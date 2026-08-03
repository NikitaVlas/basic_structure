import { expect, test } from "@playwright/test";
import { waitForApplicationLink } from "../support/mailpit.js";

test("registration, email verification, recovery, and session revocation", async ({ page, browser }) => {
  const email = `browser-${Date.now()}@example.test`;
  const initialPassword = "CorrectHorse7";
  const replacementPassword = "Replacement7Password";

  await page.goto("/");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(initialPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText("Your email is not verified.")).toBeVisible();

  const verificationLink = await waitForApplicationLink(email, "/verify-email");
  await page.goto(verificationLink);
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText("Your email is not verified.")).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");

  const resetLink = await waitForApplicationLink(email, "/reset-password");
  await page.goto(resetLink);
  await page.getByRole("textbox", { name: "New password", exact: true }).fill(replacementPassword);
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("status")).toContainText("Password changed");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(replacementPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();

  const secondaryContext = await browser.newContext();
  const secondary = await secondaryContext.newPage();
  await secondary.goto("/");
  await secondary.getByLabel("Email").fill(email);
  await secondary.getByLabel("Password").fill(replacementPassword);
  await secondary.getByRole("button", { name: "Sign in" }).click();
  await expect(secondary.getByRole("heading", { name: "Account" })).toBeVisible();

  await page.reload();
  const otherSession = page.locator(".security-list li:not(:has(.badge))").first();
  await expect(otherSession).toBeVisible();
  await otherSession.getByRole("button", { name: "Revoke" }).click();
  await expect(otherSession).toHaveCount(0);
  await secondary.reload();
  await expect(secondary.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await secondaryContext.close();

  await page.reload();
  await expect(page.getByText("email verified")).toBeVisible();
  await expect(page.getByText("password reset", { exact: true })).toBeVisible();
  await expect(page.getByText("session revoked")).toBeVisible();
});

test("keyboard focus and mobile layout remain usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Password")).toBeFocused();
  const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
