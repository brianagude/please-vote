// Bills each legislator wrote, from Open States bulk files. Small made-up samples stand in for the
// real downloads, so these run without the internet (and without using up Open States requests).
import { describe, expect, it } from "vitest";
import { sessionBills } from "../pipeline/bills";

/** A fake bulk download: CSV tables by name. */
const reader = (tables: Record<string, Record<string, string>[]>) => (name: string) => tables[name] ?? [];

const org = [
  { id: "o-up", classification: "upper" },
  { id: "o-low", classification: "lower" },
];

describe("bills from bulk files", () => {
  it("Georgia: the author comes from the General Assembly's sponsor order, not the file's", () => {
    const read = reader({
      bills: [{ id: "b1", identifier: "SB 135", title: "Paternity", classification: "['bill']" }],
      organizations: org,
      // The file lists Strickland first, but Georgia's official order has Kirkpatrick as #1.
      bill_sponsorships: [
        { bill_id: "b1", person_id: "p-strickland", primary: "True" },
        { bill_id: "b1", person_id: "p-kirkpatrick", primary: "True" },
      ],
      bill_sources: [],
      bill_actions: [],
    });
    const ga = { authors: new Map([["SB 135", { author: "4910", act: "244" }]]), member: new Map([["4910", "p-kirkpatrick"], ["835", "p-strickland"]]), passed: new Set<string>() };
    const by = sessionBills(read, new Set(["p-strickland", "p-kirkpatrick"]), ga);
    expect(by["p-strickland"]).toBeUndefined();
    expect(by["p-kirkpatrick"]?.map((b) => b.id)).toEqual(["SB 135"]);
  });

  it("Georgia: a veto number means vetoed, not law; only recorded passage votes count as passing", () => {
    const read = reader({
      bills: [
        { id: "b1", identifier: "SB 569", title: "Tow permits", classification: "['bill']" },
        { id: "b2", identifier: "SB 28", title: "Red tape", classification: "['bill']" },
      ],
      organizations: org,
      bill_sponsorships: [],
      bill_sources: [],
      bill_actions: [
        // Open States calls Georgia's veto a "signature", and marks a recommitted bill as passing the House.
        { bill_id: "b1", date: "2026-05-12", classification: "['executive-signature']", organization_id: "o-up", order: "9" },
        { bill_id: "b2", date: "2025-04-04", classification: "['passage']", organization_id: "o-low", order: "9" },
      ],
    });
    const ga = {
      authors: new Map([
        ["SB 569", { author: "835", act: "V12" }],
        ["SB 28", { author: "835", act: "" }],
      ]),
      member: new Map([["835", "p"]]),
      passed: new Set(["Senate|SB 569", "House|SB 569", "Senate|SB 28"]),
    };
    const [sb569, sb28] = sessionBills(read, new Set(["p"]), ga)["p"];
    expect(sb569).toMatchObject({ vetoed: true, law: null, house: true, senate: true });
    expect(sb28).toMatchObject({ house: false, senate: true, law: null });
  });

  it("New York: one primary sponsor, and the bill's own history for passing, vetoes, and laws", () => {
    const read = reader({
      bills: [
        { id: "b1", identifier: "S 8938", title: "Local thing", classification: "['bill']" },
        { id: "b2", identifier: "S 1", title: "Vetoed thing", classification: "['bill']" },
        { id: "b3", identifier: "J 5", title: "A resolution", classification: "['resolution']" },
      ],
      organizations: org,
      bill_sponsorships: [
        { bill_id: "b1", person_id: "p-ober", primary: "True" },
        { bill_id: "b1", person_id: "p-other", primary: "False" },
        { bill_id: "b2", person_id: "p-ober", primary: "True" },
        { bill_id: "b3", person_id: "p-ober", primary: "True" },
      ],
      bill_sources: [{ bill_id: "b1", url: "https://www.nysenate.gov/legislation/bills/2025/S8938" }],
      bill_actions: [
        { bill_id: "b1", date: "2026-01-16", classification: "['referral-committee']", organization_id: "o-up", order: "1" },
        { bill_id: "b1", date: "2026-06-02", classification: "['passage']", organization_id: "o-up", order: "2" },
        { bill_id: "b1", date: "2026-06-03", classification: "['passage']", organization_id: "o-low", order: "3" },
        { bill_id: "b2", date: "2025-03-01", classification: "['passage']", organization_id: "o-up", order: "1" },
        { bill_id: "b2", date: "2025-11-01", classification: "['executive-veto']", organization_id: "o-up", order: "2" },
      ],
    });
    const mine = sessionBills(read, new Set(["p-ober"]))["p-ober"];
    expect(mine.map((b) => b.id)).toEqual(["S 8938", "S 1"]); // resolutions don't count
    expect(mine[0]).toMatchObject({ house: true, senate: true, law: null, introduced: "2026-01-16", url: "https://www.nysenate.gov/legislation/bills/2025/S8938" });
    expect(mine[1]).toMatchObject({ vetoed: true, law: null });
  });
});
