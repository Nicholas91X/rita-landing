import { z } from "zod"
import { emailSchema, passwordSchema } from "@/lib/security/validation"

// Checkboxes registered via react-hook-form yield `"on"` when checked and
// `false` when unchecked; FormData yields `"on"` when checked and missing
// when unchecked. We accept both so the same schema validates client-side
// (RHF resolver) and server-side (formDataToObject).
const checkboxOn = z
  .union([z.literal("on"), z.literal(true), z.literal(false), z.undefined()])
  .transform((v) => (v === "on" || v === true ? ("on" as const) : undefined))

export const leadFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Nome troppo corto")
    .max(100, "Nome troppo lungo"),
  email: emailSchema,
  terms_accepted: checkboxOn.refine((v) => v === "on", {
    message: "Devi accettare i termini",
  }),
  marketing_consent: checkboxOn.optional(),
  lead_source: z.string().max(50).optional(),
})
export type LeadFormInput = z.input<typeof leadFormSchema>
export type LeadFormParsed = z.infer<typeof leadFormSchema>

export const upgradeLeadSchema = z.object({
  password: passwordSchema,
})
export type UpgradeLeadInput = z.infer<typeof upgradeLeadSchema>
