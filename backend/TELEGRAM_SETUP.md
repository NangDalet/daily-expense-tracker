# Telegram budget alerts

The feature is implemented but disabled by default. No bot credentials are committed to Git.

## Administrator setup

1. Create a bot with [BotFather](https://t.me/BotFather), and keep its token in your deployment's secret environment variables.
2. Configure these backend environment variables:

   - `TELEGRAM_ENABLED=true`
   - `TELEGRAM_BOT_TOKEN`: the bot token
   - `TELEGRAM_BOT_USERNAME`: bot username without `@`
   - `TELEGRAM_WEBHOOK_SECRET`: a random secret of 16-256 letters, digits, underscores or hyphens

3. Deploy/restart the backend. Flyway applies `V5__budget_currency_and_telegram.sql`. Test this migration in an isolated environment before production deployment.
4. Register a Telegram webhook with `setWebhook`. Set `url` to `https://YOUR_BACKEND/api/v1/telegram/webhook`, `secret_token` to the same `TELEGRAM_WEBHOOK_SECRET`, and `allowed_updates` to `["message"]`.

The webhook must be reachable by Telegram over HTTPS. The bot token stays on the backend; never add it to a `VITE_` variable or the frontend. See the [official webhook API](https://core.telegram.org/bots/api#setwebhook).

## Local development settings

The `dev` profile automatically loads `backend/.env.telegram` when the backend is launched from the repository root or the `backend` directory. This private file is ignored by Git. It uses the environment variable names above, one `KEY=value` per line. Restart the backend after changing it. Other profiles should use deployment environment variables.

A supplied chat ID is only a test reference (`TELEGRAM_TEST_CHAT_ID`); it does not connect an app account or redirect all users' alerts. Connect your account through **Telegram alerts** and press **Start**. With `TELEGRAM_UPDATES_MODE=polling`, the backend retrieves connection messages directly from Telegram; a public URL is not required. Run only one backend instance per bot in polling mode and ensure no webhook is registered. Restarting may replay old updates; consumed connection links cannot be reused. The default `webhook` mode is intended for public deployments.

If a bot token has been shared in chat or source code, regenerate it with BotFather and replace `TELEGRAM_BOT_TOKEN` in the private file.

## User setup

Open **Telegram alerts** in the app, select **Connect Telegram**, then follow the link and press **Start** in the bot's private chat. Connection links expire after 10 minutes and can be used only once. Each Telegram chat belongs to one app account. Disconnecting cancels pending deliveries.

## Notification behavior

- One message for each newly saved expense covered by an overall or category budget with the same currency and expense month. If both budgets cover an expense, it still sends one spending message.
- A separate alert when spending reaches **at least 80%**, once per budget, month and currency. Further spending does not repeat that alert.
- Expense edits and budget changes also check the threshold, without sending a new expense message.
- USD and KHR are never added together or converted. Existing budgets migrate to USD; edit a budget's currency if needed.
- Messages are saved in the same transaction as the expense. The worker delivers only committed messages, with retry backoff and up to 10 failed attempts. The worker checks that the original chat is still connected.
- Delivery is at least once: a server crash after Telegram accepts a message but before its delivery status is saved may cause a duplicate on retry. The 80% event is deduplicated in the database.
- Failed deliveries are retained with `status='failed'` in `telegram_notifications`. No Telegram request URLs or exception bodies are logged because they can contain the bot token.

Live sending requires bot credentials and either polling mode or a registered webhook. Automated checks use disposable PostgreSQL data and mocked Telegram delivery; they never send real Telegram messages.

### Budget message example

New expense messages include the expense amount, date, description, and usage of each matching budget. The separate 80% alert uses this layout:

```text
📊 Daily Expense Tracker

⚠️ Budget Alert: 80% reached

🎯 Budget: Overall budget
📅 Period: 2026-10
💰 Budget limit: USD 100.00
📈 Total spent: USD 90.48
💵 Remaining: USD 9.52
📊 Used: 90.48%

🔔 Review your spending to stay within your budget.
```

When spending exceeds the limit, `Over budget` replaces `Remaining` and shows the positive excess amount. Each total uses the budget's own currency. Deploy the updated backend to apply these messages; already queued messages retain their original text.

## Configuration prepared for this project

Local development uses the private `backend/.env.telegram` file with polling enabled. Restart your IDE backend, or run `docker compose up -d --build backend` from the repository root. Docker Compose also loads the private file; Docker builds exclude it. Open **Telegram alerts**, select **Connect Telegram**, then press **Start** in **@MSGPortfolioBot**.

The Render blueprint declares Telegram environment variables in webhook mode. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET` in the Render dashboard (use the same secret when registering the webhook). A deployed HTTPS backend URL is required to register that webhook. Local configuration is not automatically copied to Render.

A private production environment file has been prepared at `backend/.env.render.telegram`. It contains the existing bot credentials with `TELEGRAM_ENABLED=true` and `TELEGRAM_UPDATES_MODE=webhook`, and is ignored by Git. In Render, open the `daily-expense-tracker-api` service, select **Environment → Add from .env**, and import this file. Choose **Save only** until the updated backend source is ready to deploy. Importing variables does not deploy local source code or register the Telegram webhook. Do not share this file or commit it.

## Production release

The production frontend is hosted at `https://daily-expense-tracker-topaz.vercel.app`. Its backend is `https://daily-expense-tracker-api-mrl6.onrender.com`. The updated frontend was deployed to production on October 10, 2026 with deployment ID `dpl_Gx6vSkLSz7ocMMTom7z2TA5fjD42`. The backend release artifact was built successfully, but deploying it to Render is still pending because Render is not connected.

Deploy the backend source and Flyway migrations to the existing Render service, set its Telegram secret environment variables, and verify `/actuator/health`. In webhook mode, register `https://daily-expense-tracker-api-mrl6.onrender.com/api/v1/telegram/webhook` with the same `TELEGRAM_WEBHOOK_SECRET` configured on Render. Ensure local polling is stopped when production uses the same bot. Do not register the webhook before the updated backend and its Telegram settings are active.

A staged frontend release is available at `https://daily-expense-tracker-f3m2cwz48-dt5.vercel.app` (Vercel authentication may be required). The same frontend changes are now in production: the USD/KHR dashboard currency selector, corrected budget usage, embedded Khmer PDF fonts, the null-anchor crash fix for Khmer export text, bundled Khmer display fonts, and the Telegram connection page. API requests use `/api/v1` on the frontend domain; a Vercel function forwards them to Render without a browser Origin header, so preview domains do not need to be added to Render's CORS allow list. Keep `VITE_API_BASE_URL=/api/v1` for Vercel builds. The production deployment command was:

```powershell
vercel --scope team_AIiMUVslypqVUEcssscK2z8v deploy --prod --yes --build-env VITE_API_BASE_URL=/api/v1
```

Verify personal Telegram connection and budget alert delivery after promotion. Existing budgets migrate to USD; review their currency where needed.

### Hosted checks on October 10, 2026

- Before this release, the production frontend served an older build without the Telegram route, and its Khmer font URL returned HTML. After the production deployment, `/login` returned HTTP 200, the Khmer font returned HTTP 200 with `font/ttf`, and the served JavaScript included the Telegram page.
- The new preview is ready and serves `NotoSansKhmer-Regular.ttf` as `font/ttf`.
- The bot configured locally has no registered webhook and two pending updates. Register the production webhook only after confirming that Render has the matching bot credentials, webhook secret, and updated backend. Do not run local polling with the same bot while production uses webhooks.
- Validation: all nine export/Telegram browser tests, all 174 backend unit tests, and the frontend production build passed. Live Telegram connection and delivery still require the Render configuration and deployment; mock tests do not verify live delivery.
- The initial preview used a direct Render API URL and received HTTP 403 for its CORS preflight, while the production domain received HTTP 200. The corrected preview uses the same-origin API proxy; all five proxy tests passed, and a live unauthenticated expense request reached Render and returned the expected JSON HTTP 401 response.
- The dashboard now aggregates currency-bearing expense rows across every page in its date window. It keeps USD and KHR totals, averages, category shares, chart amounts, and budget remaining separate. It defaults to KHR when the window contains only KHR expenses and hides totals if a later page fails. Three currency regression tests passed. This fixes the hosted dashboard without depending on the legacy summary endpoint, which sums currencies together.
- Dashboard and Budgets now calculate budget usage from all expenses in the budget month, matching currency and category. Legacy budgets without a currency are treated as USD. A USD 250 budget with USD 88.48 spent shows USD 161.52 remaining and 35.4% used, excluding KHR expenses.
- The hosted backend OpenAPI schema has no Telegram endpoints and no budget currency field. The Telegram page explains the missing server update. The proxy refuses KHR budget writes on this legacy backend to prevent KHR amounts from being saved as USD; writes become available after the backend schema supports currency.
- Latest frontend validation: 13 browser tests, three budget calculation tests, seven proxy tests, TypeScript checking, and the production build passed. Render deployment remains required for Telegram connection and KHR budget saving. Render is not connected in this session.
- Telegram credentials were verified against `getMe`: the bot username matches `MSGPortfolioBot`, and the private webhook secret satisfies the configured validation. One user-requested delivery test was successfully sent to the configured private test chat. This verifies direct bot delivery, not hosted account linking or automatic budget alerts. No webhook was registered or pending updates consumed during these checks.
- Backend unit tests were rerun: 174 passed with no failures or skips. The `TelegramBudgetIT` suite was also rerun against disposable PostgreSQL using `mvn verify -DskipTests=false -Dtest=TelegramPollingWorkerTest,TelegramDeliveryWorkerTest -Dit.test=TelegramBudgetIT`. Render configuration and deployment are still pending because Render is not connected.
- After the frontend production deployment, its API proxy reached Render and returned the expected JSON HTTP 401 for an unauthenticated expense request. Render health was `UP`, but its OpenAPI schema still exposed zero Telegram endpoints. Automatic Telegram alerts remain unavailable until the backend release and webhook configuration are completed.
