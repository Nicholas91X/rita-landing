import { z } from "zod"

export const saveVideoProgressSchema = z.object({
  video_id: z.string().uuid(),
  progress_seconds: z.number().int().min(0).max(86400),
  duration_seconds: z.number().int().min(0).max(86400),
  completed: z.boolean().optional(),
})
export type SaveVideoProgressInput = z.infer<typeof saveVideoProgressSchema>
