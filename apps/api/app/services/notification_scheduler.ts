import { DateTime } from 'luxon'
import logger from '@adonisjs/core/services/logger'
import NotificationSchedule from '#models/notification_schedule'
import UserNotificationPreference from '#models/user_notification_preference'
import RecurringBill from '#models/recurring_bill'
import RecurringBillPayment from '#models/recurring_bill_payment'
import Utility from '#models/utility'
import UtilityBill from '#models/utility_bill'
import UserSubscription from '#models/user_subscription'
import SubscriptionPayment from '#models/subscription_payment'
import PushSubscription from '#models/push_subscription'
import {
  compareByDaysUntilDue,
  nextUnpaidRecurringBillDueDate,
} from '#services/recurring_bill_due_date'
import { nextUnpaidUtilityDueDate } from '#services/utility_billing_period'
import { sendPushNotification, type PushPayload } from '#services/push_service'

/** The one settings row this app has for the shared daily check - there's no per-user dimension to when the job runs. */
const SCHEDULE_ID = 1

const DEFAULT_SCHEDULE = { sendHour: 8, lastRunAt: null }

export interface DueBill {
  kind: 'utility' | 'recurring' | 'subscription'
  name: string
  daysUntilDue: number
}

export async function getNotificationSchedule(): Promise<NotificationSchedule> {
  return NotificationSchedule.firstOrCreate({ id: SCHEDULE_ID }, DEFAULT_SCHEDULE)
}

const DEFAULT_PREFERENCE = {
  enabled: false,
  leadDays: 3,
  notifyUtilityBills: true,
  notifyRecurringBills: true,
  notifySubscriptions: true,
}

export async function getUserNotificationPreference(
  userId: number
): Promise<UserNotificationPreference> {
  return UserNotificationPreference.firstOrCreate({ userId }, { userId, ...DEFAULT_PREFERENCE })
}

/**
 * True once the local calendar day has moved on from the last run and the
 * configured hour has passed - so the check fires once, at a predictable
 * time of day, rather than at whatever moment a 15-minute poll first
 * notices a new day (which could be the middle of the night).
 */
export function isNotificationCheckDue(
  schedule: Pick<NotificationSchedule, 'sendHour' | 'lastRunAt'>,
  now: DateTime
): boolean {
  if (schedule.lastRunAt && now.hasSame(schedule.lastRunAt, 'day')) return false
  return now.hour >= schedule.sendHour
}

async function findDueRecurringBills(today: DateTime, leadDays: number): Promise<DueBill[]> {
  const bills = await RecurringBill.query().where('isActive', true).whereNotNull('dueDay')

  const billIds = bills.map((bill) => bill.id)
  const paidPayments = billIds.length
    ? await RecurringBillPayment.query().whereIn('recurringBillId', billIds).where('paid', true)
    : []
  const paidPeriods = new Set(
    paidPayments.map((payment) => `${payment.recurringBillId}-${payment.year}-${payment.month}`)
  )

  return bills
    .map((bill) => {
      // whereNotNull('dueDay') above guarantees nextUnpaidRecurringBillDueDate
      // returns non-null here too. Shared with the dashboard's upcoming-bills
      // card so an already-paid occurrence is skipped the same way in both
      // places, rather than a paid bill still triggering a reminder.
      const nextOccurrence = nextUnpaidRecurringBillDueDate(
        bill.frequency,
        bill.dueDay,
        bill.dueMonth,
        bill.dueYear,
        today,
        (year, month) => paidPeriods.has(`${bill.id}-${year}-${month}`)
      )!
      return {
        kind: 'recurring' as const,
        name: bill.name,
        daysUntilDue: Math.floor(nextOccurrence.diff(today, 'days').days),
      }
    })
    .filter((bill) => bill.daysUntilDue <= leadDays)
    .sort((a, b) => compareByDaysUntilDue(a.daysUntilDue, b.daysUntilDue))
}

/**
 * Uses the same due-date math as the utility trend chart
 * (`nextUnpaidUtilityDueDate`, built on `utilityDueDateFor`'s
 * `receivedOn + dueOffsetDays`) rather than a separate "unpaid current-month
 * row" flag, so a notification can never fire on a different date than what
 * the chart shows as "next due" - which is what let a utility bill notify a
 * full week before its real due date. A utility with no configured
 * `dueOffsetDays`, or no bill that's ever had a `receivedOn` recorded, has a
 * genuinely unknown due date and is silently skipped rather than guessed.
 */
async function findDueUtilityBills(today: DateTime, leadDays: number): Promise<DueBill[]> {
  const utilities = await Utility.query().where('isActive', true)
  const dueBills: DueBill[] = []

  for (const utility of utilities) {
    const bills = await UtilityBill.query().where('utilityId', utility.id)
    const nextDueOn = nextUnpaidUtilityDueDate(utility, bills, today)
    if (!nextDueOn) continue

    const daysUntilDue = Math.floor(nextDueOn.diff(today, 'days').days)
    if (daysUntilDue <= leadDays) {
      dueBills.push({ kind: 'utility', name: utility.name, daysUntilDue })
    }
  }

  return dueBills.sort((a, b) => compareByDaysUntilDue(a.daysUntilDue, b.daysUntilDue))
}

