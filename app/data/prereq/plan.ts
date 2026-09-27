import type { PrereqGraph, PrereqNode } from "../types"
import { evaluate } from "./evaluate"
import { prereqTreeFor } from "./traverse"

export interface PathCourse {
  code: string
  /** When picked from a "one of" group: the other courses that would also do. */
  alternatives: string[]
  /** Also has requirements that aren't courses (HKDSE results, year of study...). */
  otherRequirements: boolean
}

export interface CoursePath {
  /** Courses still to take before the target, in order: step 1 can be taken now. */
  steps: PathCourse[][]
  /** Completed courses the path relies on. */
  completedUsed: string[]
  /** The target itself has requirements that aren't courses. */
  targetOtherRequirements: boolean
  /** A prerequisite loop was cut short (e.g. UCMP 6030 <-> UCMP 6040). */
  loops: boolean
}

/**
 * One concrete route to `target`: which courses to take, and in what order.
 *
 * - Completed courses are met. For a "one of" group already met, nothing more is needed.
 * - Otherwise a group picks, in order of preference: an option with a starred course (the
 *   user's own choice, e.g. from the star prompt), then the option needing the fewest
 *   courses in total (its own prerequisites included), then the first listed.
 * - Free-text alternatives ("or HKDSE Level 3") are passed over when a course option
 *   exists. Free text that is required flags its course as having other requirements (the
 *   text itself is often a parsing fragment, so the course page's "As written" has it).
 * - Each course sits one step after its latest prerequisite, so step 1 is what can be
 *   taken now and the number of steps is the shortest possible sequence of terms.
 *
 * The target uses its prerequisites for `term`; courses further down use their newest
 * version, like the prerequisite tree. Returns null if nothing is missing.
 */
export function planPath(
  graph: PrereqGraph,
  target: string,
  completed: ReadonlySet<string>,
  starred: ReadonlySet<string>,
  term?: number,
): CoursePath | null {
  if (completed.has(target)) return null
  const treeOf = (code: string) => prereqTreeFor(graph, code, code === target ? term : undefined)

  const completedUsed = new Set<string>()
  const withText = new Set<string>()
  const alternatives = new Map<string, string[]>()
  let loops = false

  // Total courses needed to take `code` (itself plus everything it still needs).
  const costMemo = new Map<string, number>()
  const costOf = (code: string, stack: Set<string>): number => {
    if (completed.has(code) || stack.has(code)) return 0
    const known = costMemo.get(code)
    if (known !== undefined) return known
    const tree = treeOf(code)
    stack.add(code)
    const cost = 1 + (tree ? nodeCost(tree, stack) : 0)
    stack.delete(code)
    costMemo.set(code, cost)
    return cost
  }
  const nodeCost = (node: PrereqNode, stack: Set<string>): number => {
    switch (node.kind) {
      case "course":
        return costOf(node.code, stack)
      case "text":
        return 0
      case "all":
        return node.children.reduce((sum, c) => sum + nodeCost(c, stack), 0)
      case "any": {
        if (evaluate(node, completed) === "met") return 0
        const costs = node.children.filter((c) => c.kind !== "text").map((c) => nodeCost(c, stack))
        return costs.length ? Math.min(...costs) : 0
      }
    }
  }

  const mentionsStarred = (node: PrereqNode): boolean =>
    node.kind === "course"
      ? starred.has(node.code)
      : node.kind !== "text" && node.children.some(mentionsStarred)

  // The courses (not yet completed) that `node`, part of `owner`'s prerequisites, directly
  // requires, choosing within ORs.
  const select = (node: PrereqNode, owner: string, stack: Set<string>): string[] => {
    switch (node.kind) {
      case "course":
        if (completed.has(node.code)) {
          completedUsed.add(node.code)
          return []
        }
        return [node.code]
      case "text":
        withText.add(owner)
        return []
      case "all":
        return node.children.flatMap((c) => select(c, owner, stack))
      case "any": {
        const met = node.children.find((c) => c.kind !== "text" && evaluate(c, completed) === "met")
        if (met) return select(met, owner, stack)
        const options = node.children.filter((c) => c.kind !== "text")
        if (options.length === 0) {
          withText.add(owner)
          return []
        }
        const ranked = options
          .map((option, index) => ({
            option,
            index,
            starred: mentionsStarred(option) ? 0 : 1,
            cost: nodeCost(option, stack),
          }))
          .sort((a, b) => a.starred - b.starred || a.cost - b.cost || a.index - b.index)
        const chosen = ranked[0].option
        if (chosen.kind === "course") {
          alternatives.set(
            chosen.code,
            options.flatMap((o) => (o.kind === "course" && o !== chosen ? [o.code] : [])),
          )
        }
        return select(chosen, owner, stack)
      }
    }
  }

  // Walk from the target, recording each course's chosen direct prerequisites.
  const needs = new Map<string, string[]>()
  const visit = (code: string, stack: Set<string>) => {
    if (needs.has(code)) return
    const tree = treeOf(code)
    stack.add(code)
    const direct = [...new Set(tree ? select(tree, code, stack) : [])].filter((p) => {
      if (stack.has(p)) loops = true
      return !stack.has(p)
    })
    needs.set(code, direct)
    direct.forEach((p) => visit(p, stack))
    stack.delete(code)
  }
  visit(target, new Set())

  const direct = needs.get(target) ?? []
  if (direct.length === 0) return null

  // Step = 1 + the latest step among a course's prerequisites.
  const stepMemo = new Map<string, number>()
  const stepOf = (code: string): number => {
    const known = stepMemo.get(code)
    if (known !== undefined) return known
    stepMemo.set(code, 1) // provisional, in case of a loop not already cut
    const pre = needs.get(code) ?? []
    const step = pre.length ? 1 + Math.max(...pre.map(stepOf)) : 1
    stepMemo.set(code, step)
    return step
  }
  const steps: PathCourse[][] = []
  for (const code of needs.keys()) {
    if (code === target) continue
    const i = stepOf(code) - 1
    ;(steps[i] ??= []).push({
      code,
      alternatives: alternatives.get(code) ?? [],
      otherRequirements: withText.has(code),
    })
  }
  steps.forEach((s) => s.sort((a, b) => a.code.localeCompare(b.code)))

  return {
    steps: steps.filter(Boolean),
    completedUsed: [...completedUsed].sort(),
    targetOtherRequirements: withText.has(target),
    loops,
  }
}
