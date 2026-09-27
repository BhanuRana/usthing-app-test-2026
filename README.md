# HKUST Course Explorer

A React Native + Expo app for browsing HKUST courses, understanding their prerequisites, and planning how to get to the course you want. Built for the USThing App Team 2026-27 Fall technical test on the provided Ignite template, using the supplied local `courses.json`. There's no backend and no network.

<table>
  <tr>
    <td align="center"><img src="docs/demos/explore.gif" width="260" alt="Demo: filter sheet, title search, a course page and its prerequisite tree" /></td>
    <td align="center"><img src="docs/demos/plan.gif" width="260" alt="Demo: starring a course offers its prerequisites; Your path shows the route and shrinks as courses are completed" /></td>
  </tr>
  <tr>
    <td align="center"><b>Find a course</b><br/>Filter, search by title, follow the prerequisite tree</td>
    <td align="center"><b>Plan the route</b><br/>Star with prerequisites, then watch "Your path" shrink as you complete courses</td>
  </tr>
</table>

## What it does

**Browse and search** 4,030 courses across 4 terms and 129 departments.
- Search by code (`comp3711`, `COMP 3711`) or title (`operating systems`, even `systems operating`). The matched part of each result is highlighted.
- Filter by term, level (UG/PG), department and "Unlocked for me" in a sheet that shows how many courses you'll get before you apply ([D16](docs/DECISIONS.md#d16--filters-in-a-sheet-2026-09-26)). Active filters stay visible as removable pills.

**Course details**, per term (descriptions and prerequisites change between terms): credits, description, prerequisites, co-requisites, exclusions, attributes, learning outcomes. Course codes in free text are tappable links.

**Prerequisite explorer** *(the required challenge)*:
- An expandable AND/OR tree: expand any prerequisite to reveal its own, as deep as the chain goes. Tap any course to open it.
- Cycles are marked "↻ Loops back" instead of recursing (the data has a real one, `UCMP 6030 ↔ UCMP 6040`).
- Courses missing from the catalogue and non-course requirements (HKDSE, IELTS…) are shown as such, and the original text is always shown under the tree.
- Also: the **full chain** by level, and **"Leads to"**, the courses that list this one as a prerequisite.

