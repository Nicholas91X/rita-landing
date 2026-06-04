// src/app/actions/admin_actions/broadcasts.schemas.ts
import { z } from "zod"

export const broadcastSchema = z.object({
  title: z.string().trim().min(3, "Titolo min 3 caratteri").max(80, "Titolo max 80 caratteri"),
  body: z.string().trim().min(5, "Messaggio min 5 caratteri").max(150, "Messaggio max 150 caratteri"),
  // Optional longer text used only by the email channel (newsletter body).
  emailBody: z.string().trim().max(2000).optional(),
  url: z.string().startsWith("/", "URL deve iniziare con /").max(200),
  targetType: z.enum(["all", "package", "level", "lead"]),
  targetId: z.string().uuid().optional(),
  channels: z.object({
    inApp: z.boolean(),
    push: z.boolean(),
    email: z.boolean().default(false),
  }),
}).refine(
  (d) => d.targetType === "all" || d.targetType === "lead" || !!d.targetId,
  { message: "targetId richiesto quando targetType è 'package' o 'level'", path: ["targetId"] },
)

export type BroadcastInput = z.infer<typeof broadcastSchema>
