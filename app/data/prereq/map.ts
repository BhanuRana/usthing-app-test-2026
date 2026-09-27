import type { PrereqGraph, PrereqNode } from "../types"
import { prereqTreeFor, unlockedBy } from "./traverse"

/** Which side of the focus course to draw. */
export type MapMode = "prerequisites" | "both" | "leads"

export interface MapNode {
  /** The course code, or a generated id for a junction. */
  id: string
  /** A course, or a junction where a "one of" / "all of" group meets. */
  kind: "course" | "any" | "all"
  /** Column: negative = prerequisites (further left = further back), 0 = focus, 1 = leads to. */
  rank: number
  /** Centre of the node, in map units (one unit = one point at 100% zoom). */
  x: number
  y: number
  width: number
  height: number
  /** A course whose prerequisites also include free text (HKDSE results etc.). */
  otherRequirements?: boolean
}

export interface MapEdge {
  from: string
  to: string
  /** Closes a prerequisite loop; drawn differently and ignored by the layout. */
  loop: boolean
}

export interface CourseMap {
  focus: string
  nodes: MapNode[]
  edges: MapEdge[]
  /** Extent of all nodes, in map units. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  /** The course columns (integer ranks) present, left to right, with their x. */
  columns: { rank: number; x: number }[]
}

export const MAP_SIZES = {
  course: { width: 196, height: 64 },
  junction: { width: 68, height: 26 },
  /** Horizontal distance between course columns. */
  column: 300,
  /** Minimum vertical space between nodes in a column. */
  gap: 22,
} as const

/**
 * Lays out the prerequisites of `focus` (and/or the courses it leads to) as a left-to-right
 * graph.
 *
 * Structure: every course in the prerequisite chain is expanded once. Its tree becomes edges
 * into it; a "one of" group with several options becomes a junction the options feed into,
 * and an "all of" group nested inside one becomes an "all" junction. Free text is left out
 * (the course is flagged instead). "Leads to" shows only the courses that list `focus`
 * directly: transitively it explodes (MATH 1020 reaches 295 courses in three steps).
 *
 * Columns: a course sits one column left of the leftmost course it is a prerequisite for
 * (longest path), so every edge points right; junctions sit half a column before the course
 * they feed. Edges that would close a loop (UCMP 6030 <-> UCMP 6040) are kept but marked,
 * and don't take part in the layout.
 *
 * Rows: working outwards from the focus, each node aims for the average height of the nodes
 * it connects to, then the column is spread to a minimum gap and re-centred on those aims,
 * which keeps most edges close to straight.
 */
