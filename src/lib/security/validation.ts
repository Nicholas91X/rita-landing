import { z, ZodType } from "zod"

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email non valida")
  .max(254, "Email troppo lunga")

export const passwordSchema = z
  .string()
  .min(8, "Minimo 8 caratteri")
  .max(72, "Massimo 72 caratteri")
  .regex(/[A-Z]/, "Almeno una lettera maiuscola")
  .regex(/[a-z]/, "Almeno una lettera minuscola")
  .regex(/[0-9]/, "Almeno un numero")

export const shortTextSchema = z
  .string()
  .trim()
  .min(1, "Campo obbligatorio")
  .max(500, "Massimo 500 caratteri")

export class ValidationError extends Error {
  constructor(public fieldErrors: Record<string, string[]>) {
    super("Validazione fallita")
    this.name = "ValidationError"
  }
}

export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data)
  if (!parsed.success) {
    const flattened = parsed.error.flatten()
    throw new ValidationError(
      flattened.fieldErrors as Record<string, string[]>,
    )
  }
  return parsed.data
}

export function formDataToObject(
  fd: FormData,
): Record<string, FormDataEntryValue> {
  return Object.fromEntries(fd.entries())
}
