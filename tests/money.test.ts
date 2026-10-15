// FEC names and amounts, shown in plain, readable form.
import { describe, expect, it } from "vitest";
import { orgName, usd } from "../src/lib/money";

describe("money display", () => {
  it("makes FEC names readable but keeps acronyms", () => {
    expect(orgName("COX ENTERPRISES PAC (COXPAC) INC.")).toBe("Cox Enterprises PAC (COXPAC) Inc.");
    expect(orgName("AMERICAN FEDERATION OF TEACHERS, AFL-CIO COMMITTEE ON POLITICAL EDUCATION")).toBe(
      "American Federation of Teachers, AFL-CIO Committee on Political Education",
    );
    expect(orgName("THE HOME DEPOT INC. POLITICAL ACTION COMMITTEE")).toBe("The Home Depot Inc. Political Action Committee");
    expect(orgName("SLF PAC")).toBe("SLF PAC");
    expect(orgName("GEORGIA OILMEN'S ASSOCIATION INC PAC (GOAPAC)")).toBe("Georgia Oilmen's Association Inc PAC (GOAPAC)");
    expect(orgName("AMERICAN WATERWAYS OPERATORS-PAC")).toBe("American Waterways Operators-PAC");
  });
  it("formats amounts", () => {
    expect(usd(10000)).toBe("$10,000");
    expect(usd(1885776)).toBe("$1.9 million");
    expect(usd(2000000)).toBe("$2 million");
  });
});
