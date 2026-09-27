import type { PrereqGraph, PrereqNode } from "../types"
import { buildCourseMap, lineage, MAP_SIZES } from "./map"

const c = (code: string): PrereqNode => ({ kind: "course", code })
const t = (text: string): PrereqNode => ({ kind: "text", text })
const any = (...children: PrereqNode[]): PrereqNode => ({ kind: "any", children })
const all = (...children: PrereqNode[]): PrereqNode => ({ kind: "all", children })

/** A graph where every course has one version, with the reverse index built from the trees. */
function graphOf(trees: Record<string, PrereqNode>): PrereqGraph {
  const exprs: PrereqNode[] = []
  const byCourse: PrereqGraph["byCourse"] = {}
  const unlocks: PrereqGraph["unlocks"] = {}
  const codesIn = (n: PrereqNode): string[] =>
    n.kind === "course" ? [n.code] : n.kind === "text" ? [] : n.children.flatMap(codesIn)
  for (const [code, tree] of Object.entries(trees)) {
    byCourse[code] = [[[0], exprs.push(tree) - 1]]
    for (const p of codesIn(tree)) (unlocks[p] ??= []).push(code)
  }
  return { exprs, byCourse, unlocks }
}

// 3711 needs (2011 | 2012) and 2711; 2011 needs 1021; 2012 needs 1021 + 1022 (all).
// 3711 leads to 4211 and 4611.
const g = graphOf({
  "COMP 3711": all(any(c("COMP 2011"), c("COMP 2012")), c("COMP 2711")),
  "COMP 2011": c("COMP 1021"),
  "COMP 2012": all(c("COMP 1021"), c("COMP 1022")),
  "COMP 4211": c("COMP 3711"),
  "COMP 4611": all(c("COMP 3711"), t("Year 4 standing")),
})

const byId = (map: ReturnType<typeof buildCourseMap>) =>
  Object.fromEntries(map.nodes.map((n) => [n.id, n]))

describe("buildCourseMap", () => {
  it("puts prerequisites left, the course at 0 and what it leads to right", () => {
    const n = byId(buildCourseMap(g, "COMP 3711"))
    expect(n["COMP 3711"].rank).toBe(0)
    expect(n["COMP 2711"].rank).toBe(-1)
    expect(n["COMP 2011"].rank).toBe(-1)
    expect(n["COMP 1021"].rank).toBe(-2)
    expect(n["COMP 4211"].rank).toBe(1)
    expect(n["COMP 4611"].rank).toBe(1)
  })

  it("makes a junction for a 'one of' group, half a column before its course", () => {
    const map = buildCourseMap(g, "COMP 3711")
    const junction = map.nodes.find((n) => n.kind === "any")!
    expect(junction.rank).toBe(-0.5)
    const into = map.edges.filter((e) => e.to === junction.id).map((e) => e.from)
    expect(into.sort()).toEqual(["COMP 2011", "COMP 2012"])
    expect(map.edges).toContainEqual({ from: junction.id, to: "COMP 3711", loop: false })
    // A top-level "all of" needs no junction: 2711 feeds 3711 directly.
    expect(map.edges).toContainEqual({ from: "COMP 2711", to: "COMP 3711", loop: false })
  })

  it("points every non-loop edge to the right", () => {
    const map = buildCourseMap(g, "COMP 3711")
    const n = byId(map)
    for (const e of map.edges.filter((x) => !x.loop)) expect(n[e.from].x).toBeLessThan(n[e.to].x)
  })

  it("never overlaps two nodes in a column", () => {
    const map = buildCourseMap(g, "COMP 3711")
    const columns = new Map<number, typeof map.nodes>()
    for (const node of map.nodes)
      (columns.get(node.x) ?? columns.set(node.x, []).get(node.x)!).push(node)
    for (const col of columns.values()) {
      col.sort((a, b) => a.y - b.y)
      for (let i = 1; i < col.length; i++) {
        const gap = col[i].y - col[i].height / 2 - (col[i - 1].y + col[i - 1].height / 2)
        expect(gap).toBeGreaterThanOrEqual(MAP_SIZES.gap - 0.001)
      }
    }
  })

  it("shows one side only when asked", () => {
    const prereqs = buildCourseMap(g, "COMP 3711", { mode: "prerequisites" })
    expect(prereqs.nodes.some((x) => x.rank > 0)).toBe(false)
    const leads = buildCourseMap(g, "COMP 3711", { mode: "leads" })
    expect(leads.nodes.map((x) => x.id).sort()).toEqual(["COMP 3711", "COMP 4211", "COMP 4611"])
  })

  it("flags required free text, not free text offered as an alternative", () => {
    const g2 = graphOf({
      A: all(c("B"), t("Year 3 standing")),
      C: any(c("B"), t("an A-Level pass")),
    })
    expect(byId(buildCourseMap(g2, "A")).A.otherRequirements).toBe(true)
    expect(byId(buildCourseMap(g2, "C")).C.otherRequirements).toBeUndefined()
  })

  it("marks a prerequisite loop instead of following it", () => {
    const loop = graphOf({ "UCMP 6030": c("UCMP 6040"), "UCMP 6040": c("UCMP 6030") })
    const map = buildCourseMap(loop, "UCMP 6030")
    expect(map.edges).toContainEqual({ from: "UCMP 6040", to: "UCMP 6030", loop: false })
    // 6030 is also a prerequisite of 6040 (and 6040 is what 6030 leads to): both close the loop.
    expect(map.edges.filter((e) => e.loop).length).toBeGreaterThan(0)
    expect(map.nodes).toHaveLength(2)
  })

  it("lays out a course with no prerequisites and nothing after it", () => {
    const map = buildCourseMap(graphOf({}), "SOLO 1000")
    expect(map.nodes).toEqual([expect.objectContaining({ id: "SOLO 1000", rank: 0, x: 0, y: 0 })])
    expect(map.columns).toEqual([{ rank: 0, x: 0 }])
  })
})

