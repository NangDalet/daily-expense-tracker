-- Income records use the same money, category and ownership conventions as expenses.
CREATE TABLE IF NOT EXISTS incomes
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount         NUMERIC(15, 2) NOT NULL,
    currency       VARCHAR(3)     NOT NULL DEFAULT 'USD',
    description    VARCHAR(500),
    income_date   DATE           NOT NULL,
    payment_method VARCHAR(30)    NOT NULL,
    -- ON DELETE SET NULL: deleting a category keeps historical incomes
    category_id    UUID           REFERENCES categories (id) ON DELETE SET NULL,
    user_id        UUID           NOT NULL,
    receipt_url    VARCHAR(500),
    tags           TEXT[]         NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT fk_incomes_user     FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_incomes_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT ck_incomes_amount_positive   CHECK (amount > 0),
    CONSTRAINT ck_incomes_currency_iso      CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_incomes_payment_method    CHECK (payment_method IN
        ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET', 'OTHER')),
    -- Guard against nonsense dates (e.g. year 0001 / 9999)
    CONSTRAINT ck_incomes_date_range CHECK (income_date BETWEEN DATE '1900-01-01' AND DATE '2999-12-31')
);


CREATE INDEX idx_incomes_user_date ON incomes (user_id, income_date DESC, id DESC);
CREATE INDEX idx_incomes_user_category ON incomes (user_id, category_id);

CREATE TRIGGER trg_incomes_updated_at
    BEFORE UPDATE ON incomes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();