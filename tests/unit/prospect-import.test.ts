import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/domain/csv";
import { guessMapping, prepareImportRows, sourceResolver } from "@/lib/domain/prospect-import";
import { LEAD_SOURCES } from "@/lib/domain/constants";

const resolve = sourceResolver([...LEAD_SOURCES.list, { value: "podcast_guests", label: "Podcast guests" }]);

describe("parseCsv", () => {
  it("handles quotes, commas, newlines, CRLF and a BOM", () => {
    const rows = parseCsv('﻿Business,Notes\r\n"Acme, Inc","said ""hi""\nthen left"\r\nBeta,\r\n');
    expect(rows).toEqual([
      ["Business", "Notes"],
      ["Acme, Inc", 'said "hi"\nthen left'],
      ["Beta", ""],
    ]);
  });
});

describe("guessMapping", () => {
  it("maps common header spellings", () => {
    const m = guessMapping(["Company Name", "Contact", "E-mail", "Mobile", "Website", "LinkedIn URL", "Instagram", "Industry", "City", "Lead Source", "Notes"]);
    expect(m).toEqual({
      business_name: 0,
      contact_name: 1,
      email: 2,
      phone: 3,
      website: 4,
      linkedin_url: 5,
      instagram_url: 6,
      industry: 7,
      location: 8,
      lead_source: 9,
      research_notes: 10,
    });
  });

  it("leaves unknown headers unmapped", () => {
    expect(guessMapping(["foo", "bar"])).toEqual({});
  });
});

describe("prepareImportRows", () => {
  const mapping = { business_name: 0, email: 1, phone: 2, website: 3, location: 4, lead_source: 5 };

  it("validates rows and resolves sources (built-in and custom)", () => {
    const rows = prepareImportRows(
      [
        ["Acme Dental", "hi@acme.example", "+91 98765 43210", "https://acme.example", "Pune", "Google Maps"],
        ["", "x@y.example", "", "", "", ""],
        ["Bad Email Co", "not-an-email", "123", "", "", "Podcast guests"],
        ["Mystery", "", "", "", "", "Carrier pigeon"],
      ],
      mapping,
      resolve,
    );
    expect(rows[0]).toMatchObject({ rowNumber: 2, sourceKey: "google_maps", errors: [], duplicateOfRow: null });
    expect(rows[0].keys.website_domain).toBe("acme.example");
    expect(rows[1].errors).toContain("Business name is missing");
    expect(rows[2].errors).toHaveLength(2);
    expect(rows[2].sourceKey).toBe("podcast_guests");
    expect(rows[3].sourceKey).toBe("other");
    expect(rows[3].warnings.join(" ")).toMatch(/Unknown source/);
    expect(rows[3].warnings).toContain("No contact details");
  });

  it("flags duplicates within the same file", () => {
    const rows = prepareImportRows(
      [
        ["Acme Dental", "hi@acme.example", "", "https://acme.example", "", ""],
        ["Acme Dental Clinic", "", "", "http://www.acme.example/contact", "", ""],
        ["Other", "HI@ACME.EXAMPLE", "", "", "", ""],
      ],
      mapping,
      resolve,
    );
    expect(rows[1].duplicateOfRow).toBe(2);
    expect(rows[2].duplicateOfRow).toBe(2);
  });

  it("caps the number of rows", () => {
    const many = Array.from({ length: 20 }, (_, i) => [`B${i}`]);
    expect(prepareImportRows(many, { business_name: 0 }, resolve, { maxRows: 5 })).toHaveLength(5);
  });
});
