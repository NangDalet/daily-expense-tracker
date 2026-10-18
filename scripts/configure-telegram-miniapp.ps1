param(
    [Parameter(Mandatory = $true)][uri]$MiniAppUrl,
    [string]$EnvironmentFile = (Join-Path $PSScriptRoot '../backend/.env.render.telegram')
)
$ErrorActionPreference = 'Stop'
if ($MiniAppUrl.Scheme -ne 'https' -or -not $MiniAppUrl.Host -or $MiniAppUrl.UserInfo -or $MiniAppUrl.Fragment) {
    throw 'Provide the complete public HTTPS Mini App address, for example https://your-app.example/miniapp.'
}
$miniAppBotToken = $env:TELEGRAM_BOT_TOKEN
if (-not $miniAppBotToken -and (Test-Path -LiteralPath $EnvironmentFile)) {
    foreach ($line in [System.IO.File]::ReadAllLines((Resolve-Path -LiteralPath $EnvironmentFile).Path)) {
        if ($line -match '^\s*TELEGRAM_BOT_TOKEN\s*=\s*(.*?)\s*$') {
            $miniAppBotToken = $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
}
if (-not $miniAppBotToken -or $miniAppBotToken -notmatch '^\d+:[A-Za-z0-9_-]+$') {
    throw 'Set TELEGRAM_BOT_TOKEN in the environment or the specified private environment file.'
}
$body = @{ menu_button = @{ type = 'web_app'; text = 'Open tracker'; web_app = @{ url = $MiniAppUrl.AbsoluteUri } } } | ConvertTo-Json -Depth 5 -Compress
try {
    $result = Invoke-RestMethod -Method Post -Uri ('https://api.telegram.org/bot' + $miniAppBotToken + '/setChatMenuButton') -ContentType 'application/json' -Body $body
} catch {
    throw 'Telegram menu configuration failed. Check the bot token and network connection.'
} finally { $miniAppBotToken = $null }
if (-not $result.ok) { throw 'Telegram did not accept the Mini App menu configuration.' }
Write-Output ('Telegram Mini App menu configured: ' + $MiniAppUrl.AbsoluteUri)
