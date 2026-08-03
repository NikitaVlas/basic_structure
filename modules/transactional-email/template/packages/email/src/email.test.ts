import assert from "node:assert/strict";
import test from "node:test";
import { ConsoleEmailTransport } from "./console.js";
import { passwordResetEmail, verificationEmail } from "./templates.js";
import { openEmail, sealEmail } from "./outbox-crypto.js";
import { readEmailWorkerConfig, retryDelayMs } from "./worker-config.js";

test("templates safely encode opaque tokens", () => {
  const message = verificationEmail("person@example.test", "a&b=<token>", {
    PUBLIC_APP_URL: "https://app.example.test/base/"
  });
  assert.match(message.text, /token=a%26b%3D%3Ctoken%3E/);
  assert.doesNotMatch(message.html, /<token>/);
  assert.match(message.html, /token=a%26b%3D%3Ctoken%3E/);
});

test("password reset email communicates expiry and unsolicited-request handling", () => {
  const message = passwordResetEmail("person@example.test", "opaque", {
    PUBLIC_APP_URL: "https://app.example.test"
  });
  assert.match(message.text, /30 minutes/);
  assert.match(message.text, /ignore this email/i);
});

test("console transport never logs recipients or message contents", async () => {
  const output: string[] = [];
  const original = console.log;
  console.log = (...values) => output.push(values.join(" "));
  try {
    await new ConsoleEmailTransport().send({
      to: "private@example.test",
      template: "reset-password",
      subject: "secret subject",
      text: "token-is-secret",
      html: "<p>token-is-secret</p>"
    });
  } finally {
    console.log = original;
  }
  const logged = output.join("\n");
  assert.match(logged, /transactional_email_captured/);
  assert.match(logged, /reset-password/);
  assert.doesNotMatch(logged, /private@example\.test|secret subject|token-is-secret/);
});

test("outbox encryption round-trips without exposing the token", () => {
  const env = { EMAIL_OUTBOX_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"), PUBLIC_APP_URL: "https://app.example.test" };
  const original = verificationEmail("private@example.test", "raw-secret-token", env);
  const sealed = sealEmail(original, env);
  assert.doesNotMatch(sealed.ciphertext, /private@example\.test|raw-secret-token/);
  assert.deepEqual(openEmail(sealed, env), original);
  assert.throws(() => openEmail({ ...sealed, authTag: Buffer.alloc(16).toString("base64") }, env), /INVALID_OUTBOX_PAYLOAD/);
});

test("worker configuration validates bounds and caps exponential retry", () => {
  const config = readEmailWorkerConfig({ EMAIL_WORKER_BATCH_SIZE: "100", EMAIL_WORKER_MAX_ATTEMPTS: "7" });
  assert.equal(config.batchSize, 100);
  assert.equal(config.maxAttempts, 7);
  assert.equal(retryDelayMs(1, { baseRetryMs: 1000, maxRetryMs: 5000 }), 1000);
  assert.equal(retryDelayMs(10, { baseRetryMs: 1000, maxRetryMs: 5000 }), 5000);
  assert.throws(() => readEmailWorkerConfig({ EMAIL_WORKER_BATCH_SIZE: "101" }), /EMAIL_WORKER_BATCH_SIZE/);
});
