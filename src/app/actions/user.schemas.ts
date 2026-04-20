import { z } from "zod"
import { emailSchema, passwordSchema } from "@/lib/security/validation"

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  full_name: z.string().trim().min(2, "Minimo 2 caratteri").max(100),
  terms_accepted: z.literal("on", {
    message: "Devi accettare i termini",
  }),
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password obbligatoria").max(72),
})
export type LoginInput = z.infer<typeof loginSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const findEmailSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
})
export type FindEmailInput = z.infer<typeof findEmailSchema>

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Minimo 2 caratteri").max(100),
})
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export const resetPasswordSchema = z.object({
  password: passwordSchema,
})
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
