import { isDatabaseEnabled, isUuid, query } from './db';
import type { SessionUser } from './types';

export async function auditLog(
  user: SessionUser | null,
  action: string,
  entityType: string,
  entityId?: string | null,
  metadata: Record<string, unknown> = {}
) {
  if (!isDatabaseEnabled) return;
  await query(
    `INSERT INTO audit_logs(user_id, action, entity_type, entity_id, metadata)
     VALUES($1,$2,$3,$4,$5)`,
    [user?.id ?? null, action, entityType, entityId && isUuid(entityId) ? entityId : null, JSON.stringify(metadata)]
  );
}

export async function outboxEvent(
  eventType: string,
  aggregateType: string,
  aggregateId: string,
  payload: Record<string, unknown>,
  targetSystem = 'future-integrations'
) {
  if (!isDatabaseEnabled) return;
  await query(
    `INSERT INTO outbox_events(event_type, aggregate_type, aggregate_id, payload, target_system)
     VALUES($1,$2,$3,$4,$5)`,
    [eventType, aggregateType, aggregateId, JSON.stringify(payload), targetSystem]
  );
}
