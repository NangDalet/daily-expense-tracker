# Construction worker payments (កម្មករសំណង់)

The construction module is a shared workspace, separate from personal expenses and income. All construction wages, advances, deductions, payments and reports use **KHR (Cambodian riel) only**. Open **Construction payments** in the sidebar, or `/construction`.

Workers are records in **Construction → Workers**, not login accounts in **Users**. Adding a worker never creates a user account. Only staff who operate the system need login accounts and module access. Removing an operator account with construction history disables its login and removes it from Users and module assignments, while retaining its identity in attendance, approval and payment audit history. Worker records and payment amounts remain intact.

## Access

Super administrators have access automatically. To create a site manager, open **Users ? New user** and select **Construction access ? Construction Site Manager**. The account can keep the ordinary USER role; construction permission is managed separately.

Site managers manage workers, projects, adjustments, payroll, payments and reports. In **Construction payments ? Access**, a manager selects an existing account, chooses its assigned sites, and selects **Assign** to give it **Construction Foreman** access. Use **Update access** to change sites or **Revoke** to remove access. Only super administrators can assign managers; managers cannot promote themselves or change another manager's assignment.

Foremen see only **Attendance**, the projects assigned to them, and workers currently assigned to those projects. They can record and review attendance, edit or remove unallocated records, and use the date/site/worker filters. They cannot access wages, payroll, payments, worker ID cards, or permission assignments. Attendance already included in payroll stays locked.

Server authorization checks the enabled account, construction role and site assignment on every request. Changes take effect for existing tokens. Disabled and archived accounts have no access. The audit history stores the actor, construction role, assigned sites and grant/revoke decision. Existing construction assignments become manager access when the role migration is applied.

## Setup and attendance

1. In **Projects**, create a project and construction site. Each project record has one site; multiple projects can share a site. Optionally enter both the project start and end dates and a nonnegative planned amount in KHR. Duration includes both dates. These values appear in the project list and can be edited or cleared; the project budget is visible to managers only.
2. In **Workers**, choose the assigned site and add a unique worker ID, full name, phone, position, start date, wage basis, rate, overtime rate, and regular hours per day. Currency is fixed to KHR.
3. In **Attendance**, select the worker, project/site and work date. Choose full day, half day, or hourly work, and enter overtime hours.
4. Use the top date, worker, and project/site filters to review attendance totals or payment history.

When adding or editing a worker, select **Worker photo / រូបថតកម្មករ** to upload a JPG, PNG or WebP image up to 5 MB. Preview the photo before saving. Saved photos appear beside the worker's name; **View / edit** lets you replace or remove them. Photos are optional, so existing workers remain valid. The browser resizes photos to at most 384 pixels, and the server validates and re-encodes them before saving them in the database. Photos share the construction module's access permissions and persist with its database volume.

Full days use the worker's regular daily hours; half days use half those hours. Hourly entries require regular hours. Regular hours cannot exceed the agreed workday; regular plus overtime hours cannot exceed 24. There is one attendance entry per worker per date. Work dates must be between the worker's start date and today in Bangkok time.

Daily wages are prorated by hours worked divided by regular daily hours. Hourly wages use rate × regular hours. Overtime uses the explicit overtime rate × overtime hours. Attendance stores its calculated wages, so later rate changes do not change existing attendance. Fixed wages use the worker's current fixed rate once for each project payroll period, plus recorded overtime.

**View / edit** allows worker details to be reviewed and updated, including deactivation. Currency is always KHR. Wage basis cannot change after attendance exists. Create a separate worker account when the wage basis changes. Deactivated workers and projects retain their history.

## Advances, deductions, bonuses and allowances

In **Adjustments**, record an amount in KHR, date and reason. Record an advance when the money has actually been given to the worker. A reviewer must approve or reject the entry and provide a review reason before it can affect payroll. Each decision is final; its actor, timestamp and reason remain visible.

