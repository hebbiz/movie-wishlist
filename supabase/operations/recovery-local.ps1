# Existing backup only. No remote connection or password prompt. Private key on stdin.
[CmdletBinding()]
param([Parameter(Mandatory)][ValidateSet('stage','verify')][string]$Mode,[Parameter(Mandatory)][string]$VmRoot,
 [Parameter(Mandatory)][string]$Checkpoint,[Parameter(Mandatory)][string]$ManifestSha256,
 [Parameter(Mandatory)][string]$KeySha256)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/recovery-local-guards.ps1"
$resolved=Assert-RecoveryVmRoot $VmRoot
$original=Assert-RecoveryCheckpoint $Checkpoint $ManifestSha256 $KeySha256
$keyPath=$original.KeyPath
$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=(Get-Command node.exe).Source
$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
$start.ArgumentList.Add((Join-Path $PSScriptRoot 'recovery-local.mjs'))
foreach($name in @($start.Environment.Keys)){if($name -like 'PG*'){$start.Environment.Remove($name)|Out-Null}}
$p=[Diagnostics.Process]::new();$p.StartInfo=$start
try{
 $p.Start()|Out-Null
 $config=@{mode=$Mode;root=$resolved;directory=$original.Directory;keyBase64=[Convert]::ToBase64String($key);bin=(Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/pgsql/bin')}
 $p.StandardInput.Write(($config|ConvertTo-Json -Compress));$p.StandardInput.Close();$config.Remove('keyBase64')
 $out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
 if(-not $p.WaitForExit(180000)){$p.Kill($true);$p.WaitForExit();throw 'Private local operation timeout'}
 $err.GetAwaiter().GetResult()|Out-Null
 $out.GetAwaiter().GetResult()
 if($p.ExitCode -ne 0){throw 'Local operation failed; detailed evidence private'}
}finally{[Array]::Clear($key,0,$key.Length);$p.Dispose()}
