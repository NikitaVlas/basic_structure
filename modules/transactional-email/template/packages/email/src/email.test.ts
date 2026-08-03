import assert from "node:assert/strict";
import test from "node:test";
import { ConsoleEmailTransport } from "./console.js";
import { passwordResetEmail, verificationEmail } from "./templates.js";

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
