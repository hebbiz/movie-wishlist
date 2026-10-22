# Existing backup only. No remote connection or password prompt. Private key on stdin.
[CmdletBinding()]
param([ValidateSet('stage','verify')][string]$Mode,[Parameter(Mandatory)][string]$VmRoot,
 [string]$Checkpoint='checkpoint-20261021T221351Z-432dc0a6')
$ErrorActionPreference='Stop'
if($Checkpoint -cnotmatch '^checkpoint-\d{8}T\d{6}Z-[a-f0-9]{8}$'){throw 'Invalid checkpoint'}
$expectedParent=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'MovieWishlist/RestoreTests'))
$resolved=[IO.Path]::GetFullPath($VmRoot)
if([IO.Path]::GetDirectoryName($resolved) -ne $expectedParent -or [IO.Path]::GetFileName($resolved) -cnotmatch '^restore-\d{8}-qemu-[a-f0-9]{8}$'){throw 'Invalid private test path'}
$keyPath=Join-Path $env:LOCALAPPDATA "MovieWishlist/RecoveryKeys/$Checkpoint.key.dpapi"
$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=(Get-Command node.exe).Source
$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
$start.ArgumentList.Add((Join-Path $PSScriptRoot 'recovery-local.mjs'))
foreach($name in @($start.Environment.Keys)){if($name -like 'PG*'){$start.Environment.Remove($name)|Out-Null}}
$p=[Diagnostics.Process]::new();$p.StartInfo=$start
try{
 $p.Start()|Out-Null
 $config=@{mode=$Mode;root=$resolved;directory=(Join-Path $env:LOCALAPPDATA "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$Checkpoint");keyBase64=[Convert]::ToBase64String($key);bin=(Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/pgsql/bin')}
 $p.StandardInput.Write(($config|ConvertTo-Json -Compress));$p.StandardInput.Close();$config.Remove('keyBase64')
 $out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
 if(-not $p.WaitForExit(180000)){$p.Kill($true);$p.WaitForExit();throw 'Private local operation timeout'}
 $err.GetAwaiter().GetResult()|Out-Null
 $out.GetAwaiter().GetResult()
 if($p.ExitCode -ne 0){throw 'Local operation failed; detailed evidence private'}
}finally{[Array]::Clear($key,0,$key.Length);$p.Dispose()}
