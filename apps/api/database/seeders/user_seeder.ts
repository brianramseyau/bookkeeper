import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import User from '#models/user'

export default class extends BaseSeeder {
  async run() {
    await User.updateOrCreateMany('email', [
      {
        fullName: 'Brian',
        email: env.get('SEED_BRIAN_EMAIL'),
        password: env.get('SEED_BRIAN_PASSWORD'),
      },
      {
        fullName: 'Ariel',
        email: env.get('SEED_ARIEL_EMAIL'),
        password: env.get('SEED_ARIEL_PASSWORD'),
      },
    ])
  }
}
