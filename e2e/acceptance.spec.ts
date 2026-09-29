import { expect, test, type Page } from "@playwright/test";

// Walks the LeadOS acceptance workflow through the real UI: partner & service →
// prospect → outreach → reply → qualify → opportunities → pipeline → partner
// handoff → won → client & project → payments & commission → search → CSV.

const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
test.skip(!EMAIL || !PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD (an approved user) to run the E2E test");

function localDate(offsetDays = 0, timeZone = "Asia/Kolkata") {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(d);
}

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/dashboard");
}

async function expectNoVendorBranding(page: Page) {
  await expect(page.locator("body")).not.toContainText(/bharatcoder|hariom/i);
}

test("partner → prospect → outreach → qualify → opportunities → handoff → won → client → payments → search → CSV", async ({ page }) => {
  test.setTimeout(240_000);
  const run = Date.now().toString(36);
  const name = `E2E Physio ${run}`;
  const partnerName = `E2E Partner ${run}`;
  const serviceName = `E2E Website ${run}`;
  const domain = `e2e-${run}.example.com`;
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" && !/React DevTools|Failed to load resource/.test(m.text())) pageErrors.push(`${page.url()}: ${m.text().slice(0, 500)}`);
  });
  await signIn(page);
  await expectNoVendorBranding(page);

  // partner + service (user-created, generic)
  await page.goto("/partners");
  await page.getByRole("button", { name: "New partner" }).click();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(partnerName);
  await page.getByLabel("Contact person", { exact: true }).fill("Ravi");
  await page.getByLabel("Email", { exact: true }).fill(`ravi@${domain}`);
  await page.getByLabel("Status", { exact: true }).selectOption("active");
  await page.getByRole("button", { name: "Save" }).click();
  await page.waitForURL(/\/partners\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: partnerName })).toBeVisible();

  await page.goto("/services");
  await page.getByRole("button", { name: "New service" }).click();
  await page.getByRole("textbox", { name: "Service name", exact: true }).fill(serviceName);
  await page.getByLabel("Delivery model", { exact: true }).selectOption("partner_delivered");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(serviceName)).toBeVisible();

  // create a prospect with research + lead score
  await page.goto("/prospects/new");
  await page.getByRole("textbox", { name: "Business name", exact: true }).fill(name);
  await page.getByLabel("Contact name", { exact: true }).fill("John Doe");
  await page.getByLabel("Job title", { exact: true }).fill("Founder");
  await page.getByLabel("Email", { exact: true }).fill(`john@${domain}`);
  await page.getByLabel("Website", { exact: true }).fill(domain);
  await page.getByLabel("City / location", { exact: true }).fill("Pune");
  await page.getByLabel("Industry", { exact: true }).fill("Healthcare");
  await page.getByRole("combobox", { name: "Source", exact: true }).selectOption("instagram");
  await page.getByLabel("Observed problem", { exact: true }).fill("Current website does not support online appointment booking.");
  await page.getByLabel("Suggested solution", { exact: true }).fill("New website with appointment booking");
  await page.getByLabel("Estimated value (INR)", { exact: true }).fill("2L");
  await page.getByLabel("Clear business problem", { exact: true }).selectOption("3");
  await page.getByRole("button", { name: "Create prospect" }).click();
  await page.waitForURL(/\/prospects\/[0-9a-f-]{36}\?created=1/);
  await expect(page.getByRole("heading", { name }), pageErrors.join("\n")).toBeVisible();
  const prospectUrl = page.url().split("?")[0];

  // duplicate detection
  await page.goto("/prospects/new");
  await page.getByRole("textbox", { name: "Business name", exact: true }).fill(`${name} again`);
  await page.getByLabel("Website", { exact: true }).fill(`https://www.${domain}/contact`);
  await page.getByRole("button", { name: "Create prospect" }).click();
  await expect(page.getByText("Potential duplicate prospect found.")).toBeVisible();

  // compose from a generic template, personalise, record as sent → follow-up created
  await page.goto(prospectUrl);
  await page.getByRole("link", { name: "Compose first message" }).click();
  await page.waitForURL("**/outreach/new**");
  await page.getByLabel("Channel", { exact: true }).selectOption("email");
  await page.getByRole("button", { name: /Direct business — first contact/ }).click();
  await expect(page.getByText("Personalize this message before sending.")).toBeVisible();
  const record = page.getByRole("button", { name: "I sent this — record it" });
  await expect(record).toBeDisabled(); // {{observation}} still unfilled
  await page.getByRole("textbox", { name: /\{\{observation\}\}/ }).fill("your clinic's 4.9★ Google rating");
  await page.getByRole("textbox", { name: /\{\{service\}\}/ }).fill("online booking");
  await expect(page.getByLabel("Message", { exact: true })).toHaveValue(/4\.9★ Google rating/);
  await expect(page.getByLabel("Message", { exact: true })).not.toHaveValue(/bharatcoder/i);
  await expect(record).toBeEnabled();
  await record.click();
  await page.waitForURL(prospectUrl);
  await expect(page.getByText(`Follow-up #1 — ${name}`, { exact: true })).toBeVisible();

  // reply
  await page.getByRole("button", { name: "Update" }).first().click();
  await page.getByLabel("Response", { exact: true }).selectOption("interested");
  await page.getByRole("button", { name: "Save response" }).click();
  await expect(page.getByText("Qualify this lead")).toBeVisible();

  // qualify on all seven criteria → lead Qualified + first opportunity
  await page.getByRole("link", { name: "Qualify", exact: true }).first().click();
  await page.waitForURL("**/qualification/new**");
  for (const group of ["Need clarity", "Budget", "Timeline", "Decision-maker access", "Urgency", "Solution fit", "Delivery feasibility"]) {
    await page.getByRole("radiogroup", { name: group, exact: true }).getByRole("radio", { name: "5" }).click();
  }
  await page.getByLabel("Budget min (INR)", { exact: true }).fill("1L");
  await page.getByLabel("Budget max (INR)", { exact: true }).fill("2L");
  await page.getByLabel("Timeline notes", { exact: true }).fill("4–6 weeks");
  await page.getByLabel("Decision maker identified", { exact: true }).check();
  await page.getByLabel("Decision maker name / role", { exact: true }).fill("John Doe (Founder)");
  await page.getByRole("button", { name: "Save qualification" }).click();
  await page.waitForURL(prospectUrl);
  const oppSection = page.locator("#opportunities");
  await expect(oppSection.getByText("Qualified", { exact: true })).toBeVisible();

  // set service, partner, delivery model and explicit commission terms on the opportunity
  await oppSection.getByRole("link").first().click();
  await page.waitForURL(/\/opportunities\/[0-9a-f-]{36}$/);
  const oppUrl = page.url();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByRole("textbox", { name: "Opportunity name", exact: true }).fill("Website + booking");
  await page.getByLabel("Service", { exact: true }).selectOption({ label: serviceName });
  await page.getByLabel("Delivery model", { exact: true }).selectOption("partner_delivered");
  await page.getByLabel("Partner", { exact: true }).selectOption({ label: partnerName });
  await page.getByLabel("Estimated value (INR)", { exact: true }).fill("200000");
  await page.getByLabel("Revenue model", { exact: true }).selectOption("partner_commission");
  await page.getByLabel("Commission", { exact: true }).selectOption("percentage");
  await page.getByLabel("Commission %", { exact: true }).fill("10");
  await expect(page.getByText("Choose what the commission is calculated on (the basis).")).toBeVisible(); // no default basis
  await page.getByLabel("Commission basis", { exact: true }).selectOption("amount_received");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("10% of amount received")).toBeVisible();

  // a second opportunity for the same prospect
  await page.goto(prospectUrl);
  await oppSection.getByRole("button", { name: "New" }).click();
  await page.getByRole("textbox", { name: "Opportunity name", exact: true }).fill("Local SEO retainer");
  await page.getByLabel("Delivery model", { exact: true }).selectOption("referral");
  await page.getByRole("button", { name: "Create opportunity" }).click();
  await page.waitForURL(/\/opportunities\/[0-9a-f-]{36}$/);
  await page.goto(prospectUrl);
  await expect(oppSection.getByRole("link", { name: "Local SEO retainer" })).toBeVisible();
  await expect(oppSection.getByRole("link", { name: "Website + booking" })).toBeVisible();

  // pipeline: discovery call → proposal
  await page.goto(oppUrl);
  await page.getByRole("button", { name: "Change stage" }).click();
  await page.getByLabel("Move to", { exact: true }).selectOption({ label: "Discovery" });
  await page.getByLabel("Call date (optional)", { exact: true }).fill(localDate(1));
  await page.getByLabel("Time", { exact: true }).fill("11:30");
  await page.getByRole("button", { name: "Move to Discovery" }).click();
  await expect(page.getByText(/Discovery call — /).first()).toBeVisible();
  await page.getByRole("button", { name: "Change stage" }).click();
  await page.getByLabel("Move to", { exact: true }).selectOption({ label: "Proposal" });
  await page.getByRole("button", { name: "Move to Proposal" }).click();
  await expect(page.getByText(/Follow up on proposal — /).first()).toBeVisible();

  // partner handoff (copyable, generic)
  await page.getByRole("button", { name: "Prepare handoff" }).click();
  await expect(page.getByLabel("Partner", { exact: true })).toHaveValue(/.+/); // taken from the opportunity
  await page.getByLabel("Notes for the partner (optional)", { exact: true }).fill("Client wants to start this month.");
  await page.getByRole("button", { name: "Generate handoff" }).click();
  await page.waitForURL("**/handoffs/**");
  await expect(page.getByLabel("Handoff summary", { exact: true })).toHaveValue(/## Opportunity Handoff[\s\S]*Website \+ booking[\s\S]*₹1L–2L/);
  await page.getByRole("button", { name: "Copy as text" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain("OPPORTUNITY HANDOFF");
  expect(clip).toContain(partnerName);
  expect(clip).not.toMatch(/bharatcoder/i);
  await page.getByLabel("Status", { exact: true }).selectOption("sent");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Handoff saved")).toBeVisible();

  // board shows the deal; move to Won → convert to client + project
  await page.goto("/opportunities");
  await expect(page.getByRole("region", { name: "Proposal column" }).getByRole("link", { name: "Website + booking" })).toBeVisible();
  await page.goto(oppUrl);
  await page.getByRole("button", { name: "Change stage" }).click();
  await page.getByLabel("Move to", { exact: true }).selectOption({ label: "Won" });
  await page.getByRole("button", { name: "Move to Won" }).click();
  await expect(page.getByText("Won!")).toBeVisible();
  await page.getByRole("button", { name: "Convert to client" }).first().click();
  await page.getByRole("button", { name: "Convert", exact: true }).click();
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: "Website + booking" })).toBeVisible();
  await expect(page.getByText("10% of amount received")).toBeVisible();

  // payments → commission (₹200,000 project, 10% on amount received, client paid ₹100,000 → ₹10,000)
  await page.getByRole("button", { name: "Add payment" }).click();
  await page.getByRole("textbox", { name: "Amount (INR)", exact: true }).fill("100000");
  await page.getByLabel("Type", { exact: true }).selectOption("advance");
  await page.getByLabel("Status", { exact: true }).selectOption("received");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Payment added")).toBeVisible();
  expect(pageErrors).toEqual([]);
  const commissionRow = page.getByText("Commission earned", { exact: true }).last().locator("..");
  await expect(commissionRow).toContainText("₹10,000");

  // change the basis → commission recalculates
  await page.getByRole("button", { name: "Edit project & terms" }).click();
  await page.getByLabel("Commission basis", { exact: true }).selectOption("total_project_value");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Project saved")).toBeVisible();
  await expect(commissionRow).toContainText("₹20,000");

  // client has the project; a second project can be added
  await page.getByRole("link", { name }).first().click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("link", { name: "Website + booking" })).toBeVisible();

  // global search
  await page.goto(`/search?q=${encodeURIComponent(run)}`);
  await expect(page.getByText(/Prospects \(\d+\)/)).toBeVisible();
  await expect(page.getByText(/Clients \(\d+\)/)).toBeVisible();
  await expect(page.getByText(/Partners \(\d+\)/)).toBeVisible();

  // CSV import with preview + duplicate check
  await page.goto("/prospects/import");
  const csv = `Business,Contact,Email,Website,Source\n${name},John,,${domain},Instagram\nImported ${run},Asha,asha@${run}.example.com,,Google Maps\n,Nobody,bad,,\n`;
  // retry until the (freshly compiled) page has hydrated and picked the file up
  await expect(async () => {
    await page.getByLabel("CSV file").setInputFiles({ name: "leads.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
    await expect(page.getByText("leads.csv")).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByText("3 rows · 1 with errors")).toBeVisible();
  await page.getByRole("button", { name: "Check for duplicates" }).click();
  await expect(page.getByText(/Matches/).first()).toBeVisible();
  await page.getByRole("button", { name: "Import 1" }).click();
  await page.waitForURL("**/prospects?**");
  await expect(page.getByRole("link", { name: `Imported ${run}` })).toBeVisible();

  // dashboard, analytics, exports
  await page.goto("/dashboard");
  await expect(page.getByText("Commission earned").first()).toBeVisible();
  await expectNoVendorBranding(page);
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { name: "By acquisition channel" })).toBeVisible();
  const opps = await page.request.get("/api/export/opportunities");
  expect(opps.status()).toBe(200);
  expect(await opps.text()).toContain("Website + booking");
  const payments = await page.request.get("/api/export/payments");
  expect(await payments.text()).toContain("100000.00");
  expect(pageErrors).toEqual([]);
});
