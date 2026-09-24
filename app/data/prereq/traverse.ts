import type { PrereqGraph, PrereqNode } from "../types"
import { referencedCodes } from "./parse"

/**
 * The prerequisite tree for `code` as of `term` (an index into CatalogIndex.terms).
 * Falls back to the newest version when the course has no entry for that term, e.g.
 * a prerequisite course that is not offered this semester.
 */
export function prereqTreeFor(graph: PrereqGraph, code: string, term?: number): PrereqNode | null {
  const versions = graph.byCourse[code]
  if (!versions?.length) return null
  const match = term === undefined ? undefined : versions.find(([terms]) => terms.includes(term))
  return graph.exprs[(match ?? versions[0])[1]]
}

export type ExpansionState =
  /** Has prerequisites, safe to expand. */
  | "expandable"
  /** No prerequisites recorded: a leaf. */
  | "none"
  /** Already an ancestor on this branch: expanding it would loop forever. */
  | "cycle"

/**
 * Decides whether a course node inside the tree may be expanded.
 *
 * The UI expands one level at a time, so there is no recursion to run away. What must not
 * happen is a branch re-entering itself (UCMP 6030 -> UCMP 6040 -> UCMP 6030 exists in the
 * data). Each rendered node carries its ancestor path; a code already on that path is a cycle.
 * The same course appearing on *different* branches is fine and stays expandable.
 */
export function expansionState(
  graph: PrereqGraph,
  code: string,
  ancestors: readonly string[],
  term?: number,
): ExpansionState {
  if (ancestors.includes(code)) return "cycle"
  return prereqTreeFor(graph, code, term) ? "expandable" : "none"
}

export interface ChainEntry {
  code: string
  /** Shortest number of prerequisite hops from the root course. */
  depth: number
}

/**
 * Every course reachable through prerequisites, breadth-first, each listed once at its
 * shallowest depth. A visited set makes this terminate on cycles and shared subtrees
 * without exploring either twice. It treats AND and OR alike ("could be involved"), which
 * suits a "full chain" overview; the tree view keeps the exact AND/OR structure.
 */
export function prerequisiteChain(graph: PrereqGraph, root: string, term?: number): ChainEntry[] {
  const visited = new Set([root])
  const out: ChainEntry[] = []
  let frontier = [root]
  for (let depth = 1; frontier.length > 0; depth++) {
    const next: string[] = []
    for (const code of frontier) {
      // Only the root is pinned to the selected term; deeper levels use their newest version.
      const tree = prereqTreeFor(graph, code, code === root ? term : undefined)
      for (const ref of referencedCodes(tree)) {
        if (visited.has(ref)) continue
        visited.add(ref)
        out.push({ code: ref, depth })
        next.push(ref)
      }
    }
    frontier = next
  }
  return out
}

/** Courses whose prerequisites mention `code`, i.e. what taking it helps unlock. */
export function unlockedBy(graph: PrereqGraph, code: string): string[] {
  return graph.unlocks[code] ?? []
}
