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

### D14 · Visual design pass (2026-09-25)

**Decision:** A small design system on top of the template's theme, applied to every screen:
- **Surfaces:** courses, sections and stats sit on cards (`surface` token, soft shadow in light mode, a lighter tone in dark mode, where shadows don't show).
- **Colour carries meaning:** `tint` = tappable, green (`success`) = met/completed, amber (`warning`) = still needed. Before this, "met" and "link" were the same colour. (The tint was orange here; D15 made it navy.)
- **Department colours:** each prefix hashes to one of 8 hues (no green or amber, which already carry meaning), shown as a badge on rows, course pages and the department picker. Same prefix, same colour, everywhere.
- **Search highlighting:** the matched part of the code (typed with any spacing or case) and the matched title words are emphasised, so it's clear why a result matched.
- **My Courses summary:** completed, credits earned (range-credit courses count at their minimum and the total shows "+"), and starred.

**Why:** The grading criteria include UX ("information and interactions are clear and coherent"). The old screens worked but were flat, and they used one colour for two meanings. Everything is JS/styling on existing dependencies: no new native modules, so there's no rebuild risk and the bundle barely grows.
**Kept fixed:** rows are still a fixed height (card + gap) so `getItemLayout` stays exact, and all test IDs and accessibility labels are unchanged.
**Also fixed:** completed courses were meant to be highlighted in the full chain, but the flag was never passed through. They now show as green chips there and in "Leads to".

### D15 · Navy and gold theme (2026-09-25)

**Decision:** Replace the Ignite starter's terracotta-on-beige with navy and gold, after HKUST's own colours:
- navy (`tint`) for links, buttons and selected filters;
- gold (`star`) for stars;
- cool neutral greys, and a deep navy ground in dark mode, where the tint lifts to a lighter blue so links stay readable;
- green and amber keep their meanings (met / still needed).

The department hue list swapped its plain blue for coral, so a badge never looks like a link. The app icon and splash use the same navy, and the graph's top node is gold.
**Why:** The starter palette read as a template. Navy and gold fit a HKUST course explorer and give the app a recognisable identity. Only token values changed; the components already read semantic tokens, so no component code was touched.

### D16 · Filters in a sheet (2026-09-26)

**Decision:** The two rows of filter chips on Explore became one button in the header that opens a sheet dropping from the top: term chips, a level segmented control, the department picker and "Unlocked for me". Changes are a draft until "Show N courses", which counts the results live and says "No matching courses" instead of applying a dead end. Tapping outside, swiping up or the back gesture discards the draft. Active filters show as removable pills under the search field, and the button carries a count badge.
**Why:** The chip rows took two lines of every Explore screen for something used occasionally, and the department picker already lived one tap away. A sheet with a live count lets people try combinations without losing their list, and the pills keep what's applied visible.
**Considered:** a bottom sheet (further from the button that opens it) and applying each change immediately (every tap would re-filter and scroll the list behind the sheet).

### D17 · Navy header band (2026-09-26)

**Decision:** A shared `HeroHeader`: a navy band with rounded bottom corners, a gold eyebrow, and faint rings with a gold node after the app icon. Explore puts the title, count, filter button and search on it; My Courses puts its stats tiles on it; a course page puts the code, title, info pills and "Mark as completed" on it, under a pinned navy bar where Back and Star stay reachable and the code fades in once the big one scrolls away.
**Why:** It gives each screen a clear top and brings the D15 identity into the layout, not just the accent colour.
**Tried and dropped:** a gold band for My Courses (too warm next to the navy), and a header that folds to a compact bar as Explore scrolls (the motion distracted more than the space helped).

### D18 · Starring a course you can't take yet (2026-09-27)

**Decision:** Starring a course whose prerequisites aren't met opens a prompt listing what's missing and offers to star those courses too. Required courses are checkboxes; "one of" groups are pick-one, preset to their first option; courses to be taken together are one option; already-starred and not-in-catalogue courses are shown but can't be picked. No prompt when unstarring, when there's nothing missing, when the requirement can't be verified (a free-text alternative such as an HKDSE result), or for a completed course.
**Why:** A star usually means "I want to take this", and the next question is "what do I need first?". The prompt answers it at that moment and turns the answer into stars, which the path (D19) then follows.
**Data:** `missingGroups()` turns a tree into these groups. A sweep over every course found three (LANG 3021, LANG 4030, SCIE 3500) that name the same course twice with different notes, so groups are de-duplicated.

### D19 · "Your path" (2026-09-27)

**Decision:** A course you can't take yet gets a "Your path" card: the courses still to take, as numbered steps, ending at the course. `planPath()` picks one concrete route:
- completed courses count, and a "one of" group already met needs nothing more;
- otherwise a group takes an option with a starred course first (the user's own choice, e.g. from D18), then the option needing the fewest courses in total, then the first listed;
- each course sits one step after its latest prerequisite, so step 1 is "can take now" and the number of steps is the shortest possible sequence of terms;
- free-text requirements flag their course ("+ other requirements") rather than being listed, since many are parsing fragments; loops are cut and noted.

**Why:** The tree and the full chain show *everything* (DSAA 3072's chain is 22 courses); a student needs *a* route (3 courses). It reuses the parsed trees, stars and completed courses, costs 0.02 ms, and one tap stars the whole route.
**Limits:** it plans by prerequisites only; it doesn't check which term a course runs in beyond showing its seasons, or credit loads, or co-requisites.

### D20 · Prerequisite map (2026-09-27)

**Decision:** A "Course map" screen, opened from any course page: the prerequisite chain and the courses it leads to, as a left-to-right graph you can pan, pinch-zoom and tap.
- **Structure you can't see in lists:** "one of" / "all of" groups become small junctions where their options meet; loops are dashed amber arcs; the course glows navy; completed courses are green, starred ones gold; "Your path" is drawn as a thick line with step badges.
- **Selecting** a course lights up its lineage (what it needs and what it feeds) and dims the rest; a card offers "Open course" and "Centre map here", which opens the map around that course, so you can walk the curriculum and come back.
- **Layout** (`prereq/map.ts`, pure TypeScript): longest-path columns (every edge points right, junctions half a column before their course), then rows placed outwards from the course at the average height of their neighbours and spread to a minimum gap. Loops are found with a DFS and left out of the layout.
- **Leads to is one level deep:** transitively it explodes (MATH 1020 reaches 295 courses in three steps). "Centre map here" is how you go further.
- **Rendering:** nodes are views, edges are SVG paths, and the whole canvas is one transformed view driven by Reanimated. It's drawn at 1.5× and zoom stops at 100%: scaling a view *up* on iOS blurs its text, scaling down doesn't. Taps are hit-tested against the layout, so one gesture detector handles pan, pinch, double-tap and tap.
- **First frame:** the whole map if it's readable that way; otherwise the course's neighbourhood (direct prerequisites, the course, what it leads to), falling back to prerequisites and the course when that's too wide.

**Why:** The tree shows one branch at a time and the full chain is a flat list; neither shows *shape*: where branches merge, which courses are bottlenecks, where your route runs. Chains are small (median 0, 99th percentile 20 courses, largest 59 nodes with junctions), so the whole thing fits and lays out in well under a millisecond.
**Cost:** `react-native-svg` (the standard Expo package; a native module, so the dev client was rebuilt) and a `GestureHandlerRootView` at the app root. **Considered:** Skia (smoother at huge sizes, but a heavier native dependency and unnecessary at these sizes) and a force-directed layout (organic but unstable between opens, and it hides the before/after direction that matters here).

### D21 · Light theme only (2026-09-27)

**Decision:** The app is always light, whatever the phone is set to: `ThemeProvider` gets `initialContext="light"` (the template's own override), and the native `userInterfaceStyle` is `light`, so the keyboard, system sheets and splash match.
**Why:** The navy band, the gold accents and the map were designed and tuned in light mode, and every screenshot, demo and Maestro flow covers light mode. Dark mode was a second theme to keep in step with each new screen, and parts of it (the filter sheet, the Explore header) had never been checked. One polished theme beats two uneven ones.
**Kept:** the dark palette and the `isDark` branches are still in the code, so bringing dark mode back is removing the override and checking each screen.

### D22 · Exploring forward on the map (2026-09-27)

**Decision:** On the map, tapping a course on the "leads to" side opens a new column to its right with what *that* course leads to, in the same map. The courses tapped through form a trail: its edges are drawn as a navy route, a breadcrumb (`COMP 2011 › COMP 2012 › COMP 4211`) jumps back to any point, and tapping a different course in an earlier column switches branch from there. A "→ N" badge shows how many courses each one would open; the map glides so the new column is in view.
**Why:** D20 showed only the direct "leads to" courses, and going further meant re-centring, which loses where you came from. Students think forward ("I've done COMP 2011; what does it open, and what does *that* open?"), so the map should let them walk forward and keep the route.
**One branch at a time:** all of it at once is a hairball (MATH 1020 reaches 295 courses in three steps); one column per tap stays readable. A course already on the map (a prerequisite, the course itself, an earlier column) isn't moved or duplicated, and an edge that would point back into it is left out, so every edge still points right.
**Implementation:** `buildCourseMap(…, { trail })` adds the columns; a trail entry that isn't in the column its position implies ends the trail, so a stale trail can't draw a broken map. When a new column grows the map up or left, the pan is shifted by the same amount before the frame is drawn, so nothing on screen jumps.

### D23 · What you can take, on the map; and completing with prerequisites (2026-09-28)

**Decision:**
- **The map always shows both directions.** The Prerequisites / Both / Leads to switch is gone: with forward exploration (D22) the map reads as "before → this course → where it leads", and one-sided views only hid context.
- **Each course says whether you can take it,** once anything is marked completed: CAN TAKE (every prerequisite met), NEEDS n (n requirements missing) or ? (what's left is free text the app can't check). Lines out of completed courses and satisfied groups turn green ("ONE OF 3 ✓"). Before anything is completed, statuses are hidden (every course would say "needs"), and the card suggests marking what you've done.
- **The selection card gives a verdict** ("You can take this", "Still needed: …", "Completed") with Mark completed / Undo, where the course sits ("Direct prerequisite of COMP 3711", "2 steps before…", "Builds on…"), and two lines of its description.
- **Marking a course completed whose prerequisites aren't marked** asks "Did you also complete these?", on the map and the course page, with the star prompt's picker (required courses ticked, "one of" groups pick-one). Un-completing stays one tap.

**Why:** Chains are the point of the app, and "can I take it, and how far along am I?" is the question a student brings to them; the answer should be on the map, not one screen away. Completing a 3000-level course implies its prerequisites, so asking once saves entering a history course by course, and it makes the green spread down the chain as it should.
**Implementation:** `courseStatus()` (evaluate.ts) is the one answer used everywhere; the prompt is `StarPrompt` with `kind="complete"` (different wording, icons and test IDs, same logic), so there's one picker to test.
**Considered:** gating "completed" behind an "enrolled" state. The brief's optional list asks for "prerequisite completion", past courses would need two taps each, and "enrolled" could be mistaken for registration in an app that isn't connected to it.
