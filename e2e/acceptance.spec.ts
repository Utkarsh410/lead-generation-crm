import { expect, test, type Page } from "@playwright/test";

// Walks the Week 1 acceptance workflow (brief §28) through the real UI.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD (an approved user) to run the E2E test");

function istDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

test("prospect → outreach → follow-up → reply → qualify → call → handoff → won → analytics", async ({ page }) => {
  const run = Date.now().toString(36);
  const name = `E2E Physio ${run}`;
  const domain = `e2e-${run}.example.com`;
  await signIn(page);

  // 1–4. create a prospect with links, research and opportunity score
  await page.goto("/prospects/new");
  await page.getByRole("textbox", { name: "Business name", exact: true }).fill(name);
  await page.getByLabel("Contact name", { exact: true }).fill("John Doe");
  await page.getByLabel("Job title", { exact: true }).fill("Founder");
  await page.getByLabel("Email", { exact: true }).fill(`john@${domain}`);
  await page.getByLabel("Website", { exact: true }).fill(domain);
  await page.getByLabel("Instagram URL", { exact: true }).fill("instagram.com/e2ephysio");
  await page.getByLabel("City / location", { exact: true }).fill("Pune");
  await page.getByLabel("Industry", { exact: true }).fill("Healthcare");
  await page.getByRole("combobox", { name: "Source", exact: true }).selectOption("instagram");
  await page.getByLabel("Observed problem", { exact: true }).fill("Current website does not support online appointment booking.");
  await page.getByLabel("Suggested solution", { exact: true }).fill("New website with appointment booking");
  await page.getByLabel("Potential project", { exact: true }).selectOption("website");
  await page.getByLabel("Estimated value (₹)", { exact: true }).fill("1.5L");
  await page.getByLabel("Clear business problem", { exact: true }).selectOption("3");
  await page.getByLabel("Website / software gap", { exact: true }).selectOption("3");
  await page.getByLabel("Potential development requirement", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Create prospect" }).click();
  await page.waitForURL(/\/prospects\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  const prospectUrl = page.url().split("?")[0];

  // duplicate detection
  await page.goto("/prospects/new");
  await page.getByRole("textbox", { name: "Business name", exact: true }).fill(`${name} again`);
  await page.getByLabel("Website", { exact: true }).fill(`https://www.${domain}/contact`);
  await page.getByRole("button", { name: "Create prospect" }).click();
  await expect(page.getByText("Potential duplicate prospect found.")).toBeVisible();
  await expect(page.getByRole("link", { name })).toBeVisible();

  // 5–8. compose from a template, personalise, record as sent → follow-up created
  await page.goto(prospectUrl);
  await page.getByRole("link", { name: "Compose first message" }).click();
  await page.waitForURL("**/outreach/new**");
  await page.getByLabel("Channel", { exact: true }).selectOption("email");
  await page.getByRole("button", { name: /Direct Business — First Contact/ }).click();
  await expect(page.getByText("Personalize this message before sending.")).toBeVisible();
  const record = page.getByRole("button", { name: "I sent this — record it" });
  await expect(record).toBeDisabled(); // {{personalized_observation}} still unfilled
  await page.getByRole("textbox", { name: /personalized_observation/ }).fill("your clinic's 4.9★ Google rating");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(/4\.9★ Google rating/);
  await expect(record).toBeEnabled();
  await record.click();
  await page.waitForURL(prospectUrl);
  await expect(page.getByText("Contacted").first()).toBeVisible();
  await expect(page.getByText(`Follow-up #1 — ${name}`, { exact: true })).toBeVisible();

  // 9. record the response
  await page.getByRole("button", { name: "Update" }).first().click();
  await page.getByLabel("Response", { exact: true }).selectOption("interested");
  await page.getByLabel("Notes", { exact: true }).fill("Wants to talk this week");
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(page.getByText("Qualify this lead")).toBeVisible();

  // 10. qualify
  await page.getByRole("link", { name: "Qualify", exact: true }).first().click();
  await page.waitForURL("**/qualification/new**");
  for (const group of ["Need clarity", "Budget fit", "Timeline fit", "Decision-maker access", "Urgency"]) {
    await page.getByRole("radiogroup", { name: group }).getByRole("radio", { name: "5" }).click();
  }
  await page.getByLabel("Budget min (₹)", { exact: true }).fill("1L");
  await page.getByLabel("Budget max (₹)", { exact: true }).fill("2L");
  await page.getByLabel("Timeline notes", { exact: true }).fill("4–6 weeks");
  await page.getByLabel("Decision maker identified", { exact: true }).check();
  await page.getByLabel("Decision maker name / role", { exact: true }).fill("John Doe (Founder)");
  await page.getByRole("button", { name: "Save qualification" }).click();
  await page.waitForURL(prospectUrl);
  await expect(page.getByText("Prepare BharatCoder handoff").first()).toBeVisible();

  // 11–12. move through the pipeline: schedule a discovery call
  await page.getByRole("button", { name: "Stage", exact: true }).click();
  await page.getByLabel("Move to", { exact: true }).selectOption("discovery_call");
  await page.getByLabel("Call date", { exact: true }).fill(istDate(1));
  await page.getByLabel("Time (optional)", { exact: true }).fill("11:30");
  await page.getByRole("button", { name: "Move to Discovery Call" }).click();
  await expect(page.getByText(/Discovery call — /).first()).toBeVisible();

  // 13–14. prepare and copy the handoff
  await page.getByRole("button", { name: "Prepare handoff" }).first().click();
  await page.getByLabel("Notes for BharatCoder (optional)", { exact: true }).fill("Client is interested in discussing requirements this week.");
  await page.getByRole("button", { name: "Generate handoff" }).click();
  await page.waitForURL("**/handoffs/**");
  await expect(page.getByLabel("Handoff summary", { exact: true })).toHaveValue(/## BharatCoder Lead Handoff[\s\S]*₹1L–2L/);
  await page.getByRole("button", { name: "Copy as text" }).click();
  await expect(page.getByRole("button", { name: "Copy as text" })).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("BHARATCODER LEAD HANDOFF");
  expect(clip).toContain(name);
  await page.getByLabel("Status", { exact: true }).selectOption("sent");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Handoff saved")).toBeVisible();

  // 15. track until Won
  await page.goto(prospectUrl);
  await page.getByRole("button", { name: "Stage", exact: true }).click();
  await page.getByLabel("Move to", { exact: true }).selectOption("won");
  await page.getByRole("button", { name: "Move to Won" }).click();
  await expect(page.getByText("Track payments & commission")).toBeVisible();
  await expect(page.getByText("Stage: Discovery Call → Won")).toBeVisible();

  // pipeline board shows it in Won
  await page.goto("/pipeline");
  await expect(page.getByRole("region", { name: "Won column" }).getByRole("link", { name })).toBeVisible();

  // 16. analytics + exports
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
  const csv = await page.request.get("/api/export/qualified");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(name);
});
