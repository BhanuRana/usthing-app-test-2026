import { parsePrerequisite, referencedCodes } from "./parse"

const course = (code: string, note?: string) =>
  note ? { kind: "course", code, note } : { kind: "course", code }

describe("parsePrerequisite", () => {
  it("returns null for empty input", () => {
    expect(parsePrerequisite("")).toBeNull()
  })

  it("parses a single course", () => {
    expect(parsePrerequisite("OCES 3160")).toEqual(course("OCES 3160"))
  })

  it("parses flat AND / OR", () => {
    expect(parsePrerequisite("BIEN 2410 AND BIEN 2610")).toEqual({
      kind: "all",
      children: [course("BIEN 2410"), course("BIEN 2610")],
    })
    expect(parsePrerequisite("LIFS 4971 OR SCIE 4500")).toEqual({
      kind: "any",
      children: [course("LIFS 4971"), course("SCIE 4500")],
    })
  })

  it("respects parentheses and square brackets", () => {
    const expected = {
      kind: "all",
      children: [
        { kind: "any", children: [course("UFUG 2102"), course("UFUG 2103")] },
        { kind: "any", children: [course("UFUG 2601"), course("UFUG 2602")] },
      ],
    }
    expect(parsePrerequisite("[UFUG 2102 OR UFUG 2103] AND [UFUG 2601 OR UFUG 2602]")).toEqual(
      expected,
    )
    expect(parsePrerequisite("(UFUG 2102 OR UFUG 2103) AND (UFUG 2601 OR UFUG 2602)")).toEqual(
      expected,
    )
  })

  it("attaches trailing qualifiers as notes instead of dropping them", () => {
    expect(parsePrerequisite("CIVL 1121 OR COMP 1022P (prior to 2025-26) OR COMP 1023")).toEqual({
      kind: "any",
      children: [
        course("CIVL 1121"),
        course("COMP 1022P", "prior to 2025-26"),
        course("COMP 1023"),
      ],
    })
  })

  it("does not treat 'or above' as an operator", () => {
    expect(parsePrerequisite("(Grade A- or above in MATH 1014) OR MATH 1020 OR MATH 1024")).toEqual(
      {
        kind: "any",
        children: [
          course("MATH 1014", "Grade A- or above in"),
          course("MATH 1020"),
          course("MATH 1024"),
        ],
      },
    )
  })

  it("lets commas take the operator of their segment, with OR binding tighter than AND", () => {
    expect(
      parsePrerequisite("One of ECON 2103, ECON 2113 OR ECON 3113, AND ECON 2123 OR ECON 3123"),
    ).toEqual({
      kind: "all",
      children: [
        { kind: "any", children: [course("ECON 2103"), course("ECON 2113"), course("ECON 3113")] },
        { kind: "any", children: [course("ECON 2123"), course("ECON 3123")] },
      ],
    })
  })

  it("treats a spaced slash as OR but keeps slashes inside words", () => {
    expect(parsePrerequisite("grade B+ or above in MATH 1020 / MATH 1024")).toEqual({
      kind: "any",
      children: [course("MATH 1020", "grade B+ or above in"), course("MATH 1024")],
    })
    expect(parsePrerequisite("Level 3 or above in HKDSE 1/2x")).toEqual({
      kind: "text",
      text: "Level 3 or above in HKDSE 1/2x",
    })
  })

  it("keeps non-course requirements as text", () => {
    expect(parsePrerequisite("MSc status")).toEqual({ kind: "text", text: "MSc status" })
  })

  it("ignores enumerators and handles codes without a space", () => {
    expect(parsePrerequisite("(a) UFUG 1303; and\n(b) UFUG1103 or UFUG 1106")).toEqual({
      kind: "all",
      children: [
        course("UFUG 1303"),
        { kind: "any", children: [course("UFUG 1103"), course("UFUG 1106")] },
      ],
    })
  })

  it("survives unbalanced parentheses", () => {
    expect(referencedCodes(parsePrerequisite("(COMP 2011 OR COMP 2012"))).toEqual([
      "COMP 2011",
      "COMP 2012",
    ])
    expect(referencedCodes(parsePrerequisite("COMP 2011) AND MATH 2111"))).toEqual([
      "COMP 2011",
      "MATH 2111",
    ])
  })
})
