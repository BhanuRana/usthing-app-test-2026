/**
 * Micro-benchmarks for the data layer (`yarn bench`), to back the README's performance claims.
 * Runs in Node, so absolute numbers are faster than Hermes on a phone; what matters is the
 * order of magnitude and the comparison with parsing the raw dataset.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"

import { evaluate } from "../app/data/prereq/evaluate"
import { prereqTreeFor, prerequisiteChain } from "../app/data/prereq/traverse"
import type { CatalogIndex, PrereqGraph } from "../app/data/types"

const ROOT = join(__dirname, "..")

function time(label: string, fn: () => unknown, runs = 50) {
  fn() // warm up
  const samples: number[] = []
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    fn()
    samples.push(performance.now() - t0)
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]
  const p95 = samples[Math.floor(samples.length * 0.95)]
  console.log(
    `${label.padEnd(46)} median ${median.toFixed(2).padStart(7)} ms   p95 ${p95.toFixed(2).padStart(7)} ms`,
  )
}

const read = (p: string) => readFileSync(join(ROOT, p), "utf8")
const rawText = read("courses.json")
const indexText = read("app/data/generated/index.json")
const graphText = read("app/data/generated/prereqs.json")
const compText = read("app/data/generated/details/COMP.json")

console.log("Parsing")
time("JSON.parse raw courses.json (28 MB)", () => JSON.parse(rawText), 5)
time("JSON.parse index.json (startup)", () => JSON.parse(indexText))
time("JSON.parse prereqs.json (first detail view)", () => JSON.parse(graphText))
time("JSON.parse details/COMP.json (one department)", () => JSON.parse(compText))

// The catalogue module caches its data, so require it after parsing is measured.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { searchCourses, unlockedCourses } =
  require("../app/data/catalog") as typeof import("../app/data/catalog")

const index: CatalogIndex = JSON.parse(indexText)
const graph: PrereqGraph = JSON.parse(graphText)
searchCourses({ text: "" }) // build search keys once

console.log("\nPer interaction")
time('search "comp" (all terms)', () => searchCourses({ text: "comp" }))
time('search "operating systems"', () => searchCourses({ text: "operating systems" }))
time("filter COMP + Fall + UG, no text", () =>
  searchCourses({ text: "", prefix: "COMP", term: 0, career: "UG" }),
)
time("prerequisite chain (BFS) of DSAA 3072, 9 levels", () => prerequisiteChain(graph, "DSAA 3072"))
const completed = new Set(["COMP 1021", "COMP 2011", "COMP 2711", "MATH 1013", "MATH 1014"])
time("evaluate every course vs completed (4,030 trees)", () => {
  for (const c of index.courses) {
    const tree = prereqTreeFor(graph, c.code)
    if (tree) evaluate(tree, completed)
  }
})
time('"Unlocked for me" filter', () => unlockedCourses(completed, 0))
