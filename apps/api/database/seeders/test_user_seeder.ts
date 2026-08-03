import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'

/** Fixed login the Japa test suite runs against - not read from anywhere real. */
const TEST_USERS = [
  { fullName: 'Adam', email: 'adam@test.local' },
  { fullName: 'Eve', email: 'eve@test.local' },
]
const TEST_PASSWORD = 'test-password-123'

export default class extends BaseSeeder {
  static environment = ['test']

  async run() {
    for (const row of TEST_USERS) {
      await User.updateOrCreate(
        { email: row.email },
        { fullName: row.fullName, password: TEST_PASSWORD }
      )
    }
  }
}
