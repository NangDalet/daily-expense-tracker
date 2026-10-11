# Daily Expense Tracker

User guide · Updated October 10, 2026

Open the app: [daily-expense-tracker-topaz.vercel.app](https://daily-expense-tracker-topaz.vercel.app)

Track money coming in, record everyday spending, set monthly budgets, and receive personal Telegram notifications. This guide is for regular users.

## 1. Get started

1. Open the app and select **Create one** on the sign-in screen.
2. Enter a unique **Username** and **E-mail** address.
3. Choose a password with 8–72 characters and enter it again under **Confirm password**.
4. Add your **Full name** if you want it displayed in the app and your alerts.
5. Select **Create account**.

Usernames must have 3–50 characters and use letters, numbers, dots, underscores, or dashes. For later visits, sign in with your username or email address and password.

### Your first five minutes

1. Record an expense, choosing its correct currency.
2. Record income if you want to calculate your monthly balance.
3. Set a budget for the same month and currency as your expenses.
4. Connect your personal Telegram account.
5. Open **Monthly calculator** to review income, expenses, and balance.

## 2. Find your way around

Use the sidebar to move between pages. On a small screen, open the menu button to show the navigation.

| Page | What you can do |
| --- | --- |
| Dashboard | Review spending totals, trends, categories, and the current overall budget. |
| Expenses | Add, find, edit, delete, and export expenses. |
| Income | Record and manage money received. |
| Monthly calculator | Compare monthly income and expenses and try a spending plan. |
| Categories | Organize transactions with category names, icons, and colors. |
| Budgets | Set overall or category limits for a month and currency. |
| Telegram alerts | Connect or disconnect your private Telegram chat. |
| My profile | Change your details and profile photo. |

The **Users** page is available only to administrators. To sign out, use the sign-out button beside your account details in the sidebar.

## 3. Record and manage expenses

### Add an expense

1. Open **Expenses** and select **Add expense**. The header also provides an **Add expense** button.
2. Enter a positive **Amount**.
3. Choose **Currency**: USD for US dollars or KHR for Cambodian riel.
4. Select the **Date** of the payment and its **Payment method**.
5. Choose a **Category**, or leave it as **No category**.
6. Optionally add a **Description**, comma-separated **Tags**, and a **Receipt URL**.
7. Select **Add expense** in the form to save it.

For example, record a coffee purchase as amount **2.00**, currency **USD**, and description **Coffee**. A payment of 4,500 riel should be recorded as amount **4500**, currency **KHR**.

Descriptions can contain Khmer text. Tags help you recognize transactions, such as `shared, recurring`. A receipt URL links to an existing receipt; this field does not upload a receipt image.

### Find, edit, or delete an expense

- Use the search box to find expenses. Open **Filters** to narrow results by category, dates, amount, or payment method. Use **Clear** to remove active filters.
- Use the page controls to view more results.
- Select the pencil/edit action for an expense, change its fields, and select **Save changes**.
- Select the delete action and confirm to remove an expense permanently.

Check the date and currency before saving: both affect which monthly totals and budgets include the expense.

## 4. Record income

1. Open **Income** and select **Add income**.
2. Enter the positive **Amount** and choose its **Currency**.
3. Set the **Date** when you received the money and the **Payment method**.
4. Optionally choose a category and enter a description, tags, or receipt URL.
5. Select **Add income** in the form.

Examples include salary, freelance payments, and other money received. Use search and filters to find records. Use the edit action and **Save changes** to correct a record, or the delete action to remove it permanently.

Income contributes to your monthly balance. It does not reduce the spending counted against a budget.

## 5. Understand the dashboard and currencies

Choose **Currency** on the Dashboard to view USD or KHR spending. Choose **Daily**, **Weekly**, or **Monthly** to change the chart grouping and its date window. Read the date range shown below the welcome message.

- **Total spend** shows expenses in the displayed date window and selected currency.
- **Average expense** shows the average amount of those expenses.
- **By category** and **Spending trend** help you see where and when you spend.
- **Budget left** shows the current month's overall budget for the selected currency, when one is set. A negative remaining amount means you have exceeded the limit.

The dashboard uses a rolling date window. Use **Monthly calculator** for totals from the first to the last day of a calendar month. The dashboard spending window and the current monthly budget can cover different dates.

### USD and KHR stay separate

The app does not convert currencies or add USD and KHR together. If you record USD 2.00 and KHR 4,500, your totals are **USD 2.00** and **KHR 4,500**, rather than one combined dollar amount.

If an amount appears wrong, check the currency on the original transaction before changing the amount.

## 6. Set monthly budgets

1. Open **Budgets**. Use **Previous** or **Next** to choose a month.
2. Select **Set budget**.
3. Under **Category**, choose **Overall budget (no category)** for all spending, or select a category for a category-specific limit.
4. Choose **Currency** and enter a positive **Monthly limit**.
5. Check **Month** and **Year**, then select **Save budget**.

An overall budget includes expenses in the budget's month and currency, including expenses without a category. A category budget includes only expenses assigned to that category, in the same month and currency.

**Remaining = budget limit − spending.** For a USD 100 budget with USD 80 spent, USD 20 remains and usage is 80%. KHR spending does not count toward this USD budget.

You can set separate USD and KHR budgets. An expense can count toward both an overall budget and its category budget; these are separate limits, so do not add their spending totals together.

Use the pencil/edit action to change a budget and select **Save changes**. An existing budget's category cannot be changed; create another budget if you need a different category. Use the delete action to remove a limit.

Budgets are set for a specific month and year. Review or create the budget for each new month.

## 7. Receive private Telegram alerts

### Connect your own Telegram account

1. Sign in to your Expense Tracker account.
2. Open **Telegram alerts** and select **Connect Telegram**.
3. Select **Open Telegram and press Start**.
4. In Telegram, open the bot using the Telegram account that should receive your alerts, then press **Start**.
5. Return to the app and check for **Telegram connected. Budget alerts are enabled.**

The current bot is **@MSGPortfolioBot**. Use the connection link from the app to link the correct Expense Tracker account. Sending a plain message to the bot or entering a Telegram username at registration does not connect your account.

The personal link expires in 10 minutes. Keep it private. If it expires, select **Create a new connection link** and follow the new link.

### Which messages will you receive?

- **Expense Recorded:** one message for each newly saved expense covered by a matching budget. It includes your name, expense details, budget limit, total spent, remaining amount, and usage percentage.
- **Budget Alert: 80% reached:** an alert when spending reaches at least 80% of a budget. It is sent once per budget, month, and currency. It does not repeat for every later expense.
- Editing expenses or changing budgets can trigger the 80% alert, but editing an expense does not send a new **Expense Recorded** message.
- Expenses outside a matching budget do not send spending messages. Income entries do not generate these budget-spending alerts.

If an expense matches both an overall budget and a category budget, it sends one expense message with the matching budget details. Each budget can have its own threshold alert.

### Who can see your messages?

Alerts are sent to your connected private chat with the bot. Other users chatting with the same bot do not see your private messages. Each user connects their own account; a Telegram chat can be linked to one app account at a time.

The name in an alert comes from **My profile**: your full name, or your Expense Tracker username if your full name is empty. The bot's name is shared, but the recipient is your own linked chat.

Select **Disconnect Telegram** in the app to stop alerts for that connection.

## 8. Calculate your monthly balance

1. Open **Monthly calculator**.
2. Choose the **Month** and **Currency**.
3. Review **Monthly income**, **Monthly expenses**, and **Monthly balance**.

**Monthly balance = recorded income − recorded expenses.** For USD 500 income and USD 120 expenses, the balance is USD 380. A negative balance means expenses exceed income for that month.

Totals use transaction dates within the selected calendar month. USD and KHR are calculated separately. A month without transactions in the selected currency shows zero totals.

Under **Plan your month**, enter **Planned income** and **Planned expenses** to try different amounts. The **Planned balance** updates as you type. These fields do not create income or expense records; save actual transactions on the Income and Expenses pages.

## 9. Organize categories

Open **Categories** and select **New category**. Enter a name, optionally add a description, and choose an icon and color. Select **Create category**.

Use categories such as Food, Transport, Shopping, or Salary to organize transactions. Select the edit action and **Save changes** to update a category.

If the app refuses to delete a category because it is used, reassign the linked transactions before trying again.

## 10. Download expense reports

1. Open **Expenses**.
2. Search or apply filters for the records you want in the report.
3. Select **Export PDF** for a readable report or **Export Excel** for a spreadsheet.
4. Wait for the download to finish, then open the file from your browser's downloads.

The report includes all expenses matching the current filters across all result pages. It includes transaction details and separate currency totals. Khmer descriptions are supported.

Export is unavailable when there are no matching expenses. If an export fails, refresh the expense list and try again. The app stops the export when it cannot load a complete set of records.

## 11. Personalize your profile and theme

### Edit your details

1. Open **My profile**.
2. Update your **Full name**, **Username**, or **Email**.
3. Select **Save profile** and wait for the success message.

Your username and email must be unique. Use your updated username or email the next time you sign in. This page edits your own account details; it does not change your password or account role.

### Upload a profile photo

1. On **My profile**, select **Change photo**.
2. Choose a JPEG, PNG, or WebP photo up to 5 MB.
3. Adjust **Zoom**, **Horizontal position**, and **Vertical position** in **Crop your photo**.
4. Check the circular preview and select **Save photo**.

The saved photo appears on your profile and beside your account in the sidebar. Select **Remove photo** to restore your initials. Photo changes and personal-detail changes have separate save buttons.

### Switch light or dark mode

Select the sun/moon button in the header to switch themes. The app remembers your choice on that device. On a first visit, it follows the device's light/dark preference.

## 12. Common questions and problems

### I cannot reach the server

Check your internet connection, wait a moment, and try again. The hosted backend may take time to wake up or restart. If the error continues, contact the app administrator with the page name and error message.

### I did not receive a Telegram alert

Check that the app shows **Telegram connected**, that you pressed **Start**, and that you have not blocked the bot. Confirm that a budget matches the expense's month, currency, and category. Notifications may take a moment to arrive.

If you already received the 80% alert for that budget and month, it will not be repeated. To receive a new expense message, save a new expense covered by a budget; editing an existing expense does not send that message.

### Telegram says it is unavailable or not configured

Contact the administrator. The server needs the Telegram feature enabled and configured before you can connect. You do not need to provide a bot token yourself.

### My totals or remaining budget look wrong

Check the selected currency, the transaction dates, the budget month, and any active filters. Open **Monthly calculator** for calendar-month totals. Check for an expense saved in the wrong currency or entered twice.

### My profile will not save

Check for an error message, an invalid email address, or a username/email already used by another account. For photos, choose a supported format under 5 MB, let the preview load, and select **Save photo**.

### I forgot my password

Contact the administrator for help. There is no self-service password-reset screen in the current app.

When requesting help, include the page, the action you attempted, and the error text. Do not include your password or your personal Telegram connection link.

## 13. Construction worker payments

Super administrators assign **Construction Site Manager** from **Users ? New user ? Construction access**, or from **Construction payments ? Access** for an existing account. Managers manage construction records and assign **Construction Foreman** access with selected sites. Foremen can record and review worker attendance only at their assigned sites; financial records and worker ID cards stay restricted to managers.

For setup, payment-period rules and the full workflow, see [Construction worker payments](CONSTRUCTION_PAYMENTS.md).
