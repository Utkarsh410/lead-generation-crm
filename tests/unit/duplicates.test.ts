import { describe, expect, it } from "vitest";
import {
  computeDuplicateKeys,
  findDuplicates,
  hasAnyDuplicateKey,
  nameLocationKey,
  normalizeDomain,
  normalizeEmail,
  normalizePhone,
  type DuplicateCandidate,
} from "@/lib/domain/duplicates";

describe("normalisation", () => {
  it("normalises website domains", () => {
    expect(normalizeDomain("https://www.ABCphysio.in/contact?x=1")).toBe("abcphysio.in");
    expect(normalizeDomain("abcphysio.in")).toBe("abcphysio.in");
    expect(normalizeDomain("http://www2.abcphysio.in")).toBe("abcphysio.in");
    expect(normalizeDomain("  ")).toBeNull();
    expect(normalizeDomain(null)).toBeNull();
    expect(normalizeDomain("not a url")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });

  it("ignores shared platform domains", () => {
    expect(normalizeDomain("https://instagram.com/abc")).toBeNull();
    expect(normalizeDomain("https://www.facebook.com/abc")).toBeNull();
    expect(normalizeDomain("https://linktr.ee/abc")).toBeNull();
  });

  it("normalises emails and phones", () => {
    expect(normalizeEmail("  Priya@Example.COM ")).toBe("priya@example.com");
    expect(normalizeEmail("invalid")).toBeNull();
    expect(normalizePhone("+91 98765-43210")).toBe("9876543210");
    expect(normalizePhone("098765 43210")).toBe("9876543210");
    expect(normalizePhone("9876543210")).toBe("9876543210");
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("builds name+location keys ignoring suffixes and punctuation", () => {
    expect(nameLocationKey("ABC Physiotherapy Pvt. Ltd.", "Pune")).toBe(nameLocationKey("abc physiotherapy", " pune "));
    expect(nameLocationKey("Smith & Co", "Mumbai")).toBe("smith|mumbai");
    expect(nameLocationKey("", "Pune")).toBeNull();
  });
});

describe("findDuplicates", () => {
  const existing: DuplicateCandidate = {
    id: "p1",
    business_name: "ABC Physiotherapy",
    location: "Pune",
    stage: "contacted",
    archived_at: null,
    ...computeDuplicateKeys({
      business_name: "ABC Physiotherapy",
      location: "Pune",
      website: "abcphysio.in",
      email: "hello@abcphysio.in",
      phone: "+91 98765 43210",
      whatsapp: null,
    }),
  };

  it("matches on website, email, phone and name+location", () => {
    const keys = computeDuplicateKeys({
      business_name: "ABC Physiotherapy Pvt Ltd",
      location: "Pune",
      website: "https://www.abcphysio.in/",
      email: "HELLO@abcphysio.in",
      whatsapp: "9876543210",
    });
    const [match] = findDuplicates(keys, [existing]);
    expect(match.reasons.sort()).toEqual(["email", "name_location", "phone", "website"]);
  });

  it("matches archived prospects too (so they can be restored instead)", () => {
    const archived = { ...existing, archived_at: "2026-09-01T00:00:00Z" };
    const matches = findDuplicates(computeDuplicateKeys({ website: "abcphysio.in" }), [archived]);
    expect(matches).toHaveLength(1);
  });

  it("does not match on empty keys or the record being edited", () => {
    const empty = computeDuplicateKeys({ business_name: null });
    expect(hasAnyDuplicateKey(empty)).toBe(false);
    expect(findDuplicates(empty, [existing])).toEqual([]);
    const same = computeDuplicateKeys({ website: "abcphysio.in" });
    expect(findDuplicates(same, [existing], "p1")).toEqual([]);
  });

  it("does not match different businesses", () => {
    const keys = computeDuplicateKeys({
      business_name: "ABC Physiotherapy",
      location: "Mumbai",
      website: "abc-mumbai.in",
      email: "info@abc-mumbai.in",
      phone: "+91 91234 56789",
    });
    expect(findDuplicates(keys, [existing])).toEqual([]);
  });
});
