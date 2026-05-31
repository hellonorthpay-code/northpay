import { uid } from "@/lib/utils";
import type { IAuditRepository } from "@/lib/repositories/types";

export type AuditEvent =
  | "payroll.preview.created"
  | "payroll.finalized"
  | "payroll.voided"
  | "employee.created"
  | "employee.updated"
  | "employee.removed"
  | "settings.updated";

export interface AuditEntry {
  id: string;
  ts: string;
  event: AuditEvent;
  actor?: string;
  /** Lightweight, JSON-safe context. Do NOT include SIN, bank, etc. */
  context: Record<string, string | number | boolean | null | undefined>;
}

export class AuditLogService {
  constructor(private readonly repo: IAuditRepository) {}

  async log(event: AuditEvent, context: AuditEntry["context"] = {}) {
    const entry: AuditEntry = {
      id: uid(),
      ts: new Date().toISOString(),
      event,
      context: sanitize(context),
    };
    await this.repo.append(entry);
  }

  async tail(limit = 50): Promise<AuditEntry[]> {
    return this.repo.list(limit);
  }
}

const REDACT_KEYS = new Set([
  "sin",
  "bankAccount",
  "bankTransit",
  "bankInstitution",
]);

function sanitize(ctx: AuditEntry["context"]): AuditEntry["context"] {
  const out: AuditEntry["context"] = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (REDACT_KEYS.has(k)) out[k] = "***";
    else out[k] = v;
  }
  return out;
}
