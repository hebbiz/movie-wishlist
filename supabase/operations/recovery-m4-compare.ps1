# Supplemental OFFLINE comparison only: no VM, restore, export or SQL execution.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$VmRoot,[Parameter(Mandatory)][string]$Checkpoint,
 [Parameter(Mandatory)][string]$ManifestSha256,[Parameter(Mandatory)][string]$KeySha256,
 [Parameter(Mandatory)][string]$FullStatusName,[Parameter(Mandatory)][string]$FullStatusSha256)
$ErrorActionPreference='Stop'
. "$PSScriptRoot/recovery-local-guards.ps1"
$resolved=Assert-RecoveryVmRoot $VmRoot
$original=Assert-RecoveryCheckpoint $Checkpoint $ManifestSha256 $KeySha256
if($FullStatusName -cnotmatch '^restore-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.status\.json$' -or $FullStatusSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Explicit full verifier status and SHA256 required.'}
$fullStatus=Join-Path $original.Directory $FullStatusName
Assert-RecoveryLocalPrivatePath $fullStatus | Out-Null
foreach($suffix in @('-comparisons.aesgcm','-details.aesgcm')){
 # These are consumed now, not historical metadata: require current-user owner.
 Assert-RecoveryLocalPrivatePath ($fullStatus.Replace('.status.json',$suffix)) | Out-Null
}
if((Get-FileHash -LiteralPath $fullStatus).Hash.ToLowerInvariant() -cne $FullStatusSha256){throw 'Full verifier status pin mismatch.'}
$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($original.KeyPath),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=(Get-Command node.exe).Source
$start.UseShellExecute=$false;$start.CreateNoWindow=$true
$start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
$start.ArgumentList.Add((Join-Path $PSScriptRoot 'recovery-m4-compare-run.mjs'))
foreach($name in @($start.Environment.Keys)){
 if($name -like 'PG*' -or $name -in @('NODE_OPTIONS','NODE_DEBUG','NODE_PATH','NODE_V8_COVERAGE','SSLKEYLOGFILE')){$start.Environment.Remove($name)|Out-Null}
}
$p=[Diagnostics.Process]::new();$p.StartInfo=$start
try{
 $p.Start()|Out-Null
 $config=@{root=$resolved;directory=$original.Directory;checkpoint=$Checkpoint;fullStatusName=$FullStatusName;fullStatusSha256=$FullStatusSha256;keyBase64=[Convert]::ToBase64String($key)}
 $p.StandardInput.Write(($config|ConvertTo-Json -Compress));$p.StandardInput.Close();$config.Remove('keyBase64')
 $out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
 if(-not $p.WaitForExit(180000)){$p.Kill($true);$p.WaitForExit();throw 'Offline M4 comparison timeout.'}
 $err.GetAwaiter().GetResult()|Out-Null
 $out.GetAwaiter().GetResult()
 if($p.ExitCode -ne 0){throw 'M4 comparison failed or refused; no private errors printed.'}
}finally{[Array]::Clear($key,0,$key.Length);$p.Dispose()}
