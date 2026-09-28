import { describe, expect, it } from "vitest";
import {
  PERSONALIZE_WARNING,
  buildTemplateVariables,
  checkPersonalization,
  findPlaceholders,
  renderTemplate,
  splitName,
} from "@/lib/domain/templates";

describe("renderTemplate", () => {
  it("replaces known variables", () => {
    const r = renderTemplate("Hi {{first_name}}, about {{ company_name }}!", {
      first_name: "Priya",
      company_name: "Acme",
    });
    expect(r.text).toBe("Hi Priya, about Acme!");
    expect(r.missing).toEqual([]);
    expect(r.unknown).toEqual([]);
  });

  it("leaves missing values as placeholders and reports them", () => {
    const r = renderTemplate("Hi {{first_name}} — {{specific_problem}}", { first_name: "  " });
    expect(r.text).toBe("Hi {{first_name}} — {{specific_problem}}");
    expect(r.missing.sort()).toEqual(["first_name", "specific_problem"]);
  });

  it("reports unknown placeholders without touching them", () => {
    const r = renderTemplate("Hello {{nickname}}", {});
    expect(r.text).toBe("Hello {{nickname}}");
    expect(r.unknown).toEqual(["nickname"]);
  });

  it("is case-insensitive for variable names and handles empty templates", () => {
    expect(renderTemplate("{{First_Name}}", { first_name: "A" }).text).toBe("A");
    expect(renderTemplate(null, {}).text).toBe("");
  });

  it("does not interpret $ patterns in values", () => {
    expect(renderTemplate("{{company_name}}", { company_name: "Cash $& Co" }).text).toBe("Cash $& Co");
  });
});

describe("variables from prospect data", () => {
  it("splits names and strips honorifics", () => {
    expect(splitName("Dr. Anil Kumar Mehta")).toEqual({ first: "Anil", last: "Kumar Mehta" });
    expect(splitName("")).toEqual({ first: "", last: "" });
    expect(splitName(null)).toEqual({ first: "", last: "" });
  });

  it("builds variables and applies non-empty overrides", () => {
    const vars = buildTemplateVariables(
      {
        contact_name: "Priya Shah",
        business_name: "Acme Clinic",
        industry: "Healthcare",
        observed_problem: "No online booking on the website.",
        suggested_solution: "Booking system with reminders",
        potential_project: "web_application",
      },
      { service_area: "physiotherapy", first_name: "" },
    );
    expect(vars.first_name).toBe("Priya");
    expect(vars.last_name).toBe("Shah");
    expect(vars.specific_problem).toBe("no online booking on the website");
    expect(vars.potential_solution).toBe("booking system with reminders");
    expect(vars.project_type).toBe("Web Application");
    expect(vars.service_area).toBe("physiotherapy");
  });

  it("keeps acronyms intact", () => {
    const vars = buildTemplateVariables({ observed_problem: "SEO is weak" });
    expect(vars.specific_problem).toBe("SEO is weak");
  });
});

describe("personalisation checks", () => {
  it("always warns on generic templates", () => {
    const r = checkPersonalization({ isGenericTemplate: true, renderedTemplate: "Hi A", finalMessage: "Hi A, loved your reel" });
    expect(r.warnings).toContain(PERSONALIZE_WARNING);
    expect(r.hasUnfilledPlaceholders).toBe(false);
  });

  it("flags unfilled placeholders and unchanged generic messages", () => {
    const r = checkPersonalization({
      isGenericTemplate: true,
      renderedTemplate: "Hi {{first_name}}",
      finalMessage: "Hi  {{first_name}}",
    });
    expect(r.hasUnfilledPlaceholders).toBe(true);
    expect(r.warnings.some((w) => w.includes("{{first_name}}"))).toBe(true);
    expect(r.warnings.some((w) => w.includes("identical"))).toBe(true);
  });

  it("finds placeholders", () => {
    expect(findPlaceholders("a {{x}} b {{ y }} {{x}}")).toEqual(["x", "y"]);
    expect(findPlaceholders("")).toEqual([]);
  });
});

describe("audiencesForProspect", () => {
  it("prioritises the prospect type, then industry, then general", async () => {
    const { audiencesForProspect } = await import("@/lib/domain/templates");
    expect(audiencesForProspect({ prospect_type: "seo_agency" })).toEqual(["seo_agency", "general"]);
    expect(audiencesForProspect({ prospect_type: "direct_business", industry: "Dental clinic" })).toEqual([
      "direct_business",
      "healthcare",
      "general",
    ]);
    expect(audiencesForProspect({ prospect_type: "web_design_agency" })).toEqual(["marketing_agency", "general"]);
    expect(audiencesForProspect({})).toEqual(["direct_business", "general"]);
  });
});
