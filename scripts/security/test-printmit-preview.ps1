param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-z]{20}$')]
  [string]$ProjectRef
)

$ErrorActionPreference = 'Stop'
$baseUrl = "https://$ProjectRef.supabase.co"
$keys = (npx.cmd --yes supabase@latest projects api-keys --project-ref $ProjectRef --output json 2>$null) |
  ConvertFrom-Json
$anonKey = ($keys | Where-Object name -eq 'anon').api_key
$serviceKey = ($keys | Where-Object name -eq 'service_role').api_key
if (-not $anonKey -or -not $serviceKey) { throw 'Preview API keys are unavailable.' }

function Invoke-PreviewJson {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [Parameter(Mandatory = $true)][string]$Uri,
    [Parameter(Mandatory = $true)][hashtable]$Headers,
    [hashtable]$Body
  )
  $request = @{ Method = $Method; Uri = $Uri; Headers = $Headers }
  if ($Body) {
    $request.ContentType = 'application/json'
    $request.Body = $Body | ConvertTo-Json -Depth 20 -Compress
  }
  Invoke-RestMethod @request
}

function Copy-Headers([hashtable]$Headers, [hashtable]$Extra) {
  $copy = $Headers.Clone()
  foreach ($key in $Extra.Keys) { $copy[$key] = $Extra[$key] }
  $copy
}

function Get-Rows($Response) {
  $items = @($Response)
  if ($items.Count -eq 1 -and $items[0].PSObject.Properties.Name -contains 'value') {
    return @($items[0].value)
  }
  return $items
}

$adminHeaders = @{ apikey = $serviceKey; Authorization = "Bearer $serviceKey" }
$emailA = "printmit-a-$([guid]::NewGuid().ToString('N'))@isolated.invalid"
$emailB = "printmit-b-$([guid]::NewGuid().ToString('N'))@isolated.invalid"
$password = "Preview-$([guid]::NewGuid().ToString('N'))-A1!"
$userA = $null
$userB = $null

