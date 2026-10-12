// Core flows that must keep working before anything is released.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const MOCK = fs.readFileSync(path.join(__dirname, "mock-firebase.js"), "utf8");

async function setUp(page, time = "2026-10-12T14:10:00") {
  await page.clock.install({ time: new Date(time) });
  await page.goto("/");
  await page.fill("#ob-name", "Dan");
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Build my day" }).click();
  await expect(page).toHaveURL(/#day/);
  await page.getByRole("button", { name: "Today", exact: true }).click();
}

test("setup builds a day and Today shows it", async ({ page }) => {
  const errors = []; page.on("pageerror", e => errors.push(e.message));
  await setUp(page);
  await expect(page.locator("#today-h")).toHaveText("Good afternoon, Dan");
  await expect(page.locator("#routines .routine, #routines .pastcard")).not.toHaveCount(0);
  expect(errors).toEqual([]);
});

test("ticking a habit updates progress and survives a reload", async ({ page }) => {
  await setUp(page);
  const sub = page.locator("#today-sub");
  await expect(sub).toContainText(/0 of \d+ done/);
  await page.locator(".hab .tick").first().click();
  await expect(sub).toContainText(/1 of \d+ done/);
  await page.reload();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(sub).toContainText(/1 of \d+ done/);
});

test("Not today drops a habit from the total and can be undone", async ({ page }) => {
  await setUp(page);
  const sub = page.locator("#today-sub");
  const total = Number((await sub.innerText()).match(/of (\d+) done/)[1]);
  await page.locator(".skipbtn").first().click();
  await expect(sub).toContainText(`0 of ${total - 1} done`);
  await expect(page.locator(".hab.skipped")).toHaveCount(1);
  await page.locator(".hab.skipped .skipbtn").click();
  await expect(sub).toContainText(`0 of ${total} done`);
});

test("Build shows one part of the day at a time and can switch to editing", async ({ page }) => {
  await setUp(page);
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.locator("#plan .chunk")).toHaveCount(1);
  await page.locator("#plan .daytabs").getByText("Evening").click();
  await expect(page.locator("#plan .chunk h2")).toHaveText("Evening");
  await page.locator("#edit-toggle").click();
  await expect(page.locator("#plan .ename").first()).toBeVisible();
  await expect(page.locator("#edit-toggle")).toHaveText("Done");
  await expect(page.locator(".dt-add")).toBeVisible();
  await page.locator("#edit-toggle").click();
  await expect(page.locator(".dt-add")).toHaveCount(0);
});

test("sign-in screen, email link, and first sign-in brings this device's data across", async ({ page }) => {
  // Swap the real Firebase SDK for an in-memory stand-in and pretend this is a preview copy
  await page.route("**/vendor/firebase-app-compat.js", r => r.fulfill({ contentType: "text/javascript", body: MOCK }));
  await page.route(/vendor\/firebase-(auth|firestore)-compat\.js/, r => r.fulfill({ contentType: "text/javascript", body: "" }));
  await page.route("**/firebase-config.js", r => r.fulfill({ contentType: "text/javascript", body: 'window.STACK_ENV="preview";window.STACK_FIREBASE={apiKey:"test",projectId:"demo"};' }));
  await page.clock.install({ time: new Date("2026-10-12T14:10:00") });
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("stack:data:v1", JSON.stringify({ seedVersion: 99, c: {
    settings: { main: { onboarded: true, name: "Dan", chunks: [{ id: "morning", name: "Morning", time: "08:30" }] } },
    anchors: { a1: { name: "Wake up", slot: "morning", order: 1, kind: "wake", duration: 5 } },
    habits: {}, checkins: {}, weeks: {} } })));
  await page.reload();
  await expect(page.locator(".gate")).toBeVisible();
  await page.fill(".gate input", "dan@example.com");
  await page.click(".gate button[type=submit]");
  await expect(page.locator(".gate h1")).toHaveText("Check your email");
  await page.goto(await page.evaluate(() => window.__sentLink));
  await expect(page.locator(".gate")).toHaveCount(0);
  await expect(page.locator("#today-h")).toHaveText("Good afternoon, Dan");
  await page.click("#profile-btn");
  await expect(page.locator(".acct-who")).toHaveText("Signed in as dan@example.com");
});

test("profile page edits the name and interests", async ({ page }) => {
  await setUp(page);
  await page.click("#profile-btn");
  await expect(page).toHaveURL(/#profile/);
  const name = page.locator("#profile .namefield input");
  await name.fill("Daniel");
  await name.press("Enter");
  await expect(page.locator(".pf-name")).toHaveText("Daniel");
  await expect(page.locator("#avatar-i")).toHaveText("D");
  const chip = page.locator("#profile .chip").first();
  const before = await chip.getAttribute("aria-pressed");
  await chip.click();
  await expect(chip).not.toHaveAttribute("aria-pressed", before);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.locator("#today-h")).toHaveText("Good afternoon, Daniel");
});
