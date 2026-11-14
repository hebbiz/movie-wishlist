# Authored Windows-only fixtures. Never reads a real backup/key or starts QEMU.
$ErrorActionPreference='Stop'
. "$PSScriptRoot/../../supabase/operations/recovery-password-prompt.ps1"
. "$PSScriptRoot/../../supabase/operations/recovery-local-guards.ps1"
function Assert-GuardTest($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Assert-Refused([scriptblock]$Action,[string]$Reason=''){
 $refused=$false
 try{& $Action | Out-Null}catch{$refused=($Reason -eq '' -or $_.Exception.Message.Contains($Reason))}
 Assert-GuardTest $refused 'Authored unsafe case was not refused as expected.'
}
$oldLocalAppData=$env:LOCALAPPDATA
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('mw-recovery-guards-'+[Guid]::NewGuid().ToString('N'))
$env:LOCALAPPDATA=$fixture
$checkpoint='checkpoint-20000101T000000Z-aabbccdd'
$root=Join-Path $fixture 'MovieWishlist/RestoreTests/restore-20000101-qemu-aabbccdd'
$backup=Join-Path $fixture "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$checkpoint"
$keyPath=Join-Path $fixture "MovieWishlist/RecoveryKeys/$checkpoint.key.dpapi"
$checks=0
try{
 New-RecoveryPrivateDirectory $fixture | Out-Null
 foreach($directory in @($root,$backup,[IO.Path]::GetDirectoryName($keyPath))){New-RecoveryPrivateDirectory $directory | Out-Null}
 [IO.File]::WriteAllText($keyPath,'AUTHORED non-key bytes; never decrypted')
 $names=@('database','roles-before','roles-after','source-inventory','archive-toc','archive-read-test','checkpoint-record')
 $files=@(foreach($name in $names){
  $file=Join-Path $backup "$name.aesgcm"
  [IO.File]::WriteAllText($file,'AUTHORED non-cipher bytes; hash-guard fixture only')
  @{name="$name.aesgcm";bytes=(Get-Item -LiteralPath $file).Length;sha256=(Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant()}
 })
 $manifest=Join-Path $backup 'status.json'
 [IO.File]::WriteAllText($manifest,(@{project='mttkectgdqqmejpenkrn';backupComplete=$true;files=$files}|ConvertTo-Json -Depth 5))
 $manifestHash=(Get-FileHash -LiteralPath $manifest).Hash.ToLowerInvariant()
 $keyHash=(Get-FileHash -LiteralPath $keyPath).Hash.ToLowerInvariant()
 Assert-GuardTest ((Assert-RecoveryVmRoot $root) -eq [IO.Path]::GetFullPath($root)) 'Private bounded root must pass.';$checks++
 $original=Assert-RecoveryCheckpoint $checkpoint $manifestHash $keyHash
 Assert-GuardTest ($original.Directory -eq $backup) 'Explicit authenticated-path hash guards must pass.';$checks++
 foreach($bad in @($fixture,[IO.Path]::GetPathRoot($fixture),(Join-Path $root 'nested'),(Join-Path $fixture 'restore-20000101-qemu-aabbccdd'),'relative/restore-20000101-qemu-aabbccdd')){
  Assert-Refused {Assert-RecoveryVmRoot $bad};$checks++
 }
 Assert-Refused {Assert-RecoveryCheckpoint '../checkpoint' $manifestHash $keyHash};$checks++
 Assert-Refused {Assert-RecoveryCheckpoint 'checkpoint-20000102T000000Z-aabbccdd' $manifestHash $keyHash};$checks++
 Assert-Refused {Assert-RecoveryCheckpoint $checkpoint ('0'*64) $keyHash} 'pin mismatch';$checks++
 Assert-Refused {Assert-RecoveryCheckpoint $checkpoint $manifestHash ('0'*64)} 'pin mismatch';$checks++
 [IO.File]::AppendAllText((Join-Path $backup 'database.aesgcm'),'authored corruption')
 Assert-Refused {Assert-RecoveryCheckpoint $checkpoint $manifestHash $keyHash} 'integrity refused';$checks++
 [IO.File]::WriteAllText((Join-Path $backup 'database.aesgcm'),'AUTHORED non-cipher bytes; hash-guard fixture only')
 $acl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($root),[Security.AccessControl.AccessControlSections]::Access)
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow'))
 [IO.FileSystemAclExtensions]::SetAccessControl([IO.DirectoryInfo]::new($root),$acl)
 Assert-Refused {Assert-RecoveryVmRoot $root} 'private ACL';$checks++
 New-RecoveryPrivateDirectory $root | Out-Null
 $child=Join-Path $root 'authored.txt';[IO.File]::WriteAllText($child,'authored')
 $acl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.FileInfo]::new($child),[Security.AccessControl.AccessControlSections]::Access)
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'))
 [IO.FileSystemAclExtensions]::SetAccessControl([IO.FileInfo]::new($child),$acl)
 Assert-Refused {Assert-RecoveryVmRoot $root} 'private ACL';$checks++
 Remove-Item -LiteralPath $child
 # Wrong-owner and inherited-root ACL decisions use authored in-memory security
 # descriptors, without requiring SetOwner privileges on a real filesystem item.
 $ownerAcl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($root),[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access)
 $ownerAcl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-18'))
 Assert-Refused {Assert-RecoveryLocalAcl $ownerAcl -RequireProtected} 'ownership';$checks++
 Assert-Refused {Assert-RecoveryLocalAcl $ownerAcl -RequireProtected -AllowHistoricalOwner} 'ownership';$checks++
 $daclBefore=$ownerAcl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
 $ownerAcl.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))
 Assert-RecoveryLocalAcl $ownerAcl -RequireProtected -AllowHistoricalOwner;$checks++
 Assert-GuardTest ($ownerAcl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access) -eq $daclBefore) 'Historical Administrators allowance must not change DACL.';$checks++
 $unknownOwner=[Security.AccessControl.DirectorySecurity]::new()
 $unknownOwner.SetSecurityDescriptorSddlForm($ownerAcl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access))
 $unknownOwner.SetOwner([Security.Principal.SecurityIdentifier]::new('S-1-5-21-111111111-222222222-333333333-1001'))
 Assert-Refused {Assert-RecoveryLocalAcl $unknownOwner -RequireProtected -AllowHistoricalOwner} 'ownership';$checks++
 $ownerAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'))
 Assert-Refused {Assert-RecoveryLocalAcl $ownerAcl -RequireProtected -AllowHistoricalOwner} 'private ACL';$checks++
 $inheritedAcl=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($root),[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access)
 $inheritedAcl.SetAccessRuleProtection($false,$true)
 Assert-Refused {Assert-RecoveryLocalAcl $inheritedAcl -RequireProtected} 'inheritance';$checks++
 $missingSystem=[IO.FileSystemAclExtensions]::GetAccessControl([IO.DirectoryInfo]::new($root),[Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access)
 foreach($rule in @($missingSystem.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | Where-Object {$_.IdentityReference.Value -eq 'S-1-5-18'})){$missingSystem.RemoveAccessRuleSpecific($rule)}
 Assert-Refused {Assert-RecoveryLocalAcl $missingSystem -RequireProtected} 'owner/SYSTEM full control';$checks++
 $junction=Join-Path $root 'authored-junction'
 New-Item -ItemType Junction -Path $junction -Target $backup | Out-Null
 try{
  Assert-Refused {Assert-RecoveryVmRoot $root} 'reparse';$checks++
  Assert-Refused {Assert-RecoveryLocalPrivatePath (Join-Path $junction 'status.json')} 'reparse';$checks++
 }finally{[IO.Directory]::Delete($junction)}
 function Get-Process { [PSCustomObject]@{Path=(Join-Path $root 'qemu/qemu-system-x86_64.exe')} }
 try{Assert-Refused {Assert-RecoveryVmRoot $root} 'VM still running';$checks++}finally{Remove-Item Function:Get-Process}
 $stageMarker=Join-Path $root 'private-data-staged.json';[IO.File]::WriteAllText($stageMarker,'{}')
 try{Assert-Refused {& (Join-Path $PSScriptRoot '../../supabase/operations/recovery-software-iso.ps1') -Root $root} 'Private recovery material';$checks++}finally{Remove-Item -LiteralPath $stageMarker}
 # Node cannot bypass the PowerShell ACL/path preflight, even in software mode.
 $node=(Get-Command node.exe).Source
 $vmScript=Join-Path $PSScriptRoot '../../supabase/operations/recovery-vm.mjs'
 $badRoot=Join-Path $fixture 'restore-20000101-qemu-aabbccdd'
 New-RecoveryPrivateDirectory $badRoot | Out-Null
 $output=& $node $vmScript $badRoot prepare 2>&1
 Assert-GuardTest ($LASTEXITCODE -ne 0 -and ($output -join ' ').Contains('private VM root preflight refused')) 'Node must reject a root outside RestoreTests before QEMU.';$checks++
 Assert-GuardTest (@(Get-ChildItem -LiteralPath $badRoot -Force).Count -eq 0) 'Node guard must run before any writes.';$checks++
 # Cleanup wrapper must fail before deletion when independent checkpoint pin is wrong.
 $cleanup=Join-Path $PSScriptRoot '../../supabase/operations/recovery-local-cleanup.ps1'
 Assert-Refused {& $cleanup -VmRoot $root -Checkpoint $checkpoint -ManifestSha256 ('0'*64) -KeySha256 $keyHash} 'pin mismatch';$checks++
 Assert-GuardTest ((Test-Path -LiteralPath $root) -and (Get-FileHash -LiteralPath $manifest).Hash.ToLowerInvariant() -eq $manifestHash) 'Refused cleanup preserves staging and original fixture.';$checks++
 $privateDirectory=Join-Path $root 'nested';New-Item -ItemType Directory -Path $privateDirectory | Out-Null
 foreach($name in @('private-data-staged.json','database.dump','roles.sql','source-inventory.json','authored.aesgcm','authored.key.dpapi')){
  $file=Join-Path $privateDirectory $name;[IO.File]::WriteAllText($file,'authored')
  try{Assert-Refused {& $cleanup -VmRoot $root -Checkpoint $checkpoint -ManifestSha256 $manifestHash -KeySha256 $keyHash -SoftwareOnly} 'Private recovery material';$checks++}finally{Remove-Item -LiteralPath $file}
 }
 $softwareStatus=& $cleanup -VmRoot $root -Checkpoint $checkpoint -ManifestSha256 $manifestHash -KeySha256 $keyHash -SoftwareOnly | ConvertFrom-Json
 Assert-GuardTest (-not (Test-Path -LiteralPath $root) -and $softwareStatus.softwareOnly -and $softwareStatus.wrappedKeyPreserved -and $softwareStatus.encryptedBackupPreserved -and $null -eq $softwareStatus.driverMatchesWorktree) 'Software-only cleanup must preserve original fixture and must not claim a restore.';$checks++
 New-RecoveryPrivateDirectory $root | Out-Null
 # Positive deletion uses only authored local fixtures and a captured invocation.
 $attempt=Join-Path $root 'attempt-restore-1';New-Item -ItemType Directory -Path $attempt | Out-Null
 Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../../supabase/operations/recovery-guest-inside.sh') -Destination (Join-Path $attempt 'guest-inside.sh')
 [IO.File]::WriteAllText((Join-Path $root 'latest-restore.json'),'{"share":"attempt-restore-1"}')
 [IO.File]::WriteAllText((Join-Path $root 'vm-invocation-restore-1.json'),'{"mode":"restore","noNetworkDevice":true,"noPorts":true,"startedAt":"2000-01-01T00:00:00Z"}')
 $status=& $cleanup -VmRoot $root -Checkpoint $checkpoint -ManifestSha256 $manifestHash -KeySha256 $keyHash | ConvertFrom-Json
 Assert-GuardTest (-not (Test-Path -LiteralPath $root) -and $status.encryptedBackupPreserved -and $status.wrappedKeyPreserved -and -not $status.forensicEraseClaim) 'Authored cleanup must remove only exact staging and preserve original fixtures.';$checks++
 "PASS: $checks authored Windows guard checks; no actual backup, key, QEMU, network or restore used."
}finally{
 $env:LOCALAPPDATA=$oldLocalAppData
 # This exact fresh GUID root is authored by this test, never user recovery data.
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($fixture)) -ne [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) -or [IO.Path]::GetFileName($fixture) -notmatch '^mw-recovery-guards-[a-f0-9]{32}$'){throw 'Authored cleanup root refused.'}
 if(Test-Path -LiteralPath $fixture){Remove-Item -LiteralPath $fixture -Recurse -Force}
}
