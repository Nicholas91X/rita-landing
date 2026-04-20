import { z } from "zod"

export const refundRequestSchema = z.object({
  id: z.string().uuid("ID non valido"),
  type: z.enum(["subscription", "purchase"]),
  reason: z.string().trim().min(1, "Motivo richiesto").max(500, "Max 500 caratteri"),
})
export type RefundRequestInput = z.infer<typeof refundRequestSchema>

export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
})
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>
