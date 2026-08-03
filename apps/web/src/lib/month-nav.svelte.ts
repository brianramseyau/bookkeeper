import { page } from '$app/state'
import { replaceState } from '$app/navigation'

/**
 * Shared month/year navigation state for pages keyed by a single
 * year+month pair in the URL (e.g. `?year=2026&month=3`) - the Dashboard
 * and Monthly pages both need identical behavior here: read the initial
 * value from the query string (falling back to the current month), step
 * forward/back a month at a time (rolling over the year), jump back to
 * "This Month", and keep the URL in sync so it can be reloaded or shared.
 */
export class MonthNav {
  year = $state(0)
  month = $state(0)
  readonly #basePath: string
  readonly #onChange: () => void
  readonly #currentYear: number
  readonly #currentMonth: number

  constructor(basePath: string, onChange: () => void) {
    this.#basePath = basePath
    this.#onChange = onChange

    const today = new Date()
    this.#currentYear = today.getFullYear()
    this.#currentMonth = today.getMonth() + 1

    const yearParam = Number(page.url.searchParams.get('year'))
    const monthParam = Number(page.url.searchParams.get('month'))
    const hasValidMonthParam = Number.isInteger(monthParam) && monthParam >= 1 && monthParam <= 12

    this.year = Number.isInteger(yearParam) && yearParam > 0 ? yearParam : this.#currentYear
    this.month = hasValidMonthParam ? monthParam : this.#currentMonth
  }

  get isCurrentMonth(): boolean {
    return this.year === this.#currentYear && this.month === this.#currentMonth
  }

  changeMonth(delta: number): void {
    let newMonth = this.month + delta
    let newYear = this.year
    if (newMonth < 1) {
      newMonth = 12
      newYear -= 1
    } else if (newMonth > 12) {
      newMonth = 1
      newYear += 1
    }
    this.month = newMonth
    this.year = newYear
    replaceState(`${this.#basePath}?year=${this.year}&month=${this.month}`, {})
    this.#onChange()
  }

  goToCurrentMonth(): void {
    this.year = this.#currentYear
    this.month = this.#currentMonth
    if (page.url.search) replaceState(this.#basePath, {})
    this.#onChange()
  }
}