All approved, unallocated adjustments dated on or before the payroll end date are applied to the next payroll for that worker, including advances from earlier periods or other projects. Entries are allocated once. The screen shows all adjustment dates for the selected worker and outstanding approved advances in KHR. Advances allocated to an unpaid payroll are shown as allocated, and can be found in that payroll's breakdown.

## Payroll and payments

1. In **Payroll**, choose **Prepare payroll** and select the worker, project/site, period and dates.
   With **Worked days**, the dates automatically cover all unpaid attendance at the selected site, including earlier months. You can narrow the dates manually or choose **Use all unpaid worked days** to restore the complete range. Attendance already included in payroll is excluded.
2. Select **Calculate / refresh preview** to review workdays, regular/overtime hours and every wage adjustment.
3. Select **Create payroll**. The server recalculates using the latest records and prevents overlapping payrolls for the same worker and project. Attendance and included adjustments are locked to that payroll.
   The list automatically switches to the new payroll's dates, worker and site so you can pay it immediately. Attendance already assigned to payroll must be paid through its existing payroll, rather than creating another payroll for the same days.
4. Select **Pay** and record the amount, actual date and cash, bank transfer or QR method. Partial payments keep a remaining balance.
5. Open **Details** for the wage breakdown and transaction history. **Receipt** downloads a printable PDF with payment references, amounts, dates, methods, processor and signature lines.

The default **Worked days (any date range)** period lets you pay multiple worked days together without requiring a full week or month. Select the first and last dates to include: only recorded, unallocated attendance for that worker and project contributes wages. For example, full days on January 1 and 10 plus a half day on January 4 pay 2.5 days, even though the selected range spans 10 calendar days. Days without attendance add no daily/hourly wages. Fixed wages still apply once per payroll. Existing payroll periods cannot overlap; use a new unpaid date range for the next payment.

Daily (1 day), weekly (7 days), biweekly (14 days), and monthly (one calendar month from the selected date) remain available. Record attendance before creating payroll. Approved advances and deductions cannot make net pay negative; if they exceed wages, choose a longer period or record an approved allowance as appropriate. Amounts use decimal arithmetic rounded to two decimal places.

**Net pay = Base wages + Overtime + Bonuses + Allowances − Advances − Deductions.**

Payment states are Pending, Partially Paid, Paid and Cancelled. A zero-net payroll is Paid without a cash transaction. Payments cannot exceed the balance. The server serializes changes per worker and locks payroll during payments. Every transaction has a unique reference and request key; retries of the same submitted payment return the original transaction. Keep the payment form open to retry a failed request. Different details cannot reuse an existing key.

Only a payroll with no payments can be cancelled. Provide a cancellation reason; attendance and adjustments are released for a replacement payroll. Payrolls with payment transactions remain immutable. Worker/project records and payment processors referenced in financial history cannot be deleted from the database; deactivate accounts instead.

## Dashboard and reports

The dashboard shows total/active workers, net wages, paid and unpaid amounts. All construction totals are shown in KHR. Worker filtering provides payment history; project/site and date filtering provide project reports. Date filters select payroll periods that overlap the range; paid amounts are cumulative against those payrolls, rather than cash transactions paid inside that date range. Cancelled payrolls remain visible but are excluded from totals.

Select **Excel** or **PDF** on Payroll or Reports to export fresh data with the current filters. Excel includes all wage components and a KHR summary. PDFs and receipts support Khmer names through the existing Noto Sans Khmer fonts.

## English and Khmer

Use **Language / ភាសា** beside the construction page heading to switch between **English** and **ភាសាខ្មែរ**. The browser remembers your selection. Construction tabs, forms, statuses, help text, reports and receipts use the selected language; worker and project names keep the entered text. This switch applies to the construction module.

