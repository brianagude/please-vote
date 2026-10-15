// Which votes appear (DECISIONS #4): final passage on bills and joint resolutions only.
import { describe, expect, it } from "vitest";
import { fedBill, gaPassage, housePassage, parseCSV, senatePassage } from "../pipeline/votes";

describe("which votes count", () => {
  it("House: passage, concur, conference, veto override; not procedure or amendments", () => {
    expect(housePassage("On Passage")).toBe("Passage");
    expect(housePassage("On Motion to Suspend the Rules and Pass, as Amended")).toBe("Passage");
    expect(housePassage("On Motion to Concur in the Senate Amendment")).toBeTruthy();
    expect(housePassage("On Agreeing to the Conference Report")).toBeTruthy();
    expect(housePassage("On Passage, Objections of the President To The Contrary Notwithstanding")).toBe("Veto override");
    for (const q of ["On Motion to Recommit", "On Agreeing to the Amendment", "On Ordering the Previous Question", "On Agreeing to the Resolution", "On Motion to Table"])
      expect(housePassage(q), q).toBeNull();
  });

  it("Senate: passage and concur; not cloture, nominations, or amendments", () => {
    expect(senatePassage("On Passage of the Bill")).toBe("Passage");
    expect(senatePassage("On the Joint Resolution")).toBe("Passage");
    expect(senatePassage("On the Motion", "Motion to Concur in the House Amendment to S. 5")).toBeTruthy();
    expect(senatePassage("On the Motion", "Motion to Table the Motion to Concur")).toBeNull();
    for (const q of ["On the Cloture Motion", "On the Nomination", "On the Amendment", "On the Motion to Proceed", "On Cloture on the Motion to Proceed"])
      expect(senatePassage(q), q).toBeNull();
  });

  it("Georgia: uses the General Assembly's caption", () => {
    for (const c of ["PASSAGE", "PASSAGE BY SUBSTITUTE", "PASSAGE AS AMENDED", "AGREE TO HOUSE SUBSTITUTE", "Agree to Senate Sub as Am", "ADOPTION"])
      expect(gaPassage(c), c).toBeTruthy();
    for (const c of ["ADOPTION OF AMENDMENT #1 BY THE SENATOR FROM THE 22ND", "ADOPTION OF AMEND #2", "MORNING ROLL CALL", "Attendance", "LOCAL CONSENT CALENDAR", "MOTION TO ENGROSS", "Reconsider", "TABLE", ""])
      expect(gaPassage(c), c).toBeNull();
  });

  it("only bills and joint resolutions", () => {
    expect(fedBill("H R 3424")).toEqual({ type: "HR", number: "3424" });
    expect(fedBill("S.J.Res. 7")).toEqual({ type: "SJRES", number: "7" });
    expect(fedBill("H J RES 12")).toEqual({ type: "HJRES", number: "12" });
    expect(fedBill("H RES 5")).toBeNull();
    expect(fedBill("S.Con.Res. 3")).toBeNull();
    expect(fedBill("PN373")).toBeNull();
  });

  it("reads CSV with quoted commas, quotes, and newlines", () => {
    expect(parseCSV('a,b\n"x, y","say ""hi""\nthere"\n1,2\n')).toEqual([
      { a: "x, y", b: 'say "hi"\nthere' },
      { a: "1", b: "2" },
    ]);
  });
});
