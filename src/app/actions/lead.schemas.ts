import { z } from "zod"
import { emailSchema, passwordSchema } from "@/lib/security/validation"

export const leadFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Nome troppo corto")
    .max(100, "Nome troppo lungo"),
  email: emailSchema,
  terms_accepted: z.literal("on", { message: "Devi accettare i termini" }),
  marketing_consent: z.literal("on").optional(),
  lead_source: z.string().max(50).optional(),
})
export type LeadFormInput = z.infer<typeof leadFormSchema>

export const upgradeLeadSchema = z.object({
  password: passwordSchema,
})
export type UpgradeLeadInput = z.infer<typeof upgradeLeadSchema>
