# Native PG17, authored empty local cluster only. No production connection/credentials.
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/../supabase/operations/recovery-password-prompt.ps1"
$bin = Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/pgsql/bin'
$fixture = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('mw-recovery-native-' + [Guid]::NewGuid().ToString('N'))))
$data = Join-Path $fixture 'data'
$started = $false
$created = $false
function Invoke-LocalPgControl([string[]]$Arguments) {
    # PowerShell's native pipeline can wait for PostgreSQL's long-lived descendants.
    # Wait only for pg_ctl itself, with a bound; -l directs server output to the fixture.
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = Join-Path $bin 'pg_ctl.exe'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    foreach ($arg in $Arguments) { $start.ArgumentList.Add($arg) }
    $p = [Diagnostics.Process]::Start($start)
    try {
        if (-not $p.WaitForExit(20000)) { throw 'Local pg_ctl timed out.' }
        if ($p.ExitCode -ne 0) { throw 'Local pg_ctl failed.' }
    } finally { $p.Dispose() }
}
function Invoke-LocalRecoveryPsql([string]$Sql) {
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = Join-Path $bin 'psql.exe'
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($key in @($start.Environment.Keys)) { if ($key -like 'PG*') { $start.Environment.Remove($key) | Out-Null } }
    foreach ($arg in @('-X','-w','-q','-A','-t','-v','ON_ERROR_STOP=1','-d',
        "host=127.0.0.1 port=$port dbname=postgres user=postgres sslmode=disable connect_timeout=5 options='-c default_transaction_read_only=off'",'-c',$Sql)) {
        $start.ArgumentList.Add($arg)
    }
    $p = [Diagnostics.Process]::new()
    $p.StartInfo = $start
    try {
        $p.Start() | Out-Null
        $outputTask = $p.StandardOutput.ReadToEndAsync()
        $errorTask = $p.StandardError.ReadToEndAsync()
        if (-not $p.WaitForExit(10000)) { $p.Kill($true); $p.WaitForExit(); throw 'Local fixture query timeout.' }
        if ($p.ExitCode -ne 0) { throw 'Local fixture query failed.' }
        $errorTask.GetAwaiter().GetResult() | Out-Null
        return $outputTask.GetAwaiter().GetResult().Trim()
    } finally { $p.Dispose() }
}
try {
    New-RecoveryPrivateDirectory $fixture | Out-Null
    $created = $true
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start()
    $port = $listener.LocalEndpoint.Port
    $listener.Stop()
    & (Join-Path $bin 'initdb.exe') -D $data -U postgres -A trust --encoding=UTF8 --locale=C *> (Join-Path $fixture 'init.log')
    if ($LASTEXITCODE -ne 0) { throw 'Local fixture init failed.' }
    Invoke-LocalPgControl @('-D',$data,'-l',(Join-Path $fixture 'server.log'),'-o',"-h 127.0.0.1 -p $port -c max_connections=10",'-w','-t','15','start')
    $started = $true
    $oldSql = "SELECT json_build_object('database',current_database(),'user',session_user,'version_num',current_setting('server_version_num'),'read_only',current_setting('transaction_read_only'))::text"
    $oldOutput = Invoke-LocalRecoveryPsql $oldSql
    $reason = ''
    try { ConvertFrom-RecoveryAccessCheck $oldOutput | Out-Null } catch { $reason = $_.Exception.Message }
    if ($reason -notmatch 'transaction-not-read-only') { throw 'Expected original implicit-transaction refusal was not reproduced.' }
    $newOutput = Invoke-LocalRecoveryPsql (Get-RecoveryAccessCheckSql)
    $check = ConvertFrom-RecoveryAccessCheck $newOutput
    if (-not $check.readOnly) { throw 'Explicit read-only transaction not verified.' }
    'PASS: native PostgreSQL17 reproduces implicit read-write default refusal; explicit read-only transaction passes unchanged database/role/major gates. No production connection.'
} finally {
    $stopped = -not $started
    if ($started) {
        Invoke-LocalPgControl @('-D',$data,'-m','fast','-w','-t','15','stop')
        $stopped = $true
    }
    # Only this freshly created, private, empty authored cluster; never user data.
    $parent = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/')
    if ($created -and $stopped -and [IO.Path]::GetDirectoryName($fixture).TrimEnd('\','/') -eq $parent -and
        [IO.Path]::GetFileName($fixture) -cmatch '^mw-recovery-native-[a-f0-9]{32}$') {
        Remove-Item -LiteralPath $fixture -Recurse -Force
    }
}