**Planning** *(beyond the brief)*:
- **Completed courses** drive an eligibility check on every course page ("Still needed: one of COMP 2711 / COMP 2711H / MATH 2343") and the "Unlocked for me" filter: everything you can take next.
- **Starring a course you can't take yet** offers to star its missing prerequisites too, letting you pick within each "one of" group ([D18](docs/DECISIONS.md#d18--starring-a-course-you-cant-take-yet-2026-09-27)).
- **Your path**: the courses still to take, in order, as a timeline ending at the course. It builds on what you've completed, follows the options you've starred, marks what you can take now, and stars the whole route in one tap ([D19](docs/DECISIONS.md#d19--your-path-2026-09-27)).
- **My Courses**: starred and completed courses, with courses completed, credits earned and courses starred.

**Polish:** a navy and gold identity after HKUST's colours ([D15](docs/DECISIONS.md#d15--navy-and-gold-theme-2026-09-25), [D17](docs/DECISIONS.md#d17--navy-header-band-2026-09-26)); colour that carries meaning (navy = tappable, gold = starred, green = met, amber = still needed); light and dark mode; VoiceOver labels on interactive elements; state that persists across launches.

### Screens

<table>
  <tr>
    <td><img src="docs/screenshots/explore.png" width="200" alt="Explore: the navy header, search and course cards" /></td>
    <td><img src="docs/screenshots/filters.png" width="200" alt="Filter sheet with a live result count" /></td>
    <td><img src="docs/screenshots/search.png" width="200" alt="Search with highlighted matches and active filter pills" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Explore</sub></td>
    <td align="center"><sub>Filters, with a live count</sub></td>
    <td align="center"><sub>Search highlighting and filter pills</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/course.png" width="200" alt="Course page: header, terms, and what's still needed" /></td>
    <td><img src="docs/screenshots/prerequisites.png" width="200" alt="The prerequisite tree, expanded two levels" /></td>
    <td><img src="docs/screenshots/cycle.png" width="200" alt="A real prerequisite cycle, marked instead of recursing" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Course page and eligibility</sub></td>
    <td align="center"><sub>Expandable prerequisite tree</sub></td>
    <td align="center"><sub>A real cycle, handled</sub></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/star-prompt.png" width="200" alt="Starring a course you can't take yet offers its prerequisites" /></td>
    <td><img src="docs/screenshots/path.png" width="200" alt="Your path: the courses to take, in order" /></td>
    <td><img src="docs/screenshots/my-courses.png" width="200" alt="My Courses: completed, credits earned, starred" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Star with prerequisites</sub></td>
    <td align="center"><sub>Your path</sub></td>
    <td align="center"><sub>My Courses</sub></td>
  </tr>
</table>

---

## Setup and running

**Requirements:** Node ≥ 20, Yarn 1 (pinned via `packageManager`; `corepack enable` picks it up), Xcode with an iOS simulator, or, for Android, the Android SDK with an emulator and **JDK 17** (the JDK React Native's Android build targets; point `JAVA_HOME` at it).

```bash
git clone https://github.com/BhanuRana/usthing-app-test-2026.git
cd usthing-app-test-2026
yarn install
yarn ios          # builds the dev client and opens it in the iOS simulator (first build takes ~10 min)
                  # or: yarn android
yarn start        # afterwards, start Metro on its own when the app is already installed
```

The template uses `expo-dev-client` (for MMKV), so it runs as a development build, not in Expo Go.

**Dataset.** The supplied `courses.json` is included at the repo root. The app doesn't read it directly. It reads the preprocessed files in `app/data/generated/`, which are committed, so nothing extra is needed to run. To regenerate them after changing the dataset:

```bash
yarn data         # courses.json -> app/data/generated/ (~2 s)
```

**Checks**

```bash
yarn test         # 62 Jest tests: parser, traversal, eligibility, path planning, search on the real data
yarn compile      # TypeScript
yarn lint:check
yarn bench        # data-layer micro-benchmarks
maestro test -e MAESTRO_APP_ID=com.usthing.apptechtest27 .maestro/flows   # 6 end-to-end flows (needs Maestro + a running app)
```

## Platforms tested

| Platform | Build | Result |
|---|---|---|
| iOS 26.5 simulator, iPhone 17 / 17 Pro | Debug (dev client) and Release, including a Release build from a fresh `git clone` | All features; **6/6 Maestro flows pass** on the current code (Debug build). Release and fresh-clone builds were verified before D16–D19. Dark mode checked on every screen except the filter sheet and the Explore header. |
| Android 16 (API 36) emulator, Pixel 8 | Debug (dev client) and Release APK | All features, light and dark mode, hardware back button; 4/4 Maestro flows passed on the Release build, **before** the filter sheet, header band, star prompt and "Your path" ([D16–D19](docs/DECISIONS.md#d16--filters-in-a-sheet-2026-09-26)). Not re-run since. |

---

## Architecture

```
scripts/build-data.ts        courses.json -> app/data/generated/   (build time, Node)
app/data/
  types.ts                   shapes of the generated data
  catalog.ts                 loading, lookup, search/filter, "unlocked" query
  prereq/parse.ts            prerequisite text -> AND/OR tree
  prereq/traverse.ts         per-term lookup, cycle checks, full chain (BFS)
  prereq/evaluate.ts         tree vs. completed courses -> met / unmet / unknown; what's missing
  prereq/plan.ts             "Your path": one route to a course, in steps
  generated/                 index.json, prereqs.json, details/<DEPT>.json (committed)
app/screens/                 ExploreScreen, CourseDetailScreen, MyCoursesScreen
app/components/course/       CourseRow, Chip, HeroHeader, FilterSheet, DepartmentPicker, PrereqTree,
                             StarPrompt, CoursePathView, LinkedCodesText
app/utils/usePreferences.ts  starred / completed / selected term (MMKV)
app/navigators/              stack (Tabs → CourseDetail) + bottom tabs (Explore, My Courses)
```

- **The data layer is plain TypeScript with no React.** The build script, the app, the Jest tests and the benchmark all use the same `app/data` code. The screens only call its functions.
- **Navigation:** a native stack on top of two tabs. Course pages are *pushed*, so following a prerequisite chain builds a back stack you can retrace.
- **State management:**
  - The catalogue is static and synchronous, so there's no server state to manage. It lives in module-level caches in `catalog.ts`.
  - UI state (search text, filters, the filter sheet's draft) is local component state.
  - The three persisted preferences (starred, completed, selected term) use `react-native-mmkv` hooks, the same mechanism the template uses for its theme. They subscribe to their key, so every screen stays in sync without a context provider or a state library.
  - The rationale is in [D7](docs/DECISIONS.md#d7--state-component-state--mmkv-hooks-no-state-library-2026-09-24).
- **Built on the template:** its `Screen`, `Text`, `TextField`, `Header`, `EmptyState`, themes and typed i18n (`tx` keys, English only). The Ignite demo screens, auth flow and API client were removed.

## How the dataset is processed, searched and filtered

`courses.json` is 28 MB: **15,178 rows = 4 terms × ~3,800 courses**, but only **4,030 unique course codes**. Learning outcomes and descriptions are about half the bytes. Parsing the raw file takes ~100 ms on a laptop (more on a phone), and every launch would pay that. So it's preprocessed once at build time:

| Output | Contents | Size | Loaded |
|---|---|---|---|
| `index.json` | one row per code: code, title, credits, UG/PG, terms offered | 574 KB | first screen |
| `prereqs.json` | 787 distinct prerequisite strings parsed once into trees, plus a reverse index | 176 KB | first course view |
| `details/<DEPT>.json` × 129 | full per-term content | 5.3 MB total, ≤ 457 KB each | when you open a course in that department |

- **Per-term versions.** The same code's content changes between terms: the prerequisites of 117 codes, the descriptions of 107, and the titles of 58. Each course stores a list of *versions*, and terms with identical content collapse into one version. The detail screen shows the version for the semester you're browsing, and falls back to the newest one if the course isn't offered then.
- **Lazy details.** Metro can't `require()` a computed path, so the build script also generates `details/index.ts`, a static map of `DEPT: () => require("./DEPT.json")`. With `inlineRequires` and Hermes bytecode, a department's module runs only the first time it's opened.
- **Search** is a linear scan over lower-cased keys computed once, ranked as: exact code › code prefix › title prefix › title word › title substring › all query words in any order. Codes match regardless of case and spacing. The search input updates immediately, and the list filters on a `useDeferredValue` copy so typing never blocks.
- **Filters** (term, department, UG/PG, "Unlocked for me") are applied in the same pass. The filter sheet runs the same search on its draft to show "Show N courses" before you apply, and the department picker shows live counts under the other filters, so you can see a dead end before picking it.
- **Lists** are `FlatList`s with fixed-height, memoised rows and `getItemLayout`, so ~4,000 rows are never measured. Titles are one line and font scaling is capped so rows always fit.

## How prerequisite traversal works

**1. Parsing** (`prereq/parse.ts`, build time). A small tokenizer produces course codes, `AND`/`OR`, brackets, separators and words. A recursive-descent parser then builds a tree of `course | all | any | text` nodes. The rules come from the data (all 787 strings were profiled):

- `()` and `[]` group, and a spaced ` / ` means OR.
- **OR binds tighter than AND.** Of 175 strings that mix both, only 3 aren't fully bracketed, and the one real case (`ECON 2103, ECON 2113 OR ECON 3113, AND ECON 2123 OR ECON 3123`) only reads correctly this way.
- `,` and `;` take the operator used in their segment (`A, B OR C` → any; `A, B, and C` → all).
- `or above` and `or equivalent` are prose, not operators.
- Text next to a course becomes that course's **note** (`Grade A- or above in` MATH 1014, MATH 1012 `(prior to 2025-26)`). Other text stays a **text** node. Nothing is dropped, and the original string is always shown under the tree ("As written").

**2. The tree view** (`PrereqTree.tsx` + `prereq/traverse.ts`). It shows the course's direct prerequisites, and each course node expands **one level at a time**. So what gets rendered depends only on what you open, not on the size of the graph (the deepest chain, DSAA 3072, is 9 levels). Each node carries its **ancestor path**:
- If a course is already on its own path, it's a **cycle**: it's shown as "↻ Loops back" and can't be expanded.
- The same course on *different* branches is legitimate, and stays expandable.

**3. The full chain** is a breadth-first search with a visited set. It lists every transitive prerequisite once, at its shallowest level, and terminates on cycles and shared subtrees.

**4. "Leads to"** comes from a reverse index built at preprocessing time: an O(1) lookup instead of scanning every course.

**5. Eligibility** (`prereq/evaluate.ts`) evaluates a tree against your completed courses with three-valued logic:
- a course is *met* or *unmet*; free text is *unknown* (the app can't check your HKDSE results);
- AND is unmet if any child is unmet, and OR is met if any child is met;
- unknowns propagate otherwise.

It only evaluates a course's *direct* prerequisites (having completed a course is a fact), so it doesn't recurse across courses and can't loop. "Unlocked for me" runs it for all 4,030 courses in under a millisecond.

**6. Missing prerequisites as choices** (`missingGroups()` in `evaluate.ts`, used by the star prompt). The unmet part of a tree becomes *required* courses and *"one of"* groups, where each option is a list of courses taken together (`one of COMP 2011 / (COMP 1021 + COMP 1022P)`). Free-text alternatives make a group unverifiable, so it's left out; courses the data names twice (LANG 3021 lists LANG 2010 "for DSCT only" and "for all others") are listed once.

**7. Your path** (`prereq/plan.ts`). Picks one concrete route and orders it:
- A completed course is met; a "one of" group that's already met needs nothing more.
- Otherwise a group takes an option containing a **starred** course (your own choice), then the option needing the **fewest courses in total** (its own prerequisites included, memoised), then the first listed. Free-text alternatives are passed over when a course option exists.
- Walking from the target records each chosen course's own chosen prerequisites, with the current path as a stack so loops are cut (and noted) instead of followed.
- Each course's step is one more than its latest prerequisite's (a longest-path layering of the resulting DAG), so step 1 is "can take now" and the number of steps is the shortest possible sequence of terms.

## Performance

`yarn bench` on an M1 Pro (Node). Hermes on a phone is slower, but even 10× these numbers stays well under a 16 ms frame.

| Operation | Median |
|---|---|
| Parse the raw `courses.json` (what we avoid at startup) | 99 ms |
| Parse `index.json` (what we do at startup) | 1.7 ms |
| Search "comp" / "operating systems" over all courses | 0.4 / 0.5 ms |
| Full prerequisite chain of DSAA 3072 (9 levels) | 0.02 ms |
| Evaluate all 4,030 courses for "Unlocked for me" | 0.3 ms |
| "Your path" to CENG 5840 (the largest: 11 courses, 4 steps) | 0.02 ms |
| "Your path" for all 4,030 courses | 7.7 ms |

The production iOS bundle is 9.5 MB of Hermes bytecode, mostly the lazily loaded detail chunks ([D9](docs/DECISIONS.md#d9--bundle-size-vs-startup-2026-09-24)).

## Testing

- **Jest (62 tests):**
  - the parser on real-world strings (brackets, precedence, notes, `or above`, enumerators, unbalanced parentheses);
  - traversal (per-term lookup, cycles, self-reference, shared subtrees);
  - eligibility (three-valued logic, "still needed") and missing-prerequisite groups (nesting, duplicates, free text);
  - path planning (cheapest option, completed courses, starred options, shared prerequisites, ordering, loops);
  - search/filter/unlocked on the **real generated data**, and search-match highlighting;
  - plus the template's i18n key check.
- **Data sweeps:** the star prompt's groups and "Your path" were run for every course in every term (15,178 cases): no crashes, no duplicate rows, no course on its own path.
- **Maestro (6 flows in `.maestro/flows`):**
  - search → open → follow a prerequisite → back;
  - the UCMP cycle;
  - filter sheet (department + level) → star → My Courses;
  - complete two courses → eligibility changes → "Unlocked for me";
  - the star prompt: defaults, changing picks, cancelling, "star only", already-starred, required, taken-together and not-in-catalogue courses, and every case with no prompt (120 steps);
  - "Your path": contents, completing a course from the path, a starred option steering the route, starring the whole path, a loop, and no card when there's nothing to plan.
- **Media:** `.maestro/screenshots.yaml` regenerates the screenshots above; `scripts/record-demo.sh explore|plan` records the demo GIFs from `.maestro/demos/` (needs ffmpeg).

## Assumptions and limitations

- **Prerequisite parsing is best-effort**, as the brief allows. The rules cover the observed grammar, and anything unusual degrades to readable text rather than being dropped. The raw string is always shown next to the tree.
- **Deeper tree levels use each course's newest version.** Only the course you're viewing follows the selected term, because "the prerequisites of a prerequisite in a given term" isn't well defined.
- **"Leads to" spans all terms.** A course that listed this one as a prerequisite in any term is included.
- **"Your path" plans by prerequisites only.** It shows which seasons each course runs in, but doesn't schedule courses into specific terms, balance credit loads, or account for co-requisites and exclusions. Where the data offers a choice, it takes your starred option or the shortest route; star a different option to change it.
- **Eligibility only checks course prerequisites.** Co-requisites, exclusions, grade conditions ("Grade A- or above") and non-course requirements aren't enforced. Grade notes are shown, and text requirements make the result "can't verify" rather than a guess.
- **Section data (quota, enrolment, waitlist) isn't shown**, per the 2026-09-24 brief update. The dataset doesn't include it.
- **Tested on simulators and emulators only**, not physical devices. Android hasn't been re-run since D16–D19 (see [Platforms tested](#platforms-tested)).

## Documentation

- [docs/DECISIONS.md](docs/DECISIONS.md): every significant decision, with the alternatives considered and why.
- [docs/BUILD-LOG.md](docs/BUILD-LOG.md): how the app was built, step by step, including what the QA pass found.

AI assistance (Claude Code) was used during development, as the brief permits.