/** Subscriptions are per-person, so only this user's own are ever included. */
async function findDueSubscriptions(
  userId: number,
  today: DateTime,
  leadDays: number
): Promise<DueBill[]> {
  const subscriptions = await UserSubscription.query()
    .where('userId', userId)
    .where('isActive', true)
    .where('isPaused', false)
    .whereNotNull('dayOfMonth')

  const dueBills: DueBill[] = []
  for (const subscription of subscriptions) {
    const payment = await SubscriptionPayment.query()
      .where('userSubscriptionId', subscription.id)
      .where('year', today.year)
      .where('month', today.month)
      .first()
    if (payment?.paid) continue

    // dayOfMonth can be entered up to 31 regardless of the actual month
    // (see the validator) - clamp so e.g. day 31 in February resolves to a
    // real date instead of producing an invalid DateTime.
    const daysInMonth = today.daysInMonth ?? 31
    const day = Math.min(Math.max(subscription.dayOfMonth!, 1), daysInMonth)
    const dueDate = DateTime.local(today.year, today.month, day)
    const daysUntilDue = Math.floor(dueDate.diff(today, 'days').days)
    if (daysUntilDue <= leadDays) {
      dueBills.push({ kind: 'subscription', name: subscription.name, daysUntilDue })
    }
  }

  return dueBills.sort((a, b) => compareByDaysUntilDue(a.daysUntilDue, b.daysUntilDue))
}

export async function findDueBillsForUser(
  userId: number,
  prefs: Pick<
    UserNotificationPreference,
    'leadDays' | 'notifyUtilityBills' | 'notifyRecurringBills' | 'notifySubscriptions'
  >,
  today: DateTime
): Promise<DueBill[]> {
  const [recurring, utility, subscriptions] = await Promise.all([
    prefs.notifyRecurringBills ? findDueRecurringBills(today, prefs.leadDays) : [],
    prefs.notifyUtilityBills ? findDueUtilityBills(today, prefs.leadDays) : [],
    prefs.notifySubscriptions ? findDueSubscriptions(userId, today, prefs.leadDays) : [],
  ])

  return [...recurring, ...utility, ...subscriptions]
}

function buildPayload(dueBills: DueBill[]): PushPayload {
  const overdue = dueBills.filter((bill) => bill.daysUntilDue < 0).length
  const title =
    dueBills.length === 1
      ? '1 bill due'
      : `${dueBills.length} bills due${overdue > 0 ? ` (${overdue} overdue)` : ''}`
  const body = dueBills
    .slice(0, 5)
    .map((bill) => bill.name)
    .join(', ')

  return { title, body, url: '/bills' }
}

/**
 * Runs the daily bill-reminder check if it's due: for every user who has
 * opted in, computes their due bills and pushes a summary notification to
 * every device they've registered. Always logs a summary line (never just
 * silently returns) so activity is visible in `docker logs`, and never lets
 * one user's or one device's failure stop the rest - matching the backup
 * scheduler's "never crash the poll" guarantee.
 */
export async function runDueNotificationCheck(now: DateTime = DateTime.local()): Promise<void> {
  const schedule = await getNotificationSchedule()
  if (!isNotificationCheckDue(schedule, now)) return

  const today = now.startOf('day')
  const preferences = await UserNotificationPreference.query().where('enabled', true)

  let sent = 0
  let pruned = 0
  let failed = 0

  for (const prefs of preferences) {
    try {
      const dueBills = await findDueBillsForUser(prefs.userId, prefs, today)
      if (dueBills.length === 0) continue

      const payload = buildPayload(dueBills)
      const subscriptions = await PushSubscription.query().where('userId', prefs.userId)

      for (const subscription of subscriptions) {
        try {
          const outcome = await sendPushNotification(subscription, payload)
          if (outcome.pruned) {
            pruned++
            logger.warn(
              { userId: prefs.userId, subscriptionId: subscription.id },
              'Pruned stale push subscription'
            )
          } else {
            sent++
          }
        } catch (error) {
          failed++
          logger.error(
            { err: error, userId: prefs.userId, subscriptionId: subscription.id },
            'Failed to send bill-reminder push notification'
          )
        }
      }
      /* c8 ignore start -- the outer catch below is only reachable via a genuine DB-level failure (e.g. connection loss) mid-query, which can't be triggered from a test without faking the database itself; it's a last-resort guard so one user's failure can never take down the rest of the run. */
    } catch (error) {
      failed++
      logger.error({ err: error, userId: prefs.userId }, 'Failed to compute due bills for user')
    }
    /* c8 ignore stop */
  }

  schedule.lastRunAt = now
  await schedule.save()

  logger.info({ sent, pruned, failed }, 'Notification check complete')
}
