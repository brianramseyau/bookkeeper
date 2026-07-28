import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import User from '#models/user'
import NotificationSchedule from '#models/notification_schedule'
import UserNotificationPreference from '#models/user_notification_preference'
import PushSubscription from '#models/push_subscription'
import RecurringBill from '#models/recurring_bill'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'
import {
  getNotificationSchedule,
  getUserNotificationPreference,
  isNotificationCheckDue,
  findDueBillsForUser,
  runDueNotificationCheck,
} from '#services/notification_scheduler'
import {
  startFakePushServer,
  generateTestSubscriptionKeys,
  type FakePushServer,
} from '#tests/helpers/fake_push_server'

async function loginAsBrian() {
  return User.findByOrFail('fullName', 'Brian')
}

async function loginAsAriel() {
  return User.findByOrFail('fullName', 'Ariel')
}

test.group('isNotificationCheckDue', () => {
  test('is false when it already ran today, regardless of hour', ({ assert }) => {
    const now = DateTime.local(2026, 7, 28, 20, 0, 0)
    const lastRunAt = DateTime.local(2026, 7, 28, 8, 0, 0)
    assert.isFalse(isNotificationCheckDue({ sendHour: 8, lastRunAt }, now))
  })

  test('is false when never run but the send hour has not passed yet', ({ assert }) => {
    const now = DateTime.local(2026, 7, 28, 7, 0, 0)
    assert.isFalse(isNotificationCheckDue({ sendHour: 8, lastRunAt: null }, now))
  })

  test('is true when never run and the send hour has passed', ({ assert }) => {
    const now = DateTime.local(2026, 7, 28, 8, 0, 0)
    assert.isTrue(isNotificationCheckDue({ sendHour: 8, lastRunAt: null }, now))
  })

  test('is false when last run was a previous day but the send hour has not passed yet', ({
    assert,
  }) => {
    const now = DateTime.local(2026, 7, 28, 7, 0, 0)
    const lastRunAt = DateTime.local(2026, 7, 27, 8, 0, 0)
    assert.isFalse(isNotificationCheckDue({ sendHour: 8, lastRunAt }, now))
  })

  test('is true once a new day has started and the send hour has passed', ({ assert }) => {
    const now = DateTime.local(2026, 7, 28, 9, 0, 0)
    const lastRunAt = DateTime.local(2026, 7, 27, 8, 0, 0)
    assert.isTrue(isNotificationCheckDue({ sendHour: 8, lastRunAt }, now))
  })
})

test.group('getNotificationSchedule / getUserNotificationPreference', (group) => {
  group.each.teardown(async () => {
    await NotificationSchedule.query().where('id', 1).delete()
    await UserNotificationPreference.query().delete()
  })

  test('creates default schedule (8am, never run) on first access', async ({ assert }) => {
    const schedule = await getNotificationSchedule()
    assert.equal(schedule.sendHour, 8)
    assert.isNull(schedule.lastRunAt)
  })

  test('creates default (disabled) preference per user on first access', async ({ assert }) => {
    const brian = await loginAsBrian()
    const prefs = await getUserNotificationPreference(brian.id)

    assert.equal(Boolean(prefs.enabled), false)
    assert.equal(prefs.leadDays, 3)
    assert.equal(Boolean(prefs.notifyUtilityBills), true)
    assert.equal(Boolean(prefs.notifyRecurringBills), true)
    assert.equal(Boolean(prefs.notifySubscriptions), true)
  })
})

