import type { PrereqGraph, PrereqNode } from "../types"
import { expansionState, prereqTreeFor, prerequisiteChain, unlockedBy } from "./traverse"

const c = (code: string): PrereqNode => ({ kind: "course", code })
const any = (...children: PrereqNode[]): PrereqNode => ({ kind: "any", children })
const all = (...children: PrereqNode[]): PrereqNode => ({ kind: "all", children })

/**
 * A 4211 -> {2011, MATH 2111}; 2011 -> 1021 | 1022P (shared with 2012);
 * X <-> Y is a cycle, SELF lists itself; 3000 changed its prerequisite between terms.
 */
const graph: PrereqGraph = {
  exprs: [
    all(c("COMP 2011"), c("MATH 2111")),
    any(c("COMP 1021"), c("COMP 1022P")),
    c("UCMP 6040"),
    c("UCMP 6030"),
    c("SELF 1000"),
    c("COMP 2011"),
    c("COMP 2012"),
  ],
  byCourse: {
    "COMP 4211": [[[0], 0]],
    "COMP 2011": [[[0, 1], 1]],
    "COMP 2012": [[[0], 1]],
    "UCMP 6030": [[[0], 2]],
    "UCMP 6040": [[[0], 3]],
    "SELF 1000": [[[0], 4]],
    "COMP 3000": [
      [[0], 5],
      [[1, 2], 6],
    ],
  },
  unlocks: { "COMP 2011": ["COMP 4211"] },
}

describe("prereqTreeFor", () => {
  it("returns null for a course with no prerequisites", () => {
    expect(prereqTreeFor(graph, "COMP 1021")).toBeNull()
  })

  it("picks the version for the requested term and falls back to the newest", () => {
    expect(prereqTreeFor(graph, "COMP 3000", 2)).toEqual(c("COMP 2012"))
    expect(prereqTreeFor(graph, "COMP 3000", 0)).toEqual(c("COMP 2011"))
    expect(prereqTreeFor(graph, "COMP 3000", 3)).toEqual(c("COMP 2011"))
    expect(prereqTreeFor(graph, "COMP 3000")).toEqual(c("COMP 2011"))
  })
})

describe("expansionState", () => {
  it("marks leaves, expandable nodes and cycles", () => {
    expect(expansionState(graph, "COMP 1021", ["COMP 2011"])).toBe("none")
    expect(expansionState(graph, "COMP 2011", ["COMP 4211"])).toBe("expandable")
    expect(expansionState(graph, "UCMP 6030", ["UCMP 6030", "UCMP 6040"])).toBe("cycle")
    expect(expansionState(graph, "SELF 1000", ["SELF 1000"])).toBe("cycle")
  })

  it("allows the same course on a different branch", () => {
    // COMP 2011 is not an ancestor of itself here, only a sibling elsewhere.
    expect(expansionState(graph, "COMP 2011", ["COMP 3000"])).toBe("expandable")
  })
})

describe("prerequisiteChain", () => {
  it("lists every transitive prerequisite once at its shallowest depth", () => {
    expect(prerequisiteChain(graph, "COMP 4211")).toEqual([
      { code: "COMP 2011", depth: 1 },
      { code: "MATH 2111", depth: 1 },
      { code: "COMP 1021", depth: 2 },
      { code: "COMP 1022P", depth: 2 },
    ])
  })

  it("terminates on cycles and self-references", () => {
    expect(prerequisiteChain(graph, "UCMP 6030")).toEqual([{ code: "UCMP 6040", depth: 1 }])
    expect(prerequisiteChain(graph, "SELF 1000")).toEqual([])
  })

  it("is empty for a course with no prerequisites", () => {
    expect(prerequisiteChain(graph, "COMP 1021")).toEqual([])
  })
})

describe("unlockedBy", () => {
  it("uses the reverse index", () => {
    expect(unlockedBy(graph, "COMP 2011")).toEqual(["COMP 4211"])
    expect(unlockedBy(graph, "COMP 9999")).toEqual([])
  })
})
