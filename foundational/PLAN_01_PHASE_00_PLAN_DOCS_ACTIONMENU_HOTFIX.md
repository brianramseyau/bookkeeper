# PLAN 01 · Phase 00 — Plan docs + ActionMenu hotfix

Branch: `phase-00-plan-docs-actionmenu-hotfix`. See [PLAN_01_OVERVIEW.md](PLAN_01_OVERVIEW.md).

## Goal

Land the plan and design docs and the new agent rules. Install the shadcn-svelte foundation, and fix the clipped row-action menu that makes the last rows of Expenses (and the other tables) unusable.

## Tasks

- [x] Write `foundational/DESIGN.md` ("Polymer"), `PLAN_01_OVERVIEW.md` and one doc per phase.
- [x] Update `AGENTS.md`:
  - [x] Plans and design pointers.
  - [x] Design rules: `/frontend-design` first, and the templated-tells list.
  - [x] Browser screenshot recipe.
  - [x] Checks-and-reviews workflow.
- [x] Install shadcn-svelte in `apps/web`:
  - [x] `components.json`
  - [x] `$lib/utils` (`cn`)
  - [x] Token block in `src/routes/layout.css` (see deviation below)
  - [x] `dropdown-menu`, `popover` and `button` via the CLI
- [x] Rebuild `ActionMenu.svelte` on bits-ui `DropdownMenu`: portalled, collision-aware, keyboard navigable. Kept the `label`/`actions` props. The custom `trigger` snippet now receives the trigger props to spread.
- [x] Rebuild `HelpTooltip.svelte` on `Popover`, replacing the hand-rolled fixed positioning.
- [x] Unit specs updated. Positioning is covered in Playwright, not jsdom.
- [x] New e2e spec (`e2e/action-menu.spec.ts`): the last row's action menu on `/expenses` opens fully inside the viewport, and its item fires.

## Acceptance criteria

- [x] The last row's ⋮ menu on `/expenses` is fully visible; the e2e test asserts the menu item's bounding box sits inside the viewport. Also manually confirmed against the real dev server (light and dark, 1000×620) — the menu now flips upward and the last row's Edit/Pause/Archive are fully readable, matching the reported bug screenshot's exact scenario.
- [x] Income's "Add ▾" menu still works (its own unit tests pass, plus the shared `ActionMenu` e2e coverage). Monthly's estimated-amount `HelpTooltip` wasn't separately re-verified live (see deviation below) but uses the same rebuilt component, unit-tested directly.
- [x] `pnpm verify` and `pnpm test:e2e` pass. API coverage is unchanged (no API changes).
- [x] Screenshots reviewed: desktop (1000×620, light/dark) and mobile (390×700, light) against the real dev server. See deviations below for what's outstanding.

## Notes and deviations

- **Tokens deliberately NOT switched to the Polymer palette yet.** `layout.css`'s new shadcn semantic tokens (`--background`, `--popover`, `--primary`, etc.) are mapped to the app's _existing_ slate/indigo palette, not "Polymer", so the new dropdown-menu/popover/button primitives render consistently with every page that hasn't been migrated. Phase 1 replaces these with the real Polymer tokens once the rest of the app moves onto them — this is called out at the top of the token block in `layout.css` and logged in `DESIGN.md`'s decisions log.
- **jsdom cannot lay out bits-ui's floating content** (no real layout engine, so floating-ui never resolves a final position): the popover/menu content stays `visibility: hidden` and its `getBoundingClientRect()` is always the zero rect. This has three knock-on effects worked around in the unit specs (see `ActionMenu.spec.ts`'s top-of-file comment for the full explanation):
  - `getByRole` queries into an open menu need `{ hidden: true }`.
  - An item's accessible _name_ computation comes back empty (inherited `visibility: hidden` excludes descendant text from "name from content"), so items are found with `getByText`/`within(...).getByText` instead of `getByRole(role, { name })`. Two existing specs (`expenses/page.spec.ts`, `income/page.spec.ts`) needed the same fix.
  - Simulating an outside click needs `fireEvent.pointerDown` at an explicit nonzero coordinate (the zero rect otherwise reads as "inside") and `waitFor` (bits-ui's dismiss check is a real, debounced timer) rather than `user.click`, which correctly refuses to click through the body's own `pointer-events: none` while a layer is open.
  - Added a global `afterEach` reset in `src/tests/setup.ts` for `<body>`'s inline style and bits-ui's `globalThis.bitsDismissableLayers` map — without it, one test's still-settling body-scroll-lock/dismiss-layer state leaks into the next test in the same file. This will matter again for every bits-ui overlay Phase 1 adds (Dialog, Sheet, Drawer, Select, Tabs), not just these two components.
  - None of this affects real browsers, which do lay things out — confirmed by the new `e2e/action-menu.spec.ts` passing for real, and by the manual dev-server screenshots above.
- **Login-throttle limited manual verification.** The dev server's login endpoint is rate-limited (5 attempts/15 min/IP+email, `apps/api/start/limiter.ts`). After several manual logins while iterating, I hit that limit before capturing a 1440px screenshot, a mobile _dark_ screenshot, or a live shot of Monthly's `HelpTooltip` specifically. What I do have: desktop (1000×620) light+dark of the `ActionMenu` fix, and mobile (390×700) light of Expenses' unaffected mobile row layout. `AGENTS.md`'s new "Verifying UI changes in a browser" section now calls out this throttle and recommends reusing one Playwright session across viewports/themes, and preferring the (unaffected) e2e suite over repeated dev-server logins — a future phase revisiting this page can take the missing shots at essentially no cost once the throttle window has passed.
- Added `src/lib/components/ui/` and `apps/web/vitest.config.ts`'s coverage exclusion, plus an `eslint.config.js` ignore for the same path — the generated files trip `svelte/valid-compile`'s `custom_element_props_identifier` rule, which isn't something to fix in vendored code.
- **Unrelated CI failure fixed along the way**: `test` and `e2e` both failed on the PR with `Invalid command exported from "demo_seed.js" file. Invalid URL`, thrown while `apps/api`'s test bootstrap boots the ace Kernel (`testUtils.db().migrate()` scans every command file, including `commands/demo_seed.ts`). Root cause: Node 24.20's stricter URL parsing breaks `@adonisjs/ace@14.1.0`'s command-metadata validator (adonisjs/ace#169), fixed upstream in `14.1.1` — already diagnosed and fixed the same way in EveryList (commit `468045b`). Added a `pnpm-workspace.yaml` override to `@adonisjs/ace: 14.1.1` and pinned Node to the exact `24.20.0` in `.nvmrc`, CI's `node-version` and the Dockerfile's base image tag, with both `package.json` `engines` fields set to a `>=24.20.0 <25` floor (not an exact pin there), matching EveryList's current state. This affects every PR against this repo, not just this one — main's CI hadn't run since before this Node version existed.
- **Kilo Code Review round**: the first review found 4 issues (1 warning, 3 suggestions) — `ActionMenu`'s (and Income's custom trigger's) `class` prop being silently dropped by a class attribute written after `{...props}`, `HelpTooltip`'s `role="tooltip"` conflicting with `PopoverTrigger`'s own `aria-haspopup="dialog"` (switched to `role="status"`), `e2e/action-menu.spec.ts` only checking the first menu item's bounding box instead of the whole menu container, and a stale version cited in the `pnpm-workspace.yaml` override comment. All four fixed, replied to and resolved individually; Kilo's re-review confirmed "No Issues Found — Recommendation: Merge".
