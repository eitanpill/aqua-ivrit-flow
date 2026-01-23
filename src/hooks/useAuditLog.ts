import { supabase } from "@/integrations/supabase/client";

interface AuditLogParams {
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  details?: Record<string, unknown>;
}

export function useAuditLog() {
  const logAuditEvent = async ({
    action,
    entityType,
    entityId,
    entityName,
    details = {}
  }: AuditLogParams): Promise<void> => {
    try {
      await (supabase.rpc as any)('log_audit_event', {
        p_action: action,
        p_entity_type: entityType,
        p_entity_id: entityId || null,
        p_entity_name: entityName || null,
        p_details: details
      });
    } catch (error) {
      // Silently fail - audit logging should not block main operations
      console.error('Audit log error:', error);
    }
  };

  return { logAuditEvent };
}