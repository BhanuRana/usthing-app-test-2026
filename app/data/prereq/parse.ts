import type { PrereqNode } from "../types"

/**
 * Parses HKUST's free-text prerequisite strings into an AND/OR tree.
 *
 * It is a best-effort extractor, not a natural-language parser (the brief says one is not
 * expected). Anything that is not a course code survives as a `text` node or as a note on
 * the adjacent course, so no information is silently dropped.
 *
 * Grammar, as observed across the 787 distinct strings in the dataset:
 *   - `AND` / `OR` (any case), `()` and `[]` for grouping, ` / ` meaning OR.
 *   - `,` and `;` are separators that take on the operator used in their segment:
 *     "A, B OR C" is any(A, B, C) and "A, B, and C" is all(A, B, C).
 *   - OR binds tighter than AND. Almost every mixed string is fully parenthesised; the one
 *     that is not ("ECON 2103, ECON 2113 OR ECON 3113, AND ECON 2123 OR ECON 3123") only
 *     reads correctly this way.
 *   - "or above" / "or equivalent" are prose, not operators.
 *   - Text directly before/after a course becomes its note: "grade A- or above in MATH 1014",
 *     "MATH 1012 (prior to 2025-26)".
 */
export function parsePrerequisite(source: string): PrereqNode | null {
  const tokens = tokenize(source)
  const parser = new Parser(tokens)
  return parser.parseAll()
}

// ---------------------------------------------------------------------------------------
// Tokenizer

type Token =
  { t: "code"; v: string } | { t: "word"; v: string } | { t: "and" | "or" | "sep" | "lp" | "rp" }

const CODE = /^([A-Z]{4})\s?(\d{4}[A-Z]?)\b/
const PROSE_AFTER_OR = new Set(["above", "equivalent", "equivalence", "better", "higher"])
/** Enumerators like "(a)", "(ii)" carry no meaning for the tree. */
const ENUMERATOR = /\((?:[a-h]|i{1,3}|iv|v)\)/gi

function tokenize(source: string): Token[] {
  const s = source.replace(ENUMERATOR, " ").replace(/\s+/g, " ").trim()
  const tokens: Token[] = []
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === " ") {
      i++
      continue
    }
    if (ch === "(" || ch === "[") {
      tokens.push({ t: "lp" })
      i++
      continue
    }
    if (ch === ")" || ch === "]") {
      tokens.push({ t: "rp" })
      i++
      continue
    }
    if (ch === "," || ch === ";") {
      tokens.push({ t: "sep" })
      i++
      continue
    }
    // A slash is OR only when it stands apart ("MATH 1020 / MATH 1024");
    // inside a word ("M1/M2", "1/2x") it is part of that word.
    if (ch === "/" && (s[i - 1] === " " || s[i + 1] === " ")) {
      tokens.push({ t: "or" })
      i++
      continue
    }
    const code = CODE.exec(s.slice(i))
    if (code) {
      tokens.push({ t: "code", v: `${code[1]} ${code[2]}` })
      i += code[0].length
      continue
    }
    // Any other run of characters up to the next delimiter is a word.
    let j = i
    while (j < s.length && !" ()[],;".includes(s[j])) {
      if (s[j] === "/" && (s[j - 1] === " " || s[j + 1] === " ")) break
      j++
    }
    if (j === i) j = i + 1 // lone "/" glued to nothing: consume it as a word
    const word = s.slice(i, j)
    const lower = word.toLowerCase()
    const next = /^\s*([A-Za-z]+)/.exec(s.slice(j))?.[1]?.toLowerCase()
    if (
      (lower === "and" || lower === "or") &&
      !(lower === "or" && next && PROSE_AFTER_OR.has(next))
    ) {
      tokens.push({ t: lower })
    } else {
      tokens.push({ t: "word", v: word.replace(/\.$/, "") })
    }
    i = j
  }
  return tokens
}

// ---------------------------------------------------------------------------------------
// Parser

type Op = "and" | "or" | "sep"

/** Filler phrases that add nothing once the structure is captured. */
const FILLER = /^(one of|either|both|any of|all of|and|or)$/i

class Parser {
  private pos = 0
  constructor(private readonly tokens: Token[]) {}

  parseAll(): PrereqNode | null {
    const node = this.parseSequence()
    // Unbalanced ")" in the source: skip it and keep going rather than losing the rest.
    while (this.pos < this.tokens.length) {
      this.pos++
      const rest = this.parseSequence()
      if (rest) return simplify({ kind: "all", children: node ? [node, rest] : [rest] })
    }
    return node
  }

