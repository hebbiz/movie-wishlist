# Node entrypoint's Windows path/ACL check, before any guest input or QEMU start.
param([Parameter(Mandatory)][string]$VmRoot,[switch]$SoftwareOnly)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/recovery-local-guards.ps1"
Assert-RecoveryVmRoot $VmRoot | Out-Null
if($SoftwareOnly){Assert-RecoveryPublicSoftwareOnly $VmRoot}
'PRIVATE_STOPPED_VM_ROOT_VERIFIED'
