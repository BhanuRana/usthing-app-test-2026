/** A run of text, and whether it matched the search. */
export interface Segment {
  text: string
  match: boolean
}

/**
 * Splits a course code into matched/unmatched runs for a query typed with any spacing or
 * case: "comp37" and "COMP 37" both highlight "COMP 37" in "COMP 3711". Only a prefix match
 * counts, mirroring how code search ranks.
 */
export function highlightCode(code: string, query: string): Segment[] {
  const q = query.replace(/\s+/g, "").toUpperCase()
  if (!q) return [{ text: code, match: false }]
  let matched = 0
  let end = 0
  for (; end < code.length && matched < q.length; end++) {
    const ch = code[end]
    if (ch === " ") continue
    if (ch.toUpperCase() !== q[matched]) return [{ text: code, match: false }]
    matched++
  }
  if (matched < q.length) return [{ text: code, match: false }]
  return toSegments(code, [[0, end]])
}

/** Highlights every occurrence of each query word (2+ characters) in a title. */
export function highlightWords(text: string, query: string): Segment[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2)
  if (!words.length) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const ranges: [number, number][] = []
  for (const w of words) {
    for (let i = lower.indexOf(w); i !== -1; i = lower.indexOf(w, i + w.length)) {
      ranges.push([i, i + w.length])
    }
  }
  return toSegments(text, mergeRanges(ranges))
}

function mergeRanges(ranges: [number, number][]): [number, number][] {
  ranges.sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const r of ranges) {
    const last = merged[merged.length - 1]
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
    else merged.push([r[0], r[1]])
  }
  return merged
}

function toSegments(text: string, ranges: [number, number][]): Segment[] {
  const out: Segment[] = []
  let pos = 0
  for (const [start, end] of ranges) {
    if (start > pos) out.push({ text: text.slice(pos, start), match: false })
    out.push({ text: text.slice(start, end), match: true })
    pos = end
  }
  if (pos < text.length) out.push({ text: text.slice(pos), match: false })
  return out
}
