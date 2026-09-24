# Decision log

Short, dated records of the choices that shaped this app: what was decided, the alternatives, and why.

---

### D1 · Build on the provided Ignite template (2026-09-24)

**Decision:** Start from `USThing/AppTechTest2627Fall` (Ignite 11.5, Expo SDK 55, RN 0.83) and remove the demo screens, rather than starting from `create-expo-app`.
**Why:** The template's theme, `Screen`/`ListItem`/`TextField` components, MMKV storage and navigation are already set up, and they match how the team works. The template's two commits are kept as the base of the history, so it's clear which code is the template's and which is mine.

### D2 · Preprocess the dataset at build time, not on device (2026-09-24)

**Context:** `courses.json` is 28 MB: 15,178 rows = 4 terms × ~3,800 courses, but only **4,030 unique codes**. CILOs and descriptions are about half the bytes.
**Decision:** `scripts/build-data.ts` (`yarn data`) produces:

| File | Size | Loaded |
|---|---|---|
| `index.json`: one row per code (code, title, credits, UG/PG, terms offered) | ~570 KB | on first screen |
| `prereqs.json`: parsed prerequisite trees + reverse "unlocks" index | ~180 KB | on first detail view |
| `details/<PREFIX>.json`: full per-term content, 129 files | 5.3 MB total, ≤460 KB each | when a course of that department is opened |

**Why:** The device never parses 28 MB. The work that's the same every time (grouping, deduplicating, parsing prerequisites) runs once on a laptop in about 2 s instead of on every app launch.
**Alternatives rejected:**
- *Bundle the raw file:* parsing it at startup is slow and memory-heavy.
- *SQLite:* adds a native dependency, a migration/copy step and async queries, for a 4k-row read-only dataset that fits comfortably in memory.
- *Ship chunks as assets read with expo-file-system:* truly off-bundle, but async and more code. The bundled lazy `require` gets most of the benefit.

**Metro detail:** `require()` paths must be static, so the script also generates `details/index.ts`, a map of `PREFIX: () => require("./PREFIX.json")`. With `inlineRequires`, a chunk's module runs only when first called.
**Output is committed**, so `git clone` → run works without running the script.

### D3 · Store details per version, not per course (2026-09-24)

**Context:** The same code's content changes between terms: the prerequisite differs for 117 codes, the description for 107, the title for 58.
**Decision:** Each course keeps a list of *versions*, and each version lists the terms it applies to. Identical terms collapse into one version. The detail screen shows the version for the selected term, or the newest one when the course isn't offered that term.
**Why:** Merging to "latest only" would show wrong prerequisites for older terms. Storing every row separately would triple the details size.

### D4 · Prerequisite parsing: small tokenizer + precedence rules (2026-09-24)

**Context:** 787 distinct prerequisite strings. Most are `AND`/`OR` with `()`/`[]` grouping, plus noise: `(prior to 2025-26)`, `Grade A- or above in MATH 1014`, ` / ` meaning OR, `;`/`,` separators, `UCUG1001` (no space), and 23 strings with no course at all (HKDSE, IELTS, "MSc status").
**Decision:** Tokenize into codes, operators, brackets, separators and words; then parse by recursive descent.
- **OR binds tighter than AND.** Of 175 strings that mix both, only 3 lack grouping, and the one real case (`ECON 2103, ECON 2113 OR ECON 3113, AND ECON 2123 OR ECON 3123`) is only right this way.
- `,` and `;` take the operator of their segment (`A, B OR C` is any; `A, B, and C` is all).
- `or above` / `or equivalent` are prose, not operators.
- Text next to a course becomes its **note** (shown in the UI). Text on its own stays a **text node**. Nothing is silently dropped.
- The raw string is always shown alongside the tree so users can check it.

**Why not a full NLP parser:** the brief says one isn't expected, and these rules cover the observed grammar. Covered by unit tests.

### D5 · Cycle-safe traversal by ancestor path (2026-09-24)

**Context:** The real data has a cycle (`UCMP 6030 → UCMP 6040 → UCMP 6030`) and many shared subtrees (e.g. COMP 2011 under many courses). The longest chain is 9 levels (DSAA 3072).
**Decision:**
- *Tree view* expands one level at a time. Each node knows its ancestor path, and a code already on that path renders as "cycle" and can't be expanded. The same course on *different* branches stays expandable, since that's legitimate.
- *Full-chain summary* is a BFS with a visited set: it terminates on cycles and lists each course once at its shallowest depth.
- *"Unlocks"* is a reverse index precomputed at build time: an O(1) lookup instead of scanning every course.

### D6 · Search: linear ranked scan, no index library (2026-09-24)