ជ្រើសរើស **ភាសាខ្មែរ** ដើម្បីប្រើម៉ូឌុលជាភាសាខ្មែរ។ ក្នុង **បញ្ជីប្រាក់ឈ្នួល → រៀបចំបញ្ជីប្រាក់ឈ្នួល** ជ្រើសរើស **ថ្ងៃបានធ្វើការ (ជ្រើសរើសរយៈពេលណាមួយ)** និងថ្ងៃចាប់ផ្តើម/បញ្ចប់ ដើម្បីទូទាត់ថ្ងៃធ្វើការច្រើនរួមគ្នា។ គិតប្រាក់តែវត្តមានដែលបានកត់ត្រាប៉ុណ្ណោះ។

## Development and rollout

The module uses the existing Spring Boot, MyBatis XML mappers, PostgreSQL, React, and authenticated API client. Its routes live under `/api/v1/construction`. Flyway migration `V7__construction_payments.sql` creates the tables, `V8__construction_khr_only.sql` enforces KHR, and `V9__construction_custom_period.sql` adds flexible worked-day periods. V8 rejects existing non-KHR records; amounts are never automatically relabeled or converted. Existing migration files are preserved.

Before production rollout, test the migration against an isolated PostgreSQL database/Neon branch, then deploy the backend and frontend together. Use a direct connection for schema migrations. Existing personal finance APIs continue to use their existing permissions.

Validation commands:

```sh
cd backend
mvn test
mvn -Dit.test=ConstructionApiIT verify
cd ../frontend
npm run build
npx playwright test construction.spec.ts
```

The integration test uses PostgreSQL Testcontainers and requires a reachable Docker daemon. Browser tests stub the API to validate access screens, payroll previews, idempotent retry payloads, Excel exports, Khmer PDF text, and printable receipts. Backend unit tests validate decimal calculations, adjustment eligibility, period overlap, payment balance limits, idempotency, cancellation and current database permissions.

### Run the isolated Docker stack

From the repository root:

```sh
docker compose -p expense-tracker-construction-test -f docker-compose.yml -f docker-compose.test.yml up -d --build postgres backend frontend
```

Open `http://localhost:3000/construction`. The development seed super administrator is `root` with password `Root@123`. This stack uses its own KHR test database volume and disables Telegram. The previous USD test database volume is retained. Its ports are 3000 (frontend), 8080 (backend), and 5432 (PostgreSQL).

After a frontend rebuild, refresh any previously open tab if PDF export reports a missing dynamically imported module. Docker serves HTML with `Cache-Control: no-store` and caches versioned assets. Removed assets return HTTP 404. The frontend automatically reloads on a failed lazy import once per minute to load the current build; repeated failures remain visible. A reload resets unsaved form input, so retry the export after the page loads.

Run the real HTTP/browser test against this stack from PowerShell in `frontend`:

```powershell
$env:EXPORT_TEST_BASE_URL = 'http://127.0.0.1:3000'
$env:CONSTRUCTION_LIVE_TESTS = '1'
npx playwright test construction-live.spec.ts construction.spec.ts
```

The live test creates clearly marked test records in the isolated database and checks concurrent payment balance enforcement, identical-request retries, paid receipts, cancellation/replacement payrolls and immediate access revocation. It is skipped unless explicitly enabled. The isolated stack allows browser requests from both `localhost:3000` and `127.0.0.1:3000`.

To verify the existing three sample workers in the Khmer payroll form without creating users or payments, run from `frontend`:

```powershell
$env:EXPORT_TEST_BASE_URL = 'http://127.0.0.1:3000'
$env:CONSTRUCTION_SAMPLE_TESTS = '1'
npx playwright test construction-samples.spec.ts
```

The sample test checks 7, 14 and 28 worked days ending September 30, 2026, with net wages of 280,000, 560,000 and 1,120,000 KHR. It requires the sample attendance already present in the local test database.

Stop the stack without removing its test data using:

```sh
docker compose -p expense-tracker-construction-test -f docker-compose.yml -f docker-compose.test.yml down
```
