/**
 * Shapes of the preprocessed data in `app/data/generated/`.
 * Produced by `scripts/build-data.ts`; consumed by the app at runtime.
 */

/** Prerequisite expression, parsed from the free-text `prerequisite` field. */
export type PrereqNode =
  | { kind: "course"; code: string; note?: string }
  | { kind: "all" | "any"; children: PrereqNode[] }
  | { kind: "text"; text: string }

export type Career = "UG" | "PG"

export interface Term {
  /** e.g. "2610" */
  code: string
  /** e.g. "2026-27 Fall" */
  name: string
}

/** One row per unique course code, small enough to load at startup. */
export interface CourseSummary {
  /** "COMP 1021" */
  code: string
  prefix: string
  /** "1021", "1022P", "6000-6010" */
  number: string
  /** Title from the most recent term the course is offered in. */
  title: string
  /** "3" or "0-4" */
  credits: string
  career: Career
  /** Indices into `CatalogIndex.terms`, newest first. */
  terms: number[]
}

export interface Department {
  prefix: string
  career: Career | "Mixed"
  courseCount: number
}

export interface CatalogIndex {
  /** Newest first. */
  terms: Term[]
  departments: Department[]
  /** Sorted by code. */
  courses: CourseSummary[]
}

/** The full course record for one or more terms whose content is identical. */
export interface CourseVersion {
  terms: number[]
  title: string
  credits: string
  description: string
  prerequisite: string
  corequisite: string
  exclusion: string
  colist: string
  previous: string
  attributes: { label: string; description: string }[]
  cilos: string[]
}

/** Per-department detail chunk: code -> versions (newest first). */
export type DetailChunk = Record<string, CourseVersion[]>

export interface PrereqGraph {
  /** Parsed expressions, deduplicated by source string. */
  exprs: PrereqNode[]
  /** code -> [[termIndices, exprIndex], ...], newest first. Missing = no prerequisites. */
  byCourse: Record<string, [number[], number][]>
  /** code -> codes whose prerequisites mention it (any term). */
  unlocks: Record<string, string[]>
}
