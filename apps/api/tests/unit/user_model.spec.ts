import { test } from '@japa/runner'
import User from '#models/user'

test.group('User.initials', () => {
  test('uses the first letter of each name for a two-word fullName', ({ assert }) => {
    const user = new User()
    user.fullName = 'John Doe'

    assert.equal(user.initials, 'JD')
  })

  test('falls back to the first two letters when fullName has no space', ({ assert }) => {
    const user = new User()
    user.fullName = 'Brian'

    assert.equal(user.initials, 'BR')
  })

  test('falls back to the email address when fullName is not set', ({ assert }) => {
    const user = new User()
    user.email = 'brian@example.com'

    assert.equal(user.initials, 'BE')
  })
})
