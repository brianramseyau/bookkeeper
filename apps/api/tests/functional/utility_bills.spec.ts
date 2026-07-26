import { test } from '@japa/runner'
import User from '#models/user'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

test.group('UtilityBills / index', () => {
  test("lists a utility's bills ordered chronologically, with an empty monthlyShares for a monthly utility", async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 3, amount: 314.86 })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 2, amount: 409.08 })

    const response = await client.get(`/api/utilities/${utility.id}/bills`).loginAs(brian)

    response.assertStatus(200)
    assert.deepEqual(
      response.body().bills.map((b: { month: number }) => b.month),
      [2, 3]
    )
    assert.deepEqual(response.body().monthlyShares, [])
  })

  test('splits a quarterly bill into equal monthlyShares for all 3 covered months, including the billing month itself', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Water', frequency: 'quarterly' })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 4, amount: 369.49 })

    const response = await client.get(`/api/utilities/${utility.id}/bills`).loginAs(brian)

    response.assertStatus(200)
    const shares = response.body().monthlyShares
    assert.deepEqual(
      shares.map((s: { year: number; month: number }) => [s.year, s.month]),
      [
        [2026, 2],
        [2026, 3],
        [2026, 4],
      ]
    )
    for (const share of shares) {
      assert.equal(share.amount, 123.16)
      assert.equal(share.billYear, 2026)
      assert.equal(share.billMonth, 4)
    }
  })

  test('returns 404 for a non-existent utility', async ({ client }) => {
    const brian = await loginAsBrian()

    const response = await client.get('/api/utilities/999999/bills').loginAs(brian)

    response.assertStatus(404)
  })
})

test.group('UtilityBills / upsert', () => {
  test('creates a bill for a month with no existing row', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })

    const response = await client
      .put(`/api/utilities/${utility.id}/bills/2026/2`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 409.08 })

    response.assertStatus(200)
    assert.equal(response.body().data.amount, 409.08)
  })

  test('updates the existing bill for that month rather than duplicating it', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 2, amount: 400 })

    const response = await client
      .put(`/api/utilities/${utility.id}/bills/2026/2`)
      .withCsrfToken()
      .loginAs(brian)
      .json({ amount: 409.08 })

    response.assertStatus(200)
    const bills = await UtilityBill.query().where('utilityId', utility.id)
    assert.lengthOf(bills, 1)
    assert.equal(bills[0]!.amount, 409.08)
  })
})

test.group('UtilityBills / destroy', () => {
  test('deletes a bill', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })
    const bill = await UtilityBill.create({
      utilityId: utility.id,
      year: 2026,
      month: 2,
      amount: 409.08,
    })

    const response = await client
      .delete(`/api/utility-bills/${bill.id}`)
      .withCsrfToken()
      .loginAs(brian)

    response.assertStatus(204)
    const remaining = await UtilityBill.query().where('utilityId', utility.id)
    assert.lengthOf(remaining, 0)
  })
})

test.group('UtilityBills / trend', () => {
  test('returns a rolling-average trend for the utility', async ({ client, assert }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 1, amount: 400 })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 2, amount: 420 })

    const response = await client.get(`/api/utilities/${utility.id}/trend`).loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().average, 410)
    assert.equal(response.body().trend, 'up')
  })

  test('averages a quarterly utility over its split monthly shares, not its raw bills', async ({
    client,
    assert,
  }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Water', frequency: 'quarterly' })
    await UtilityBill.create({ utilityId: utility.id, year: 2026, month: 4, amount: 369.49 })

    const response = await client.get(`/api/utilities/${utility.id}/trend`).loginAs(brian)

    response.assertStatus(200)
    assert.equal(response.body().average, 123.16)
    assert.equal(response.body().latestAmount, 123.16)
    assert.lengthOf(response.body().months, 3)
  })
})
