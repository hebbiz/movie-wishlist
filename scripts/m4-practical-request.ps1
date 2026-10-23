#Requires -Version 7.0
[CmdletBinding()]
param([string]$Operation)

# One local framed JSON request. No prompts, credentials, HTTP or worker execution.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$pipe = $null
$deadline = $null
$requestBytes = $null
$responseBytes = $null
$utf8 = [Text.UTF8Encoding]::new($false, $true)

function Read-M4RequestExact([IO.Stream]$Stream, [byte[]]$Bytes, [Threading.CancellationToken]$Token) {
    $offset = 0
    while ($offset -lt $Bytes.Length) {
        $read = $Stream.ReadAsync($Bytes, $offset, $Bytes.Length - $offset, $Token).GetAwaiter().GetResult()
        if ($read -eq 0) { throw 'incomplete-response' }
        $offset += $read
    }
}

try {
    if (-not $IsWindows -or [string]::IsNullOrWhiteSpace($Operation)) { throw 'operation-required' }
    $value = ConvertFrom-Json -InputObject $Operation -AsHashtable -Depth 10
    if ($value -isnot [Collections.IDictionary]) { throw 'operation-object-required' }
    $requestBytes = $utf8.GetBytes(($value | ConvertTo-Json -Depth 10 -Compress))
    if ($requestBytes.Length -gt 4096) { throw 'request-size' }
    $pipe = [IO.Pipes.NamedPipeClientStream]::new('.', 'mw-m4-practical-series-v1', [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
    $pipe.Connect(5000)
    $deadline = [Threading.CancellationTokenSource]::new(135000)
    $header = [BitConverter]::GetBytes([int]$requestBytes.Length)
    [void]$pipe.WriteAsync($header, 0, 4, $deadline.Token).GetAwaiter().GetResult()
    [void]$pipe.WriteAsync($requestBytes, 0, $requestBytes.Length, $deadline.Token).GetAwaiter().GetResult()
    [void]$pipe.FlushAsync($deadline.Token).GetAwaiter().GetResult()
    Read-M4RequestExact $pipe $header $deadline.Token
    $length = [BitConverter]::ToInt32($header, 0)
    if ($length -lt 2 -or $length -gt 524288) { throw 'response-size' }
    $responseBytes = [byte[]]::new($length)
    Read-M4RequestExact $pipe $responseBytes $deadline.Token
    $report = ConvertFrom-Json -InputObject ($utf8.GetString($responseBytes)) -AsHashtable -Depth 40
    if ($report -isnot [Collections.IDictionary] -or $report.execution -cne 'local-diagnostic' -or $report.Contains('context') -or $report.Contains('tmdbToken') -or $report.Contains('tavilyKey')) { throw 'response-contract' }
    # ASCII JSON preserves Ukrainian text through legacy CMD/SSH code pages.
    $report | ConvertTo-Json -Depth 40 -Compress -EscapeHandling EscapeNonAscii
} catch {
    @{ execution = 'local-diagnostic'; status = 'local-request-unavailable-or-invalid'; sourceRetry = $false } | ConvertTo-Json -Compress
    exit 1
} finally {
    if ($requestBytes) { [Array]::Clear($requestBytes) }
    if ($responseBytes) { [Array]::Clear($responseBytes) }
    if ($deadline) { $deadline.Dispose() }
    if ($pipe) { $pipe.Dispose() }
}
