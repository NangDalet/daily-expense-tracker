ALTER TABLE construction_payrolls DROP CONSTRAINT construction_payrolls_period_check;
ALTER TABLE construction_payrolls ADD CONSTRAINT construction_payrolls_period_check
    CHECK (period IN ('CUSTOM', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'));
