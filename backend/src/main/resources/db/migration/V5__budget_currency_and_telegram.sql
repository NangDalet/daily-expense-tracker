ALTER TABLE budgets ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE budgets ADD CONSTRAINT ck_budgets_currency CHECK (currency IN ('USD', 'KHR'));
DROP INDEX uq_budgets_user_category_period;
CREATE UNIQUE INDEX uq_budgets_user_category_period ON budgets
    (user_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid), month, year, currency);

CREATE TABLE telegram_connections (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    chat_id BIGINT UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    link_hash VARCHAR(64) UNIQUE,
    link_expires_at TIMESTAMPTZ
);
CREATE TABLE telegram_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    event_key TEXT NOT NULL UNIQUE,
    message TEXT NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_telegram_pending ON telegram_notifications(next_attempt_at) WHERE status IN ('pending','sending');
