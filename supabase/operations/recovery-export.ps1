# Local operator only. Exports encrypted files; never invokes production restore/DDL.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/recovery-password-prompt.ps1"
$pending = Join-Path $env:LOCALAPPDATA 'MovieWishlist/Recovery/mttkectgdqqmejpenkrn/pending'
$credentialPath = Join-Path $pending 'credential.pending.clixml'
$state = Get-Content -LiteralPath (Join-Path $pending 'pending.json') -Raw | ConvertFrom-Json -AsHashtable
if ($state.project -ne 'mttkectgdqqmejpenkrn' -or $state.purpose -ne 'one-recovery-operation' -or
    [DateTimeOffset]$state.expiresAt -le [DateTimeOffset]::UtcNow) { throw 'Missing/expired/incorrect recovery handoff; refusing.' }
# Earlier helper versions emitted extra non-secret pipeline values around TLS evidence.
# Accept exactly one fully verified evidence object, not a truthy array or a guess.
$tls = @($state.tls | Where-Object { $_ -is [Collections.IDictionary] -and $_.Contains('hostnameVerified') })
if ($tls.Count -ne 1 -or $tls[0].hostnameVerified -ne $true -or $tls[0].chainVerified -ne $true -or
    $tls[0].rootSha256 -cne '807025AD50D4ED219D2C9C7D299C004F824EB00CF7F65AFEF607D07B72E6CAFA') { throw 'TLS evidence invalid.' }
if ($state.database.database -ne 'postgres' -or $state.database.user -ne 'postgres' -or
    $state.database.serverVersionNum -notmatch '^17\d{4}$' -or $state.database.readOnly -ne $true) { throw 'Database evidence invalid.' }
$credential = Import-Clixml -LiteralPath $credentialPath
$key = $null
$process = $null
$start = $null
try {
    if ($credential.UserName -ne 'postgres.mttkectgdqqmejpenkrn' -or $credential.Password.Length -eq 0) { throw 'Credential role invalid.' }
    $checkpoint = 'checkpoint-' + [DateTimeOffset]::UtcNow.ToString('yyyyMMddTHHmmssZ') + '-' + [Guid]::NewGuid().ToString('N').Substring(0,8)
    $directory = New-RecoveryPrivateDirectory (Join-Path $env:LOCALAPPDATA "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$checkpoint")
    $keys = New-RecoveryPrivateDirectory (Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryKeys')
    $keyPath = Join-Path $keys ($checkpoint + '.key.dpapi')
    $key = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    $wrapped = [Security.Cryptography.ProtectedData]::Protect($key, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    $testKey = [Security.Cryptography.ProtectedData]::Unprotect($wrapped, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    if (-not [Security.Cryptography.CryptographicOperations]::FixedTimeEquals($key,$testKey)) { throw 'Recovery key round-trip failed.' }
    [Array]::Clear($testKey,0,$testKey.Length)
    $keyStream = [IO.File]::Open($keyPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $keyStream.Write($wrapped) } finally { $keyStream.Dispose() }
    $toolRoot = Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11'
    $config = @{
        directory=$directory; keyBase64=[Convert]::ToBase64String($key)
        bin=(Join-Path $toolRoot 'pgsql/bin'); caFile=(Join-Path $pending 'verified-pooler-root.pem')
        pgModule='C:/Users/DenysLis/.codex/visualizations/2026/09/28/01a0e7c4-3dc8-75e0-a3ed-84a709483b8d/m4-native-review-pg17/node_modules/pg'
    }
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = (Get-Command node.exe).Source
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.ArgumentList.Add((Join-Path $PSScriptRoot 'recovery-export.mjs'))
    foreach ($name in @($start.Environment.Keys)) { if ($name -like 'PG*') { $start.Environment.Remove($name) | Out-Null } }
    $secretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($credential.Password)
    try { $start.Environment['PGPASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr) }
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    $process.Start() | Out-Null
    $start.Environment.Remove('PGPASSWORD') | Out-Null
    $process.StandardInput.Write(($config | ConvertTo-Json -Compress))
    $process.StandardInput.Close()
    $config.Remove('keyBase64')
    $stdout = $process.StandardOutput.ReadToEndAsync()
    $stderr = $process.StandardError.ReadToEndAsync()
    if (-not $process.WaitForExit(1800000)) { $process.Kill($true); $process.WaitForExit(); throw 'Export worker timeout.' }
    $stdout.GetAwaiter().GetResult().Split("`n") | Where-Object { $_.Trim() -cmatch '^[A-Z_]+$' } | ForEach-Object { Write-Host $_.Trim() }
    $stderr.GetAwaiter().GetResult() | Out-Null
    Write-Host ('CHECKPOINT_DIRECTORY=' + $directory)
    Write-Host ('DPAPI_KEY_FILE=' + $keyPath)
    if ($process.ExitCode -ne 0) { throw 'Export incomplete; inspect only encrypted private diagnostics. No restore performed.' }
    Write-Host 'Backup exported; actual restore still blocked pending verified encrypted local staging.'
} finally {
    if ($start) { $start.Environment.Remove('PGPASSWORD') | Out-Null }
    if ($process) { $process.Dispose() }
    if ($key) { [Array]::Clear($key,0,$key.Length) }
    $credential.Password.Dispose()
    # Exact one-use credential only, never a broad/recursive operation. Do not retain
    # this password with the database archive or DPAPI archive key.
    if (Test-Path -LiteralPath $credentialPath) { Remove-Item -LiteralPath $credentialPath -Force }
    if (Test-Path -LiteralPath (Join-Path $pending 'pending.json')) {
        if (Get-Variable directory -ErrorAction SilentlyContinue) {
            Move-Item -LiteralPath (Join-Path $pending 'pending.json') -Destination (Join-Path $directory 'handoff-metadata.json') -ErrorAction Stop
        }
    }
}
