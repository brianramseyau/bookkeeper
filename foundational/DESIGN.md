# DESIGN — Bookkeeper

The design system and brand rules for `apps/web`. **Load the `/frontend-design` skill before any UI work** (`.claude/skills/frontend-design`). Load `dataviz` before any chart work. Log every decision or deviation in the decisions log at the bottom of this file.

## Brief

- **Subject:** a joint household account for two people, replacing the "Joint Account Workbook" spreadsheet. The money is Australian dollars, and the financial year runs 1 July – 30 June.
- **Audience:** two partners. Most days it's a quick look on a phone ("did the power bill come out?"). At month-end it's a desktop session reconciling everything.
- **Job:** answer _"are we OK this month, and what's coming?"_

Every screen answers exactly one question:

| Screen                                    | Question                            |
| ----------------------------------------- | ----------------------------------- |
| Dashboard                                 | Are we OK?                          |
| Monthly                                   | What's in and out this month?       |
| Bills, Subscriptions, Expenses, Utilities | What do we pay for?                 |
| A single item's detail page               | Is this one costing more over time? |
| Income                                    | What came in?                       |

If a section doesn't help answer its screen's question, it belongs somewhere else.

## Concept: "Polymer"

The palette is taken from Australian polymer banknotes, the material this money is actually made of. The ground is a faint green-grey, like clear polymer: not cream, not navy, not black. Banknote colours are used sparingly, and each means exactly one thing:

- **Violet ($5 note):** interactive elements only.
- **Green ($100):** money coming in.
- **Gold ($50):** something needs attention.
- **Red ($20):** something is wrong.

Money going out, which is most of what's on screen, stays plain ink. The colour that does appear therefore always means something.

Directions rejected, and why:

- **The previous indigo-on-slate:** it was the Tailwind default look.
- **Ink and lamp-amber:** that's home-work-hours-tracker's identity.
- **Cream with a serif:** the generic "finance" default.

## Colour

Tokens live in `src/routes/layout.css`. They are mapped onto the shadcn-svelte variables:

- `--background` = ground
- `--card` / `--popover` = surface
- `--foreground` = ink
- `--primary` / `--ring` = violet
- `--border` = rule
- `--destructive` = over

The brand names are also exposed as Tailwind colours (`bg-ground`, `text-in`, `bg-due/15`, …).

| Token     | Light     | Dark      | Role                                                                      |
| --------- | --------- | --------- | ------------------------------------------------------------------------- |
| `ground`  | `#F2F5F3` | `#101613` | Page background (polymer)                                                 |
| `surface` | `#FFFFFF` | `#18201C` | Cards, sheets, menus, popovers                                            |
| `ink`     | `#16201B` | `#E5ECE8` | Text, and money going out                                                 |
| `muted`   | `#5C6A63` | `#93A299` | Secondary text, meta                                                      |
| `rule`    | `#DAE1DC` | `#27322C` | Borders and dividers                                                      |
| `violet`  | `#5B3FA0` | `#B7A1EC` | Buttons, links, focus, selection. **Interactive elements only**           |
| `in`      | `#0A6B50` | `#3FC79D` | Money coming in, surplus                                                  |
| `due`     | `#8A6200` | `#E6AE34` | Due soon; estimated or assumed values. Text in `due` sits on a `due` tint |
| `over`    | `#9C3320` | `#F2735A` | Overdue, deficit, delete                                                  |

- Each person's `displayColor` (Settings) remains their per-person colour in Income, Subscriptions and charts.
- Contrast is validated with axe and screenshots (Phase 1). Light-mode `in`, `due` and `over` are all darker than the literal $100/$50/$20-note hues DESIGN.md started from, in two rounds: first checked as plain text against `ground` (the literal notes' green/gold/red only hit 4.84:1/3.13:1/5.00:1 there - the gold outright failed WCAG AA's 4.5:1), then checked _again_ with axe against real rendered badges once Phase 1 actually built them, which is a different (and stricter) test than text-on-`ground` - see the next entry.

### Status is never shown by colour alone

| State             | Colour  | Also shown by                         |
| ----------------- | ------- | ------------------------------------- |
| Overdue           | `over`  | Alert icon plus "3 days overdue"      |
| Due soon          | `due`   | Clock icon plus "Due in 4 days"       |
| Paid              | `in`    | Check icon plus "Paid"                |
| Estimated/assumed | `due`   | Dotted underline plus a `HelpTooltip` |
| Paused / archived | neutral | Text badge                            |

## Type

The whole app uses one variable superfamily, **Recursive** (Arrow Type), self-hosted: no external font requests, which keeps the CSP clean. Its axes are assigned roles:

| Role    | Setting                               | Used for                                                  |
| ------- | ------------------------------------- | --------------------------------------------------------- |
| Display | `CASL 1`, wght 750, `slnt -4`         | Page titles and the month strip's headline figure only    |
| UI/body | Sans Linear, `CASL 0`, wght 400 / 560 | Everything else                                           |
| Figures | `MONO 1`, `CASL 0`, `tabular-nums`    | Every money value and table date, right-aligned in tables |

