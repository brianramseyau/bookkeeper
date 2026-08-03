# STYLEGUIDE.md

UI/CSS conventions for `apps/web`, as they actually exist in the codebase
today. This documents the current, real patterns so new work matches them —
it isn't an aspirational design system. Tailwind CSS v4 via
`@tailwindcss/vite` (no `tailwind.config.js`; see AGENTS.md). Prettier +
`prettier-plugin-tailwindcss` auto-sorts class order — write classes in any
order and run `pnpm format`.

Every example below is copied verbatim from a real file. When adding a new
UI element, grep the referenced file for the pattern rather than inventing a
new one.

## Buttons

Three button "components" cover almost every button in the app. Prefer
these over a raw `<button class="...">` unless a route needs something a
variant can't express (see "Ad hoc buttons" below).

- **Primary** — `$lib/components/PrimaryButton.svelte`. Filled indigo,
  used for the main submit action of a form/section (Save, Add, Log
  income, Backup now, Download JSON). Base class:
  `rounded-md bg-indigo-600 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400`.
  `size` prop is `sm` (`px-3 py-1.5`) / `md` (`px-4 py-1.5`, default) /
  `lg` (`px-4 py-2`, used for the single-field "quick add" forms — see
  Categories/Utilities below). Renders as `<a>` if `href` is passed,
  otherwise `<button>`.
- **Icon action button** — `$lib/components/IconActionButton.svelte`. Used
  for every row-level action (Edit / Delete / Save / Cancel / Pause /
  Unpause / Archive / Unarchive / Restore) inside tables and inline edit
  rows. See "Icon action buttons" below for the full icon/variant mapping.
  This replaced a text-only `TextActionButton` (removed) specifically
  because text links are a hover/mouse-first pattern — see that section for
  why and what changed.
- **Nav icon button** — no shared component; `ThemeToggleButton.svelte`,
  `LogoutButton.svelte`, and `SettingsLink.svelte`
  (`apps/web/src/lib/components/`) each hard-code the same shape: a 20px
  heroicon-style inline SVG (`class="size-5"`) inside a button/link with
  `class={[padding, 'rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200']}`,
  `padding` prop `p-1.5` (desktop nav, default) or `p-2.5` (mobile nav —
  bigger tap target). Distinct from `IconActionButton` (top-level nav
  chrome, not a table/row action) — don't merge the two, but note
  `IconActionButton`'s hover/color treatment was deliberately modeled on
  this pattern for visual consistency.

### Icon action buttons

Row-level table actions (Edit, Save, Cancel, Pause, Unpause, Archive,
Unarchive, Delete, Restore) are icons, not text — `TextActionButton` (a
`text-xs` link) was removed and replaced app-wide by
`$lib/components/IconActionButton.svelte`. Text-only row actions are a
hover/mouse-first pattern: on a phone there's no hover state to reveal
intent, and a bare text link is a small, inconsistent tap target next to
its neighbors. Icons plus a fixed touch-sized hit area fix both problems
and read the same on desktop and mobile.

- **Icon set: Material Design Icons**, via the `@mdi/js` package (path-data
  constants, no font/icon-sprite dependency) — `import { mdiPencil } from
'@mdi/js'`, passed to `IconActionButton`'s `path` prop. This was a
  deliberate choice over Heroicons: Heroicons has no official Svelte
  package, and `@mdi/js` gives exact, verified path data instead of
  hand-copied/hand-typed SVG paths.
- **Sizing**: `p-2` button padding around a `size-5` (20px) SVG — a 36px
  square hit target, comfortably inside WCAG's 24px minimum and close to
  the 44px "comfortable" touch target, without the visual bulk of full
  44px buttons crowding a dense table row. Rendered with
  `rounded-md hover:bg-{slate-100/800}` (mirrors the nav icon button's
  hover treatment) plus a `variant`-driven icon color, exactly like
  `TextActionButton`'s old variants.
- **Tooltip**: a plain HTML `title` attribute set from the same `label`
  prop that fills `aria-label` — no custom tooltip component. This is fine
  for a row action, where the icon's meaning is already implied by its
  position/shape and the tooltip is just a courtesy label, at the cost of
  the tooltip not appearing on keyboard focus in most browsers;
  `aria-label` still covers screen readers regardless of that gap. Contrast
  with "Tap-to-explain tooltips" below, where the explanation itself is the
  point and a hover-only `title` isn't enough.
- **Labels are always row-specific**, not the bare verb — `label="Edit
{row.category.name}"`, not `label="Edit"`. A screen reader user tabbing
  through a table of icon-only buttons needs the entity name to tell one
  row's Edit button from another's; the visible `title` tooltip gets the
  same string for free.
