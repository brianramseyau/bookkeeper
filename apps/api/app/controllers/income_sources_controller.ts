import { DateTime } from 'luxon'
import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import IncomeSource from '#models/income_source'
import IncomeSourceTransformer from '#transformers/income_source_transformer'
import { createIncomeSourceValidator, updateIncomeSourceValidator } from '#validators/income_source'
import { monthlyEquivalentAmount } from '#services/income_cadence'
import { computeIncomeLines } from '#services/income_lines'

function round(value: number): number {
  return Math.round(value * 100) / 100
}

export default class IncomeSourcesController {
  async index({ request, serialize }: HttpContext) {
    const userId = request.input('userId')
    const query = IncomeSource.query().orderBy('name', 'asc')
    if (userId) {
      query.where('userId', Number(userId))
    }
    const sources = await query
    return serialize(IncomeSourceTransformer.transform(sources))
  }

  async summary({ response }: HttpContext) {
    const [users, sources] = await Promise.all([
      User.query().orderBy('fullName', 'asc'),
      IncomeSource.query().where('isActive', true),
    ])

    const results = users.map((user) => {
      const userSources = sources.filter((s) => s.userId === user.id)
      const total = userSources.reduce((sum, s) => sum + monthlyEquivalentAmount(s), 0)
      return {
        userId: user.id,
        fullName: user.fullName,
        total: round(total),
        count: userSources.length,
      }
    })

    return response.json({ data: results })
  }

  async ytd({ request, response }: HttpContext) {
    const userId = Number(request.input('userId'))
    const year = Number(request.input('year'))
    const now = DateTime.now()
    const maxMonth = year < now.year ? 12 : year === now.year ? now.month : 0

    const sources = await IncomeSource.query().where('userId', userId).orderBy('name', 'asc')

    const months: {
      month: number
      bySource: Record<number, number>
      total: number
      estimated: boolean
    }[] = []
    let ytdTotal = 0

    for (let month = 1; month <= maxMonth; month++) {
      const { lines } = await computeIncomeLines(year, month)
      const userLines = lines.filter((line) => line.userId === userId)
      const bySource: Record<number, number> = {}
      let total = 0
      let estimated = false
      for (const line of userLines) {
        if (line.sourceId !== null) bySource[line.sourceId] = line.actual
        total += line.actual
        if (line.estimated) estimated = true
      }
      months.push({ month, bySource, total: round(total), estimated })
      ytdTotal += total
    }

    return response.json({
      year,
      sources: sources.map((source) => ({ id: source.id, name: source.name })),
      months,
      ytdTotal: round(ytdTotal),
    })
  }

  async store({ request, response, serialize }: HttpContext) {
    const payload = await request.validateUsing(createIncomeSourceValidator)
    const source = await IncomeSource.create({
      userId: payload.userId,
      name: payload.name,
      expectedAmount: payload.expectedAmount,
      frequency: payload.frequency,
      payDayOfMonth: payload.payDayOfMonth ?? null,
      weekendRollback: payload.weekendRollback ?? false,
      anchorDate: payload.anchorDate ?? null,
      taxWithheld: payload.taxWithheld ?? true,
      notes: payload.notes ?? null,
    })
    return response.created(await serialize(IncomeSourceTransformer.transform(source)))
  }

  async update({ params, request, serialize }: HttpContext) {
    const source = await IncomeSource.findOrFail(params.id)
    const payload = await request.validateUsing(updateIncomeSourceValidator)
    source.merge(payload)
    await source.save()
    return serialize(IncomeSourceTransformer.transform(source))
  }

  async destroy({ params, response }: HttpContext) {
    const source = await IncomeSource.findOrFail(params.id)
    source.isActive = false
    await source.save()
    return response.noContent()
  }
}
