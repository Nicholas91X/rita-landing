import { z } from "zod"
import { emailSchema } from "@/lib/security/validation"

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: emailSchema,
  message: z.string().trim().min(10, "Messaggio troppo corto").max(2000),
  honeypot: z.string().max(0, "Campo nascosto — bot detected").optional(),
})
export type ContactInput = z.infer<typeof contactSchema>