- **Icon mapping** (`mdi*` export name → `variant`):

  | Action    | Icon             | `variant` |
  | --------- | ---------------- | --------- |
  | Edit      | `mdiPencil`      | `neutral` |
  | Save      | `mdiContentSave` | `primary` |
  | Cancel    | `mdiCloseThick`  | `cancel`  |
  | Pause     | `mdiPause`       | `amber`   |
  | Unpause   | `mdiPlay`        | `success` |
  | Archive   | `mdiArchive`     | `muted`   |
  | Unarchive | `mdiPackageUp`   | `success` |
  | Delete    | `mdiDelete`      | `danger`  |
  | Restore   | `mdiRestore`     | `success` |
  | Accept    | `mdiCheckBold`   | `success` |

  "Cancel" renders an X-mark shape (`mdiCloseThick`) rather than MDI's own
  `mdi-cancel` glyph (a prohibition/circle-slash icon) — X-mark is what's
  actually meant, and matches the × this app already used elsewhere for
  "close/cancel".

- **"Remove" was ratified into Archive or Delete** (this app previously
  used "Remove" for two different underlying actions, which this pass
  cleaned up): every former "Remove" button in categories/bills/
  subscriptions/income/settings/tasks called a hard-delete endpoint behind
  a `confirm(...)` (or, for income entries and push-notification devices,
  no confirmation at all) — none of them were actually the soft
  pause/archive toggle, so they all became **Delete** (`mdiDelete`,
  `danger`), never a second "Archive" button.
- An `onmousedown` prop exists on `IconActionButton` alongside `onclick`
  for the one case that needs it: the utility detail page's inline
  amount-cell editor calls `onmousedown={(e) => e.preventDefault()}` on its
  Delete button so clicking it doesn't first blur (and thus save) the
  adjacent number input. Don't add this prop out of habit — only when an
  adjacent focused input's blur handler would otherwise fire first.

### Action menus (>2 row actions)