test.group('findDueBillsForUser', (group) => {
  const today = DateTime.local(2026, 7, 28)
  const allEnabled = {
    leadDays: 3,
    notifyUtilityBills: true,
    notifyRecurringBills: true,
    notifySubscriptions: true,
  }

  group.each.teardown(async () => {
    await RecurringBill.query().delete()
    await Utility.query().delete()
    await UserSubscription.query().delete()
  })

  test('includes a recurring bill due within leadDays and excludes one further out', async ({
    assert,
  }) => {
    const brian = await loginAsBrian()
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: today.plus({ days: 2 }),
    })
    await RecurringBill.create({
      name: 'Car rego',
      amount: 500,
      frequency: 'annual',
      nextDueOn: today.plus({ days: 30 }),
    })

    const dueBills = await findDueBillsForUser(brian.id, allEnabled, today)

    assert.lengthOf(dueBills, 1)
    assert.equal(dueBills[0].name, 'VPN')
    assert.equal(dueBills[0].kind, 'recurring')
  })

  test('excludes recurring bills when notifyRecurringBills is off', async ({ assert }) => {
    const brian = await loginAsBrian()
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: today.plus({ days: 2 }),
    })

    const dueBills = await findDueBillsForUser(
      brian.id,
      { ...allEnabled, notifyRecurringBills: false },
      today
    )

    assert.lengthOf(dueBills, 0)
  })

  test('a recurring bill with a stale nextDueOn rolls forward rather than reading as overdue', async ({
    assert,
  }) => {
    // resolveNextOccurrence (shared with the dashboard) always advances a
    // past-due anchor date forward by the bill's frequency until it's not
    // in the past - so this never surfaces as negative daysUntilDue.
    const brian = await loginAsBrian()
    await RecurringBill.create({
      name: 'Insurance',
      amount: 200,
      frequency: 'monthly',
      nextDueOn: today.minus({ days: 5 }),
    })

    const dueBills = await findDueBillsForUser(brian.id, allEnabled, today)

    assert.lengthOf(dueBills, 0)
  })

  test('includes an unpaid current-month utility bill and excludes a paid one', async ({
    assert,
  }) => {
    const brian = await loginAsBrian()
    const unpaidUtility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({
      utilityId: unpaidUtility.id,
      year: today.year,
      month: today.month,
      amount: 150,
      paid: false,
    })
    const paidUtility = await Utility.create({ name: 'Gas' })
    await UtilityBill.create({
      utilityId: paidUtility.id,
      year: today.year,
      month: today.month,
      amount: 80,
      paid: true,
    })

    const dueBills = await findDueBillsForUser(brian.id, allEnabled, today)

    assert.lengthOf(dueBills, 1)
    assert.equal(dueBills[0].name, 'Electricity')
    assert.equal(dueBills[0].kind, 'utility')
  })

  test('excludes utility bills when notifyUtilityBills is off', async ({ assert }) => {
    const brian = await loginAsBrian()
    const utility = await Utility.create({ name: 'Electricity' })
    await UtilityBill.create({
      utilityId: utility.id,
      year: today.year,
      month: today.month,
      amount: 150,
      paid: false,
    })

    const dueBills = await findDueBillsForUser(
      brian.id,
      { ...allEnabled, notifyUtilityBills: false },
      today
    )

    assert.lengthOf(dueBills, 0)
  })

  test("includes only the given user's own subscriptions due within leadDays", async ({
    assert,
  }) => {
    const brian = await loginAsBrian()
    const ariel = await loginAsAriel()
    const dueDay = today.plus({ days: 1 }).day
    await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 20,
      dayOfMonth: dueDay,
    })
    await UserSubscription.create({
      userId: ariel.id,
      name: 'Spotify',
      amount: 12,
      dayOfMonth: dueDay,
    })

    const dueBills = await findDueBillsForUser(brian.id, allEnabled, today)

    assert.lengthOf(dueBills, 1)
    assert.equal(dueBills[0].name, 'Netflix')
    assert.equal(dueBills[0].kind, 'subscription')
  })

  test('includes an overdue subscription (day earlier this month) with a negative daysUntilDue', async ({
    assert,
  }) => {
    // Unlike recurring bills, a subscription's dayOfMonth isn't rolled
    // forward to next month - if this month's day has already passed and
    // it's unpaid, it's genuinely overdue.
    const brian = await loginAsBrian()
    const overdueDay = Math.max(1, today.day - 2)
    await UserSubscription.create({
      userId: brian.id,
      name: 'Gym',
      amount: 30,
      dayOfMonth: overdueDay,
    })

    const dueBills = await findDueBillsForUser(brian.id, allEnabled, today)

    assert.lengthOf(dueBills, 1)
    assert.isBelow(dueBills[0].daysUntilDue, 0)
  })

  test('excludes a subscription already marked paid for the current month', async ({ assert }) => {
    const brian = await loginAsBrian()
    const dueDay = today.plus({ days: 1 }).day
    const subscription = await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 20,
      dayOfMonth: dueDay,
    })
    await SubscriptionPayment.create({
      userSubscriptionId: subscription.id,
      year: today.year,
      month: today.month,
      paid: true,
    })

    const dueBills = await findDueBillsForUser(brian.id, allEnabled, today)

    assert.lengthOf(dueBills, 0)
  })

  test('excludes subscriptions when notifySubscriptions is off', async ({ assert }) => {
    const brian = await loginAsBrian()
    const dueDay = today.plus({ days: 1 }).day
    await UserSubscription.create({
      userId: brian.id,
      name: 'Netflix',
      amount: 20,
      dayOfMonth: dueDay,
    })

    const dueBills = await findDueBillsForUser(
      brian.id,
      { ...allEnabled, notifySubscriptions: false },
      today
    )

    assert.lengthOf(dueBills, 0)
  })
})