- **Why:** the casual display cut reads like the partners writing in the household book, and the mono figures read like the spreadsheet it replaced. One file makes the pairing coherent and cheap.
- **Open risk:** if the Linear sans reads too quirky in dense 14px tables, only the UI/body role switches to **Hanken Grotesk**. Decide from Phase 1 screenshots and log it below.
- **Scale (1.2 ratio):** 12 / 13 / 14 (UI base) / 16 / 20 / 24 / 30 / 40px. 40px is reserved for the month strip figure.
- **Line-height:** 1.5 for body, 1.15 for display.

### Copy rules

- Sentence case everywhere. No all-caps eyebrows, no middle-dot meta strings (use badges), no `→` suffixes on links or buttons.
- Buttons are verb-first and say exactly what happens: "Add bill", "Save changes", "Log payment".
- Lifecycle verbs are fixed, and the toast repeats the verb:

  | Action    | Toast             |
  | --------- | ----------------- |
  | Pause     | "Bill paused"     |
  | Resume    | "Bill resumed"    |
  | Archive   | "Bill archived"   |
  | Unarchive | "Bill unarchived" |
  | Restore   | "Bill restored"   |
  | Delete    | "Bill deleted"    |

  "Unpause" is retired in favour of Resume.

- Errors say what to fix ("Enter an amount"). They never apologise and are never vague.
- Empty states invite action: "No bills yet. Add the first one to see when it's due."

## Layout

- Content column: `max-w-5xl`. Monthly may widen to `6xl`.
- Cards are `surface` with a `rule` border and **no shadow**. Only floating surfaces (menus, popovers, sheets, dialogs) get elevation.
- Radius: 10px for cards and sheets, 6px for controls, full for badges and chips. Radii are not all the same.
- **Mobile lists** (below `sm`): every list is a two-line row with a 48px minimum height:
  - Left: the name on top, meta badges underneath.
  - Right: the amount on top, the due chip underneath.
  - Far right: the ⋮ menu.
- At `sm+` the same data renders as a real table. **One row component drives both.** Never write parallel desktop and mobile markup.
- Lifecycle groups (Paused, Archived, Removed) sit behind Tabs with counts, not uppercase section rows.
- Adding and editing happen in a **Sheet** (desktop) or **Drawer** (mobile), never in an inline table row. Clicking a row opens its detail page.

### Motion

- The month strip's running-balance line draws in once on first load.
- Sheets, drawers and menus use bits-ui's default transitions.
- Nothing else animates. `prefers-reduced-motion` disables all of the above.

## Signature element: the month strip

A horizontal timeline of the current month. It is the Dashboard's hero and the Monthly page's header, replacing generic stat-card grids.

```text
 Sept 2026                                    +$1,240 projected surplus
 ────────────────────────────────────────────────────────────────────
  ▲pay        ▲pay                   ▲pay                 ▲pay       income (in), above the line
 ─┼──┬──┬─────┼───┬──────┬──────|────┼──┬──────┬──────────┼───── 1 … 30
     ▼  ▼         ▼      ▼     today    ▼      ▼                     outgoings (ink; due / over tints)
    rent power  netflix water          rates  car rego               below the line
 ╲___╱‾‾‾‾╲____╱‾‾‾‾‾‾╲__________________  running balance (thin line)
```

- Paydays sit above the line and bills below it, each on the day it falls due. A "today" marker and a thin running-balance line complete it.
- Tapping a tick opens that line's detail page. On mobile the strip scrolls horizontally, snapping to today.
- Detail pages get a 12-month variant on the same baseline.
- Layout maths live in a pure, unit-tested `$lib/month-strip.ts`.

## Interaction rules

- Every floating surface (menu, popover, tooltip, select) is **portalled and collision-aware** via bits-ui, so it is never clipped by a scrolling card and flips upward near the viewport edge.
- The same row-action menu (`ActionMenu`) is used on mobile and desktop.
- Destructive actions confirm through an AlertDialog, never `confirm()`.
- Mutations confirm with a Sonner toast. Inline errors are only for form validation.
- Focus is always visible: a 2px `violet` ring.

## Components

- Primitives come from **shadcn-svelte**, vendored in `src/lib/components/ui/**`, generated by the CLI (`pnpm dlx shadcn-svelte@latest add <name> -y`, config in `apps/web/components.json`). Wrap and compose them. Don't edit `ui/**` beyond what the CLI generates. `ui/**` is excluded from coverage.
- App-level compositions live in `src/lib/components/` (and `src/lib/components/app/` from Phase 1). Icons for app code: `@mdi/js`. The vendored components use `@lucide/svelte` internally.

## Quality floor

- Responsive down to 360px.
- Visible keyboard focus.
- Reduced motion respected.
- Axe-clean contrast in both themes.
- Screenshots reviewed at 390px and 1440px, light and dark, for every UI change (see AGENTS.md).

## Decisions log

