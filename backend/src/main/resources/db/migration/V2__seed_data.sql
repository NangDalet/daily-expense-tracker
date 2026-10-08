-- =============================================================================
-- V2__seed_data.sql
-- Demo data so the app is usable immediately after `docker compose up`.
--
-- Password hashes are produced by pgcrypto's bcrypt implementation, which is
-- fully compatible with Spring Security's BCryptPasswordEncoder
-- (`$2a$` prefix). Using crypt() keeps plaintext out of the migration log.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users: admin / Admin@123   and  demo / Demo@123
-- -----------------------------------------------------------------------------
INSERT INTO users (username, email, password, full_name, roles, enabled)
VALUES ('admin', 'admin@expense-tracker.local',
        crypt('Admin@123', gen_salt('bf', 10)), 'Alex Admin', 'ADMIN,USER', TRUE),
       ('demo', 'demo@expense-tracker.local',
        crypt('Demo@123', gen_salt('bf', 10)), 'Dana Demo', 'USER', TRUE)
ON CONFLICT (username) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Default categories for both demo users
-- -----------------------------------------------------------------------------
WITH demo_users AS (SELECT id, username FROM users WHERE username IN ('admin', 'demo')),
     seed(name, description, icon_name, color_hex, ordinal) AS (VALUES
         ('Groceries', 'Supermarket and farmers market runs', 'ShoppingCart', '#22c55e', 1),
         ('Transport', 'Fuel, transit, rides and parking', 'Car', '#3b82f6', 2),
         ('Dining', 'Restaurants, coffee and takeout', 'UtensilsCrossed', '#f59e0b', 3),
         ('Housing', 'Rent, utilities and maintenance', 'Home', '#8b5cf6', 4),
         ('Entertainment', 'Streaming, events and hobbies', 'Clapperboard', '#ec4899', 5),
         ('Health', 'Pharmacy, gym and medical', 'HeartPulse', '#ef4444', 6),
         ('Shopping', 'Clothing, electronics and home goods', 'ShoppingBag', '#14b8a6', 7),
         ('Other', 'Everything that does not fit elsewhere', 'Ellipsis', '#64748b', 8)
         )
INSERT INTO categories (name, description, icon_name, color_hex, user_id)
SELECT s.name, s.description, s.icon_name, s.color_hex, u.id
FROM seed s
         CROSS JOIN demo_users u
ON CONFLICT (user_id, lower(name)) DO NOTHING;

-- -----------------------------------------------------------------------------
-- ~45 expenses per demo user spread over the last 90 days so that the
-- dashboard trends, the monthly aggregation and the budget bars all have data.
-- Amounts are derived from a deterministic formula (no random()) to keep the
-- seed reproducible across environments.
-- -----------------------------------------------------------------------------
INSERT INTO expenses (amount, currency, description, expense_date, payment_method, category_id, user_id, tags, receipt_url)
SELECT round((12 + ((s.n * 37) % 240)::numeric / 4.0)::numeric, 2) AS amount,
       'USD',
       (ARRAY[
           'Weekly groceries run',
           'Metro card top-up',
           'Team lunch',
           'Electricity bill',
           'Streaming subscription',
           'Pharmacy pickup',
           'Running shoes',
           'Parking garage'
       ])[(s.n % 8) + 1],
       (CURRENT_DATE - ((s.n * 2) % 90))::date,
       (ARRAY['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'E_WALLET'])[(s.n % 5) + 1],
       c.id,
       u.id,
       -- exercises the text[] round-trip through the StringArrayTypeHandler
       (ARRAY['seed', (ARRAY['recurring', 'one-off', 'shared'])[(s.n % 3) + 1]]),
       CASE WHEN s.n % 7 = 0
            THEN 'https://receipts.example.com/' || u.username || '/' || s.n || '.pdf'
            ELSE NULL
            END
FROM generate_series(0, 44) AS s(n)
         CROSS JOIN (SELECT id, username FROM users WHERE username IN ('admin', 'demo')) u
         JOIN categories c
              ON c.user_id = u.id
                  AND c.name = (ARRAY['Groceries', 'Transport', 'Dining', 'Housing', 'Entertainment', 'Health', 'Shopping', 'Other'])[(s.n % 8) + 1];

-- -----------------------------------------------------------------------------
-- Budgets for the current month (per category + one overall budget)
-- -----------------------------------------------------------------------------
INSERT INTO budgets (user_id, category_id, monthly_limit, month, year)
SELECT u.id,
       c.id,
       400.00,
       EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT,
       EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT
FROM (SELECT id FROM users WHERE username IN ('admin', 'demo')) u
         JOIN categories c ON c.user_id = u.id
WHERE c.name IN ('Groceries', 'Dining', 'Transport')
ON CONFLICT (user_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid), month, year) DO NOTHING;

-- Overall (category-less) budget
INSERT INTO budgets (user_id, category_id, monthly_limit, month, year)
SELECT id,
       NULL,
       2500.00,
       EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT,
       EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT
FROM users
WHERE username IN ('admin', 'demo')
ON CONFLICT (user_id, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid), month, year) DO NOTHING;
