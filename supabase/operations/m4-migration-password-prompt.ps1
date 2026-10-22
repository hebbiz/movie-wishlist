# Operator-only hidden credential handoff. No DDL or migration execution.
[CmdletBinding()]
param()
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'recovery-password-prompt.ps1')
$pending=New-RecoveryPrivateDirectory (Join-Path $env:LOCALAPPDATA 'MovieWishlist/M4Deployment/pending')
$credentialFile=Join-Path $pending 'credential.pending.clixml'
$metadataFile=Join-Path $pending 'pending.json'
if((Test-Path -LiteralPath $credentialFile) -or (Test-Path -LiteralPath $metadataFile)){throw 'Existing M4 handoff: refusing overwrite.'}
$certificate=Join-Path $pending 'verified-pooler-root.pem'
$tls=Get-RecoveryVerifiedRoot $certificate
$password=Read-Host 'Existing Supabase database password (hidden; not an API key)' -AsSecureString
try{
    if($password.Length -eq 0){throw 'Empty password.'}
    $psql=Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/pgsql/bin/psql.exe'
    $database=Test-RecoveryDatabaseAccess $psql $certificate $password
    [PSCredential]::new('postgres.mttkectgdqqmejpenkrn',$password) | Export-Clixml -LiteralPath $credentialFile -NoClobber
    $now=[DateTimeOffset]::UtcNow
    $metadata=[ordered]@{purpose='m4-two-reviewed-migrations';project='mttkectgdqqmejpenkrn';host='aws-1-eu-north-1.pooler.supabase.com';port=5432;database='postgres';createdAt=$now.ToString('o');expiresAt=$now.AddHours(2).ToString('o');versions=@('20261020205122','20261021072002');tls=$tls;access=$database}
    [IO.File]::WriteAllText($metadataFile,($metadata | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
    Write-Host 'M4 TLS/read-only identity verified; private DPAPI credential handoff ready. No migrations ran.'
    Write-Host 'Tell Codex that the local prompt completed. Never send the password.'
}finally{$password.Dispose()}