test.group('runDueNotificationCheck', (group) => {
  let server: FakePushServer
  let originalTlsReject: string | undefined

  group.setup(async () => {
    originalTlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    server = await startFakePushServer()
    return async () => {
      await server.close()
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTlsReject
    }
  })

  group.each.teardown(async () => {
    await NotificationSchedule.query().where('id', 1).delete()
    await UserNotificationPreference.query().delete()
    await RecurringBill.query().delete()
    await UserSubscription.query().delete()
    await PushSubscription.query()
      .where('endpoint', 'like', server.url + '%')
      .delete()
  })

  let subscriptionCounter = 0

  async function subscribe(userId: number) {
    subscriptionCounter++
    const keys = generateTestSubscriptionKeys()
    return PushSubscription.create({
      userId,
      endpoint: `${server.url}?u=${userId}&d=${subscriptionCounter}`,
      p256Dh: keys.p256dh,
      auth: keys.auth,
    })
  }

  group.each.setup(() => {
    // Reset in case a previous test in this group left the fake server in a
    // non-default state (a non-2xx status, or a nonzero request count).
    server.setResponseStatus(201)
    server.resetRequestCount()
  })

  test('does nothing when the check is not due yet', async ({ assert }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: true })
    await subscribe(brian.id)
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 28),
    })

    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 7, 0, 0))

    assert.equal(server.getRequestCount(), 0)
    const schedule = await getNotificationSchedule()
    assert.isNull(schedule.lastRunAt)
  })

  test('sends a push to every subscribed device when a user has a due bill', async ({ assert }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: true, leadDays: 3 })
    await subscribe(brian.id)
    await subscribe(brian.id)
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 29),
    })
    // A second, also-not-overdue due bill so the summary payload's plural,
    // no-overdue-suffix wording path gets exercised too.
    await RecurringBill.create({
      name: 'Streaming',
      amount: 15,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 30),
    })

    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 9, 0, 0))

    assert.equal(server.getRequestCount(), 2)
    const schedule = await getNotificationSchedule()
    assert.equal(schedule.lastRunAt?.toMillis(), DateTime.local(2026, 7, 28, 9, 0, 0).toMillis())
  })

  test('sends one summary push covering multiple due bills, including an overdue one', async ({
    assert,
  }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: true, leadDays: 3 })
    await subscribe(brian.id)
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 29),
    })
    await UserSubscription.create({
      userId: brian.id,
      name: 'Gym',
      amount: 30,
      // Overdue: earlier in the month than "today" below.
      dayOfMonth: 26,
    })

    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 9, 0, 0))

    assert.equal(server.getRequestCount(), 1)
  })

  test('stamps lastRunAt without sending anything when no user has a due bill', async ({
    assert,
  }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: true })
    await subscribe(brian.id)

    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 9, 0, 0))

    assert.equal(server.getRequestCount(), 0)
    const schedule = await getNotificationSchedule()
    assert.isNotNull(schedule.lastRunAt)
  })

  test('skips users who have not opted in', async ({ assert }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: false })
    await subscribe(brian.id)
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 29),
    })

    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 9, 0, 0))

    assert.equal(server.getRequestCount(), 0)
  })

  test('prunes a subscription the push service reports gone', async ({ assert }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: true })
    const subscription = await subscribe(brian.id)
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 29),
    })

    server.setResponseStatus(410)
    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 9, 0, 0))

    assert.isNull(await PushSubscription.find(subscription.id))
  })

  test('logs and continues past a genuine send failure rather than crashing the run', async ({
    assert,
  }) => {
    const brian = await loginAsBrian()
    await UserNotificationPreference.create({ userId: brian.id, enabled: true })
    await subscribe(brian.id)
    await subscribe(brian.id)
    await RecurringBill.create({
      name: 'VPN',
      amount: 10,
      frequency: 'monthly',
      nextDueOn: DateTime.local(2026, 7, 29),
    })

    server.setResponseStatus(500)
    await runDueNotificationCheck(DateTime.local(2026, 7, 28, 9, 0, 0))

    // Both devices were attempted despite neither succeeding, and the run
    // still completed (stamped lastRunAt) rather than throwing.
    assert.equal(server.getRequestCount(), 2)
    const schedule = await getNotificationSchedule()
    assert.isNotNull(schedule.lastRunAt)
  })
})
