import type { PrereqNode } from "../types"

/**
 * Three-valued result: a free-text requirement ("Level 3 in HKDSE Physics") can't be checked
 * against the user's completed courses, so it is `unknown` rather than guessed.
 */
export type RequirementStatus = "met" | "unmet" | "unknown"

/**
 * Evaluates a prerequisite tree against the courses the user has completed.
 *
 *   course -> met if completed, else unmet
 *   text   -> unknown
 *   all    -> unmet if any child is unmet; else unknown if any is unknown; else met
 *   any    -> met if any child is met; else unknown if any is unknown; else unmet
 *
 * This is Kleene's three-valued logic. It only looks at the one tree passed in (a course's
 * direct prerequisites), so there is no recursion across courses and no cycle to worry about:
 * whether you *completed* COMP 2011 is a fact, not something re-derived from its own prerequisites.
 */
export function evaluate(node: PrereqNode, completed: ReadonlySet<string>): RequirementStatus {
  switch (node.kind) {
    case "course":
      return completed.has(node.code) ? "met" : "unmet"
    case "text":
      return "unknown"
    case "all": {
      const results = node.children.map((c) => evaluate(c, completed))
      if (results.includes("unmet")) return "unmet"
      return results.includes("unknown") ? "unknown" : "met"
    }
    case "any": {
      const results = node.children.map((c) => evaluate(c, completed))
      if (results.includes("met")) return "met"
      return results.includes("unknown") ? "unknown" : "unmet"
    }
  }
}

/**
 * What is still missing, as short human-readable items:
 *   all(MATH 2111, any(COMP 2011, COMP 2012)) with nothing completed
 *   -> ["MATH 2111", "one of COMP 2011 / COMP 2012"]
 * Satisfied branches are skipped; unverifiable text is not listed as missing.
 */
export function missingRequirements(node: PrereqNode, completed: ReadonlySet<string>): string[] {
  if (evaluate(node, completed) !== "unmet") return []
  switch (node.kind) {
    case "course":
      return [node.code]
    case "text":
      return []
    case "all":
      return node.children.flatMap((c) => missingRequirements(c, completed))
    case "any":
      return [`one of ${node.children.map(describe).join(" / ")}`]
  }
}

function describe(node: PrereqNode): string {
  switch (node.kind) {
    case "course":
      return node.code
    case "text":
      return node.text
    default:
      return `(${node.children.map(describe).join(node.kind === "all" ? " + " : " / ")})`
  }
}

/**
 * What is still missing, as course codes the user could act on (e.g. star them):
 *   - `all`: one course that is required outright;
 *   - `any`: pick one of `options`, each a list of courses taken together, so
 *     one of COMP 2011 / (COMP 1021 + COMP 1022P) -> options [[COMP 2011], [COMP 1021, COMP 1022P]].
 * Nested ORs flatten into their parent's options. Where an option itself contains an OR, its
 * first way of being satisfied stands in for it. Free text isn't actionable and is left out,
 * as are courses already completed; a group left with nothing to offer is dropped.
 */
export type MissingGroup = { kind: "all"; code: string } | { kind: "any"; options: string[][] }

export function missingGroups(node: PrereqNode, completed: ReadonlySet<string>): MissingGroup[] {
  return dedupe(collectMissing(node, completed))
}

/**
 * The data sometimes names a course twice with different notes (LANG 2010 "for DSCT only" /
 * "for all others"). Each required course appears once, each option once per group, and a
 * group already covered by a required course is dropped.
 */
function dedupe(groups: MissingGroup[]): MissingGroup[] {
  const required = new Set(groups.flatMap((g) => (g.kind === "all" ? [g.code] : [])))
  const seen = new Set<string>()
  const out: MissingGroup[] = []
  for (const g of groups) {
    if (g.kind === "all") {
      if (!seen.has(g.code)) out.push(g)
      seen.add(g.code)
      continue
    }
    const options = g.options.filter(
      (o, i) => g.options.findIndex((p) => p.join("+") === o.join("+")) === i,
    )
    if (options.some((o) => o.every((c) => required.has(c)))) continue
    out.push({ kind: "any", options })
  }
  return out
}

function collectMissing(node: PrereqNode, completed: ReadonlySet<string>): MissingGroup[] {
  if (evaluate(node, completed) !== "unmet") return []
  switch (node.kind) {
    case "course":
      return [{ kind: "all", code: node.code }]
    case "text":
      return []
    case "all":
      return node.children.flatMap((c) => collectMissing(c, completed))
    case "any": {
      const options = orOptions(node)
        .map((codes) => codes.filter((code) => !completed.has(code)))
        .filter((codes) => codes.length > 0)
      if (options.length === 0) return []
      if (options.length === 1 && options[0].length === 1)
        return [{ kind: "all", code: options[0][0] }]
      return [{ kind: "any", options }]
    }
  }
}

/** The alternatives of an OR node, with nested ORs flattened in. */
function orOptions(node: PrereqNode): string[][] {
  switch (node.kind) {
    case "course":
      return [[node.code]]
    case "text":
      return []
    case "any":
      return node.children.flatMap(orOptions)
    case "all": {
      const codes = firstPath(node)
      return codes.length ? [codes] : []
    }
  }
}

/** One way to satisfy a node: every course of an AND, the first workable option of an OR. */
function firstPath(node: PrereqNode): string[] {
  switch (node.kind) {
    case "course":
      return [node.code]
    case "text":
      return []
    case "all":
      return node.children.flatMap(firstPath)
    case "any":
      for (const child of node.children) {
        const path = firstPath(child)
        if (path.length) return path
      }
      return []
  }
}

/**
 * Where a course stands for a student, from their completed courses:
 *   - `completed`: done;
 *   - `can-take`: every prerequisite is met (or it has none);
 *   - `needs`: something is still missing (`missing` groups, as in `missingGroups`);
 *   - `unknown`: what's left can't be checked (free text such as an HKDSE result).
 */
export type CourseStatus =
  | { kind: "completed" }
  | { kind: "can-take" }
  | { kind: "needs"; missing: number }
  | { kind: "unknown" }

export function courseStatus(
  code: string,
  tree: PrereqNode | null,
  completed: ReadonlySet<string>,
): CourseStatus {
  if (completed.has(code)) return { kind: "completed" }
  if (!tree) return { kind: "can-take" }
  switch (evaluate(tree, completed)) {
    case "met":
      return { kind: "can-take" }
    case "unknown":
      return { kind: "unknown" }
    case "unmet":
      return { kind: "needs", missing: Math.max(1, missingGroups(tree, completed).length) }
  }
}
