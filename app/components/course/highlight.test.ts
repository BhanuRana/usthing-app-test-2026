import { highlightCode, highlightWords, Segment } from "./highlight"

const marked = (segments: Segment[]) =>
  segments.map((s) => (s.match ? `[${s.text}]` : s.text)).join("")

describe("highlightCode", () => {
  it("matches a code prefix typed with any spacing or case", () => {
    expect(marked(highlightCode("COMP 3711", "comp37"))).toBe("[COMP 37]11")
    expect(marked(highlightCode("COMP 3711", "COMP 3711"))).toBe("[COMP 3711]")
    expect(marked(highlightCode("COMP 3711", "comp"))).toBe("[COMP] 3711")
  })

  it("leaves the code alone when the query isn't a prefix of it", () => {
    expect(marked(highlightCode("COMP 3711", "3711"))).toBe("COMP 3711")
    expect(marked(highlightCode("COMP 3711", "comp37119"))).toBe("COMP 3711")
    expect(marked(highlightCode("COMP 3711", ""))).toBe("COMP 3711")
  })
})

describe("highlightWords", () => {
  it("marks every query word, in any order, case-insensitively", () => {
    expect(marked(highlightWords("Operating Systems", "systems operating"))).toBe(
      "[Operating] [Systems]",
    )
  })

  it("merges overlapping matches and ignores one-letter words", () => {
    expect(marked(highlightWords("Accounting", "count ounting a"))).toBe("Ac[counting]")
  })

  it("returns the text unchanged when nothing matches", () => {
    expect(marked(highlightWords("Discrete Structures", "algebra"))).toBe("Discrete Structures")
  })
})