**Decision:** Precompute lower-case keys once, then scan all ~4,000 courses on each (deferred) keystroke, ranking: exact code › code prefix › title prefix › title word › title substring › all words in any order. Codes match regardless of spacing/case (`comp1021`).
**Why:** A scan of 4k short strings takes about 1–2 ms. An inverted index or fuzzy library (Fuse.js) would add size and complexity with no noticeable speed gain at this scale.

### D7 · State: component state + MMKV hooks, no state library (2026-09-24)

**Decision:** Search text, department and UG/PG filters are local to the Explore screen. The selected semester and starred courses persist via `react-native-mmkv` hooks (`useMMKVString` / `useMMKVObject`), which the template already uses for its theme setting.
**Why:** The catalogue is static and synchronous, so there's no server state to cache. The only shared state is two small preferences, and MMKV hooks subscribe to their key, so every screen stays in sync with no provider. Redux/MobX/Zustand would add a layer without solving a real problem here.
**Detail:** The term is stored by *term code* (`"2610"`), not array position, so it stays valid if the dataset is regenerated with more terms. Starred courses are stored as codes, and anything no longer in the catalogue is skipped.

### D8 · Lists: FlatList with fixed row height (2026-09-24)

**Decision:** Plain `FlatList` + `getItemLayout` (76 pt rows), `React.memo` rows with a stable `onPress`, a tuned `windowSize`/batch size, and `useDeferredValue` on the search text.
**Why:** With fixed heights, FlatList never measures rows, and deferring the query keeps the text input responsive while the list catches up. FlashList would help with variable-height or much larger lists. At ~4k fixed-height rows it's another native dependency for little gain.

### D9 · Bundle size vs. startup (2026-09-24)

**Observation:** The production iOS bundle is 9.5 MB of Hermes bytecode, mostly the 129 detail chunks.
**Why that's acceptable:** Hermes memory-maps bytecode and runs a module's code only when it's first `require`d, so chunks you never open cost disk space, not startup time or memory. Startup loads only the index (and the prerequisite graph on the first detail view).
**If it mattered more:** ship the chunks as assets and read them with `expo-file-system`, or put them in SQLite. That's a small change behind `getCourseVersions()`.

### D10 · Icons: @expo/vector-icons (2026-09-24)

**Decision:** Use Ionicons from `@expo/vector-icons` for search, star, chevrons and cycle markers. The template's PNG `Icon` still backs its own components (e.g. the header back button).
**Why:** The template's PNG set has no search/star/tree icons, and `@expo/vector-icons` already ships with Expo.

### D11 · Completed courses and three-valued eligibility (2026-09-24)

**Decision:** Users can mark courses as completed. A course's prerequisite tree is then evaluated as met / unmet / **unknown**:
- AND is unmet if any child is unmet;
- OR is met if any child is met;
- free text ("Level 3 in HKDSE Physics") is unknown.

The detail screen says "You meet the prerequisites", "Still needed: …", or "can't verify". Explore gains an "Unlocked for me" filter.
**Why three values:** Treating text as met would tell a student they can take a course they can't. Treating it as unmet would hide courses they can take. "Unknown" is the honest answer and keeps the logic simple (Kleene logic).
**Why only direct prerequisites:** Having completed a course is a fact, and re-deriving it from *its* prerequisites would be wrong (students get waivers, and prerequisites change over time). It also means evaluation never crosses courses, so it can't loop, and all 4,030 courses evaluate in under 1 ms.
**Why this feature over others:** It's on the brief's optional list, and it turns the prerequisite data into an answer to the question students actually have ("what can I take next?"). It also reuses the parsed trees rather than adding a new data path. Rejected for scope: graph visualisation and fuzzy search, both larger and lower value.

### D12 · Fixes from the simulator QA pass (2026-09-24)

I drove every screen with Maestro in light and dark mode, and fixed:
- The detail header scrolled away with the content. It's now fixed: Back and Star are always reachable.
- Two-line titles clipped in fixed-height rows. Titles are now one line with the full title in the accessibility label, and font scaling is capped, so the fixed row height (needed for `getItemLayout`) always holds.
- Icon-only buttons, filter chips and tree nodes lacked spoken labels. Each now announces its code, title, and state (completed, loops back, no prerequisites).
- Overlay colours vanished in dark mode. Replaced them with theme tokens.

### D13 · End-to-end tests with Maestro (2026-09-24)

**Decision:** Re-enable the template's Maestro setup with four flows covering the brief's core paths: search/open/follow, the real prerequisite cycle, filters and starring, completion and "Unlocked for me".
**Why:** The unit tests prove the algorithms. These flows prove the screens wire them up correctly, and they caught real issues during QA. The template already shipped Maestro support, so this adds no new tooling.
