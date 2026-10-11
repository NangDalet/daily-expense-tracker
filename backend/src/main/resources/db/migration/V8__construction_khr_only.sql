-- Currency restrictions apply only to construction; personal finance is unchanged.
-- Validate existing records rather than relabeling amounts or assuming an exchange rate.
ALTER TABLE construction_workers
    ADD CONSTRAINT construction_workers_khr_only CHECK (currency = 'KHR');
ALTER TABLE construction_payrolls
    ADD CONSTRAINT construction_payrolls_khr_only CHECK (currency = 'KHR');
