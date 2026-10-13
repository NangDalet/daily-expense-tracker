# Personal cash top-ups

On **Expenses**, select **Add top-up** when you withdraw money from your bank.
Enter the withdrawn amount, currency, date and an optional note.

When adding an expense, select **Top-up balance** in **Payment method**. New expenses
select this automatically when you have recorded top-ups. Other payment methods
do not deduct cash. Existing expenses are excluded until you edit and select
the option.

Example: add a USD 100 withdrawal, then record USD 30 of cash expenses from the
balance. The remaining cash is USD 70. Top-ups do not count as income or expenses.
USD and KHR are tracked separately, without currency conversion.

**Show top-up history** lets you review, edit or delete withdrawals. Changes
that would leave a negative balance are rejected. Editing or deleting expenses
automatically adjusts the balance. Balances cover all recorded dates and are
independent of the expense list filters.

The backend applies Flyway migration `V16__personal_cash_topups.sql` on startup.
The authenticated API is `/api/v1/cash/balances` and `/api/v1/cash/topups`.
Expense payloads accept `useTopupBalance` (default false).
