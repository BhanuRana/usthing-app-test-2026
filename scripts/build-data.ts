/**
 * Preprocesses the supplied `courses.json` (~28 MB, one row per course per term) into small,
 * purpose-shaped files under `app/data/generated/`:
 *
 *   index.json          every unique course code, with only what the list/search/filter needs
 *   prereqs.json        parsed prerequisite trees (deduplicated) + reverse "unlocks" index
 *   details/<PREFIX>.json   full per-term course content, one file per department, loaded lazily
 *   details/index.ts    static require() map so Metro can bundle the lazy chunks
 *
 * Run with `yarn data`. The output is committed, so the app runs without this step.
 */
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { parsePrerequisite, referencedCodes } from "../app/data/prereq/parse"
import type {
  CatalogIndex,
  CourseSummary,
  CourseVersion,
  Department,
  DetailChunk,
  PrereqGraph,
  PrereqNode,
  Term,
} from "../app/data/types"

interface RawCourse {
  term_num: number
  term_code: string
  term_name: string
  career_type: "UG" | "PG"
  prefix: string
  number: string
  title: string
  min_credits: number
  max_credits: number
  description: string
  prerequisite: string
  corequisite: string
  exclusion: string
  colist: string
  previous: string
  attributes: { label: string; value: string; description: string }[]
  cilos: { description: string }[]
}

const ROOT = join(__dirname, "..")
const SOURCE = join(ROOT, "courses.json")
const OUT = join(ROOT, "app/data/generated")

