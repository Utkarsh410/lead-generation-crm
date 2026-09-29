import { describe, expect, it } from "vitest";
import { generateHandoff, urgencyLabel, type HandoffProspect, type HandoffQualification } from "@/lib/domain/handoff";
import { escapeCsvCell, toCsv } from "@/lib/domain/csv";
import { InvalidMoneyError, formatBudgetRange, formatMoney, formatMoneyCompact, parseMoney, sumMoney } from "@/lib/domain/money";
import { addDays, dueBucket, isIsoDate, startOfWeek, todayInTimezone } from "@/lib/domain/dates";
import { acquisitionRates, funnelCounts, rate } from "@/lib/domain/metrics";
import { recommendServices } from "@/lib/domain/service-mapping";

const prospect: HandoffProspect = {
  business_name: "ABC Physiotherapy",
  contact_name: "John Doe",
  job_title: "Founder",
  email: "john@abcphysio.in",
  phone: "+91 98765 43210",
  whatsapp: "+91 98765 43210",
  website: "https://abcphysio.in",
  location: "Pune",
  country: "India",
  industry: "Healthcare",
  prospect_type: "direct_business",
  lead_source: "instagram",
  source_url: null,
  observed_problem: "Current website does not support online appointment booking.",
  suggested_solution: "New website + appointment booking + enquiry management.",
  potential_project: "website",
  estimated_value: "150000.00",
  recommended_services: [],
};

const qualification: HandoffQualification = {
  business_model: "Clinic",
  current_technology: "WordPress site",
  problem_description: null,
  current_solution: "Phone bookings",
  whats_not_working: null,
  cost_of_inaction: null,
  project_type: "website",
  required_features: "Booking, enquiries",
  integrations: null,
  number_of_users: null,
  estimated_complexity: "medium",
  desired_launch_date: null,
  timeline_notes: "4–6 weeks",
  budget_min: "100000.00",
  budget_max: "200000.00",
  budget_notes: null,
  decision_maker_identified: true,
  decision_maker_name: "Founder",
  decision_process: null,
  other_stakeholders: null,
  urgency: 4,
  score: 75,
  classification: "qualified",
  notes: "Client is interested in discussing requirements this week.",
};

describe("handoff generation", () => {
  it("produces the handoff summary with all key sections", () => {
    const { markdown, snapshot, gaps } = generateHandoff({
      prospect,
      qualification: { ...qualification, custom_answers: [{ question: "Existing agency?", answer: "No" }] },
      opportunity: {
        title: "Website + booking",
        description: "Booking with reminders",
        estimated_value: "150000",
        delivery_model: "partner_delivered",
        service_name: "Business website",
        expected_close_date: null,
      },
      partner: { name: "PixelWorks Studio", contact_name: "Ravi", email: "ravi@pixelworks.example", phone: null },
      generatedBy: "Sam",
      generatedOn: "2026-09-28",
      sourceLabel: (s) => (s === "instagram" ? "Instagram" : s),
    });
    expect(markdown.startsWith("## Opportunity Handoff")).toBe(true);
    expect(markdown).not.toMatch(/bharatcoder/i);
    expect(snapshot.Client).toBe("ABC Physiotherapy");
    expect(snapshot.Opportunity).toBe("Website + booking");
    expect(snapshot.Service).toBe("Business website");
    expect(snapshot["Delivery model"]).toBe("Partner-delivered");
    expect(snapshot.Partner).toContain("PixelWorks Studio");
    expect(snapshot.Requirements).toContain("Booking with reminders");
    expect(snapshot["Existing agency?"]).toBe("No");
    expect(snapshot.Contact).toContain("John Doe (Founder)");
    expect(snapshot.Contact).not.toContain("WhatsApp"); // same as phone
    expect(snapshot.Problem).toContain("online appointment booking");
    expect(snapshot.Budget).toBe("₹1L–2L");
    expect(snapshot.Timeline).toBe("4–6 weeks");
    expect(snapshot["Decision maker"]).toBe("Founder");
    expect(snapshot.Urgency).toBe("High (4/5)");
    expect(snapshot.Source).toBe("Instagram");
    expect(snapshot["Prepared by"]).toBe("Sam");
    expect(snapshot.Notes).toContain("this week");
    expect(gaps).toEqual([]);
  });

  it("lists gaps when information is missing", () => {
    const { gaps, snapshot, markdown } = generateHandoff({
      prospect: { ...prospect, contact_name: null, email: null, phone: null, whatsapp: null, observed_problem: null, estimated_value: null },
      qualification: null,
      opportunity: null,
      partner: null,
      generatedBy: "",
      generatedOn: "2026-09-28",
    });
    expect(gaps).toEqual(
      expect.arrayContaining(["Contact person", "Direct contact details (email/phone)", "Problem statement", "Budget range", "Timeline", "Qualification assessment"]),
    );
    expect(snapshot.Budget).toBe("Not discussed");
    expect(markdown).toContain("**Still to confirm:**");
  });

  it("labels urgency", () => {
    expect(urgencyLabel(5)).toBe("High");
    expect(urgencyLabel(3)).toBe("Medium");
    expect(urgencyLabel(1)).toBe("Low");
    expect(urgencyLabel(null)).toBe("Unknown");
  });
});

