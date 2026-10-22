# Only the named disposable VM. Preserve encrypted backup and separate key.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$VmRoot)
$ErrorActionPreference='Stop'
$parent=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'MovieWishlist/RestoreTests'))
$resolved=[IO.Path]::GetFullPath($VmRoot)
if([IO.Path]::GetDirectoryName($resolved) -ne $parent -or [IO.Path]::GetFileName($resolved) -cnotmatch '^restore-\d{8}-qemu-[a-f0-9]{8}$'){throw 'Cleanup target refused'}
$item=Get-Item -LiteralPath $resolved -Force
if($item.FullName -ne $resolved -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Unexpected cleanup target'}
if(@(Get-ChildItem -LiteralPath $resolved -Recurse -Force -Attributes ReparsePoint).Count){throw 'Reparse point in temporary target; inspect first'}
$exe=Join-Path $resolved 'qemu/qemu-system-x86_64.exe'
if(@(Get-Process -Name qemu-system-x86_64 -ErrorAction SilentlyContinue | Where-Object {$_.Path -eq $exe}).Count){throw 'VM still running; cleanup refused'}
$backup=Join-Path $env:LOCALAPPDATA 'MovieWishlist/Recovery/mttkectgdqqmejpenkrn/checkpoint-20261021T221351Z-432dc0a6'
$key=Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryKeys/checkpoint-20261021T221351Z-432dc0a6.key.dpapi'
if(-not(Test-Path -LiteralPath $key)){throw 'Separate wrapped key missing'}
$archive=Join-Path $backup 'database.aesgcm'
$expectedHash='a09a6d3079ebf22b42ff7b0af47406bff14bc8552005ebac6d0bf2fde99104f5'
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedHash){throw 'Original backup integrity refused'}
$latest=Get-Content -LiteralPath (Join-Path $resolved 'latest-restore.json') -Raw | ConvertFrom-Json
if($latest.share -cnotmatch '^attempt-restore-\d+$'){throw 'Unexpected evidence directory'}
$actualDriver=Join-Path (Join-Path $resolved $latest.share) 'guest-inside.sh'
$actualDriverHash=(Get-FileHash -LiteralPath $actualDriver -Algorithm SHA256).Hash.ToLowerInvariant()
$normalizedSource=[IO.File]::ReadAllText((Join-Path $PSScriptRoot 'recovery-guest-inside.sh')).Replace("`r`n","`n")
$sourceHash=[Convert]::ToHexString([Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($normalizedSource))).ToLowerInvariant()
$invocationFile=Get-ChildItem -LiteralPath $resolved -Filter 'vm-invocation-restore-*.json' | Sort-Object Name | Select-Object -Last 1
$invocation=Get-Content -LiteralPath $invocationFile.FullName -Raw | ConvertFrom-Json
# Deliberately one PowerShell, resolved literal path, no globs/cmd/broad roots.
Remove-Item -LiteralPath $resolved -Recurse -Force
if(Test-Path -LiteralPath $resolved){throw 'Temporary environment not completely removed'}
$record=@{at=[DateTimeOffset]::UtcNow.ToString('o');temporaryEnvironmentRemoved=$true;temporaryPath=$resolved;encryptedBackupPreserved=((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expectedHash);wrappedKeyPreserved=(Test-Path -LiteralPath $key);forensicEraseClaim=$false;nativeInvocationStartedAt=$invocation.startedAt;driverSha256=$actualDriverHash;driverMatchesWorktree=($actualDriverHash -eq $sourceHash)}
$file=Join-Path $backup ('restore-cleanup-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')+'.status.json')
if(Test-Path -LiteralPath $file){throw 'Cleanup status already exists'}
[IO.File]::WriteAllText($file,($record|ConvertTo-Json))
$record|ConvertTo-Json -Compress
