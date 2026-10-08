-- =============================================================================
-- V1__init_schema.sql
-- Daily Expense Tracker - core schema (PostgreSQL 16)
-- =============================================================================

-- gen_random_uuid() / crypt() live in pgcrypto. On PG13+ gen_random_uuid() is
-- built-in but pgcrypto is still required for crypt()/gen_salt('bf') used by
-- the seed migration, and the extension is created idempotently.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- users
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users
(
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username   VARCHAR(50)  NOT NULL,
    email      VARCHAR(255) NOT NULL,
    -- BCrypt hash, never a plain-text password
    password   VARCHAR(100) NOT NULL,
    full_name  VARCHAR(120),
    -- Comma separated authorities, e.g. 'USER,ADMIN' (mapped to List<String>)
    roles      VARCHAR(255) NOT NULL DEFAULT 'USER',
    enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_username      UNIQUE (username),
    CONSTRAINT uq_users_email         UNIQUE (email),
    CONSTRAINT ck_users_username_fmt CHECK (username ~ '^[A-Za-z0-9._-]{3,50}$')
);

COMMENT ON TABLE users IS 'Application users; roles is a comma separated list of authorities';

-- -----------------------------------------------------------------------------
-- categories (per user)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories
(
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(255),
    icon_name   VARCHAR(50)  NOT NULL DEFAULT 'Tag',
    color_hex   VARCHAR(9)   NOT NULL DEFAULT '#6366f1',
    user_id     UUID         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT fk_categories_user      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT ck_categories_color_hex CHECK (color_hex ~ '^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$')
);

-- Case-insensitive uniqueness per user so "Food" and "food" cannot coexist.
-- A table level UNIQUE constraint cannot contain an expression, so the rule has
-- to be a unique *index*; it is created after the table and is therefore named
-- uq_categories_user_name to keep the mappers' ON CONFLICT target readable.
CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name ON categories (user_id, lower(name));

-- -----------------------------------------------------------------------------
-- expenses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount         NUMERIC(15, 2) NOT NULL,
    currency       VARCHAR(3)     NOT NULL DEFAULT 'USD',
    description    VARCHAR(500),
    expense_date   DATE           NOT NULL,
    payment_method VARCHAR(30)    NOT NULL,
    -- ON DELETE SET NULL: deleting a category keeps historical expenses
    category_id    UUID           REFERENCES categories (id) ON DELETE SET NULL,
    user_id        UUID           NOT NULL,
    receipt_url    VARCHAR(500),
    tags           TEXT[]         NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT fk_expenses_user     FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_expenses_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
    CONSTRAINT ck_expenses_amount_positive   CHECK (amount > 0),
    CONSTRAINT ck_expenses_currency_iso      CHECK (currency ~ '^[A-Z]{3}$'),
    CONSTRAINT ck_expenses_payment_method    CHECK (payment_method IN
        ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET', 'OTHER')),
    -- Guard against nonsense dates (e.g. year 0001 / 9999)
    CONSTRAINT ck_expenses_date_range CHECK (expense_date BETWEEN DATE '1900-01-01' AND DATE '2999-12-31')
);

-- -----------------------------------------------------------------------------
-- budgets (per user, per category, per month). category_id NULL == overall budget
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budgets
(
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID           NOT NULL,
    category_id    UUID           REFERENCES categories (id) ON DELETE CASCADE,
    monthly_limit  NUMERIC(15, 2) NOT NULL,
    month          SMALLINT       NOT NULL,
    year           SMALLINT       NOT NULL,
    created_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
    CONSTRAINT fk_budgets_user     FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
    CONSTRAINT ck_budgets_limit_positive CHECK (monthly_limit > 0),
    CONSTRAINT ck_budgets_month_range     CHECK (month BETWEEN 1 AND 12),
    CONSTRAINT ck_budgets_year_range      CHECK (year BETWEEN 2000 AND 2100)
);

-- One budget per user, per category, per month - and at most one "overall"
-- budget (category_id IS NULL) per month. COALESCE turns the NULL category into
-- a concrete value so ordinary unique indexes are enough. As with the category
-- name rule this has to be a unique index, not a table constraint, because the
-- column list contains an expression.
CREATE UNIQUE INDEX IF NOT EXISTS uq_budgets_user_category_period
    ON budgets (user_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid), month, year);

-- =============================================================================
-- Indexes - aligned with the dynamic filter combinations used in ExpenseMapper
-- =============================================================================
-- Single column indexes for standalone predicates
CREATE INDEX IF NOT EXISTS idx_users_email_lower  ON users (lower(email));
CREATE INDEX IF NOT EXISTS idx_categories_user    ON categories (user_id);

-- The dominant access path: "all expenses of a user within a date window"
CREATE INDEX IF NOT EXISTS idx_expenses_user_id        ON expenses (user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date   ON expenses (expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id    ON expenses (category_id);

-- Composite index that serves the paged list query (user_id, expense_date DESC, id)
CREATE INDEX IF NOT EXISTS idx_expenses_user_date     ON expenses (user_id, expense_date DESC, id DESC);

-- Supports the "spend per category for a period" aggregation without a seq scan
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses (user_id, category_id);

-- Partial index for free-text search fallback (ILIKE '%term%')
CREATE INDEX IF NOT EXISTS idx_expenses_description_lower ON expenses (lower(description));
-- GIN index makes the `tags && ARRAY[...]` / `@>` containment filters index-accelerated
CREATE INDEX IF NOT EXISTS idx_expenses_tags           ON expenses USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_budgets_user        ON budgets (user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON budgets (user_id, year, month);

-- =============================================================================
-- updated_at maintenance
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS
$$
    BEGIN
        NEW.updated_at = now();
        RETURN NEW;
    END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_expenses_updated_at ON expenses;
CREATE TRIGGER trg_expenses_updated_at
    BEFORE UPDATE ON expenses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_budgets_updated_at ON budgets;
CREATE TRIGGER trg_budgets_updated_at
    BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
