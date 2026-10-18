# Telegram Mini App

The existing frontend serves the Mini App at `/miniapp`. It includes a mobile home screen, monthly income and spending, cash-wallet balance, recent expenses, quick entry actions, and navigation to budgets and the other account features. The normal website remains available at `/` outside Telegram.

## Server settings

Use the existing bot and database. Keep the bot token on the backend:

```dotenv
TELEGRAM_ENABLED=true
TELEGRAM_MINI_APP_ENABLED=true
TELEGRAM_MINI_APP_AUTH_MAX_AGE=PT5M
TELEGRAM_BOT_TOKEN=<existing secret bot token>
TELEGRAM_BOT_USERNAME=<existing bot username without @>
```

Existing webhook/polling settings are still required for the account-linking workflow. Mini App sign-in uses the local JWT configuration; it returns service unavailable when `OAUTH_ISSUER_URI` delegates authentication to another identity provider. `render.yaml` enables the feature; for an existing Render service, set `TELEGRAM_MINI_APP_ENABLED=true` in its environment and deploy the updated backend.

No migration or new database is required. Authentication uses the existing unique private-chat link in `telegram_connections`.

## Host and configure the bot

1. Deploy the updated backend and frontend to your existing hosts. The frontend needs a public HTTPS address, with `/api/v1` routed to this backend. Existing Vercel rewrites and the Docker nginx configuration already support `/miniapp`.
2. In **@BotFather**, select the existing bot with `/mybots`, then **Bot Settings → Menu Button**, and set the complete URL, such as `https://your-frontend.example/miniapp`, with the label **Open tracker**. You can also enable the main Mini App in the bot settings and use the same URL.
3. Alternatively, configure the default bot menu with the repository script:

```powershell
.\scripts\configure-telegram-miniapp.ps1 -MiniAppUrl 'https://your-frontend.example/miniapp'
```

The script reads `TELEGRAM_BOT_TOKEN` from the process environment or, by default, the private `backend/.env.render.telegram` file. It configures the menu button and does not send chat messages. It never prints the token. The URL above is an example; replace it with the deployed frontend URL.

## Automatic account connection

Open **Open tracker** from the bot menu. If your Telegram identity is already connected, you are signed in immediately. Otherwise, sign in to your existing expense-tracker account or create an account once inside the Mini App. The same request verifies your account credentials and signed Telegram launch data, connects the accounts, and opens the dashboard. Future launches sign in automatically; no separate connection link or bot Start step is required.

An existing link cannot be silently reassigned in either direction. Disconnect an old Telegram link from that account's settings before changing accounts. Invalid or expired Telegram proof does not create a connection. Registration and linking are one database transaction, so a linking conflict rolls back the new account and its default categories.

### Optional website connection

1. Sign in to the expense tracker and open **Telegram alerts**.
2. Select **Connect Telegram**, open the generated personal link, and press **Start** in the private bot chat.
3. Open **Open tracker** from the bot menu. Telegram signs into the linked account automatically.

The website connection flow remains available. Telegram usernames, display names, URL parameters, or client-supplied account IDs cannot select an account. The Mini App's automatic connection requires both fresh signed Telegram data and a successful account sign-in or registration.

## Authentication and embedded behavior

The frontend loads Telegram's official SDK before mounting the app for Mini App launches. It posts raw `Telegram.WebApp.initData` to `POST /api/v1/auth/telegram`. The backend verifies the HMAC-SHA-256 signature, rejects duplicate/malformed fields and expired or future timestamps, then uses only the signed numeric Telegram user ID to resolve an enabled account link. Tokens carry the account's actual roles.

Each Telegram launch verifies the current Telegram identity before restoring any embedded session. Mini App tokens and the cached profile use `sessionStorage`, separately from the website's session. Account changes clear cached queries. The SDK's unsigned identity object is never used for authorization.

Disconnecting Telegram prevents new Telegram sign-ins; already issued application tokens follow the existing JWT expiry behavior. The default allowed launch-data age is five minutes with 30 seconds of future clock tolerance. Reopen the Mini App for fresh launch data after expiry.

Telegram controls light/dark appearance, safe-area spacing and the native back button. The existing forms, permissions, currency rules and API validation remain in force. Budget alerts continue through the existing bot delivery workers.

See the official [Telegram Mini Apps documentation](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app) for the SDK, signature validation, and BotFather configuration.

## Local verification

```powershell
mvn -f backend/pom.xml test
mvn -f backend/pom.xml '-Dit.test=TelegramMiniAppAuthIT,TelegramBudgetIT' verify
Set-Location frontend
npm run build
npx playwright test tests/telegram-miniapp.spec.ts tests/telegram-budget.spec.ts
```

Backend integration tests use disposable PostgreSQL containers. Browser tests simulate the Telegram SDK and API to verify authentication transitions, mobile navigation and themes; they do not represent a live Telegram-client acceptance test. Open `http://localhost:3000/miniapp` during Vite development for browser preview and ordinary account sign-in. Telegram sign-in itself requires real signed launch data from the configured HTTPS bot menu.

## Budget alerts at 80%

Connecting your account does not by itself grant the bot permission to message you. In the Mini App, tap **Enable budget alerts** and allow Telegram's permission prompt. Alternatively, open **More → Telegram connection → Open bot connection**, follow the link, and press **Start** in the bot chat.

After permission is granted, the app checks the current month's budgets and queues alerts already at or above 80%. Pending or failed alerts for that month are retried; alerts already delivered are not sent again. You can also use **Check missed budget alerts** in Telegram settings. Each budget sends one alert per month, including overall and category budgets; spending below 80% does not notify.
