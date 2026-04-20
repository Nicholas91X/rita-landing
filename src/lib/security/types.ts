/**
 * Standard return shape for server actions that can fail with either a
 * top-level message or per-field validation errors.
 *
 * Callers discriminate on `ok`. On failure, `fieldErrors` maps form field
 * names to arrays of messages (shape produced by Zod's .flatten().fieldErrors)
 * — pass directly to react-hook-form's setError or render inline.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]>; retryAfter?: number }
