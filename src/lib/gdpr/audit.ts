import { createServiceRoleClient } from "@/utils/supabase/server"

export type GdprAction = "export" | "delete_request" | "delete_completed"

export async function logGdprAction(params: {
  userId: string | null
  action: GdprAction
  ipAddress?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  const admin = await createServiceRoleClient()
  const { error } = await admin.from("gdpr_audit_log").insert({
    user_id: params.userId,
    action: params.action,
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? null,
  })
  if (error) {
    // Non-fatal — log and continue. Audit log is evidence, not a gate.
    console.error("GDPR audit log insert failed:", error)
  }
}
