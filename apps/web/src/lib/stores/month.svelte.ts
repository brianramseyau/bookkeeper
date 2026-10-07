/**
 * The month the app is currently "looking at" — shared by every
 * month-keyed screen (Dashboard and Monthly) so stepping the picker on one
 * carries across to the other, rather than each page deriving its own
 * value and resetting when you navigate.
 *
 * The value lives here, in memory, for the life of the session: it is
 * deliberately not persisted to `localStorage`, so a full reload starts
 * again at the current month. It is still seeded from `?year=&month=` on
 * the URL when a page is entered with explicit params (a shared/bookmarked
 * link, or the Dashboard chart's click-through), which is why each month
 * page calls `syncFromUrl` before its first fetch rather than reading the
 * query string itself.
 */

/** The shape `MonthNavHeader` drives, so the component stays presentational
 *  and unit-testable with a plain stub. */
export interface MonthNavState {
  readonly year: number
  readonly month: number
  readonly isCurrentMonth: boolean
  changeMonth(delta: number): void
  goToCurrentMonth(): void
}

class MonthStore implements MonthNavState {
  year = $state(0)
  month = $state(0)

  constructor() {
    const now = new Date()
    this.year = now.getFullYear()
    this.month = now.getMonth() + 1
  }

  get isCurrentMonth(): boolean {
    const now = new Date()
    return this.year === now.getFullYear() && this.month === now.getMonth() + 1
  }

  /**
   * Adopt an explicit `?year=&month=` from the URL when both are present
   * and valid; otherwise leave the session value untouched. Leaving it
   * untouched on a URL with no params is exactly what makes the choice
   * persist across navigation — plain nav links carry no params.
   */
  syncFromUrl(search: string): void {
    const params = new URLSearchParams(search)
    const yearParam = Number(params.get('year'))
    const monthParam = Number(params.get('month'))
    const validMonth = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12
    if (Number.isInteger(yearParam) && yearParam > 0 && validMonth) {
      this.year = yearParam
      this.month = monthParam
    }
  }

  changeMonth(delta: number): void {
    let month = this.month + delta
    let year = this.year
    if (month < 1) {
      month = 12
      year -= 1
    } else if (month > 12) {
      month = 1
      year += 1
    }
    this.month = month
    this.year = year
  }

  goToCurrentMonth(): void {
    const now = new Date()
    this.year = now.getFullYear()
    this.month = now.getMonth() + 1
  }
}

export const monthState = new MonthStore()
