-- Existing expenses remain outside the cash balance until explicitly selected.
ALTER TABLE expenses ADD COLUMN use_topup_balance BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expenses ADD CONSTRAINT ck_expenses_topup_cash
    CHECK (NOT use_topup_balance OR payment_method = 'CASH');

CREATE TABLE cash_topups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL CHECK (currency IN ('USD', 'KHR')),
    topup_date DATE NOT NULL CHECK (topup_date BETWEEN DATE '1900-01-01' AND DATE '2999-12-31'),
    note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_topups_user_date ON cash_topups(user_id, topup_date DESC, id DESC);
CREATE INDEX idx_expenses_topup_user_currency ON expenses(user_id, currency) WHERE use_topup_balance;