describe("CSV export", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(escapeCsvCell('He said "hi", ok')).toBe('"He said ""hi"", ok"');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell(-5)).toBe("-5");
  });

  it("neutralises spreadsheet formulas in text", () => {
    expect(escapeCsvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(escapeCsvCell("+91 98765")).toBe("'+91 98765");
    expect(escapeCsvCell("@user")).toBe("'@user");
  });

  it("builds a CSV document with header row", () => {
    const csv = toCsv([{ a: "x", b: 1 }, { a: "y,z", b: null }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe('﻿A,B\r\nx,1\r\n"y,z",\r\n');
    expect(toCsv([], [{ header: "Only", value: () => "" }])).toBe("﻿Only\r\n");
  });
});

describe("money", () => {
  it("parses Indian formats exactly", () => {
    expect(parseMoney("150000")).toBe("150000.00");
    expect(parseMoney("1,50,000")).toBe("150000.00");
    expect(parseMoney("₹1.5L")).toBe("150000.00");
    expect(parseMoney("2 lakh")).toBe("200000.00");
    expect(parseMoney("75k")).toBe("75000.00");
    expect(parseMoney("1.2cr")).toBe("12000000.00");
    expect(parseMoney("0.1")).toBe("0.10");
    expect(parseMoney("19.999")).toBe("20.00");
    expect(parseMoney("")).toBeNull();
    expect(parseMoney(null)).toBeNull();
  });

  it("rejects invalid or negative amounts", () => {
    for (const bad of ["-100", "abc", "1.2.3", "5x", "1e5", "999999999999999"]) {
      expect(() => parseMoney(bad), bad).toThrow(InvalidMoneyError);
    }
  });

  it("formats compact and ranges in the chosen currency", () => {
    expect(formatMoneyCompact("150000.00")).toBe("₹1.5L");
    expect(formatMoneyCompact(75000)).toBe("₹75K");
    expect(formatMoneyCompact(null)).toBe("—");
    expect(formatMoneyCompact(1_500_000, "USD")).toBe("$1.5M");
    expect(formatMoneyCompact(2500, "EUR")).toBe("€2.5K");
    expect(formatMoney(200000, "INR")).toBe("₹2,00,000");
    expect(formatMoney(200000, "USD")).toBe("$200,000");
    expect(formatBudgetRange(1000, 5000, "USD")).toBe("$1K–5K");
    expect(formatBudgetRange(null, null)).toBe("Not discussed");
    expect(formatBudgetRange(100000, null)).toBe("₹1L+");
    expect(formatBudgetRange(null, 50000)).toBe("Up to ₹50K");
  });

  it("sums without floating point drift", () => {
    expect(sumMoney(["0.10", "0.20", null, "abc"])).toBe(0.3);
  });
});

describe("dates", () => {
  it("computes today in the business timezone", () => {
    // 20:00 UTC on 28 Sep is already 29 Sep in India
    expect(todayInTimezone("Asia/Kolkata", new Date("2026-09-28T20:00:00Z"))).toBe("2026-09-29");
    expect(todayInTimezone("UTC", new Date("2026-09-28T20:00:00Z"))).toBe("2026-09-28");
  });

  it("adds days, validates and buckets", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(() => addDays("2026-02-30", 1)).toThrow();
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-09-28")).toBe(true);
    expect(dueBucket("2026-09-27", "2026-09-28")).toBe("overdue");
    expect(dueBucket("2026-09-28", "2026-09-28")).toBe("today");
    expect(dueBucket("2026-09-29", "2026-09-28")).toBe("upcoming");
    expect(startOfWeek("2026-09-27")).toBe("2026-09-21"); // Sunday → Monday before
  });
});

describe("metrics", () => {
  it("counts funnel progress cumulatively, including lost prospects", () => {
    const c = funnelCounts([
      { stage: "new" },
      { stage: "contacted" },
      { stage: "replied" },
      { stage: "qualified" },
      { stage: "client" },
      { stage: "lost", reachedStage: "replied" },
      { stage: "nurture", reachedStage: "contacted" },
    ]);
    expect(c).toMatchObject({ total: 7, contacted: 6, replied: 4, qualified: 2, clients: 1, lost: 1 });
    const r = acquisitionRates(c);
    expect(r.contactRate).toBe(85.7);
    expect(r.responseRate).toBe(66.7);
    expect(r.qualificationRate).toBe(50);
    expect(r.clientRate).toBe(50);
  });

  it("returns null rates for empty data", () => {
    expect(rate(0, 0)).toBeNull();
    expect(acquisitionRates(funnelCounts([])).contactRate).toBeNull();
  });

});

describe("service mapping", () => {
  it("maps WhatsApp course material to LMS", () => {
    const [top] = recommendServices("Students currently receive course material through WhatsApp.");
    expect(top.rule.id).toBe("course-material-whatsapp");
    expect(top.rule.solutions).toContain("LMS");
  });

  it("maps spreadsheet lead management to CRM", () => {
    const [top] = recommendServices("Staff manually manage leads using spreadsheets");
    expect(top.rule.solutions).toContain("CRM");
  });

  it("returns nothing for empty text", () => {
    expect(recommendServices("")).toEqual([]);
    expect(recommendServices(null)).toEqual([]);
  });
});

describe("weeklyCounts", () => {
  it("buckets dates into Monday-start weeks ending this week", async () => {
    const { weeklyCounts } = await import("@/lib/domain/metrics");
    const r = weeklyCounts(["2026-09-28", "2026-09-27", "2026-09-21", "2026-08-01", "2026-10-05"], "2026-09-30", 3);
    expect(r).toEqual([
      { weekStart: "2026-09-14", count: 0 },
      { weekStart: "2026-09-21", count: 2 },
      { weekStart: "2026-09-28", count: 1 },
    ]);
  });
});
