import { test } from '@japa/runner'
import { StandardMonthService } from '#services/standard_month_service'

/**
 * customPeriodsPerYear() is a pure function of its arguments with no DB
 * access, but private - tests reach it the same way the class itself does,
 * via bracket access.
 */
function callCustomPeriodsPerYear(
  service: StandardMonthService,
  value: number | null,
  unit: string | null
): number {
  return (
    service as unknown as {
      customPeriodsPerYear(v: number | null, u: string | null): number
    }
  ).customPeriodsPerYear(value, unit)
}

test.group('StandardMonthService.customPeriodsPerYear', () => {
  test('returns 1 when either the value or unit is missing', ({ assert }) => {
    const service = new StandardMonthService()

    assert.equal(callCustomPeriodsPerYear(service, null, 'weeks'), 1)
    assert.equal(callCustomPeriodsPerYear(service, 2, null), 1)
  })

  test('computes periods per year for days, weeks and months', ({ assert }) => {
    const service = new StandardMonthService()

    assert.equal(callCustomPeriodsPerYear(service, 2, 'weeks'), 26)
    assert.equal(callCustomPeriodsPerYear(service, 14, 'days'), 365 / 14)
    assert.equal(callCustomPeriodsPerYear(service, 3, 'months'), 4)
  })

  test('falls back to 1 period per year for an unrecognized unit', ({ assert }) => {
    const service = new StandardMonthService()

    assert.equal(callCustomPeriodsPerYear(service, 2, 'quarters'), 1)
  })
})
