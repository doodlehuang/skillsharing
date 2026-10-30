-- Fail before changing data if historical postings require reconciliation.
CREATE TABLE security_migration_check (ok INTEGER CHECK(ok=1));
INSERT INTO security_migration_check SELECT CASE WHEN
 EXISTS(SELECT 1 FROM ledger WHERE exchange_id IS NOT NULL GROUP BY exchange_id,reason HAVING COUNT(*)>1)
 OR EXISTS(SELECT 1 FROM ledger WHERE reason='bonus' GROUP BY user_id HAVING COUNT(*)>1)
 OR EXISTS(SELECT 1 FROM ledger GROUP BY user_id HAVING SUM(delta)<0)
 OR EXISTS(SELECT 1 FROM exchanges e JOIN users a ON a.id=e.requester_id JOIN users b ON b.id=e.partner_id WHERE a.is_demo!=b.is_demo)
 THEN 0 ELSE 1 END;
DROP TABLE security_migration_check;
DROP TABLE sessions;
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,created_at TEXT NOT NULL,expires_at TEXT NOT NULL);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE TABLE auth_throttle(key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL);
CREATE UNIQUE INDEX idx_ledger_posting ON ledger(exchange_id,reason) WHERE exchange_id IS NOT NULL;
CREATE UNIQUE INDEX idx_ledger_bonus ON ledger(user_id) WHERE reason='bonus';
