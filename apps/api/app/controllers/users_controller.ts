import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserTransformer from '#transformers/user_transformer'

/**
 * Read-only for now (Phase 3 just needs a list for per-user tabs/dropdowns).
 * A later phase can add `PATCH /users/:id` for self-service profile edits.
 */
export default class UsersController {
  async index({ serialize }: HttpContext) {
    const users = await User.query().orderBy('fullName', 'asc')
    return serialize(UserTransformer.transform(users))
  }
}
