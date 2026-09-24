# Build log

Chronological notes on how the app was built. The reasoning behind each choice is in [DECISIONS.md](DECISIONS.md).

## 2026-09-24

**0 · Setup**
- Cloned the USThing template (Ignite 11.5 / Expo SDK 55 / RN 0.83, dev client). Kept its two commits as the base of the history.
- A global Yarn 4 rewrote the template's v1 lockfile on first install. I reverted it and pinned `packageManager: yarn@1.22.22` so installs match the template exactly.
- iOS toolchain: Xcode 26.6, iOS 26.5 simulator runtime, CocoaPods 1.17.

**1 · Profiled the dataset** before designing anything:
- 15,178 rows = 4 terms × ~3.8k courses. Only 4,030 unique codes across 129 departments.
- CILOs (7.6 MB) and descriptions (6.9 MB) make up about half the file.
- Content changes between terms for the same code: 117 prerequisites, 107 descriptions, 58 titles.
- 787 distinct prerequisite strings. 23 contain no course code at all, and 27 referenced codes aren't in the dataset.
- Only 3 of 175 AND/OR-mixed strings lack parentheses. That's the evidence behind the precedence rule (D4).

**2 · Data layer** (`app/data/`, `scripts/build-data.ts`)
- Prerequisite tokenizer + recursive-descent parser → AND/OR trees with notes.
- Build script: 28 MB → 574 KB index + 176 KB prerequisite graph + 129 detail chunks (5.3 MB, ≤457 KB each), in ~2.5 s.
- Found a real cycle (`UCMP 6030 ↔ UCMP 6040`); the longest chain is 9 levels (DSAA 3072).
- Traversal: per-term tree lookup, ancestor-path cycle check, BFS chain with a visited set, reverse "unlocks" index.
- Ranked linear search with department, term and career filters.
- 26 unit tests covering the parser, traversal (including cycles and self-reference) and search on the real data.

**3 · UI**
- Removed the Ignite demo: screens, login/auth, podcast API, 6 demo locales, Maestro flows.
- Navigation: root stack (Tabs → CourseDetail) with Explore and Starred tabs. Detail screens are *pushed*, so following prerequisites builds a back stack.
- Explore: deferred search, term chips (persisted), department picker with live counts, UG/PG filter, fixed-height memoised rows.
- Course detail: term switcher, expandable prerequisite tree, the raw text with linked codes, full chain by level, "Leads to", and the rest of the record.
- Preferences (starred courses, selected term) via MMKV hooks.
- Fixed the template's existing type error in `navigationUtilities.ts`.
- Production iOS export: 9.5 MB Hermes bytecode bundle.