try {
  $userA = Invoke-PreviewJson -Method POST -Uri "$baseUrl/auth/v1/admin/users" -Headers $adminHeaders -Body @{
    email = $emailA; password = $password; email_confirm = $true
  }
  $userB = Invoke-PreviewJson -Method POST -Uri "$baseUrl/auth/v1/admin/users" -Headers $adminHeaders -Body @{
    email = $emailB; password = $password; email_confirm = $true
  }
  $minimalHeaders = Copy-Headers $adminHeaders @{ Prefer = 'return=minimal' }
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/profiles" -Headers $minimalHeaders -Body @{
    id = $userA.id; plan_type = 'preview'
  } | Out-Null
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/profiles" -Headers $minimalHeaders -Body @{
    id = $userB.id; plan_type = 'preview'
  } | Out-Null

  $sessionA = Invoke-PreviewJson -Method POST -Uri "$baseUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $anonKey } -Body @{
    email = $emailA; password = $password
  }
  $sessionB = Invoke-PreviewJson -Method POST -Uri "$baseUrl/auth/v1/token?grant_type=password" -Headers @{ apikey = $anonKey } -Body @{
    email = $emailB; password = $password
  }
  function Get-JwtSubject([string]$Token) {
    $payload = $Token.Split('.')[1].Replace('-', '+').Replace('_', '/')
    while ($payload.Length % 4) { $payload += '=' }
    ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($payload)) | ConvertFrom-Json).sub
  }
  $subjectA = Get-JwtSubject $sessionA.access_token
  $subjectB = Get-JwtSubject $sessionB.access_token
  Write-Output "JWT_A_MATCH=$($subjectA -eq $userA.id)_B_MATCH=$($subjectB -eq $userB.id)_DISTINCT=$($subjectA -ne $subjectB)"
  $headersA = @{ apikey = $anonKey; Authorization = "Bearer $($sessionA.access_token)" }
  $headersB = @{ apikey = $anonKey; Authorization = "Bearer $($sessionB.access_token)" }

  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/worksheet_projects" -Headers (Copy-Headers $headersA @{ Prefer = 'return=minimal' }) -Body @{
    user_id = $userA.id
    project_id = 'rls-project'
    title = 'Syntetisk'
    subject = 'Matematik'
    grade = '4. klasse'
    brief = @{ topic = 'Brøker' }
    document = @{ schemaVersion = 2; id = 'rls-project'; title = 'Syntetisk' }
    schema_version = 2
  } | Out-Null
  $rowsA = @(Get-Rows (Invoke-PreviewJson -Method GET -Uri "$baseUrl/rest/v1/worksheet_projects?project_id=eq.rls-project&select=project_id" -Headers $headersA))
  $rowsB = @(Get-Rows (Invoke-PreviewJson -Method GET -Uri "$baseUrl/rest/v1/worksheet_projects?project_id=eq.rls-project&select=project_id" -Headers $headersB))
  $visibleA = @($rowsA | Where-Object project_id -eq 'rls-project')
  $visibleB = @($rowsB | Where-Object project_id -eq 'rls-project')
  if ($visibleA.Count -ne 1 -or $visibleB.Count -ne 0) { throw 'RLS isolation failed.' }
  Invoke-PreviewJson -Method DELETE -Uri "$baseUrl/rest/v1/worksheet_projects?project_id=eq.rls-project" -Headers (Copy-Headers $headersB @{ Prefer = 'return=representation' }) | Out-Null
  $afterDelete = @(Get-Rows (Invoke-PreviewJson -Method GET -Uri "$baseUrl/rest/v1/worksheet_projects?project_id=eq.rls-project&select=project_id" -Headers $headersA))
  if (@($afterDelete | Where-Object project_id -eq 'rls-project').Count -ne 1) {
    throw 'Cross-user delete was not blocked.'
  }
  $anonBlocked = $false
  try { Invoke-PreviewJson -Method GET -Uri "$baseUrl/rest/v1/worksheet_projects?select=project_id" -Headers @{ apikey = $anonKey } | Out-Null }
  catch { $anonBlocked = $true }
  if (-not $anonBlocked) { throw 'Anonymous project access was not blocked.' }
  Write-Output 'RLS_A_B_ANON=PASS'

  $request1 = [guid]::NewGuid()
  $request2 = [guid]::NewGuid()
  $reserve1 = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/reserve_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $request1; p_provider = 'openai'; p_model = 'synthetic'; p_hourly_limit = 20
  }))
  $parallel = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/reserve_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $request2; p_provider = 'openai-image'; p_model = 'synthetic'; p_hourly_limit = 10
  }))
  $duplicate = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/reserve_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $request1; p_provider = 'openai'; p_model = 'synthetic'; p_hourly_limit = 20
  }))
  if ($reserve1[0].decision -ne 'reserved' -or $parallel[0].decision -ne 'rate_limited' -or $duplicate[0].decision -ne 'duplicate') {
    throw 'Distributed reservation contract failed.'
  }
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/complete_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $request1; p_status = 'succeeded'; p_project_id = 'rls-project'; p_duration_ms = 10
  } | Out-Null
  $reserve2 = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/reserve_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $request2; p_provider = 'openai-image'; p_model = 'synthetic'; p_hourly_limit = 10
  }))
  if ($reserve2[0].decision -ne 'reserved') { throw 'Reservation did not reopen after completion.' }
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/complete_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $request2; p_status = 'failed'; p_project_id = 'rls-project'; p_duration_ms = 20
  } | Out-Null
  Write-Output 'IDEMPOTENCY_PARALLEL_GUARD=PASS'

  $staleId = [guid]::NewGuid()
  $freshId = [guid]::NewGuid()
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/reserve_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $staleId; p_provider = 'openai'; p_model = 'synthetic'; p_hourly_limit = 20
  } | Out-Null
  Invoke-PreviewJson -Method PATCH -Uri "$baseUrl/rest/v1/worksheet_generation_events?user_id=eq.$($userA.id)&request_id=eq.$staleId" -Headers $adminHeaders -Body @{
    created_at = (Get-Date).ToUniversalTime().AddMinutes(-3).ToString('o')
  } | Out-Null
  $fresh = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/reserve_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $freshId; p_provider = 'openai'; p_model = 'synthetic'; p_hourly_limit = 20
  }))
  if ($fresh[0].decision -ne 'reserved') { throw 'Stale reservation cleanup failed.' }
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/complete_worksheet_generation" -Headers $headersA -Body @{
    p_request_id = $freshId; p_status = 'failed'; p_project_id = 'rls-project'; p_duration_ms = 1
  } | Out-Null
  Write-Output 'TIMEOUT_CLEANUP=PASS'

  $requestHash = 'a' * 64
  $nonceHash = 'b' * 64
  Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/family_sso_requests" -Headers $minimalHeaders -Body @{
    request_hash = $requestHash
    nonce_hash = $nonceHash
    destination_origin = 'https://preview.example.invalid'
    return_path = '/lav'
    expires_at = (Get-Date).ToUniversalTime().AddSeconds(90).ToString('o')
  } | Out-Null
  $authorized = Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/authorize_family_sso_request" -Headers $adminHeaders -Body @{
    p_request_hash = $requestHash
    p_user_id = $userA.id
    p_verified_email = $emailA
    p_display_name = 'Syntetisk lærer'
    p_identity_provider = 'preview'
    p_destination_origin = 'https://preview.example.invalid'
  }
  if ($authorized -ne 'authorized') { throw 'SSO authorization failed.' }
  $consume1 = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/consume_family_sso_request" -Headers $adminHeaders -Body @{
    p_request_hash = $requestHash; p_nonce_hash = $nonceHash; p_destination_origin = 'https://preview.example.invalid'
  }))
  $consume2 = @(Get-Rows (Invoke-PreviewJson -Method POST -Uri "$baseUrl/rest/v1/rpc/consume_family_sso_request" -Headers $adminHeaders -Body @{
    p_request_hash = $requestHash; p_nonce_hash = $nonceHash; p_destination_origin = 'https://preview.example.invalid'
  }))
  if ($consume1.Count -ne 1 -or $consume2.Count -ne 0) { throw 'SSO replay protection failed.' }
  Write-Output 'SSO_SINGLE_USE_REPLAY=PASS'
}
finally {
  if ($userA.id) { Invoke-PreviewJson -Method DELETE -Uri "$baseUrl/auth/v1/admin/users/$($userA.id)" -Headers $adminHeaders | Out-Null }
  if ($userB.id) { Invoke-PreviewJson -Method DELETE -Uri "$baseUrl/auth/v1/admin/users/$($userB.id)" -Headers $adminHeaders | Out-Null }
  Write-Output 'SYNTHETIC_USERS_CLEANED=true'
}
