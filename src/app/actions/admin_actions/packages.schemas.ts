import { z } from "zod"

// Text fields extracted from a package create/update FormData.
// `image` (File) is validated separately in the action itself.
export const createPackageSchema = z.object({
  name: z.string().trim().min(2, "Minimo 2 caratteri").max(200),
  title: z.string().trim().max(200).optional().or(z.literal("")),
  description: z.string().trim().min(1, "Descrizione richiesta").max(2000),
  price: z.coerce.number().min(0, "Prezzo non può essere negativo").max(99999, "Prezzo troppo alto"),
  course_id: z.string().uuid("Corso non valido"),
  badge_type: z.string().trim().max(100).optional().or(z.literal("")),
  payment_mode: z.enum(["subscription", "payment"]).default("subscription"),
})
export type CreatePackageInput = z.infer<typeof createPackageSchema>

export const updatePackageSchema = createPackageSchema.extend({
  removeImage: z.enum(["true", "false"]).optional(),
})
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>