describe("buildCourseMap with a trail", () => {
  // A -> leads to B, C;  B -> D, E;  D -> F;  C -> B (so B is also one of C's leads).
  const chain = graphOf({
    B: c("A"),
    C: c("A"),
    D: c("B"),
    E: c("B"),
    F: c("D"),
    X: all(c("C"), c("B")),
  })

  it("adds a column of leads-to courses for each course on the trail", () => {
    const map = buildCourseMap(chain, "A", { trail: ["B", "D"] })
    const n = byId(map)
    expect(map.trail).toEqual(["B", "D"])
    expect([n.B.rank, n.C.rank]).toEqual([1, 1])
    expect([n.D.rank, n.E.rank, n.X.rank]).toEqual([2, 2, 2])
    expect(n.F.rank).toBe(3)
    for (const e of map.edges) expect(n[e.from].x).toBeLessThan(n[e.to].x)
  })

  it("only expands one branch: a sibling's leads stay hidden", () => {
    const n = byId(buildCourseMap(chain, "A", { trail: ["C"] }))
    expect(n.X.rank).toBe(2) // C's lead
    expect(n.D).toBeUndefined() // B's leads aren't shown
  })

  it("stops at the first trail entry that isn't in the right column", () => {
    expect(buildCourseMap(chain, "A", { trail: ["D"] }).trail).toEqual([]) // D isn't a direct lead
    expect(buildCourseMap(chain, "A", { trail: ["B", "F"] }).trail).toEqual(["B"]) // F is D's
  })

  it("doesn't draw an expansion back into a course already on the map", () => {
    // C leads to X, and X also needs B, which sits in C's own column: no edge B -> X from
    // expanding C, and nothing moves.
    const map = buildCourseMap(chain, "A", { trail: ["C"] })
    const n = byId(map)
    expect(n.B.rank).toBe(1)
    for (const e of map.edges) expect(n[e.from].x).toBeLessThan(n[e.to].x)
  })

  it("ignores the trail when only prerequisites are shown", () => {
    const map = buildCourseMap(chain, "B", { mode: "prerequisites", trail: ["D"] })
    expect(map.trail).toEqual([])
    expect(map.nodes.map((x) => x.id).sort()).toEqual(["A", "B"])
  })
})

describe("lineage", () => {
  it("lights up what a course needs and what it feeds, not its siblings", () => {
    const map = buildCourseMap(g, "COMP 3711")
    const ids = lineage(map, "COMP 2011")
    expect(ids.has("COMP 1021")).toBe(true) // upstream
    expect(ids.has("COMP 3711")).toBe(true) // downstream, through the junction
    expect(ids.has("COMP 4211")).toBe(true)
    expect(ids.has("COMP 2012")).toBe(false) // the other option
    expect(ids.has("COMP 2711")).toBe(false)
  })
})
