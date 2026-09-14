# PLAN 01 — UI/UX overhaul (overview)

The master doc for the Bookkeeper UI/UX overhaul. Design lives in [DESIGN.md](DESIGN.md). Each phase has its own `PLAN_01_PHASE_NN_*.md` with tasks, acceptance criteria and a "Notes and deviations" section. When a phase is finished, tick its criteria and record deviations there.

## Why

The UI grew one page at a time:

- **No component library.** Very long Tailwind class strings are copy-pasted across every row.
- **Inconsistent entity model.**
  - Expenses have a detail page. Bills and Subscriptions don't, though their payment records are the same shape as expense actuals.
  - Row actions differ page to page.
- **Clipped menus and popovers.** `ActionMenu` renders inside a table card with `overflow-x-auto` and always opens downward, so the last rows' menus are cut off or invisible.
- **Duplicated markup.**
  - Every list page re-renders its row four times (Active/Paused/Archived/Removed), each with separate desktop and mobile markup.
  - `monthly` and `income` are 1.5k–1.9k lines each.
- **No shared vocabulary.** There are no toasts, dialogs or sheets, the pages use native `confirm()`, and each page hand-rolls its own headers and stat blocks.

Goal: a calm, purposeful and consistent app on the same stack as home-work-hours-tracker. That means shadcn-svelte, bits-ui and a written DESIGN.md.

## Confirmed decisions

1. **Foundation: shadcn-svelte + bits-ui**, vendored in `apps/web/src/lib/components/ui/**`.
2. **Shared template, separate pages.** Bills, Subscriptions, Expenses and Utilities keep their own nav entries but share one list component and one detail-page template.
3. **Create/edit in a Sheet (desktop) or Drawer (mobile).** Clicking a row opens its detail page.
4. **Docs live in `foundational/`.** STYLEGUIDE.md is folded into DESIGN.md in Phase 6.
5. **`/frontend-design` is mandatory** at the start of every UI phase, and each phase ends with a screenshot review.

## Phases

| Phase | Doc                                                                                                | Summary                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0     | [PLAN_01_PHASE_00_PLAN_DOCS_ACTIONMENU_HOTFIX.md](PLAN_01_PHASE_00_PLAN_DOCS_ACTIONMENU_HOTFIX.md) | These docs, AGENTS.md rules, shadcn install, and the ActionMenu/HelpTooltip clipping fix |
| 1     | [PLAN_01_PHASE_01_FOUNDATION.md](PLAN_01_PHASE_01_FOUNDATION.md)                                   | Polymer tokens and type, primitives, app-level components                                |
| 2     | [PLAN_01_PHASE_02_APP_SHELL.md](PLAN_01_PHASE_02_APP_SHELL.md)                                     | Navigation regroup, mobile tab bar, toaster                                              |
| 3     | [PLAN_01_PHASE_03_UNIFIED_OUTGOINGS.md](PLAN_01_PHASE_03_UNIFIED_OUTGOINGS.md)                     | Shared list and detail template for all four outgoing kinds, plus API additions          |
| 4     | [PLAN_01_PHASE_04_MONTHLY_INCOME.md](PLAN_01_PHASE_04_MONTHLY_INCOME.md)                           | Month strip, Monthly and Income decomposition                                            |
| 5     | [PLAN_01_PHASE_05_REMAINING_PAGES.md](PLAN_01_PHASE_05_REMAINING_PAGES.md)                         | Dashboard, Categories, Settings, Tasks, Login, error page                                |
| 6     | [PLAN_01_PHASE_06_DOCS_CLEANUP.md](PLAN_01_PHASE_06_DOCS_CLEANUP.md)                               | Retire STYLEGUIDE.md, delete dead components                                             |

## Per-phase workflow: checks and reviews

Every phase goes through these steps. The next phase does not start until step 8 is done. The full rules are in [AGENTS.md](../AGENTS.md#checks-and-reviews-multi-phase-plans).

1. **Branch:** one branch per phase, named after its doc (e.g. `phase-03-unified-outgoings`). Never work on `main`.
2. **Local gate:**
   - `pnpm verify`, `pnpm test:e2e` and API coverage at 100% all pass.
   - For a UI-touching phase, screenshots are taken at 390px and 1440px, light and dark, en-AU, and reviewed against DESIGN.md with `/frontend-design`.
3. **Ask the owner** before committing, and again before pushing and opening the PR.
4. **Wait for all PR checks** to finish: CI (`.github/workflows/ci.yml`'s lint/typecheck/test/e2e jobs) plus **Kilo Code Review**.
5. **A green Kilo check is not proof there's nothing to fix.** Kilo's check can pass while its review still has critical, unaddressed comments — fetch and read every review comment once checks are green (`gh api repos/<owner>/<repo>/pulls/<n>/comments`, `gh pr view <n> --comments`).
6. **Handle each comment on its own diff line**, Kilo's or the owner's. Fix it, or decide deliberately not to, then reply on that specific thread with what changed or why nothing did.
7. **Resolve each thread individually** after replying (`gh api graphql`'s `resolveReviewThread`). Never post one consolidated reply. New commits from a fix go back through steps 2–4.
8. **Tick the phase doc** and log deviations, updating DESIGN.md's decisions log if the phase changed a design decision. Merge only with the owner's confirmation.

## Verification (every phase)

- `pnpm verify`
- `pnpm --filter api test:coverage` (100%) and `pnpm --filter web test:coverage` (no regression; `ui/**` is excluded)
- `pnpm test:e2e`
- Playwright screenshots of every touched page at 390px and 1440px, light and dark, en-AU
- Leave `pnpm dev:api` and `pnpm dev:web` running at the end of each session
