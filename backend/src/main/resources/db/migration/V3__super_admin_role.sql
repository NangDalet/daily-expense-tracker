-- =============================================================================
-- V3__super_admin_role.sql
-- Introduces the SUPER_ADMIN tier above ADMIN and seeds the first account that
-- holds it.
--
-- Role ladder (see com.example.expensetracker.domain.Role, whose enum order IS
-- the privilege order):
--   USER (0) < ADMIN (1) < SUPER_ADMIN (2)
--
-- `roles` stays a comma separated VARCHAR, so the new tier needs no schema
-- change - only a value the code now recognises.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- root / Root@123  - the super administrator that can manage every account,
--                    including other administrators.
-- -----------------------------------------------------------------------------
INSERT INTO users (username, email, password, full_name, roles, enabled)
VALUES ('root', 'root@expense-tracker.local',
        crypt('Root@123', gen_salt('bf', 10)), 'Root Super Admin', 'SUPER_ADMIN,ADMIN,USER', TRUE)
ON CONFLICT (username) DO NOTHING;

-- -----------------------------------------------------------------------------
-- The same starter categories every other account gets, so the seeded account is
-- immediately usable.
-- -----------------------------------------------------------------------------
INSERT INTO categories (name, description, icon_name, color_hex, user_id)
SELECT s.name, s.description, s.icon_name, s.color_hex, u.id
FROM (SELECT id FROM users WHERE username = 'root') u
         CROSS JOIN (VALUES ('Groceries', 'Supermarket and farmers market runs', 'ShoppingCart', '#22c55e'),
                            ('Transport', 'Fuel, transit, rides and parking', 'Car', '#3b82f6'),
                            ('Dining', 'Restaurants, coffee and takeout', 'UtensilsCrossed', '#f59e0b'),
                            ('Housing', 'Rent, utilities and maintenance', 'Home', '#8b5cf6'),
                            ('Entertainment', 'Streaming, events and hobbies', 'Clapperboard', '#ec4899'),
                            ('Health', 'Pharmacy, gym and medical', 'HeartPulse', '#ef4444'),
                            ('Shopping', 'Clothing, electronics and home goods', 'ShoppingBag', '#14b8a6'),
                            ('Other', 'Everything that does not fit elsewhere', 'Ellipsis', '#64748b')
                     ) AS s(name, description, icon_name, color_hex)
ON CONFLICT (user_id, lower(name)) DO NOTHING;
