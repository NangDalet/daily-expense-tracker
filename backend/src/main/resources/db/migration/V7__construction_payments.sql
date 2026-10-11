-- Shared construction workspace, available only by super-admin assignment.
CREATE TABLE construction_access (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 granted_by UUID NOT NULL REFERENCES users(id), granted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE construction_access_history (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 actor_id UUID NOT NULL REFERENCES users(id), granted BOOLEAN NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE construction_projects (
 id UUID PRIMARY KEY, name VARCHAR(120) NOT NULL, site VARCHAR(160) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(name, site)
);
CREATE TABLE construction_workers (
 id UUID PRIMARY KEY, worker_code VARCHAR(40) NOT NULL UNIQUE, full_name VARCHAR(120) NOT NULL,
 phone VARCHAR(40), position VARCHAR(80) NOT NULL, rate_type VARCHAR(10) NOT NULL CHECK(rate_type IN ('DAILY','HOURLY','FIXED')),
 rate NUMERIC(16,2) NOT NULL CHECK(rate > 0), overtime_rate NUMERIC(16,2) NOT NULL CHECK(overtime_rate >= 0),
 hours_per_day NUMERIC(5,2) NOT NULL CHECK(hours_per_day > 0 AND hours_per_day <= 24),
 currency VARCHAR(3) NOT NULL CHECK(currency IN ('USD','KHR')), start_date DATE NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE construction_payrolls (
 id UUID PRIMARY KEY, reference VARCHAR(50) NOT NULL UNIQUE, worker_id UUID NOT NULL REFERENCES construction_workers(id),
 project_id UUID NOT NULL REFERENCES construction_projects(id), from_date DATE NOT NULL, to_date DATE NOT NULL CHECK(to_date >= from_date),
 period VARCHAR(10) NOT NULL CHECK(period IN ('DAILY','WEEKLY','BIWEEKLY','MONTHLY')),
 currency VARCHAR(3) NOT NULL, worker_name VARCHAR(120) NOT NULL, worker_code VARCHAR(40) NOT NULL,
 rate_type VARCHAR(10) NOT NULL, rate NUMERIC(16,2) NOT NULL,
 workdays NUMERIC(12,4) NOT NULL, hours NUMERIC(13,3) NOT NULL, overtime_hours NUMERIC(12,2) NOT NULL,
 base_wages NUMERIC(16,2) NOT NULL, overtime NUMERIC(16,2) NOT NULL,
 bonuses NUMERIC(16,2) NOT NULL, allowances NUMERIC(16,2) NOT NULL, advances NUMERIC(16,2) NOT NULL, deductions NUMERIC(16,2) NOT NULL,
 net_pay NUMERIC(16,2) NOT NULL CHECK(net_pay >= 0), paid_amount NUMERIC(16,2) NOT NULL DEFAULT 0 CHECK(paid_amount >= 0 AND paid_amount <= net_pay),
 status VARCHAR(20) NOT NULL CHECK(status IN ('PENDING','PARTIALLY_PAID','PAID','CANCELLED')),
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 cancelled_by UUID REFERENCES users(id), cancelled_at TIMESTAMPTZ, cancellation_reason VARCHAR(255)
);
CREATE INDEX construction_payroll_period ON construction_payrolls(worker_id, project_id, from_date, to_date);
CREATE TABLE construction_attendance (
 id UUID PRIMARY KEY, worker_id UUID NOT NULL REFERENCES construction_workers(id), project_id UUID NOT NULL REFERENCES construction_projects(id),
 work_date DATE NOT NULL, kind VARCHAR(10) NOT NULL CHECK(kind IN ('FULL','HALF','HOURLY')),
 workdays NUMERIC(8,4) NOT NULL CHECK(workdays > 0 AND workdays <= 1),
 hours NUMERIC(6,3) NOT NULL CHECK(hours > 0 AND hours <= 24), overtime_hours NUMERIC(5,2) NOT NULL CHECK(overtime_hours >= 0 AND hours + overtime_hours <= 24),
 base_wages NUMERIC(16,2) NOT NULL, overtime NUMERIC(16,2) NOT NULL,
 payroll_id UUID REFERENCES construction_payrolls(id), recorded_by UUID NOT NULL REFERENCES users(id),
 UNIQUE(worker_id, work_date)
);
CREATE INDEX construction_attendance_period ON construction_attendance(project_id, work_date);
CREATE TABLE construction_adjustments (
 id UUID PRIMARY KEY, worker_id UUID NOT NULL REFERENCES construction_workers(id),
 kind VARCHAR(10) NOT NULL CHECK(kind IN ('ADVANCE','DEDUCTION','BONUS','ALLOWANCE')),
 amount NUMERIC(16,2) NOT NULL CHECK(amount > 0), adjustment_date DATE NOT NULL, reason VARCHAR(255) NOT NULL,
 status VARCHAR(10) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')),
 created_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 approved_by UUID REFERENCES users(id), approved_at TIMESTAMPTZ, approval_reason VARCHAR(255),
 payroll_id UUID REFERENCES construction_payrolls(id)
);
CREATE INDEX construction_adjustments_outstanding ON construction_adjustments(worker_id, adjustment_date) WHERE payroll_id IS NULL;
CREATE TABLE construction_payments (
 id UUID PRIMARY KEY, payroll_id UUID NOT NULL REFERENCES construction_payrolls(id),
 reference VARCHAR(50) NOT NULL UNIQUE, request_key UUID NOT NULL UNIQUE,
 payment_date DATE NOT NULL, amount NUMERIC(16,2) NOT NULL CHECK(amount > 0),
 method VARCHAR(15) NOT NULL CHECK(method IN ('CASH','BANK_TRANSFER','QR')),
 processed_by UUID NOT NULL REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX construction_payments_payroll ON construction_payments(payroll_id, created_at);