function main() {
  const raw: RawCourse[] = JSON.parse(readFileSync(SOURCE, "utf8"))

  // Terms, newest first. `term_num` increases over time.
  const termByCode = new Map<string, { num: number; name: string }>()
  for (const r of raw) termByCode.set(r.term_code, { num: r.term_num, name: r.term_name })
  const terms: Term[] = [...termByCode.entries()]
    .sort((a, b) => b[1].num - a[1].num)
    .map(([code, { name }]) => ({ code, name }))
  const termIndex = new Map(terms.map((t, i) => [t.code, i]))

  // Group rows by course code, newest term first.
  const byCode = new Map<string, RawCourse[]>()
  for (const r of raw) {
    const code = `${r.prefix} ${r.number}`
    if (!byCode.has(code)) byCode.set(code, [])
    byCode.get(code)!.push(r)
  }
  for (const rows of byCode.values()) {
    rows.sort((a, b) => termIndex.get(a.term_code)! - termIndex.get(b.term_code)!)
  }

  const courses: CourseSummary[] = []
  const chunks = new Map<string, DetailChunk>()
  const exprIds = new Map<string, number>()
  const exprs: PrereqNode[] = []
  const byCourse: PrereqGraph["byCourse"] = {}
  const unlocks = new Map<string, Set<string>>()
  let textOnly = 0

  for (const [code, rows] of [...byCode.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const newest = rows[0]
    const rowTerms = rows.map((r) => termIndex.get(r.term_code)!)
    courses.push({
      code,
      prefix: newest.prefix,
      number: newest.number,
      title: newest.title,
      credits: formatCredits(newest),
      career: newest.career_type,
      terms: rowTerms,
    })

    // Details: collapse terms whose content is identical into one version.
    const versions = new Map<string, CourseVersion>()
    rows.forEach((r, i) => {
      const version: Omit<CourseVersion, "terms"> = {
        title: r.title,
        credits: formatCredits(r),
        description: r.description.trim(),
        prerequisite: r.prerequisite.trim(),
        corequisite: r.corequisite.trim(),
        exclusion: r.exclusion.trim(),
        colist: r.colist.trim(),
        previous: r.previous.trim(),
        attributes: r.attributes.map((a) => ({ label: a.label, description: a.description })),
        cilos: r.cilos.map((c) => c.description.trim()).filter(Boolean),
      }
      const key = JSON.stringify(version)
      const existing = versions.get(key)
      if (existing) existing.terms.push(rowTerms[i])
      else versions.set(key, { terms: [rowTerms[i]], ...version })
    })
    if (!chunks.has(newest.prefix)) chunks.set(newest.prefix, {})
    chunks.get(newest.prefix)![code] = [...versions.values()]

    // Prerequisites: parse each distinct string once; record which terms use which tree.
    const perExpr = new Map<number, number[]>()
    rows.forEach((r, i) => {
      const source = r.prerequisite.trim()
      if (!source) return
      let id = exprIds.get(source)
      if (id === undefined) {
        const node = parsePrerequisite(source)
        if (!node) return
        id = exprs.push(node) - 1
        exprIds.set(source, id)
        if (referencedCodes(node).length === 0) textOnly++
      }
      if (!perExpr.has(id)) perExpr.set(id, [])
      perExpr.get(id)!.push(rowTerms[i])
      for (const ref of referencedCodes(exprs[id])) {
        if (ref === code) continue
        if (!unlocks.has(ref)) unlocks.set(ref, new Set())
        unlocks.get(ref)!.add(code)
      }
    })
    if (perExpr.size > 0) {
      byCourse[code] = [...perExpr.entries()].map(([id, t]) => [t, id])
    }
  }

  const departments: Department[] = [...chunks.keys()].sort().map((prefix) => {
    const inDept = courses.filter((c) => c.prefix === prefix)
    const careers = new Set(inDept.map((c) => c.career))
    return {
      prefix,
      career: careers.size > 1 ? "Mixed" : [...careers][0],
      courseCount: inDept.length,
    }
  })

  // Write output.
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(join(OUT, "details"), { recursive: true })

  const index: CatalogIndex = { terms, departments, courses }
  writeJson("index.json", index)

  const graph: PrereqGraph = {
    exprs,
    byCourse,
    unlocks: Object.fromEntries(
      [...unlocks.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, [...v].sort()]),
    ),
  }
  writeJson("prereqs.json", graph)

  for (const [prefix, chunk] of chunks) writeJson(`details/${prefix}.json`, chunk)
  writeFileSync(join(OUT, "details/index.ts"), detailLoaderSource([...chunks.keys()].sort()))

  // Report.
  const kb = (p: string) => Math.round(statSync(join(OUT, p)).size / 1024)
  const detailKb = [...chunks.keys()].map((p) => kb(`details/${p}.json`))
  const allCodes = new Set(courses.map((c) => c.code))
  const dangling = new Set([...unlocks.keys()].filter((c) => !allCodes.has(c)))
  console.log(`source          ${raw.length} rows, ${Math.round(statSync(SOURCE).size / 1024)} KB`)
  console.log(`terms           ${terms.map((t) => t.name).join(", ")}`)
  console.log(`courses         ${courses.length} unique codes in ${departments.length} departments`)
  console.log(`index.json      ${kb("index.json")} KB`)
  console.log(
    `prereqs.json    ${kb("prereqs.json")} KB (${exprs.length} distinct trees, ${textOnly} text-only)`,
  )
  console.log(
    `details/*.json  ${detailKb.reduce((a, b) => a + b, 0)} KB total, largest ${Math.max(...detailKb)} KB`,
  )
  console.log(`unknown codes   ${dangling.size} referenced but not in the dataset`)
}

function formatCredits(r: RawCourse): string {
  const fmt = (n: number) => String(Number(n.toFixed(2)))
  return r.min_credits === r.max_credits
    ? fmt(r.min_credits)
    : `${fmt(r.min_credits)}-${fmt(r.max_credits)}`
}

function writeJson(path: string, value: unknown) {
  writeFileSync(join(OUT, path), JSON.stringify(value))
}

/**
 * Metro resolves require() at build time, so a computed path like require(`./${prefix}.json`)
 * cannot work. Generating one static require per department keeps each chunk out of the
 * startup path: with `inlineRequires`, a chunk's module is only evaluated when first called.
 */
function detailLoaderSource(prefixes: string[]): string {
  const lines = prefixes.map((p) => `  ${p}: () => require("./${p}.json"),`)
  return [
    "// Generated by scripts/build-data.ts. Do not edit.",
    'import type { DetailChunk } from "../../types"',
    "",
    "export const detailLoaders: Record<string, () => DetailChunk> = {",
    ...lines,
    "}",
    "",
  ].join("\n")
}

main()
