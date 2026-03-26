import { sql } from "@/lib/db";

// ── Event Types ────────────────────────────────────────────────────────────

export type LogEventType =
  | "ORDER_CREATED"
  | "ORDER_CANCELLED"
  | "ORDER_STATUS_CHANGED"
  | "INVENTORY_ADJUSTED"
  | "CUSTOMER_REGISTERED"
  | "CUSTOMER_LOGIN"
  | "ADMIN_LOGIN"
  | "PRODUCT_CREATED"
  | "PRODUCT_UPDATED"
  | "PRODUCT_DELETED"
  | "CATEGORY_CREATED"
  | "CATEGORY_DELETED"
  | "BRAND_CREATED"
  | "BRAND_DELETED"
  | "SITESETTINGS_UPDATED"
  | "ERROR";

// ── Logger ─────────────────────────────────────────────────────────────────

export async function logEvent(
  eventType: LogEventType,
  entityId: string | null,
  description: string
) {
  try {
    await sql`
      INSERT INTO system_logs (event_type, entity_id, description, created_at)
      VALUES (${eventType}, ${entityId || null}, ${description}, NOW())
    `;
  } catch (err) {
    // Non-blocking: never let logging break the main flow
    console.error("[Logger] Failed to write system log:", err);
  }
}
