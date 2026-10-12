# USD and KHR

Enter each income or expense in the currency you actually received or paid. The original amount and currency remain on the transaction, including when you edit it or export expenses.

The fixed rate is **1 USD = 4,000 KHR**. The entry forms preview the equivalent in the other currency. Changing the form's currency changes the meaning of the entered number; it does not automatically change that number.

Dashboard spending and monthly income, expenses, and balance include both currencies. Use the currency selector to display the same combined total in USD or KHR. The dashboard defaults to the current calendar month; its month selector changes totals, charts, category shares, and budget usage together. Chart grouping does not change the selected date range. Income also shows a combined USD total alongside the original totals per currency, with the existing password protection.

Example: income of $100 and 40,000 KHR is $110. Expenses of $5 and 20,000 KHR are $10. The balance is $100, or 400,000 KHR.

Both currencies count toward overall and category budgets. Usage is converted into the budget's currency before comparing with its limit. Telegram uses this same usage for its existing 80% alerts. If you have both USD and KHR budgets for the same category and month, both apply to the same spending.

Conversion is calculated before rounding totals to two decimal places. Small KHR transactions are summed before display rounding, so one hundred 20 KHR transactions total $0.50.

The expense summary and category statistics API now return combined USD equivalents and identify their currency as USD. Income and monthly report APIs retain their original per-currency breakdown; the frontend converts those totals. No database migration is required. Deploy the backend and frontend together to keep budget alerts and displays consistent.

The backend rate is in `MoneyUtils.KHR_PER_USD`; the frontend rate is in `src/lib/currency.ts`. Update both together if changing the fixed rate. Construction wages retain their existing KHR behavior.