  /** Parses operands and operators until ")" or end of input. */
  private parseSequence(): PrereqNode | null {
    const operands: PrereqNode[] = []
    const ops: Op[] = []
    let pending: Op[] = []

    const push = (node: PrereqNode, groupedText: boolean) => {
      const prev = operands[operands.length - 1]
      if (prev && pending.length === 0) {
        // Two operands with no operator between them: one describes the other.
        operands[operands.length - 1] = attach(prev, node, groupedText)
        return
      }
      if (operands.length > 0) ops.push(resolveOp(pending))
      operands.push(node)
      pending = []
    }

    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos]
      if (tok.t === "rp") break
      this.pos++
      switch (tok.t) {
        case "code":
          push({ kind: "course", code: tok.v }, false)
          break
        case "word": {
          const words = [tok.v]
          while (this.tokens[this.pos]?.t === "word") {
            words.push((this.tokens[this.pos++] as { v: string }).v)
          }
          const text = words.join(" ")
          if (!FILLER.test(text)) push({ kind: "text", text }, false)
          break
        }
        case "lp": {
          const inner = this.parseSequence()
          if (this.tokens[this.pos]?.t === "rp") this.pos++
          if (inner) push(inner, true)
          break
        }
        default:
          if (operands.length > 0) pending.push(tok.t)
      }
    }
    return combine(operands, ops)
  }
}

/** Explicit AND/OR wins over a bare separator; the last explicit one wins over earlier ones. */
function resolveOp(pending: Op[]): Op {
  for (let i = pending.length - 1; i >= 0; i--) if (pending[i] !== "sep") return pending[i]
  return "sep"
}

/** Split on AND (lowest precedence); each segment is an OR group, or an AND list if it has no OR. */
function combine(operands: PrereqNode[], ops: Op[]): PrereqNode | null {
  if (operands.length === 0) return null
  const segments: { nodes: PrereqNode[]; ops: Op[] }[] = [{ nodes: [operands[0]], ops: [] }]
  ops.forEach((op, i) => {
    if (op === "and") segments.push({ nodes: [operands[i + 1]], ops: [] })
    else {
      const seg = segments[segments.length - 1]
      seg.nodes.push(operands[i + 1])
      seg.ops.push(op)
    }
  })
  const parts = segments.map<PrereqNode>((seg) => ({
    kind: seg.ops.includes("or") ? "any" : "all",
    children: seg.nodes,
  }))
  return simplify({ kind: "all", children: parts })
}

function attach(prev: PrereqNode, next: PrereqNode, groupedText: boolean): PrereqNode {
  if (prev.kind === "course" && !containsCourse(next)) {
    return withNote(prev, toText(next))
  }
  if (prev.kind === "text" && next.kind === "course") {
    return withNote(next, prev.text)
  }
  if (prev.kind === "text" && next.kind === "text") {
    return { kind: "text", text: `${prev.text} ${groupedText ? `(${next.text})` : next.text}` }
  }
  // e.g. "COMP 1021 COMP 1022" with no operator: most likely a list, so require both.
  return simplify({ kind: "all", children: [prev, next] })
}

function withNote(node: { kind: "course"; code: string; note?: string }, note: string): PrereqNode {
  const clean = note.replace(/^[\s,;:]+|[\s,;:]+$/g, "")
  if (!clean || FILLER.test(clean)) return node
  return { ...node, note: node.note ? `${node.note}; ${clean}` : clean }
}

function containsCourse(node: PrereqNode): boolean {
  if (node.kind === "course") return true
  if (node.kind === "text") return false
  return node.children.some(containsCourse)
}

function toText(node: PrereqNode): string {
  switch (node.kind) {
    case "text":
      return node.text
    case "course":
      return node.note ? `${node.code} (${node.note})` : node.code
    default:
      return node.children.map(toText).join(node.kind === "any" ? " or " : " and ")
  }
}

/** Flatten nested groups of the same kind and unwrap single-child groups. */
function simplify(node: PrereqNode): PrereqNode {
  if (node.kind === "course" || node.kind === "text") return node
  const children: PrereqNode[] = []
  for (const child of node.children.map(simplify)) {
    if (child.kind === node.kind) children.push(...child.children)
    else children.push(child)
  }
  return children.length === 1 ? children[0] : { kind: node.kind, children }
}

/** All course codes referenced anywhere in the tree (with duplicates removed). */
export function referencedCodes(node: PrereqNode | null): string[] {
  const out = new Set<string>()
  const walk = (n: PrereqNode) => {
    if (n.kind === "course") out.add(n.code)
    else if (n.kind !== "text") n.children.forEach(walk)
  }
  if (node) walk(node)
  return [...out]
}
