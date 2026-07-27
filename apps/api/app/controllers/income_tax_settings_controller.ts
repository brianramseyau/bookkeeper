import type { HttpContext } from '@adonisjs/core/http'
import IncomeTaxSetting from '#models/income_tax_setting'
import { upsertIncomeTaxSettingValidator } from '#validators/income_tax_setting'

export default class IncomeTaxSettingsController {
  async show({ request, response }: HttpContext) {
    const userId = Number(request.input('userId'))
    const financialYear = Number(request.input('financialYear'))

    const setting = await IncomeTaxSetting.query()
      .where('userId', userId)
      .where('financialYear', financialYear)
      .first()

    return response.json({
      userId,
      financialYear,
      marginalRate: setting?.marginalRate ?? null,
    })
  }

  async upsert({ request, response }: HttpContext) {
    const payload = await request.validateUsing(upsertIncomeTaxSettingValidator)
    const setting = await IncomeTaxSetting.updateOrCreate(
      { userId: payload.userId, financialYear: payload.financialYear },
      { marginalRate: payload.marginalRate }
    )
    return response.json({
      userId: setting.userId,
      financialYear: setting.financialYear,
      marginalRate: setting.marginalRate,
    })
  }
}
