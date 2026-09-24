import { evaluate } from "./prereq/evaluate"
import { prereqTreeFor } from "./prereq/traverse"
import type { CatalogIndex, CourseSummary, CourseVersion, PrereqGraph } from "./types"

/**
 * Runtime access to the preprocessed data. The index (~570 KB) and prerequisite graph
 * (~180 KB) load on first use; per-department details load when a course is opened.
 * Every accessor is synchronous: the data is bundled, so there is nothing to await.
 */

let index: CatalogIndex | undefined
let graph: PrereqGraph | undefined
let byCode: Map<string, CourseSummary> | undefined
let searchKeys: SearchKey[] | undefined

export function getIndex(): CatalogIndex {
  index ??= require("./generated/index.json") as CatalogIndex
  return index
}

export function getPrereqGraph(): PrereqGraph {
  graph ??= require("./generated/prereqs.json") as PrereqGraph
  return graph
}

export function getCourse(code: string): CourseSummary | undefined {
  byCode ??= new Map(getIndex().courses.map((c) => [c.code, c]))
  return byCode.get(code)
}

/** All versions of a course's full record, newest first. Loads its department's chunk on first call. */
export function getCourseVersions(code: string): CourseVersion[] {
  const { detailLoaders } = require("./generated/details") as typeof import("./generated/details")
  const prefix = code.split(" ")[0]
  return detailLoaders[prefix]?.()[code] ?? []
}

/** The version shown for a term: that term's, or the newest if the course isn't offered then. */
export function getCourseVersion(code: string, term?: number): CourseVersion | undefined {
  const versions = getCourseVersions(code)
  return (term !== undefined && versions.find((v) => v.terms.includes(term))) || versions[0]
}

// ---------------------------------------------------------------------------------------
// Search and filtering

export interface CourseQuery {
  text: string
  /** Term index, or undefined for all terms. */
  term?: number
  /** Department prefix, or undefined for all departments. */
  prefix?: string
  career?: "UG" | "PG"
  /** Restrict to these codes (e.g. courses unlocked by the user's completed courses). */
  only?: ReadonlySet<string>
}

interface SearchKey {
  course: CourseSummary
  /** "comp1021" */
  compactCode: string
  /** "operating systems" */
  title: string
}

/** Lower-cased, spaces removed: "COMP 1021", "comp1021" and "Comp 1021" all match. */
const compact = (s: string) => s.toLowerCase().replace(/\s+/g, "")

function getSearchKeys(): SearchKey[] {
  searchKeys ??= getIndex().courses.map((course) => ({
    course,
    compactCode: compact(course.code),
    title: course.title.toLowerCase(),
  }))
  return searchKeys
}

/**
 * Filters then ranks. Lower rank = better match:
 *   0 exact code · 1 code prefix ("comp2" -> COMP 2011) · 2 title starts with the query
 *   3 a title word starts with it · 4 anywhere in the title · 5 every query word appears in the title
 * A linear scan over ~4,000 precomputed keys takes a millisecond or two, so no search index is
 * needed; results keep catalogue order within a rank.
 */
export function searchCourses(query: CourseQuery): CourseSummary[] {
  const text = query.text.trim().toLowerCase()
  const textCompact = compact(text)
  const words = text.split(/\s+/).filter(Boolean)

  const ranked: { course: CourseSummary; rank: number }[] = []
  for (const key of getSearchKeys()) {
    const { course } = key
    if (query.prefix && course.prefix !== query.prefix) continue
    if (query.term !== undefined && !course.terms.includes(query.term)) continue
    if (query.career && course.career !== query.career) continue
    if (query.only && !query.only.has(course.code)) continue

    const rank = text ? matchRank(key, text, textCompact, words) : 0
    if (rank >= 0) ranked.push({ course, rank })
  }
  if (text) ranked.sort((a, b) => a.rank - b.rank) // stable sort keeps code order within a rank
  return ranked.map((r) => r.course)
}

function matchRank(key: SearchKey, text: string, textCompact: string, words: string[]): number {
  if (key.compactCode === textCompact) return 0
  if (key.compactCode.startsWith(textCompact)) return 1
  if (key.title.startsWith(text)) return 2
  const at = key.title.indexOf(text)
  if (at > 0 && key.title[at - 1] === " ") return 3
  if (at > 0) return 4
  if (words.length > 1 && words.every((w) => key.title.includes(w))) return 5
  return -1
}

/**
 * Courses the user can now take: they have prerequisites (for the given term's version),
 * those evaluate to met against `completed`, and the user hasn't taken them already.
 * One evaluation of each course's direct prerequisite tree: ~4,000 small trees, a few ms.
 */
export function unlockedCourses(completed: ReadonlySet<string>, term?: number): Set<string> {
  const out = new Set<string>()
  if (completed.size === 0) return out
  const graph = getPrereqGraph()
  for (const course of getIndex().courses) {
    if (completed.has(course.code)) continue
    const tree = prereqTreeFor(graph, course.code, term)
    if (tree && evaluate(tree, completed) === "met") out.add(course.code)
  }
  return out
}
