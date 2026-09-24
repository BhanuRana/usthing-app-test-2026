import { getCourse, getCourseVersion, getIndex, searchCourses, unlockedCourses } from "./catalog"

// Runs against the real generated data, so it also guards the build output.
describe("catalog", () => {
  it("loads the index with terms newest first", () => {
    const { terms, courses } = getIndex()
    expect(terms[0].name).toBe("2026-27 Fall")
    expect(courses.length).toBeGreaterThan(4000)
  })

  it("ranks an exact code first regardless of spacing or case", () => {
    expect(searchCourses({ text: "comp1021" })[0].code).toBe("COMP 1021")
    expect(searchCourses({ text: "COMP 1021" })[0].code).toBe("COMP 1021")
  })

  it("matches code prefixes before title matches", () => {
    const results = searchCourses({ text: "comp 2" })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((c) => c.code.startsWith("COMP 2"))).toBe(true)
  })

  it("searches titles, including out-of-order words", () => {
    expect(searchCourses({ text: "operating systems" }).map((c) => c.code)).toContain("COMP 3511")
    expect(searchCourses({ text: "systems operating" }).map((c) => c.code)).toContain("COMP 3511")
  })

  it("filters by department, term and career", () => {
    const fall = 0
    const results = searchCourses({ text: "", prefix: "COMP", term: fall, career: "UG" })
    expect(results.length).toBeGreaterThan(0)
    for (const c of results) {
      expect(c.prefix).toBe("COMP")
      expect(c.terms).toContain(fall)
      expect(c.career).toBe("UG")
    }
  })

  it("returns nothing for a nonsense query", () => {
    expect(searchCourses({ text: "zzzzqqq" })).toEqual([])
  })

  it("loads details lazily and falls back to the newest version", () => {
    expect(getCourse("COMP 1021")?.title).toBeTruthy()
    const version = getCourseVersion("COMP 1021", 99)
    expect(version?.description.length).toBeGreaterThan(0)
  })

  it("finds courses unlocked by completed ones, excluding those already taken", () => {
    expect(unlockedCourses(new Set()).size).toBe(0)
    const unlocked = unlockedCourses(new Set(["COMP 2011", "COMP 2711"]))
    expect(unlocked.has("COMP 3711")).toBe(true)
    expect(unlocked.has("COMP 2011")).toBe(false)
    // Half of COMP 3711's requirement is not enough.
    expect(unlockedCourses(new Set(["COMP 2011"])).has("COMP 3711")).toBe(false)
    // And the filter composes with search.
    const results = searchCourses({ text: "comp 37", only: unlocked })
    expect(results.map((c) => c.code)).toContain("COMP 3711")
  })
})
