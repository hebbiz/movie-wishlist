# Offline evidence only. Never connects to a database or prints decrypted bodies.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Checkpoint,[switch]$Native)
$ErrorActionPreference='Stop'
if ($Checkpoint -cnotmatch '^checkpoint-\d{8}T\d{6}Z-[a-f0-9]{8}$') { throw 'Invalid checkpoint name.' }
$directory=Join-Path $env:LOCALAPPDATA "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$Checkpoint"
$keyFile=Join-Path $env:LOCALAPPDATA "MovieWishlist/RecoveryKeys/$Checkpoint.key.dpapi"
$localRoot=$null
if($Native){
    . (Join-Path $PSScriptRoot 'recovery-password-prompt.ps1')
    $localRoot=New-RecoveryPrivateDirectory (Join-Path $env:LOCALAPPDATA ('MovieWishlist/RestoreTests/focus-'+[Guid]::NewGuid().ToString('N')))
}
$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=(Get-Command node.exe).Source
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$start.RedirectStandardInput=$true
$start.RedirectStandardOutput=$true
$start.RedirectStandardError=$true
$start.ArgumentList.Add((Join-Path $PSScriptRoot 'recovery-focus.mjs'))
foreach($name in @($start.Environment.Keys)){ if($name -like 'PG*'){ $start.Environment.Remove($name) | Out-Null } }
$p=[Diagnostics.Process]::new();$p.StartInfo=$start
try {
    $p.Start() | Out-Null
    $config=@{directory=$directory;keyBase64=[Convert]::ToBase64String($key);bin=(Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/pgsql/bin')}
    if($Native){$config.localRoot=$localRoot}
    $p.StandardInput.Write(($config | ConvertTo-Json -Compress));$p.StandardInput.Close();$config.Remove('keyBase64')
    $out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
    if(-not $p.WaitForExit(240000)){$p.Kill($true);$p.WaitForExit();throw 'Offline focus timeout; inspect the private local cluster before cleanup.'}
    $err.GetAwaiter().GetResult() | Out-Null
    $out.GetAwaiter().GetResult()
    if($p.ExitCode -ne 0){throw 'Offline focus failed; no decrypted content output.'}
} finally {
    [Array]::Clear($key,0,$key.Length);$p.Dispose()
    if($localRoot){
        $expectedParent=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'MovieWishlist/RestoreTests'))
        $resolved=[IO.Path]::GetFullPath($localRoot)
        if([IO.Path]::GetDirectoryName($resolved) -ne $expectedParent -or [IO.Path]::GetFileName($resolved) -cnotmatch '^focus-[a-f0-9]{32}$'){throw 'Cleanup target refused.'}
        if(Test-Path -LiteralPath (Join-Path $resolved 'data/postmaster.pid')){throw 'Local PG may still be running; temporary directory retained privately.'}
        if((Get-Item -LiteralPath $resolved -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Cleanup reparse point refused.'}
        Remove-Item -LiteralPath $resolved -Recurse -Force
        if(Test-Path -LiteralPath $resolved){throw 'Temporary environment cleanup incomplete.'}
        Write-Output 'FOCUSED_TEMPORARY_CLUSTER_REMOVED'
    }
}