**Any row that has more than two actions must use `$lib/components/ActionMenu.svelte`**,
not a row of inline `IconActionButton`s — see
`apps/web/src/routes/expenses/+page.svelte`'s desktop actions column
(Edit/Pause/Archive, Edit/Unpause/Archive, and Edit/Unarchive/Delete groups)
for the reference implementation. Two icon buttons side by side (e.g. the
inline-edit row's Save + Cancel) are still fine inline — this rule only
kicks in once a row would need a third. `ActionMenu` renders a single
`mdiDotsVertical` trigger button (same 36px `IconActionButton`-style hit
target) that opens a `role="menu"` panel anchored to the row, one
icon+label button per action, closed by re-clicking the trigger, choosing
an item, or clicking outside (a `fixed inset-0` transparent overlay behind
the panel). Pass `actions` as `{ label, path, variant, onclick, disabled? }`
objects — `label` here is the bare verb ("Edit", "Archive"), not a
row-specific string like `IconActionButton`'s `label` prop, since the
row's identity is already established by where the menu was opened from.
This is a desktop-table-column concern only — a mobile card that already
condenses its actions into the title row (see "Responsive tables (mobile)"
below) can keep its inline `IconActionButton`s there even past two, since
there's no shared column width being squeezed.

### Tap-to-explain tooltips

`$lib/components/HelpTooltip.svelte` — a small `mdiHelpCircle` icon button
(`text-amber-500 dark:text-amber-400`, no background/hit-target padding
since it always sits directly beside the value it explains) that reveals a
short explanation on click/tap, not just hover. Use this instead of a bare
`title` attribute whenever the explanation is the point rather than a
courtesy label — e.g. Monthly's Actual-amount cell for a recurring bill/
subscription/expense line where `StandardMonthLine.estimated` is true (no
payment record exists this far back, so the figure shown is a guess, not a
confirmed one). A `title` still gets set too (covers desktop hover for
free), but the click-to-reveal panel is what actually works on a phone,
where there's no hover state to stumble onto it.

- **Structure**: same `open` `$state` + `fixed inset-0` transparent overlay
  dismiss pattern as `ActionMenu` above (see that section) — click the icon
  to open, click anywhere else to close. `role="tooltip"` panel,
  `absolute left-1/2 top-full ... -translate-x-1/2`, anchored directly below
  the icon.
- **One per line, on the value — not on the checkbox.** Monthly's assumed
  Paid checkbox is tinted amber (see Checkboxes below) instead of getting
  its own `HelpTooltip`; two icons explaining the same underlying fact
  (`line.estimated`) on one row is redundant, and the checkbox already sits
  right next to the Actual cell that carries the explanation. Only add a
  second `HelpTooltip` to a row if it's explaining a genuinely different
  fact, not the same flag twice.
- **Props**: `label` (accessible name for the trigger button, row-specific
  like `IconActionButton`'s — e.g. `"Why is {line.label}'s actual amount
  estimated?"`) and `text` (the explanation shown in the panel and set as
  `title`).

### Danger action confirmation

Hard-delete actions (`handleDelete`/`handleRemove` for categories, bills,
subscriptions, backups) call the browser's native `confirm(...)` before
firing — no custom confirmation dialog/modal exists anywhere in the app.
See `apps/web/src/routes/categories/+page.svelte`'s `handleRemove`.

### Ad hoc buttons

A few one-off raw `<button>`s exist outside the two shared components,
each for a shape the components don't cover:

- **Outline nav button** (Prev/Next month or financial year, identical in
  `month/+page.svelte`, `income/+page.svelte`, and
  `utilities/[utilityId]/+page.svelte`):
  `rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800`,
  with `disabled:cursor-not-allowed disabled:opacity-40` added on whichever
  side (Next) can hit a boundary.
- **Selected/unselected tab button** (the per-user picker at the top of
  `income/+page.svelte` and `subscriptions/+page.svelte`, identical in
  both):
  `rounded-lg border px-4 py-2 text-left transition-colors` plus, when
  selected, `border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/30`,
  otherwise
  `border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800 dark:hover:border-slate-600`.
- **"This Month" jump button** (`month/+page.svelte` only, a filled
  indigo-tinted variant of the outline nav button, `invisible` when
  already on the current month):
  `rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:hover:bg-indigo-900/50`.
- **Secondary (outline) button** — one instance, "Send test notification"
  in `settings/+page.svelte`:
  `rounded-md border border-slate-300 px-4 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700`.
  There's no shared "secondary button" component; if a second one is
  needed, extract this into one rather than hand-rolling a third variant.
- **Expand/collapse row toggle** (amortized bills row in `month/+page.svelte`,
  YTD month row in `income/+page.svelte`): a button wrapping a `▸`/`▾`
  glyph, `inline-flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400`.

## Form inputs

Text/number/date/select inputs come in **two sizes**, chosen by context —
not interchangeable, and not an inconsistency:

- **Compact (table-row edit) inputs** — `py-1`, `dark:border-slate-600`.
  Used inside an inline table-row edit (`{#if editingId === row.id}` /
  `{#snippet editRow}`). Example, from
  `apps/web/src/routes/categories/+page.svelte`:
  `w-28 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100`
  (drop the `w-*` for inputs that should fill/auto-size).
- **Standard (form-panel) inputs** — `py-1.5`, `dark:border-slate-700`.
  Used inside a standalone `<form>`/`<div>` panel (the bordered
  "add a new X" forms, Settings, Tasks). Example, from
  `apps/web/src/routes/recurring-bills/+page.svelte`:
  `w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100`.

Both sizes always pair with `dark:bg-slate-900 dark:text-slate-100` and
plain `border-slate-300` in light mode — only the `py-*` and dark border
shade change.

A third, larger variant (`px-3 py-2`, `focus:border-indigo-500
focus:ring-indigo-500`) is used for the two single-field "quick add" inputs
that sit outside any bordered form panel — Categories' and Utilities'
"Add a category/utility" inputs — `dark:border-slate-700 dark:bg-slate-800`
(note: `bg-slate-800`, not `bg-slate-900`, matching the page background
tier). The login page uses the same `px-3 py-2` size with
`focus:border-indigo-500 focus:ring-indigo-500` but `dark:border-slate-600
dark:bg-slate-900` — see "Known inconsistencies" below.

**Label wrapper**: every labeled field in a form panel is
`<label class="flex flex-col gap-1"><span class="text-xs font-medium text-slate-500 dark:text-slate-400">Label</span><input .../></label>`
— see any "add a new X" form, e.g.
`apps/web/src/routes/subscriptions/+page.svelte`.

**Category select** — `$lib/components/CategorySelect.svelte` wraps a
`<select>` with a `variant` prop: `'form'` (standard form-panel sizing,
default) or `'table'` (compact, `text-xs`, used for the inline category
picker inside a bill/subscription table row).

**Color input** — `type="color"`, always
`cursor-pointer rounded border border-slate-300 bg-transparent p-0 dark:border-slate-600`;
sized `h-7 w-7` for the compact swatch next to a category name (table row)
or `h-9 w-16` for the standalone Settings display-color field.

## Checkboxes

**Canonical pattern — see `apps/web/src/routes/month/+page.svelte`**
(the "Paid" column checkboxes, line ~672):

```html
<input
  type="checkbox"
  bind:checked="{...}"
  class="h-4 w-4 rounded border-slate-300 text-indigo-600 dark:border-slate-600"
/>
```

Every checkbox in the app now uses this exact class string (add
`disabled:cursor-not-allowed disabled:opacity-40` when the checkbox can be
`disabled`, as in Monthly's "Paid" column). This was fixed app-wide as part
of this pass — previously some checkboxes had no class at all (unstyled
browser default), others used `size-4` instead of `h-4 w-4`, and others
added `focus:ring-indigo-500`/`dark:bg-slate-900` that the reference
pattern doesn't use. If you add a new checkbox, copy the block above
rather than re-deriving it.

**Assumed/estimated state** — Monthly's Paid checkbox swaps
`text-indigo-600` for `text-amber-500 dark:text-amber-400` when
`StandardMonthLine.estimated` is true (a past month with no payment record
at all, so `paid` defaulted rather than reflecting a real entry):

```html
class={[
  'h-4 w-4 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600',
  line.estimated ? 'text-amber-500 dark:text-amber-400' : 'text-indigo-600',
]}
```

No extra ring/border/badge on the checkbox itself, and no `HelpTooltip`
next to it — the amber tint alone is the signal, and it's the same
`estimated` fact already explained by the `HelpTooltip` on the row's Actual
cell (see "Tap-to-explain tooltips" above); stacking a second explanation
on the checkbox was tried and removed as redundant. The checkbox's `title`
is still set from `paidTooltip(line)` for desktop hover.

## Cards / panels

`$lib/components/Card.svelte`:
`rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-800`,
renders as `<a>` when `href` is passed (dashboard/utilities grid tiles are
clickable cards) or `<div>` otherwise. Callers add their own padding via
the `class` prop — `p-4` for stat/summary tiles, `overflow-x-auto` (no
padding) when the card wraps a `<table>` since the table supplies its own
cell padding.

Bordered form panels (not `Card`, but visually identical, hand-rolled
because they're a `<form>` element) use the same look inline:
`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-800`
— see any "add a new X" form.

## Page headers

- **h1** (page title): `text-2xl font-semibold text-slate-900 dark:text-slate-100`,
  universal across every route (`PageHead` sets `<title>` separately —
  always pair the two). Detail pages (`categories/[categoryId]`,
  `utilities/[utilityId]`) put a small back-link above it:
  `text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300`
  (`← Categories` / `← Utilities`).
- **h2** (section heading within a page): `text-lg font-semibold text-slate-900 dark:text-slate-100`,
  typically `mt-8` above it (or `mt-8 mb-3` when no lead-in paragraph
  follows). List pages that have a per-section toggle put the h2 and the
  toggle in `<div class="flex items-center justify-between">` (see
  Categories' "Show paused / archived / removed" toggle).
- **h3** (sub-heading): `text-sm font-semibold text-slate-900 dark:text-slate-100`
  — only used in `tasks/+page.svelte` ("Everything, as JSON" / "Individual
  tables, as CSV") and dashboard Card titles.
- **Lead paragraph** under an h1/h2: `text-sm text-slate-500 dark:text-slate-400`,
  usually `mt-1`.

## Tables

Every data table follows the same recipe — see
`apps/web/src/routes/categories/+page.svelte` as the reference:

```html
<Card class="mt-6 sm:overflow-x-auto">
  <table class="block w-full border-collapse text-sm sm:table">
    <thead class="hidden sm:table-header-group">
      <tr class="border-b border-slate-200 dark:border-slate-700">
        <th class="px-3 py-2 text-left font-semibold text-slate-500 dark:text-slate-400">...</th>
        <!-- text-right on th for numeric columns, text-center for a checkbox column -->
      </tr>
    </thead>
    <tbody class="block sm:table-row-group">
      <tr
        class="mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 dark:divide-slate-700/60 dark:border-slate-700 sm:dark:border-slate-700/60"
      >
        <td class="px-3 py-2 sm:table-cell ...">...</td>
        <!-- see "Responsive tables (mobile)" below for cell-level rules -->
      </tr>
    </tbody>
    <!-- optional -->
    <tfoot class="block sm:table-footer-group">
      <tr
        class="mt-1 block border-t border-slate-200 pt-2 font-semibold sm:mt-0 sm:table-row sm:pt-0 dark:border-slate-700"
      >
        ...
      </tr>
    </tfoot>
  </table>
</Card>
```

- **Inline row edit mode**: swap the row for one styled
  `border-b border-slate-100 bg-indigo-50/40 last:border-0 dark:border-slate-700/60 dark:bg-indigo-900/20`
  (a light indigo tint — on mobile this becomes
  `bg-indigo-50/40 dark:bg-indigo-900/20` plus the same card-ification as any
  other row, with its border/divide colors swapped to `indigo-*` instead of
  `slate-*`; see "Responsive tables" below), containing compact-sized inputs
  (see Form inputs above) and `IconActionButton` primary (Save) + cancel
  (Cancel).
- **Grouped section header row** inside a `<tbody>` (Paused/Archived/Removed
  in Categories/Bills/Subscriptions; frequency groups in Bills):
  `border-b border-slate-100 bg-slate-50 dark:border-slate-700/60 dark:bg-slate-900/40`,
  with a single `colspan`'d cell:
  `px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400`.
- **Muted/hidden rows** (paused/archived items shown via "Show hidden"):
  same row shape plus `opacity-70` (paused/archived) or `opacity-60`
  (removed).
- **Empty table body**: a single full-width cell,
  `px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500`,
  text `"No {items} yet."`.
- **Expandable detail row** (YTD month expansion in Income, amortized bills
  in Monthly): toggled via the `▸`/`▾` button (see "Ad hoc buttons"), the
  expanded row/cell background is `bg-slate-100 dark:bg-slate-900/50` (row)
  or `bg-slate-50 dark:bg-slate-900/25` (nested detail cell).
- **Shared income-entry rows**: `IncomeEntryDisplayRow.svelte` /
  `IncomeEntryEditRow.svelte` factor out the repeated amount/date/note/actions
  columns, used by `income/+page.svelte`'s YTD month expansion.
  `monthly/+page.svelte`'s Incoming table hand-rolls its rows instead (see
  "Not-yet-persisted placeholder row" below) since its column order and
  per-row placeholder variant don't fit the shared components' fixed
  amount→date→note cell order — extend the shared pair for a table that
  matches their shape, don't force a divergent one onto them.
- **Secondary attributes folded under the title cell instead of their own
  column** (Expenses' Name column — category, "adhoc expense" when not
  Recurring, "ignored from budget" when excluded): when a table has too
  many narrow columns to fit without horizontal scroll, prefer collapsing
  low-cardinality/boolean-ish columns into a single muted line under the
  row's title rather than giving each one a dedicated column — `<p
class="mt-0.5 truncate text-xs text-slate-400 dark:text-slate-500">` with
  the parts joined by `' · '`, only rendering when there's at least one
  non-default part to show (the default/affirmative state, e.g. Recurring
  "on", isn't called out — only the deviation is). Any field that's
  editable stays editable from the row's inline edit form (see "Inline row
  edit mode" above) even after its standalone column is removed — it just
  moves into that form's body instead of a `<td>` of its own, e.g.
  Expenses' Category `<select>` and Recurring/Ignore-budget checkboxes are
  edit-only now, gone from the always-visible view row.
- **Not-yet-persisted placeholder row** (Monthly's Incoming table — a
  source's projected pay date with no logged entry yet, `monthly/+page.svelte`):
  same row shape as a normal row, plus `italic` on the `<tr>` and
  `text-slate-400 dark:text-slate-500` (the standard muted/placeholder text
  tier — see Color usage below) on every cell instead of the row's usual
  text color. Actions are Accept (`variant="success"`, `mdiCheckBold` — logs
  the row immediately at its shown projected amount/date, no confirmation)
  plus the normal Edit pencil (opens the same inline row-edit form as a real
  entry, pre-filled from the placeholder's projected amount/date, and
  creates a new entry on Save rather than updating one). No Delete action —
  there's nothing persisted yet to delete. Reuse this exact shape for any
  future "here's a known-but-not-yet-confirmed row" case rather than
  inventing a new muted-row treatment.

### Responsive tables (mobile)

Every table in the app reflows into stacked cards below `sm` (640px) instead
of horizontally scrolling — the app is mobile-first, and a table wider than
a phone screen is a poor mobile UX. This is done with responsive `display`
utilities on the _same_ markup, not a second parallel "mobile" template: one
`{#each}`, one set of `<tr>`/`<td>` elements, restyled per breakpoint. See
`apps/web/src/routes/monthly/+page.svelte` for the fullest worked example
(due chip, Paid checkbox, multiple edit-mode variants), or
`apps/web/src/routes/bills/+page.svelte` for a simpler one.

- **`table`**: `block w-full border-collapse text-sm sm:table`.
- **`thead`**: `hidden sm:table-header-group` — column headers are redundant
  once every cell carries its own mobile label.
- **`tbody`** / **`tfoot`**: `block sm:table-row-group` /
  `block sm:table-footer-group`.
- **A data `<tr>`** becomes a bordered card on mobile, a normal row on
  desktop. Take whatever divider classes the row already has (e.g.
  `border-b border-slate-100 last:border-0 dark:border-slate-700/60`, or the
  indigo-tinted edit-mode variant) and move them behind `sm:`, replacing them
  on mobile with:
  `mb-2 block divide-y divide-slate-100 rounded-lg border border-slate-200 last:mb-0 dark:divide-slate-700/60 dark:border-slate-700 sm:mb-0 sm:table-row sm:divide-y-0 sm:rounded-none sm:border-0 sm:border-b sm:border-slate-100 sm:last:border-0 sm:dark:border-slate-700/60`
  (swap `slate` for `indigo` — and add the `bg-indigo-50/40 dark:bg-indigo-900/20`
  tint unprefixed — for an edit-mode row). `opacity-70`/`opacity-60` on a
  muted row stays unprefixed (not display-related, applies at both sizes).
- **A grouped colspan section-header `<tr>`** (Paused/Archived/Removed,
  frequency groups) and the **`tfoot` totals `<tr>`** don't need the card
  treatment — they're already a full-bleed bar. Just add `block sm:table-row`
  to the `<tr>` (tfoot's row also gets `mt-1 pt-2 border-t ... sm:mt-0 sm:pt-0`
  to separate it from the last card above it) and `block sm:table-cell` to
  its `colspan`'d `<td>`.
- **Every `<td>`** gets `sm:table-cell` added, then depending on the column:
  - **Primary/title cell** (first column, e.g. Name) — just `sm:table-cell`,
    nothing else. It reads as the card's title line on mobile since it's
    already `font-medium text-slate-900 dark:text-slate-100`.
  - **Any cell whose column has a visible `<th>` label** —
    `flex items-center justify-between gap-3 px-3 py-2 <original text/color classes> sm:table-cell`
    (move a bare `text-right`/`text-center` behind `sm:` too), with a label
    prepended as the cell's first child:
    `<span class="shrink-0 text-xs font-medium text-slate-400 uppercase sm:hidden dark:text-slate-500">Label</span>`.
    For a table with a **dynamic column set** (Income's YTD table, one
    column per income source), the label is just the same data already used
    for the `<th>` (`{source.name}`) — no special-casing needed.
  - **A cell whose value is inherently multi-control** (e.g. Income sources'
    Cadence cell: a `<select>` plus a conditional day/checkbox or date input)
    doesn't fit the label-left/value-right flex row — use a stacked block
    instead: `block px-3 py-2 sm:table-cell` with the label as
    `<span class="mb-1 block text-xs ... sm:hidden">Label</span>` above the
    unchanged control markup.
  - **Actions cell** (blank `<th>`, holds `IconActionButton`s) — no label:
    `flex justify-end gap-1 px-3 py-2 whitespace-nowrap sm:table-cell sm:text-right`.
  - **A genuinely empty `<td>`** (nothing to show for this row/column) —
    `hidden sm:table-cell`.
- **Inline-edit `<input>`/`<select>` with a fixed width** (`w-24`, `w-32`,
  `w-40`, etc.) becomes `w-full` unprefixed plus the original width behind
  `sm:` (`w-full ... sm:w-24`), so it fills the mobile card row and matches
  today's exact width at `sm:` and up. `type="date"` inputs and
  `CategorySelect` have no fixed width today and need no change.
- **Shared row components** (`IncomeEntryDisplayRow.svelte`/
  `IncomeEntryEditRow.svelte`) bake these structural/responsive classes into
  their own template, keeping the caller-supplied `cellClass`/`lastCellClass`
  props purely about padding — a caller's `leading` snippet (whatever goes in
  the first cell) follows the same primary-cell-or-labeled-cell rules as any
  other table.

### Reorderable rows (drag-and-drop)

Manually-orderable lists (Categories' non-system and System groups, Expenses'
active group — each backed by a `sortOrder` column) are reordered by
click/touch-and-drag, not up/down arrow buttons (the old pattern, removed
app-wide — a pair of tap targets per row doesn't scale to touch as well as
grabbing and dragging the row itself, and arrows also add a click per
position moved instead of one drag). See
`apps/web/src/routes/categories/+page.svelte` and
`apps/web/src/routes/expenses/+page.svelte` for the reference
implementation.

- **Library**: `svelte-dnd-action`'s `dragHandleZone` action on the `<tbody>`
  wrapping the reorderable group (`use:dragHandleZone={{ items, flipDurationMs:
150, dragDisabled }}`, `onconsider`/`onfinalize` props update a local
  `$state` copy of the list). Only the rows meant to be reorderable belong to
  that `<tbody>` — a table with a mix of reorderable and non-reorderable rows
  (e.g. Categories' active vs. Archived/Removed groups) splits them into
  separate `<tbody>` elements (multiple `<tbody>` per `<table>` is valid
  HTML and doesn't change rendering) so the dnd zone's items always match its
  actual DOM children.
- **Handle** — `$lib/components/DragHandle.svelte`, a `use:dragHandle`
  (`svelte-dnd-action`) span rendering the six-dot `mdiDrag` icon
  (`@mdi/js`), `cursor: grab`/`grabbing`. Not `IconActionButton` — a drag
  handle isn't a click action, and needs the library's own action attached
  directly to it.
- **Placement — left side of the row**: a dedicated first table column
  (`hidden ... sm:table-cell`, desktop only) so the handle is the leftmost
  thing in the row above `sm`; inlined as the first child of the title
  cell's flex row (`sm:hidden`) below `sm`, ahead of the name/link, so it's
  still the leftmost element of the card on mobile. This is the same
  duplicate-markup-per-breakpoint technique the title cell's action icons
  already use (see "Responsive tables" above) — reuse it rather than trying
  to make one element serve both layouts.
- **Persisting the reorder** — `$lib/dnd.ts`'s `reorderedSortOrders(items)`:
  given the list in its new (already client-reordered) positions, it
  reassigns the same pool of `sortOrder` values the group already held
  (sorted ascending) to the new positions, returning only the `{id,
sortOrder}` pairs that actually changed. This generalizes the old
  two-item-swap logic to an arbitrary drag without ever introducing a gap or
  duplicate into a shared/global `sortOrder` column (categories/expenses
  share one `sortOrder` sequence across every group, not one sequence per
  group). The `onfinalize` handler `Promise.all`s an `updateCategory`/
  `updateExpense` call per changed row, then refreshes.
- **Keyboard**: no separate keyboard fallback was built — `dragHandleZone`/
  `dragHandle` already support keyboard reordering natively (Tab to the
  handle, Space/Enter to pick up, arrow keys to move, Space/Enter or
  `Escape` to drop), so a keyboard-only user isn't locked out despite there
  being no visible up/down button.

## Badges / status pills

- **Lifecycle badge** — `$lib/components/StatusBadge.svelte`, `tone` prop
  `'amber'` (Paused) or `'slate'` (Archived/Removed):
  `ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase`
  plus `bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300`
  or `bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300`.
- **Due-soon/overdue pill** (Monthly's Due column, Bills' Next due column;
  hand-rolled inline, same shape in both files):
  `rounded-full px-2 py-0.5 text-xs font-medium` plus
  `bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300` (overdue) or
  `bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300`
  (due soon). Monthly adds a third state,
  `bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300`,
  once the line is marked paid.
- **Trend indicator** — `$lib/components/TrendIndicator.svelte`: `▲ up`
  (red — spending went up is bad), `▼ down` (emerald), `— flat` (slate).
  Pass `caretOnly` to render just the glyph (with a `title` tooltip instead
  of the word) merged next to a value in a tight column — see Expenses'
  "12-mo avg" column, which merges what used to be a separate "Trend"
  column into `{amount} <TrendIndicator caretOnly .../>` rather than
  spending a whole column on it.

## Color usage

- **Neutrals**: `slate` throughout (never `gray`/`zinc`). Text hierarchy:
  `slate-900`/`slate-100` (primary text, dark), `slate-600`/`slate-400`
  (secondary), `slate-400`/`slate-500` (muted/placeholder/empty-state),
  `slate-300`/`slate-600` (disabled/very muted). Backgrounds:
  page `slate-50`/`slate-900`, card `white`/`slate-800`, nested/table-panel
  `slate-50`/`slate-900` (with opacity suffixes like `/25`, `/40`, `/50`,
  `/60` for subtle tints over the base card color).
- **Brand/interactive**: `indigo-600`/`indigo-400` for links, focus rings,
  and the primary button; `indigo-50`/`indigo-900/30` for selected/active
  backgrounds.
- **Semantic**: `emerald` = positive/good (net positive, trending down
  spend, success message), `red` = negative/bad (net negative, trending up
  spend, error message, overdue), `amber` = warning/attention (due soon,
  paused, budget notice banner, and — Monthly's Paid checkbox/Actual value/
  `HelpTooltip` icon — assumed/estimated data standing in for a missing
  record).
- Every color utility has a `dark:` counterpart; there is no
  dark-mode-only or light-mode-only color left unhandled in any file read
  during this audit.

## Spacing / layout conventions

- Page content sits inside `+layout.svelte`'s `<main class="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">`
  — routes never re-declare an outer max-width/padding.
  `login/+page.svelte` is the one exception (renders outside the
  authenticated shell, full-viewport centered).
  `settings/+page.svelte` and `tasks/+page.svelte` don't cap form width
  further; `email`/`password` forms there use `max-w-sm`.
  `IncomeEntryForm.svelte`'s default `class` prop is `flex flex-wrap items-end gap-3`.
- Stat/summary card grids: `grid grid-cols-1 gap-4 sm:grid-cols-N` (N = 2
  or 3), or `grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]` for the
  Utilities tile grid.
- Section-to-section vertical rhythm: `mt-6` (first section after the
  header) then `mt-8` for each subsequent `<h2>` section.
- Multi-field forms: `flex flex-wrap items-end gap-3` (or `gap-4` in
  Settings/Tasks); single-field quick-add forms: `flex gap-2`.

## Typography scale

`text-2xl` (h1) > `text-xl` (login-card h1, dashboard stat numbers,
category/utility detail stat numbers) > `text-lg` (h2) > `text-sm` (h3,
body/table text, buttons) > `text-xs` (labels, muted captions, badges'
`text-[10px]` being the one sub-`xs` outlier). Font
weight: `font-semibold` for headings and emphasized numbers,
`font-medium` for labels/buttons/links, default weight for body text.

## Loading / empty / error states

- **Loading**: `$lib/components/LoadingIndicator.svelte`, text "Loading…",
  `text-sm text-slate-400 dark:text-slate-500`, default `class="mt-6"` for
  a whole-page load, callers pass `class="mt-3"` for a sub-section load
  (Settings' forms, Tasks' forms, Income's YTD/non-PAYG panels).
- **Error**: `$lib/components/ErrorMessage.svelte`, `text-sm text-red-600 dark:text-red-400`,
  default `class="mt-3"`; detail pages use `class="mt-6"` for a
  page-level "not found" error.
- **Success**: `$lib/components/SuccessMessage.svelte`, same shape as
  ErrorMessage but `text-emerald-600 dark:text-emerald-400`. Used after a
  Settings/Tasks form save ("Saved.", "Email updated.", "Password
  changed.").
- **Empty state**: inside a table, see the Tables section above; outside a
  table, a lone `<p class="mt-3 text-sm text-slate-400 dark:text-slate-500">No X yet</p>`
  (Tasks' "No backups yet", Settings' "No devices registered yet").

## Modals / dialogs

None exist. Destructive actions confirm via the browser's native
`confirm(...)` (see Buttons → Danger action confirmation above); there is
no custom modal/dialog component anywhere in `apps/web`.

## Known inconsistencies (documented, not fixed)

These were identified during the audit but deliberately left alone —
either the divergence is structurally justified by a real UX difference,
or fixing it would be a design decision rather than a typo-level
correction.

- **`utilities/[utilityId]/+page.svelte`'s inline monthly-bill grid** is a
  spreadsheet-style click-to-edit cell, not a table-row edit like
  everywhere else — a `<button>` showing the amount swaps for a bare
  `<input>` on click, styled with a highlighted `border-indigo-400` (no
  `dark:` override) instead of the usual compact-input class. This is a
  genuinely different interaction (a 12-month grid, not a list of rows
  with an Edit action) — restyling it to match the table-row pattern would
  remove the reason it's shaped this way. As part of the icon-action-button
  pass, this cell's hover-only "delete this bill" corner button (only
  visible on `:hover`, plus `pointer-coarse:opacity-100` as a mobile
  workaround) was removed rather than converted — deleting a cell's bill
  was already available, always-visible, one click deeper (open the cell
  for editing, then use the `IconActionButton` Delete next to the input),
  so the hover shortcut was redundant once hover-only affordances were
  disallowed. Don't reintroduce a second, hover-revealed delete entry
  point on this grid.
- **Login page's large text inputs** (`px-3 py-2`,
  `focus:border-indigo-500 focus:ring-indigo-500`) use
  `dark:border-slate-600 dark:bg-slate-900`, while the only other users of
  that same large-input size — Categories' and Utilities' "quick add"
  inputs — use `dark:border-slate-700 dark:bg-slate-800`. Login renders
  outside the authenticated app shell entirely (no nav, centered card, own
  page background), so it's plausibly a deliberate visual distinction
  rather than a slip, and there's no third data point to establish which
  one is "correct."
- **Settings' "Send test notification" secondary button** is the only
  outline/secondary button in the app and isn't backed by a shared
  component (see Buttons → Ad hoc buttons). Not wrong, but if a second
  outline button is ever needed, extract it into a component instead of
  copy-pasting the class string a second time.
