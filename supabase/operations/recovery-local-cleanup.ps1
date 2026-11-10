# Only the named disposable VM. Preserve encrypted backup and separate key.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$VmRoot,[Parameter(Mandatory)][string]$Checkpoint,
 [Parameter(Mandatory)][string]$ManifestSha256,[Parameter(Mandatory)][string]$KeySha256,[switch]$SoftwareOnly)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/recovery-local-guards.ps1"
$resolved=Assert-RecoveryVmRoot $VmRoot
$original=Assert-RecoveryCheckpoint $Checkpoint $ManifestSha256 $KeySha256
$backup=$original.Directory;$key=$original.KeyPath
$archive=Join-Path $backup 'database.aesgcm';$expectedHash=$original.ArchiveSha256
$actualDriverHash=$null;$sourceHash=$null;$startedAt=$null
if($SoftwareOnly){
 Assert-RecoveryPublicSoftwareOnly $resolved
}else{
 $latest=Get-Content -LiteralPath (Join-Path $resolved 'latest-restore.json') -Raw | ConvertFrom-Json
 if($latest.share -cnotmatch '^attempt-restore-\d+$'){throw 'Unexpected evidence directory'}
 $actualDriver=Join-Path (Join-Path $resolved $latest.share) 'guest-inside.sh'
 $actualDriverHash=(Get-FileHash -LiteralPath $actualDriver -Algorithm SHA256).Hash.ToLowerInvariant()
 $normalizedSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'recovery-guest-inside.sh')).Replace("`r`n","`n")
 $sourceHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($normalizedSource))).ToLowerInvariant()
 $invocationFile=Get-ChildItem -LiteralPath $resolved -Filter 'vm-invocation-restore-*.json' | Sort-Object Name | Select-Object -Last 1
 $invocation=Get-Content -LiteralPath $invocationFile.FullName -Raw | ConvertFrom-Json
 if($invocation.mode -cne 'restore' -or $invocation.noNetworkDevice -ne $true -or $invocation.noPorts -ne $true){throw 'Isolated restore invocation evidence required'}
 $startedAt=$invocation.startedAt
}
# Recheck exact bounded paths, private ACL, stopped VM and every original cipher
# immediately before the only destructive operation. No checkpoint/key deletion.
Assert-RecoveryVmRoot $resolved | Out-Null
Assert-RecoveryCheckpoint $Checkpoint $ManifestSha256 $KeySha256 | Out-Null
if($SoftwareOnly){Assert-RecoveryPublicSoftwareOnly $resolved}
# Deliberately one PowerShell, resolved literal path, no globs/cmd/broad roots.
Remove-Item -LiteralPath $resolved -Recurse -Force
if(Test-Path -LiteralPath $resolved){throw 'Temporary environment not completely removed'}
$preserved=Assert-RecoveryCheckpoint $Checkpoint $ManifestSha256 $KeySha256
$record=@{at=[DateTimeOffset]::UtcNow.ToString('o');checkpoint=$Checkpoint;manifestSha256=$ManifestSha256;softwareOnly=[bool]$SoftwareOnly;temporaryEnvironmentRemoved=$true;temporaryPath=$resolved;encryptedBackupPreserved=((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedHash);wrappedKeyPreserved=((Get-FileHash -LiteralPath $key -Algorithm SHA256).Hash.ToLowerInvariant() -eq $KeySha256);forensicEraseClaim=$false;nativeInvocationStartedAt=$startedAt;driverSha256=$actualDriverHash;driverMatchesWorktree=$(if($SoftwareOnly){$null}else{$actualDriverHash -eq $sourceHash})}
$file=Join-Path $backup ('restore-cleanup-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'.status.json')
if(Test-Path -LiteralPath $file){throw 'Cleanup status already exists'}
[IO.File]::WriteAllText($file,($record|ConvertTo-Json))
$record|ConvertTo-Json -Compress
