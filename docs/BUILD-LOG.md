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

**4 · QA on the simulator**
- First native build blocked by the Mac, not the app: the simulator's first boot compiles Metal shaders while Spotlight indexed the new 8.5 GB runtime (load average ~320). A clean reboot of the simulator fixed it.
- Metro had been started with `CI=1`, which disables file watching, so early edits never reached the app. Restarted it normally.
- Installed Maestro and drove every screen: found and fixed the scrolling header, clipped rows, missing accessibility labels and dark-mode contrast (D12).
- Wrote 3 Maestro flows, all passing from a clean state.

**5 · Completed courses** (D11)
- `evaluate.ts` with three-valued logic, plus `missingRequirements()` for a readable "Still needed" list. 6 unit tests.
- Detail screen: completed toggle, eligibility banner, ticks in the tree, "MET ✓" on satisfied groups, completed courses highlighted in the full chain.
- Explore: "Unlocked for me". The Starred tab became My Courses (Starred + Completed).
- 4th Maestro flow; 43 Jest tests.

**6 · Polish**
- App icon and splash: a small prerequisite graph in the app's accent colour, replacing the Ignite branding. The display name is "HKUST Courses".
- `yarn bench`: every interaction is under 1 ms in Node; parsing the raw dataset would cost ~100 ms at startup.
- README covering every section the brief requires.

**7 · Submission checks**
- Fresh `git clone` from GitHub → `yarn install --frozen-lockfile` → compile ✓ lint ✓ 43/43 tests ✓ → `yarn data` regenerates byte-identical output (0 files changed) ✓ → native Release build from scratch ✓ → 4/4 Maestro flows ✓.
- Final code review found one edge case: "Unlocked for me" stayed active, invisibly, after un-completing every course. Fixed.

**8 · Android**
- Toolchain: JDK 17 (the JDK React Native's Android build targets; the machine only had JDK 25), Android SDK command-line tools, an API 36 Pixel 8 emulator, NDK 27.1.
- `expo run:android` built and ran first time; no app code changes were needed.
- The first Maestro runs failed for environment reasons, not app reasons:
  - The emulator's system services crashed while Gradle was compiling alongside it on a 16 GB Mac. Fixed by giving the emulator 4 GB and never building while it runs tests.
  - With `clearState`, the dev client falls back to its server list and re-downloads the JS bundle, which outran the flow's 20 s wait. Tested the Release APK instead, which is also what a user installs.
- One real flow fix: after navigating back, Android's keyboard loses its connection to the search field, so typing without refocusing went nowhere (iOS keeps focus). `CompletionUnlocks` now taps the field before typing, like a user would.
- Release APK: 4/4 Maestro flows pass, and the updated flows still pass 4/4 on an iOS Release build. Also checked by hand: the hardware back button walks the course stack, dark mode follows the system live, and completed courses survive a relaunch.

**9 · Design pass** (D14)
- Tokens (`surface`, `surfaceAlt`, `tintSoft`, `success`, `warning`), department colours, and a shared card style.
- Explore: course cards with department badges and a credits pill, highlighted search matches, a completed tick, and a header subtitle showing the count and term.
- Course page: a header card (badge, title, info pills, "Mark as completed" button), sections as cards with icons, a coloured eligibility banner, and tree group labels as pills.
- My Courses: stats tiles. Department picker: badges.
- 5 new Jest tests for highlighting (48 total). Maestro: `PrerequisiteCycle` now scrolls to the chain summary, since the taller cards moved it below the fold. `.maestro/screenshots.yaml` produces the README screenshots.
