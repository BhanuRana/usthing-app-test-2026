import type { PrereqNode } from "../types"
import { courseStatus, evaluate, missingGroups, missingRequirements } from "./evaluate"

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

describe("missingGroups", () => {
  it("splits required courses from pick-one groups", () => {
    expect(missingGroups(comp3711, new Set(["COMP 2011"]))).toEqual([
      { kind: "any", options: [["COMP 2711"], ["COMP 2711H"], ["MATH 2343"]] },
    ])
    expect(missingGroups(all(c("MATH 2111"), c("COMP 2011")), new Set(["COMP 2011"]))).toEqual([
      { kind: "all", code: "MATH 2111" },
    ])
  })

  it("keeps an AND inside an OR together as one option", () => {
    const tree = any(c("COMP 2011"), all(c("COMP 1021"), c("COMP 1022P")))
    expect(missingGroups(tree, new Set())).toEqual([
      { kind: "any", options: [["COMP 2011"], ["COMP 1021", "COMP 1022P"]] },
    ])
    // Half of that pair done: the option shrinks to what's left.
    expect(missingGroups(tree, new Set(["COMP 1021"]))).toEqual([
      { kind: "any", options: [["COMP 2011"], ["COMP 1022P"]] },
    ])
  })

  it("flattens nested ORs", () => {
    const tree = all(any(c("MATH 1012"), any(c("MATH 1013"), c("MATH 1014"))), c("PHYS 1111"))
    expect(missingGroups(tree, new Set())).toEqual([
      { kind: "any", options: [["MATH 1012"], ["MATH 1013"], ["MATH 1014"]] },
      { kind: "all", code: "PHYS 1111" },
    ])
  })

  it("leaves out an OR that free text might already satisfy", () => {
    // HKDSE can't be checked, so that group is "unknown", not missing; PHYS 1111 still is.
    const tree = all(any(t("HKDSE"), c("MATH 1012")), c("PHYS 1111"))
    expect(missingGroups(tree, new Set())).toEqual([{ kind: "all", code: "PHYS 1111" }])
  })

  it("lists a course named twice only once", () => {
    // LANG 3021: LANG 2010 (for DSCT only) OR LANG 2030 OR LANG 2010 (for all others)
    expect(missingGroups(any(c("LANG 2010"), c("LANG 2030"), c("LANG 2010")), new Set())).toEqual([
      { kind: "any", options: [["LANG 2010"], ["LANG 2030"]] },
    ])
    // SCIE 3500 requires SCIE 2500 twice, once with a note.
    expect(missingGroups(all(c("SCIE 2500"), c("SCIE 2500"), c("CHEM 3550")), new Set())).toEqual([
      { kind: "all", code: "SCIE 2500" },
      { kind: "all", code: "CHEM 3550" },
    ])
    // A group that a required course already satisfies adds nothing.
    expect(
      missingGroups(all(c("MATH 2111"), any(c("MATH 2111"), c("MATH 2121"))), new Set()),
    ).toEqual([{ kind: "all", code: "MATH 2111" }])
  })

  it("is empty when met or only unverifiable", () => {
    expect(missingGroups(comp3711, new Set(["COMP 2011", "COMP 2711"]))).toEqual([])
    expect(missingGroups(any(t("HKDSE"), c("PHYS 1111")), new Set())).toEqual([])
  })
})

describe("courseStatus", () => {
  it("is completed, can-take, needs or unknown", () => {
    expect(courseStatus("COMP 3711", comp3711, new Set(["COMP 3711"]))).toEqual({
      kind: "completed",
    })
    expect(courseStatus("COMP 3711", comp3711, new Set(["COMP 2011", "MATH 2343"]))).toEqual({
      kind: "can-take",
    })
    expect(courseStatus("COMP 3711", comp3711, new Set(["COMP 2011"]))).toEqual({
      kind: "needs",
      missing: 1,
    })
    expect(courseStatus("COMP 3711", comp3711, new Set())).toEqual({ kind: "needs", missing: 2 })
    expect(courseStatus("X", any(t("HKDSE"), c("PHYS 1111")), new Set())).toEqual({
      kind: "unknown",
    })
  })

  it("counts a course with no prerequisites as one you can take", () => {
    expect(courseStatus("COMP 1021", null, new Set())).toEqual({ kind: "can-take" })
  })
})
