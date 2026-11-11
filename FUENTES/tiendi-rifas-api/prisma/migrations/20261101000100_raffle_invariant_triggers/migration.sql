-- Triggers for Rifas Platform Invariants

-- 1. Inmutabilidad de compromiso y drand cuando la rifa sale de DRAFT
CREATE OR REPLACE FUNCTION check_raffle_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'DRAFT' THEN
    IF NEW."commitmentHash" IS DISTINCT FROM OLD."commitmentHash" OR
       NEW."drandRound" IS DISTINCT FROM OLD."drandRound" OR
       NEW."drandChainHash" IS DISTINCT FROM OLD."drandChainHash" THEN
      RAISE EXCEPTION 'Cannot modify commitmentHash, drandRound or drandChainHash once raffle is not in DRAFT status';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_raffle_immutability ON "Raffle";
CREATE TRIGGER trg_raffle_immutability
BEFORE UPDATE ON "Raffle"
FOR EACH ROW
EXECUTE FUNCTION check_raffle_immutability();

-- 2. Invariante append-only para AuditEvent: no UPDATE ni DELETE
CREATE OR REPLACE FUNCTION check_audit_event_append_only()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'AuditEvent records are append-only: updates are prohibited';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'AuditEvent records are append-only: deletions are prohibited';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_event_append_only ON "AuditEvent";
CREATE TRIGGER trg_audit_event_append_only
BEFORE UPDATE OR DELETE ON "AuditEvent"
FOR EACH ROW
EXECUTE FUNCTION check_audit_event_append_only();
