import type { PrereqGraph, PrereqNode } from "../types"
import { planPath } from "./plan"

const c = (code: string): PrereqNode => ({ kind: "course", code })
const t = (text: string): PrereqNode => ({ kind: "text", text })
const any = (...children: PrereqNode[]): PrereqNode => ({ kind: "any", children })
const all = (...children: PrereqNode[]): PrereqNode => ({ kind: "all", children })

/** Builds a graph where every course has one version, valid in every term. */
function graphOf(trees: Record<string, PrereqNode>): PrereqGraph {
  const exprs: PrereqNode[] = []
  const byCourse: PrereqGraph["byCourse"] = {}
  for (const [code, tree] of Object.entries(trees)) {
    byCourse[code] = [[[0, 1, 2, 3], exprs.push(tree) - 1]]
  }
  return { exprs, byCourse, unlocks: {} } as PrereqGraph
}

// A small COMP-like curriculum:
//   3711 needs (2011 | 2012 | 2012H) and (2711 | MATH 2343)
//   2011 needs 1021;  2012 needs 1021 and 1022;  2012H needs 1023
//   2711 needs MATH 1013;  MATH 2343 has none
const curriculum = graphOf({
  "COMP 3711": all(
    any(c("COMP 2011"), c("COMP 2012"), c("COMP 2012H")),
    any(c("COMP 2711"), c("MATH 2343")),
  ),
  "COMP 2011": c("COMP 1021"),
  "COMP 2012": all(c("COMP 1021"), c("COMP 1022")),
  "COMP 2012H": c("COMP 1023"),
  "COMP 2711": c("MATH 1013"),
})

const none = new Set<string>()
const codes = (steps: { code: string }[][]) => steps.map((s) => s.map((x) => x.code))

describe("planPath", () => {
  it("orders the cheapest route into steps, step 1 being what can be taken now", () => {
    const path = planPath(curriculum, "COMP 3711", none, none)!
    // 2011 (needs 1 course) beats 2012 (needs 2); MATH 2343 (none) beats 2711 (needs 1).
    expect(codes(path.steps)).toEqual([["COMP 1021", "MATH 2343"], ["COMP 2011"]])
    expect(path.steps[1][0].alternatives).toEqual(["COMP 2012", "COMP 2012H"])
  })

  it("builds on completed courses and reports them", () => {
    const path = planPath(curriculum, "COMP 3711", new Set(["COMP 1023", "COMP 2711"]), none)!
    // 2012H only needed 1023, which is done, so it's now the cheapest option.
    expect(codes(path.steps)).toEqual([["COMP 2012H"]])
    expect(path.completedUsed).toEqual(["COMP 1023", "COMP 2711"])
  })

  it("follows a starred option even when another is cheaper", () => {
    const path = planPath(curriculum, "COMP 3711", none, new Set(["COMP 2012", "COMP 2711"]))!
    expect(codes(path.steps)).toEqual([
      ["COMP 1021", "COMP 1022", "MATH 1013"],
      ["COMP 2012", "COMP 2711"],
    ])
  })

  it("lists a course shared by two branches once", () => {
    const g = graphOf({
      TOP: all(c("A"), c("B")),
      A: c("BASE"),
      B: c("BASE"),
    })
    expect(codes(planPath(g, "TOP", none, none)!.steps)).toEqual([["BASE"], ["A", "B"]])
  })

  it("puts a course after its latest prerequisite", () => {
    const g = graphOf({ TOP: all(c("DEEP"), c("SHALLOW")), DEEP: c("MID"), MID: c("LOW") })
    expect(codes(planPath(g, "TOP", none, none)!.steps)).toEqual([
      ["LOW", "SHALLOW"],
      ["MID"],
      ["DEEP"],
    ])
  })

  it("passes over free-text alternatives and flags required free text on its course", () => {
    const g = graphOf({
      TOP: all(any(t("HKDSE Level 3"), c("MATH 1012")), c("MID")),
      MID: all(c("LOW"), t("Year 3 standing")),
    })
    const path = planPath(g, "TOP", none, none)!
    expect(codes(path.steps)).toEqual([["LOW", "MATH 1012"], ["MID"]])
    expect(path.steps[1][0].otherRequirements).toBe(true)
    expect(path.steps[0].every((x) => !x.otherRequirements)).toBe(true)
    expect(path.targetOtherRequirements).toBe(false)
  })

  it("cuts prerequisite loops instead of recursing", () => {
    const g = graphOf({ "UCMP 6030": c("UCMP 6040"), "UCMP 6040": c("UCMP 6030") })
    const path = planPath(g, "UCMP 6030", none, none)!
    expect(codes(path.steps)).toEqual([["UCMP 6040"]])
    expect(path.loops).toBe(true)
  })

  it("is null when nothing is missing", () => {
    expect(planPath(curriculum, "COMP 3711", new Set(["COMP 2011", "MATH 2343"]), none)).toBeNull()
    expect(planPath(curriculum, "COMP 1021", none, none)).toBeNull()
    expect(planPath(curriculum, "COMP 3711", new Set(["COMP 3711"]), none)).toBeNull()
  })
})
