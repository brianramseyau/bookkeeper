import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import UserTransformer from '#transformers/user_transformer'
import {
  updateProfileValidator,
  changePasswordValidator,
  changeEmailValidator,
} from '#validators/user'

export default class UsersController {
  async index({ serialize }: HttpContext) {
    const users = await User.query().orderBy('fullName', 'asc')
    return serialize(UserTransformer.transform(users))
  }

  async update({ params, request, auth, response, serialize }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    if (Number(params.id) !== currentUser.id) {
      return response.forbidden({ message: 'You can only edit your own profile' })
    }

    const payload = await request.validateUsing(updateProfileValidator)
    currentUser.merge(payload)
    await currentUser.save()

    return serialize(UserTransformer.transform(currentUser))
  }

  async changePassword({ params, request, auth, response }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    if (Number(params.id) !== currentUser.id) {
      return response.forbidden({ message: 'You can only change your own password' })
    }

    const payload = await request.validateUsing(changePasswordValidator)
    await User.verifyCredentials(currentUser.email, payload.currentPassword)

    currentUser.password = payload.newPassword
    await currentUser.save()

    return response.noContent()
  }

  async changeEmail({ params, request, auth, response, serialize }: HttpContext) {
    const currentUser = auth.getUserOrFail()
    if (Number(params.id) !== currentUser.id) {
      return response.forbidden({ message: 'You can only change your own email' })
    }

    const payload = await request.validateUsing(changeEmailValidator)
    await User.verifyCredentials(currentUser.email, payload.currentPassword)

    const existing = await User.findBy('email', payload.newEmail)
    if (existing && existing.id !== currentUser.id) {
      return response.conflict({ message: 'That email is already in use' })
    }

    currentUser.email = payload.newEmail
    await currentUser.save()

    return serialize(UserTransformer.transform(currentUser))
  }
}
