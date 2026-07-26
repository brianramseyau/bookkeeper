import vine from '@vinejs/vine'

/**
 * Shared rule for email.
 */
const email = () => vine.string().email().maxLength(254)

/**
 * Validator to use before validating user credentials
 * during login
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

export const updateProfileValidator = vine.create({
  displayColor: vine.string().trim().maxLength(20).nullable().optional(),
})

export const changePasswordValidator = vine.create({
  currentPassword: vine.string(),
  newPassword: vine.string().minLength(8).maxLength(180),
})

export const changeEmailValidator = vine.create({
  currentPassword: vine.string(),
  newEmail: email(),
})
