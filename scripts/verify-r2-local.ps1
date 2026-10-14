# Exercise the running local backend and real R2, without printing credentials or tokens.
$ErrorActionPreference = 'Stop'
$checkUsername = 'r2-check-' + [guid]::NewGuid().ToString('N').Substring(0, 12)
$checkPassword = [guid]::NewGuid().ToString('N') + '!aA1'
$checkUserId = $null
$checkHeaders = $null
$checkKey = $null
$photoRemoved = $false
$checkWorkerId = $null
$workerPhotosRemoved = $false
$workerBody = $null
$apiRoot = 'http://localhost:8081/api/v1'
try {
    $registration = @{ username = $checkUsername; email = "$checkUsername@example.com"; password = $checkPassword }
    $session = Invoke-RestMethod -Method Post -Uri "$apiRoot/auth/register" -ContentType 'application/json' -Body ($registration | ConvertTo-Json) -TimeoutSec 15
    $checkUserId = $session.data.user.id
    $checkHeaders = @{ Authorization = 'Bearer ' + $session.data.accessToken }
    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap(16, 16)
    $buffer = New-Object System.IO.MemoryStream
    try {
        $bitmap.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
        $imageData = 'data:image/png;base64,' + [Convert]::ToBase64String($buffer.ToArray())
    } finally { $bitmap.Dispose(); $buffer.Dispose() }
    $saved = Invoke-RestMethod -Method Put -Uri "$apiRoot/profile/photo" -Headers $checkHeaders -ContentType 'application/json' -Body (@{ imageData = $imageData } | ConvertTo-Json) -TimeoutSec 60
    $reference = $saved.data.avatarUrl
    if (!$reference.StartsWith("/api/v1/media/profiles/$checkUserId/")) { throw 'Upload did not return an R2-backed reference' }
    $checkKey = $reference.Substring('/api/v1/media/'.Length)
    Write-Output 'Profile upload through the local backend: OK'
    $image = Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:8081' + $reference) -Headers $checkHeaders -TimeoutSec 45
    if ($image.StatusCode -ne 200 -or $image.Headers['Content-Type'] -notlike 'image/jpeg*') { throw 'Private JPEG read failed' }
    Write-Output 'Authenticated JPEG read through the local backend: OK'
    & python (Join-Path $PSScriptRoot 'check-r2.py') --key $checkKey
    if ($LASTEXITCODE -ne 0) { throw 'Direct R2 object read failed' }
    $removed = Invoke-RestMethod -Method Delete -Uri "$apiRoot/profile/photo" -Headers $checkHeaders -TimeoutSec 60
    $photoRemoved = $true
    & python (Join-Path $PSScriptRoot 'check-r2.py') --key $checkKey --expect-missing
    if ($LASTEXITCODE -ne 0) { throw 'R2 object cleanup failed' }

    # Grant only this temporary account construction access for the worker API check.
    if ($checkUserId -notmatch '^[a-f0-9-]{36}$') { throw 'Unexpected temporary account ID' }
    $grantSql = "INSERT INTO construction_access(user_id,granted_by,construction_role) VALUES ('$checkUserId'::uuid,'$checkUserId'::uuid,'MANAGER');"
    $grantResult = & docker compose exec -T postgres psql -U postgres -d expense_tracker -v ON_ERROR_STOP=1 -c $grantSql
    if ($LASTEXITCODE -ne 0) { throw 'Temporary construction access setup failed' }
    $workerBody = @{ workerCode = $checkUsername; fullName = 'R2 verification worker'; position = 'Worker';
        rateType = 'DAILY'; rate = 60000; overtimeRate = 0; hoursPerDay = 8; currency = 'KHR';
        startDate = (Get-Date).ToString('yyyy-MM-dd'); active = $true; photoDataUrl = $imageData; idCardDataUrl = $imageData }
    $worker = Invoke-RestMethod -Method Post -Uri "$apiRoot/construction/workers" -Headers $checkHeaders -ContentType 'application/json' -Body ($workerBody | ConvertTo-Json) -TimeoutSec 90
    $checkWorkerId = $worker.data.id
    $workerReferences = @($worker.data.photoDataUrl, $worker.data.idCardDataUrl)
    foreach ($workerReference in $workerReferences) {
        if (!$workerReference.StartsWith("/api/v1/media/workers/$checkWorkerId/")) { throw 'Worker image was not stored in R2' }
        $workerImage = Invoke-WebRequest -UseBasicParsing -Uri ('http://localhost:8081' + $workerReference) -Headers $checkHeaders -TimeoutSec 45
        if ($workerImage.StatusCode -ne 200 -or $workerImage.Headers['Content-Type'] -notlike 'image/jpeg*') { throw 'Worker image read failed' }
        & python (Join-Path $PSScriptRoot 'check-r2.py') --key $workerReference.Substring('/api/v1/media/'.Length)
        if ($LASTEXITCODE -ne 0) { throw 'Direct R2 worker image read failed' }
    }
    Write-Output 'Worker photo and ID card upload/read through the local backend: OK'
    $workerBody.photoDataUrl = ''; $workerBody.idCardDataUrl = ''
    $removedWorker = Invoke-RestMethod -Method Put -Uri "$apiRoot/construction/workers/$checkWorkerId" -Headers $checkHeaders -ContentType 'application/json' -Body ($workerBody | ConvertTo-Json) -TimeoutSec 90
    $workerPhotosRemoved = $true
    foreach ($workerReference in $workerReferences) {
        & python (Join-Path $PSScriptRoot 'check-r2.py') --key $workerReference.Substring('/api/v1/media/'.Length) --expect-missing
        if ($LASTEXITCODE -ne 0) { throw 'R2 worker image cleanup failed' }
    }
} finally {
    if ($checkUserId) {
        if ($checkHeaders -and !$photoRemoved) {
            $removed = Invoke-RestMethod -Method Delete -Uri "$apiRoot/profile/photo" -Headers $checkHeaders -TimeoutSec 60
        }
        if ($checkWorkerId) {
            if ($checkWorkerId -notmatch '^[a-f0-9-]{36}$') { throw 'Refusing to remove an unexpected worker' }
            if (!$workerPhotosRemoved) {
                $workerBody.photoDataUrl = ''; $workerBody.idCardDataUrl = ''
                $removedWorker = Invoke-RestMethod -Method Put -Uri "$apiRoot/construction/workers/$checkWorkerId" -Headers $checkHeaders -ContentType 'application/json' -Body ($workerBody | ConvertTo-Json) -TimeoutSec 90
            }
            $workerCleanupSql = "DELETE FROM construction_workers WHERE id='$checkWorkerId'::uuid AND worker_code='$checkUsername';"
            $workerCleanupResult = & docker compose exec -T postgres psql -U postgres -d expense_tracker -v ON_ERROR_STOP=1 -c $workerCleanupSql
            if ($LASTEXITCODE -ne 0 -or ($workerCleanupResult -join '') -notmatch 'DELETE 1') { throw 'Temporary worker cleanup failed' }
            Write-Output 'Temporary verification worker removed: OK'
        }
        # Only delete this script's freshly generated account and its cascading test records.
        if ($checkUserId -notmatch '^[a-f0-9-]{36}$' -or $checkUsername -notmatch '^r2-check-[a-f0-9]{12}$') {
            throw 'Refusing to clean up an unexpected account'
        }
        $cleanupSql = "DELETE FROM users WHERE id='$checkUserId'::uuid AND username='$checkUsername';"
        $cleanupResult = & docker compose exec -T postgres psql -U postgres -d expense_tracker -v ON_ERROR_STOP=1 -c $cleanupSql
        if ($LASTEXITCODE -ne 0 -or ($cleanupResult -join '') -notmatch 'DELETE 1') { throw 'Temporary account cleanup failed' }
        Write-Output 'Temporary verification account removed: OK'
    }
}
