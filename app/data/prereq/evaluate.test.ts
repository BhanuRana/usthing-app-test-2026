import type { PrereqNode } from "../types"
import { evaluate, missingRequirements } from "./evaluate"

const c = (code: string): PrereqNode => ({ kind: "course", code })
const t = (text: string): PrereqNode => ({ kind: "text", text })
const any = (...children: PrereqNode[]): PrereqNode => ({ kind: "any", children })
const all = (...children: PrereqNode[]): PrereqNode => ({ kind: "all", children })

// COMP 3711: (COMP 2011 | COMP 2012 | COMP 2012H) AND (COMP 2711 | COMP 2711H | MATH 2343)
const comp3711 = all(
  any(c("COMP 2011"), c("COMP 2012"), c("COMP 2012H")),
  any(c("COMP 2711"), c("COMP 2711H"), c("MATH 2343")),
)

describe("evaluate", () => {
  it("is unmet with nothing completed", () => {
    expect(evaluate(comp3711, new Set())).toBe("unmet")
  })

  it("needs one option from every AND branch", () => {
    expect(evaluate(comp3711, new Set(["COMP 2012"]))).toBe("unmet")
    expect(evaluate(comp3711, new Set(["COMP 2012", "MATH 2343"]))).toBe("met")
  })

  it("treats free text as unknown, not met or unmet", () => {
    expect(evaluate(t("Level 3 in HKDSE Physics"), new Set())).toBe("unknown")
    // One verified option is enough for OR, even beside an unknown one.
    expect(evaluate(any(t("HKDSE"), c("PHYS 1111")), new Set(["PHYS 1111"]))).toBe("met")
    expect(evaluate(any(t("HKDSE"), c("PHYS 1111")), new Set())).toBe("unknown")
    // AND with an unknown part can at best be unknown...
    expect(evaluate(all(t("MSc status"), c("MATH 2111")), new Set(["MATH 2111"]))).toBe("unknown")
    // ...but a definitely-missing course still makes it unmet.
    expect(evaluate(all(t("MSc status"), c("MATH 2111")), new Set())).toBe("unmet")
  })
})

describe("missingRequirements", () => {
  it("lists only unsatisfied branches", () => {
    expect(missingRequirements(comp3711, new Set(["COMP 2011"]))).toEqual([
      "one of COMP 2711 / COMP 2711H / MATH 2343",
    ])
  })

  it("lists single courses and nested groups readably", () => {
    const tree = all(c("MATH 2111"), any(c("COMP 2011"), all(c("COMP 1021"), c("COMP 1022P"))))
    expect(missingRequirements(tree, new Set())).toEqual([
      "MATH 2111",
      "one of COMP 2011 / (COMP 1021 + COMP 1022P)",
    ])
  })

  it("is empty when met or only unverifiable", () => {
    expect(missingRequirements(comp3711, new Set(["COMP 2011", "COMP 2711"]))).toEqual([])
    expect(missingRequirements(t("MSc status"), new Set())).toEqual([])
  })
})