export function buildCourseMap(
  graph: PrereqGraph,
  focus: string,
  options: { mode?: MapMode; term?: number } = {},
): CourseMap {
  const { mode = "both", term } = options
  const nodes = new Map<string, Omit<MapNode, "x" | "y" | "rank">>()
  const edges: MapEdge[] = []
  const edgeKeys = new Set<string>()
  const order: string[] = [] // discovery order, for stable tie-breaks

  const addNode = (id: string, kind: MapNode["kind"]) => {
    if (nodes.has(id)) return
    const size = kind === "course" ? MAP_SIZES.course : MAP_SIZES.junction
    nodes.set(id, { id, kind, ...size })
    order.push(id)
  }
  const addEdge = (from: string, to: string) => {
    const key = `${from}>${to}`
    if (from === to || edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push({ from, to, loop: false })
  }

  addNode(focus, "course")

  if (mode !== "leads") {
    const expanded = new Set<string>()
    const queue = [focus]
    let junctions = 0

    // Connects `node` so that it feeds into `target`.
    const attach = (node: PrereqNode, target: string) => {
      switch (node.kind) {
        case "course":
          addNode(node.code, "course")
          addEdge(node.code, target)
          queue.push(node.code)
          return
        case "text": {
          const owner = nodes.get(target)
          if (owner?.kind === "course") owner.otherRequirements = true
          return
        }
        case "any":
        case "all": {
          const parts = node.children.filter((c) => c.kind !== "text")
          // Free text required alongside courses flags the target; free text offered as an
          // alternative ("or an A-Level pass") doesn't add a requirement.
          if (node.kind === "all" && node.children.length > parts.length) {
            attach({ kind: "text", text: "" }, target)
          }
          if (parts.length === 0) return
          if (parts.length === 1) return attach(parts[0], target)
          const id = `${node.kind}#${++junctions}`
          addNode(id, node.kind)
          addEdge(id, target)
          parts.forEach((p) => attach(p, id))
        }
      }
    }

    while (queue.length) {
      const code = queue.shift()!
      if (expanded.has(code)) continue
      expanded.add(code)
      const tree = prereqTreeFor(graph, code, code === focus ? term : undefined)
      if (!tree) continue
      // A top-level "all of" needs no junction: each part feeds the course directly.
      if (tree.kind === "all") tree.children.forEach((c) => attach(c, code))
      else attach(tree, code)
    }
  }

  if (mode !== "prerequisites") {
    for (const code of unlockedBy(graph, focus)) {
      addNode(code, "course")
      addEdge(focus, code)
    }
  }

  // Loops: walk prerequisites backwards from the focus; an edge into a node that is still
  // on the walk's stack closes a loop. This also catches a leads-to edge into a course that
  // is itself a prerequisite (the walk reaches it, then the focus, still on the stack).
  const into = new Map<string, MapEdge[]>()
  const outOf = new Map<string, MapEdge[]>()
  for (const e of edges) {
    ;(into.get(e.to) ?? into.set(e.to, []).get(e.to)!).push(e)
    ;(outOf.get(e.from) ?? outOf.set(e.from, []).get(e.from)!).push(e)
  }
  const state = new Map<string, "active" | "done">()
  const walk = (id: string) => {
    state.set(id, "active")
    for (const e of into.get(id) ?? []) {
      if (state.get(e.from) === "active") e.loop = true
      else if (!state.has(e.from)) walk(e.from)
    }
    state.set(id, "done")
  }
  walk(focus)

  // Ranks: focus 0; leads-to +1; prerequisites by longest path, half a column per junction.
  const rank = new Map<string, number>([[focus, 0]])
  const step = (from: string, to: string) =>
    nodes.get(from)!.kind !== "course" || nodes.get(to)!.kind !== "course" ? 0.5 : 1
  const rankOf = (id: string, seen: Set<string>): number => {
    const known = rank.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) return 0
    seen.add(id)
    const targets = (outOf.get(id) ?? []).filter((e) => !e.loop)
    let r = targets.length
      ? Math.min(...targets.map((e) => rankOf(e.to, seen) - step(e.from, e.to)))
      : 1 // only reached from the focus: a leads-to course
    // Courses stay in whole columns (a course fed through two junctions lands a column back).
    if (nodes.get(id)!.kind === "course" && !Number.isInteger(r)) r = Math.floor(r)
    seen.delete(id)
    rank.set(id, r)
    return r
  }
  for (const id of order) rankOf(id, new Set())

  // Rows, column by column outwards from the focus.
  const y = new Map<string, number>([[focus, 0]])
  const byRank = new Map<number, string[]>()
  for (const id of order) {
    const r = rank.get(id)!
    ;(byRank.get(r) ?? byRank.set(r, []).get(r)!).push(id)
  }
  const neighboursToward = (id: string, r: number) =>
    r < 0
      ? (outOf.get(id) ?? []).filter((e) => !e.loop).map((e) => e.to)
      : (into.get(id) ?? []).filter((e) => !e.loop).map((e) => e.from)
  const ranks = [...byRank.keys()]
  const placeColumn = (r: number) => {
    const ids = byRank.get(r)!
    const aim = new Map<string, number>()
    for (const id of ids) {
      const placed = neighboursToward(id, r).filter((n) => y.has(n))
      aim.set(id, placed.length ? placed.reduce((s, n) => s + y.get(n)!, 0) / placed.length : 0)
    }
    ids.sort((a, b) => aim.get(a)! - aim.get(b)! || order.indexOf(a) - order.indexOf(b))
    let prevBottom = -Infinity
    const pos: number[] = []
    for (const id of ids) {
      const h = nodes.get(id)!.height
      const top = Math.max(aim.get(id)! - h / 2, prevBottom + MAP_SIZES.gap)
      pos.push(top + h / 2)
      prevBottom = top + h
    }
    const drift = pos.reduce((s, p, i) => s + (p - aim.get(ids[i])!), 0) / ids.length
    ids.forEach((id, i) => y.set(id, pos[i] - drift))
  }
  ranks
    .filter((r) => r < 0)
    .sort((a, b) => b - a)
    .forEach(placeColumn)
  ranks
    .filter((r) => r > 0)
    .sort((a, b) => a - b)
    .forEach(placeColumn)

  const laidOut: MapNode[] = order.map((id) => ({
    ...nodes.get(id)!,
    rank: rank.get(id)!,
    x: rank.get(id)! * MAP_SIZES.column,
    y: y.get(id)!,
  }))
  const bounds = {
    minX: Math.min(...laidOut.map((n) => n.x - n.width / 2)),
    minY: Math.min(...laidOut.map((n) => n.y - n.height / 2)),
    maxX: Math.max(...laidOut.map((n) => n.x + n.width / 2)),
    maxY: Math.max(...laidOut.map((n) => n.y + n.height / 2)),
  }
  const columns = [...new Set(laidOut.filter((n) => n.kind === "course").map((n) => n.rank))]
    .sort((a, b) => a - b)
    .map((r) => ({ rank: r, x: r * MAP_SIZES.column }))

  return { focus, nodes: laidOut, edges, bounds, columns }
}

/**
 * Everything connected to `id` through non-loop edges: what it needs (upstream) and what it
 * feeds (downstream). Used to light up a selected node's lineage.
 */
export function lineage(map: CourseMap, id: string): Set<string> {
  const out = new Set([id])
  const follow = (start: string, forward: boolean) => {
    const stack = [start]
    while (stack.length) {
      const cur = stack.pop()!
      for (const e of map.edges) {
        if (e.loop) continue
        const [from, to] = forward ? [e.from, e.to] : [e.to, e.from]
        if (from === cur && !out.has(to)) {
          out.add(to)
          stack.push(to)
        }
      }
    }
  }
  follow(id, true)
  follow(id, false)
  return out
}
