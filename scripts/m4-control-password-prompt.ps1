#Requires -Version 7.0
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedCommit,
    [switch]$CheckPrerequisites,
    [switch]$UrlDiagnostic,
    [switch]$TitleYearControl
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot 'm4-control-diagnostic.mjs'
$nodePath = 'C:\Program Files\nodejs\node.exe'
$pipeName = 'mw-m4-controls-198'
$pipe = $null
$child = $null
$childStarted = $false
$secureTmdb = $null
$secureTavily = $null
$tmdbText = $null
$tavilyText = $null
$payload = $null
$resultText = $null
$reportText = $null
$phase = 'preflight'

function Get-TransientPlainText([Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

try {
    if ($UrlDiagnostic -and $TitleYearControl) { throw 'incompatible-control-modes' }
    if (-not $IsWindows -or -not (Test-Path -LiteralPath $nodePath -PathType Leaf) -or -not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) { throw 'prerequisites' }
    $actualCommit = & git -C $repoPath rev-parse HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or $actualCommit -cne $ExpectedCommit) { throw 'checkout' }
    & git -C $repoPath diff --quiet HEAD -- 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'tracked-changes' }
    # File metadata only: even the preflight must not execute inherited Node preload hooks.
    if ([Diagnostics.FileVersionInfo]::GetVersionInfo($nodePath).ProductMajorPart -lt 22) { throw 'node-version' }
    if ($CheckPrerequisites) { Write-Host 'Pinned checkout and Node prerequisites verified; zero source requests.'; exit 0 }
    if ([Console]::IsInputRedirected) { throw 'interactive-console-required' }
    # One current-user-only, local IPC receiver. No TCP listener, files or result archive.
    # Creating it before prompts prevents a concurrent copy of this helper from dispatching.
    $options = [IO.Pipes.PipeOptions]::Asynchronous -bor [IO.Pipes.PipeOptions]::CurrentUserOnly
    $pipe = [IO.Pipes.NamedPipeServerStream]::new($pipeName, [IO.Pipes.PipeDirection]::Out, 1, [IO.Pipes.PipeTransmissionMode]::Byte, $options)
    if ($UrlDiagnostic) { Write-Host 'ONE URL-diagnostic run: Blade Runner 2049 only; TMDb<=2 + Tavily<=1; card GET=0; max3 attempts (prior14 separate).' }
    elseif ($TitleYearControl) { Write-Host 'ONE title/year control: Blade Runner 2049 only; TMDb<=2 + Tavily<=2 + card GET<=2; max6 attempts (prior17 separate; cumulative max23).' }
    else { Write-Host 'Two hidden inputs; then ONE run: Blade Runner 2049 and Mortal Kombat (2021), max 12 source attempts.' }
    Write-Host 'Do not use a transcript/recorded terminal. Do not repeat after an interrupted or uncertain run.'
    $secureTmdb = Read-Host 'TMDB_READ_ACCESS_TOKEN (hidden)' -AsSecureString
    if ($secureTmdb.Length -eq 0 -or $secureTmdb.Length -gt 4096) { throw 'input' }
    $secureTavily = Read-Host 'TAVILY_API_KEY (hidden)' -AsSecureString
    if ($secureTavily.Length -eq 0 -or $secureTavily.Length -gt 4096) { throw 'input' }
    $tmdbText = Get-TransientPlainText $secureTmdb
    $tavilyText = Get-TransientPlainText $secureTavily
    if ($tmdbText -match '\s' -or $tavilyText -match '\s') { throw 'input' }
    $payload = @{ tmdbToken = $tmdbText; tavilyKey = $tavilyText } | ConvertTo-Json -Compress
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $nodePath
    $start.WorkingDirectory = $repoPath
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardInput = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardOutputEncoding = [Text.UTF8Encoding]::new($false)
    $start.StandardErrorEncoding = [Text.UTF8Encoding]::new($false)
    $start.ArgumentList.Add($runnerPath)
    $start.ArgumentList.Add('--live-control')
    $start.ArgumentList.Add('--credentials-stdin')
    if ($UrlDiagnostic) { $start.ArgumentList.Add('--url-diagnostic') }
    if ($TitleYearControl) { $start.ArgumentList.Add('--title-year-control') }
    # No inherited source credentials, Node preload/debug hooks or TLS bypass.
    foreach ($name in @('TMDB_READ_ACCESS_TOKEN','TAVILY_API_KEY','NODE_OPTIONS','NODE_PATH','NODE_INSPECT_RESUME_ON_START','NODE_EXTRA_CA_CERTS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_V8_COVERAGE','SSLKEYLOGFILE')) { [void]$start.Environment.Remove($name) }
    $child = [Diagnostics.Process]::new()
    $child.StartInfo = $start
    $phase = 'run'
    if (-not $child.Start()) { throw 'child-start' }
    $childStarted = $true
    $stdoutTask = $child.StandardOutput.ReadToEndAsync()
    $stderrTask = $child.StandardError.ReadToEndAsync()
    $child.StandardInput.Write($payload)
    $child.StandardInput.Close()
    $payload = $null
    Write-Host 'Running the approved diagnostic; no automatic retries.'
    if (-not $child.WaitForExit(120000)) { $child.Kill($true); throw 'child-timeout' }
    $resultText = $stdoutTask.GetAwaiter().GetResult()
    # Never print child stderr/exception messages; they are not a safe report channel.
    $discardedError = $stderrTask.GetAwaiter().GetResult()
    $discardedError = $null
    if ($child.ExitCode -ne 0 -or $resultText.Length -gt 131072 -or $resultText.Contains($tmdbText) -or $resultText.Contains($tavilyText)) { throw 'unsafe-or-failed-child' }
    $result = $resultText | ConvertFrom-Json -Depth 30
    if ($result.execution -cne 'local-diagnostic' -or $result.status -cne 'completed-controls-not-historical-reconstruction' -or $result.runId -notmatch '^[a-f0-9-]{36}$' -or $result.counts.total -gt 12) { throw 'result-contract' }
    if ($UrlDiagnostic -and ($result.mode -cne 'url-diagnostic' -or $result.counts.total -gt 3 -or $result.counts.tmdb -gt 2 -or $result.counts.search -gt 1 -or $result.counts.cards -ne 0 -or @($result.cases).Count -ne 1 -or $result.cases[0].film -cne 'Blade Runner 2049')) { throw 'url-diagnostic-contract' }
    if ($TitleYearControl -and ($result.mode -cne 'title-year-control' -or $result.counts.total -gt 6 -or $result.counts.tmdb -gt 2 -or $result.counts.search -gt 2 -or $result.counts.cards -gt 2 -or @($result.cases).Count -ne 1 -or $result.cases[0].film -cne 'Blade Runner 2049' -or $result.accounting.priorAttempts -ne 17 -or $result.accounting.cumulativeMax -ne 23)) { throw 'title-year-control-contract' }
    # Checkout is local provenance, NEVER deployed-runtime SHA attestation.
    $reportText = @{ localCheckoutSha = $ExpectedCommit; result = $result } | ConvertTo-Json -Depth 30 -Compress
    $result = $null
    $resultText = $null
    $tmdbText = $null
    $tavilyText = $null
    $secureTmdb.Dispose(); $secureTmdb = $null
    $secureTavily.Dispose(); $secureTavily = $null
    $child.Dispose(); $child = $null
    $phase = 'handoff'
    Write-Host 'Controls completed. Safe diagnostics held in memory for Codex (up to 15 minutes).'
    Write-Host 'Leave this window open and tell Codex: local prompt completed. Do not rerun.'
    $deadline = [Threading.CancellationTokenSource]::new([TimeSpan]::FromMinutes(15))
    $reportBytes = [Text.UTF8Encoding]::new($false).GetBytes($reportText)
    try {
        $pipe.WaitForConnectionAsync($deadline.Token).GetAwaiter().GetResult()
        $pipe.WriteAsync($reportBytes, 0, $reportBytes.Length, $deadline.Token).GetAwaiter().GetResult()
        $pipe.FlushAsync($deadline.Token).GetAwaiter().GetResult()
    } finally { [Array]::Clear($reportBytes); $deadline.Dispose() }
    Write-Host 'Safe diagnostics handed to Codex; no credential or report file created.'
} catch {
    if ($phase -eq 'preflight') { Write-Host 'Stopped before source dispatch: prerequisites, checkout or hidden input failed. No credential handoff saved.' }
    elseif ($phase -eq 'handoff') { Write-Host 'Controls already completed, but local result handoff expired/failed. Do NOT rerun; tell Codex.' }
    else { Write-Host 'Control run failed/interrupted; source attempts may have been spent. Do NOT rerun; tell Codex. No credential handoff saved.' }
    exit 1
} finally {
    if ($child) { if ($childStarted -and -not $child.HasExited) { $child.Kill($true) }; $child.Dispose() }
    if ($pipe) { $pipe.Dispose() }
    if ($secureTmdb) { $secureTmdb.Dispose() }
    if ($secureTavily) { $secureTavily.Dispose() }
    $payload = $null; $tmdbText = $null; $tavilyText = $null; $resultText = $null; $reportText = $null
    # Managed strings cannot promise perfect memory zeroization; process termination
    # ends their lifetime. No DPAPI blob, environment assignment, clipboard or file.
}
