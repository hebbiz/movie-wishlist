# Offline audit only; never connects to Postgres. Key is supplied over child stdin.
[CmdletBinding()]
param([Parameter(Mandatory)][string]$Checkpoint)
$ErrorActionPreference='Stop'
if ($Checkpoint -cnotmatch '^checkpoint-\d{8}T\d{6}Z-[a-f0-9]{8}$') { throw 'Invalid checkpoint name.' }
$directory=Join-Path $env:LOCALAPPDATA "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$Checkpoint"
$keyFile=Join-Path $env:LOCALAPPDATA "MovieWishlist/RecoveryKeys/$Checkpoint.key.dpapi"
$key=[Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($keyFile),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$start=[Diagnostics.ProcessStartInfo]::new()
$start.FileName=(Get-Command node.exe).Source
$start.UseShellExecute=$false
$start.CreateNoWindow=$true
$start.RedirectStandardInput=$true
$start.RedirectStandardOutput=$true
$start.RedirectStandardError=$true
$start.ArgumentList.Add((Join-Path $PSScriptRoot 'recovery-audit.mjs'))
foreach($name in @($start.Environment.Keys)){ if($name -like 'PG*'){ $start.Environment.Remove($name) | Out-Null } }
$p=[Diagnostics.Process]::new();$p.StartInfo=$start
try {
    $p.Start() | Out-Null
    $config=@{directory=$directory;keyBase64=[Convert]::ToBase64String($key);bin=(Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/pgsql/bin')}
    $p.StandardInput.Write(($config | ConvertTo-Json -Compress));$p.StandardInput.Close();$config.Remove('keyBase64')
    $out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
    if(-not $p.WaitForExit(60000)){$p.Kill($true);$p.WaitForExit();throw 'Offline audit timeout.'}
    $err.GetAwaiter().GetResult() | Out-Null
    if($p.ExitCode -ne 0){throw 'Offline audit failed; no decrypted content output.'}
    $out.GetAwaiter().GetResult()
} finally { [Array]::Clear($key,0,$key.Length);$p.Dispose() }
