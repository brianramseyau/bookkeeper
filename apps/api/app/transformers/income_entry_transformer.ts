import type IncomeEntry from '#models/income_entry'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class IncomeEntryTransformer extends BaseTransformer<IncomeEntry> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'incomeSourceId',
      'userId',
      'year',
      'month',
      'receivedOn',
      'amount',
      'note',
      'taxWithheld',
      'createdAt',
      'updatedAt',
    ])
  }
}