| Date       | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-09-14 | "Polymer" direction set with `/frontend-design` during the overhaul plan (PLAN_01). Starting point only; Phase 1 confirms or adjusts it against rendered screens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-14 | Phase 0 adds shadcn-svelte `dropdown-menu`, `popover` and `button` only, to fix clipped action menus/tooltips. Their shadcn semantic tokens (`--background`, `--popover`, `--primary`, …) are mapped to the app's _existing_ slate/indigo palette for now, not the Polymer palette above — existing pages keep their slate/indigo classes until Phase 1 does the real token swap, so nothing changes visually except the fix itself.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-14 | jsdom can't lay out bits-ui's floating content (`Popover`/`DropdownMenu`), so its content never leaves `visibility: hidden` and its rect stays zero-sized in unit tests. `ActionMenu.spec.ts`/`HelpTooltip.spec.ts` document and work around this (`{ hidden: true }` on role queries, `getByText` instead of `getByRole(role, { name })`, an explicit nonzero coordinate + `waitFor` for outside-click). `src/tests/setup.ts` also resets `<body>`'s style and bits-ui's dismissable-layer registry every test — needed again by any future bits-ui overlay (Dialog, Sheet, Drawer, Select, Tabs in Phase 1). Real positioning is covered in `e2e/action-menu.spec.ts` instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 2026-09-14 | `HelpTooltip`'s panel is `role="status"`, not `role="tooltip"` (caught in Phase 0's Kilo Code Review). A true ARIA tooltip is non-interactive, hover/focus-triggered description text; this panel is click-to-open and built on bits-ui's `Popover`, whose trigger already carries `aria-haspopup="dialog"`/`aria-expanded` — `role="tooltip"` on the content contradicted that. `status` (implicit `aria-live="polite"`) announces the explanation the moment it appears, which is the part that matters without a hover state. Use this pattern for any future click-to-reveal explanation panel, not `role="tooltip"`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-15 | Recursive confirmed for both type roles - no fallback to Hanken Grotesk. Checked on the `/_design` specimen: the display role's CASL 1/wght 750/slnt -4 combination is visibly, distinctively casual (single-story "a", curled "y") at heading size, and the UI/body role (CASL 0) reads as a plain, professional sans at 14px in dense content - none of the "too quirky for body text" risk the original entry flagged. `document.fonts` confirms `Recursive Variable` actually loads and the computed `font-variation-settings`/`font-weight`/`font-style` match the intended axis values exactly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-09-15 | A semantic colour passing as plain text against `ground`/`surface` does **not** mean it passes as a badge built from that same colour, and checking one doesn't substitute for checking the other - axe against the real rendered `/_design` specimen (not hand-computed contrast) caught two failures neither manual check nor the Phase 0 pass had: light `due` (`#8A6200`, 5.0:1 on `ground`) only hit 4.42:1 against its own 15%-mix `due-tint` badge background, and dark `over` was fine as text but its `over-tint` percentage needed lowering to keep the badge readable. Separately, axe caught that shadcn's own generated `destructive` Button/Badge variants (`bg-destructive/10` etc., driven by `--destructive` = `--over`) have the _identical_ colour-on-its-own-tint problem via a completely different mechanism (Tailwind's opacity modifier, not our `color-mix` tint variables) - tuning `--over-tint`'s percentage did nothing for it, since it's `--over` the base colour that needed darkening again, from `#BE3A27` to `#9C3320`. Check every colour-on-its-own-tint pairing - both ours and the vendored components' - with axe against something actually using it, not just against `ground`/`surface`, before calling a new semantic colour done. |
| 2026-09-15 | `+layout.svelte`'s root wrapper (`bg-slate-50 dark:bg-slate-900`) and its loading-state div moved onto `bg-background`/`text-muted-foreground` - found while investigating an axe report that named `.min-h-screen` as a contributing ancestor. It was a self-inflicted seam (the `html` rule already used `bg-ground`), not the actual violation, but a real one anyway: the app's own root shell is as much a "primitive" as `Card` for the "no page uses raw indigo/slate for primitives" bar. The nav bar's own slate classes are untouched - that's the App Shell work, Phase 2's job (`PLAN_01_PHASE_02_APP_SHELL.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-15 | `Sonner`'s vendored wrapper (`ui/sonner/sonner.svelte`) themes itself from `mode-watcher`'s `mode.current`, a separate theme-detection library from this app's own `$lib/stores/theme.svelte.ts` (`themeState.current`, driven by the nav's theme toggle). Left as the CLI generated it rather than hand-edited (Phase 1 doesn't mount `<Toaster>` anywhere yet - that's Phase 2's job per `PLAN_01_PHASE_02_APP_SHELL.md`). Whoever mounts it there needs an app-level wrapper that overrides bits-ui's own `theme={mode.current}` with `theme={themeState.current}` (passed after it in the markup so it wins) - do **not** add `mode-watcher` as a second, unsynced theme source.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-09-15 | `IconActionButton`'s `neutral`/`cancel`/`muted` variants hover to `text-foreground` (ink), not `text-primary` (violet) - a deliberate change from the pre-Polymer version, which hovered a plain "Edit" pencil to indigo. DESIGN.md reserves violet for interactive elements specifically (buttons, links, focus, selection), not as a generic hover accent on every icon action; only the variants that actually mean something (`primary`, `danger`, `amber`, `success`) get a Polymer colour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
