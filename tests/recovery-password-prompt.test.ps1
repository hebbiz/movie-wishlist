# Authored offline test; no database/network calls or real credentials.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../supabase/operations/recovery-password-prompt.ps1"
function Assert-RecoveryTest($Condition, [string]$Message) {
    if (-not $Condition) { throw $Message }
}
$fixtureRoot = Join-Path ([IO.Path]::GetTempPath()) ('mw-recovery-authored-' + [Guid]::NewGuid().ToString('N'))
$secret = ConvertTo-SecureString 'AUTHORED-fixture-only-42' -AsPlainText -Force
$credentialFile = Join-Path $fixtureRoot 'credential.pending.clixml'
$statusFile = Join-Path $fixtureRoot 'pending.json'
try {
    $private = New-RecoveryPrivateDirectory $fixtureRoot
    # Reapplying DACL must not require SACL/ownership elevation.
    New-RecoveryPrivateDirectory $private | Out-Null
    $acl = [IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($private), [Security.AccessControl.AccessControlSections]::Access)
    $rules = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    Assert-RecoveryTest ($acl.AreAccessRulesProtected -and $rules.Count -eq 2) 'DACL must be private and non-inherited.'
    $sids = @([Security.Principal.WindowsIdentity]::GetCurrent().User.Value, 'S-1-5-18')
    foreach ($rule in $rules) {
        Assert-RecoveryTest ($rule.IdentityReference.Value -in $sids -and $rule.AccessControlType -eq 'Allow') 'Unexpected ACL principal.'
    }
    $start = New-RecoveryPgStartInfo 'psql.exe' 'C:/authored-root.pem' $secret
    try {
        Assert-RecoveryTest (-not $start.UseShellExecute -and $start.RedirectStandardError -and $start.RedirectStandardOutput) 'Private process handling.'
        Assert-RecoveryTest ($start.Environment['PGSSLMODE'] -eq 'verify-full') 'No TLS downgrade.'
        Assert-RecoveryTest ($start.Environment['PGHOST'] -eq 'aws-1-eu-north-1.pooler.supabase.com' -and $start.Environment['PGPORT'] -eq '5432') 'Fixed Session pooler.'
        Assert-RecoveryTest ($start.Environment['PGOPTIONS'] -match 'default_transaction_read_only=on') 'Read-only check.'
        Assert-RecoveryTest ($start.Environment['PGPASSWORD'] -eq 'AUTHORED-fixture-only-42') 'Password only in child environment.'
        Assert-RecoveryTest (($start.ArgumentList -join ' ') -notmatch 'AUTHORED|PGPASSWORD|password=') 'Secret must not appear in argv.'
        Assert-RecoveryTest ($start.ArgumentList.Contains('-X') -and $start.ArgumentList.Contains('-w')) 'No psqlrc or secondary prompt.'
    }
    finally { $start.Environment.Remove('PGPASSWORD') | Out-Null }
    $before = [DateTimeOffset]::UtcNow
    Save-RecoveryCredentialHandoff $private $secret @{hostnameVerified=$true} @{readOnly=$true}
    Assert-RecoveryTest (-not ([IO.File]::ReadAllText($credentialFile).Contains('AUTHORED-fixture-only-42'))) 'No plaintext credential file.'
    $loaded = Import-Clixml -LiteralPath $credentialFile
    try {
        Assert-RecoveryTest ($loaded.UserName -eq 'postgres.mttkectgdqqmejpenkrn') 'Fixed role.'
        Assert-RecoveryTest ($loaded.GetNetworkCredential().Password -eq 'AUTHORED-fixture-only-42') 'DPAPI round-trip on current profile.'
    }
    finally { $loaded.Password.Dispose() }
    $status = Get-Content -Raw -LiteralPath $statusFile | ConvertFrom-Json
    Assert-RecoveryTest (-not $status.backupCreated -and -not $status.restoreVerified) 'Must not imply backup/restore success.'
    $expires = [DateTimeOffset]$status.expiresAt
    Assert-RecoveryTest ($expires -gt $before -and $expires -le [DateTimeOffset]::UtcNow.AddHours(2)) 'Bounded handoff expiry.'
    $hashBefore = (Get-FileHash -LiteralPath $credentialFile).Hash
    $refused = $false
    try { Save-RecoveryCredentialHandoff $private $secret @{} @{} } catch { $refused = $true }
    Assert-RecoveryTest ($refused -and (Get-FileHash -LiteralPath $credentialFile).Hash -eq $hashBefore) 'Pending credentials must not be overwritten.'
    'PASS: private ACL/reapply, child-only password/no argv, verify-full/read-only config, DPAPI round-trip, expiry metadata, no overwrite, honest status.'
}
finally {
    $secret.Dispose()
    # Exact files in this test's freshly created GUID directory only; never recursive deletion.
    foreach ($file in @($credentialFile, $statusFile)) {
        if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
    }
    if (Test-Path -LiteralPath $fixtureRoot) { Remove-Item -LiteralPath $fixtureRoot }
}
