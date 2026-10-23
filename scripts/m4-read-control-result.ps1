#Requires -Version 7.0
[CmdletBinding()]
param([switch]$Compact)

# Read ONLY the existing sanitized result in the same Windows/SSH token context.
# No credentials, source calls, runner invocation, files or ACL changes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$m4Pipe = $null
$m4Reader = $null
try {
    $m4Pipe = [IO.Pipes.NamedPipeClientStream]::new('.', 'mw-m4-controls-198', [IO.Pipes.PipeDirection]::In)
    $m4Pipe.Connect(3000)
    $m4Reader = [IO.StreamReader]::new($m4Pipe, [Text.UTF8Encoding]::new($false), $false, 4096, $true)
    $m4Buffer = [char[]]::new(4096)
    $m4Text = [Text.StringBuilder]::new()
    while (($m4Read = $m4Reader.Read($m4Buffer, 0, $m4Buffer.Length)) -gt 0) {
        if ($m4Text.Length + $m4Read -gt 131072) { throw 'size-limit' }
        [void]$m4Text.Append($m4Buffer, 0, $m4Read)
    }
    $m4Report = $m4Text.ToString() | ConvertFrom-Json -Depth 30
    if ($m4Report.localCheckoutSha -notmatch '^[a-f0-9]{40}$' -or $m4Report.result.execution -cne 'local-diagnostic' -or $m4Report.result.status -cne 'completed-controls-not-historical-reconstruction' -or $m4Report.result.counts.total -gt 12) { throw 'result-contract' }
    if ($m4Report.result.PSObject.Properties.Name -contains 'mode' -and $m4Report.result.mode -ceq 'url-diagnostic') {
        if ($m4Report.result.counts.total -gt 3 -or $m4Report.result.counts.tmdb -gt 2 -or $m4Report.result.counts.search -gt 1 -or $m4Report.result.counts.cards -ne 0 -or @($m4Report.result.cases).Count -ne 1 -or $m4Report.result.cases[0].film -cne 'Blade Runner 2049') { throw 'url-diagnostic-contract' }
    }
    if ($m4Report.result.PSObject.Properties.Name -contains 'mode' -and $m4Report.result.mode -ceq 'title-year-control') {
        if ($m4Report.result.counts.total -gt 6 -or $m4Report.result.counts.tmdb -gt 2 -or $m4Report.result.counts.search -gt 2 -or $m4Report.result.counts.cards -gt 2 -or @($m4Report.result.cases).Count -ne 1 -or $m4Report.result.cases[0].film -cne 'Blade Runner 2049' -or $m4Report.result.accounting.priorAttempts -ne 17 -or $m4Report.result.accounting.cumulativeMax -ne 23) { throw 'title-year-control-contract' }
    }
    # ASCII JSON escapes preserve Unicode aliases across legacy CMD/SSH code pages.
    $m4Report | ConvertTo-Json -Depth 30 -EscapeHandling EscapeNonAscii -Compress:$Compact
} catch {
    Write-Host 'Existing safe result unavailable/expired or access denied. Do NOT rerun source controls.'
    exit 1
} finally {
    if ($m4Reader) { $m4Reader.Dispose() }
    if ($m4Pipe) { $m4Pipe.Dispose() }
}
