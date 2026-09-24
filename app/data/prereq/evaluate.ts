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
