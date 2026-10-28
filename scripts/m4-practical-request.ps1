#Requires -Version 7.0
[CmdletBinding(DefaultParameterSetName = 'Action')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'JSON')][string]$Operation,
    [Parameter(Mandatory = $true, ParameterSetName = 'Action')]
    [ValidateSet('identify','resolve','inspect-card','inspect-person','inspect-director','status','stop')][string]$Action,
    [Parameter(ParameterSetName = 'Action')][ValidateRange(1,5)][int]$Film,
    [Parameter(ParameterSetName = 'Action')][string]$SourceURL
)

# One local framed JSON request. No prompts, credentials, HTTP or worker execution.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$pipe = $null
$deadline = $null
$requestBytes = $null
$responseBytes = $null
$ackBytes = $null
$ackHeader = $null
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$phase = 'request-json'

function Read-M4RequestExact([IO.Stream]$Stream, [byte[]]$Bytes, [Threading.CancellationToken]$Token) {
    $offset = 0
    while ($offset -lt $Bytes.Length) {
        $read = $Stream.ReadAsync($Bytes, $offset, $Bytes.Length - $offset, $Token).GetAwaiter().GetResult()
        if ($read -eq 0) { throw 'incomplete-response' }
        $offset += $read
    }
}

try {
    if (-not $IsWindows) { throw 'windows-required' }
    if ($PSCmdlet.ParameterSetName -eq 'JSON') {
        $value = ConvertFrom-Json -InputObject $Operation -AsHashtable -Depth 10
    } else {
        $value = @{action=$Action.ToLowerInvariant()}
        if ($PSBoundParameters.ContainsKey('Film')) { $value.film=$Film }
        if ($PSBoundParameters.ContainsKey('SourceURL')) { $value.url=$SourceURL }
        if ($Action -notin @('status','stop') -and -not $value.Contains('film')) { throw 'film-required' }
        if (($Action -in @('inspect-card','inspect-person')) -ne $value.Contains('url')) { throw 'inspection-url-only' }
    }
    if ($value -isnot [Collections.IDictionary]) { throw 'operation-object-required' }
    $requestBytes = $utf8.GetBytes(($value | ConvertTo-Json -Depth 10 -Compress))
    if ($requestBytes.Length -gt 4096) { throw 'request-size' }
    $pipe = [IO.Pipes.NamedPipeClientStream]::new('.', 'mw-m4-practical-series-v1', [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
    $phase = 'connect'
    $pipe.Connect(5000)
    $deadline = [Threading.CancellationTokenSource]::new(135000)
    $header = [BitConverter]::GetBytes([int]$requestBytes.Length)
    $phase = 'write-frame'
    [void]$pipe.WriteAsync($header, 0, 4, $deadline.Token).GetAwaiter().GetResult()
    [void]$pipe.WriteAsync($requestBytes, 0, $requestBytes.Length, $deadline.Token).GetAwaiter().GetResult()
    [void]$pipe.FlushAsync($deadline.Token).GetAwaiter().GetResult()
    $phase = 'read-frame'
    Read-M4RequestExact $pipe $header $deadline.Token
    $length = [BitConverter]::ToInt32($header, 0)
    if ($length -lt 2 -or $length -gt 524288) { throw 'response-size' }
    $responseBytes = [byte[]]::new($length)
    Read-M4RequestExact $pipe $responseBytes $deadline.Token
    $phase = 'response-json'
    $report = ConvertFrom-Json -InputObject ($utf8.GetString($responseBytes)) -AsHashtable -Depth 40
    $phase = 'response-contract'
    if ($report -isnot [Collections.IDictionary] -or $report.execution -cne 'local-diagnostic' -or $report.Contains('context') -or $report.Contains('tmdbToken') -or $report.Contains('tavilyKey')) { throw 'response-contract' }
    $phase = 'acknowledge-response'
    $report.acknowledgementSent = $false
    try {
        $ackBytes = $utf8.GetBytes('{"received":true}')
        $ackHeader = [BitConverter]::GetBytes([int]$ackBytes.Length)
        [void]$pipe.WriteAsync($ackHeader, 0, 4, $deadline.Token).GetAwaiter().GetResult()
        [void]$pipe.WriteAsync($ackBytes, 0, $ackBytes.Length, $deadline.Token).GetAwaiter().GetResult()
        $report.acknowledgementSent = $true
    } catch {
        # The complete guarded response was already received. Preserve its
        # known counts/result even if sending the receipt fails; never retry.
    }
    # ASCII JSON preserves Ukrainian text through legacy CMD/SSH code pages.
    $report | ConvertTo-Json -Depth 40 -Compress -EscapeHandling EscapeNonAscii
} catch {
    $errorObject = $_.Exception.GetBaseException()
    @{ execution = 'local-diagnostic'; status = 'local-request-unavailable-or-invalid'; sourceRetry = $false;
        phase=$phase; exceptionType=$errorObject.GetType().FullName; hresult=$errorObject.HResult } | ConvertTo-Json -Compress
    exit 1
} finally {
    if ($requestBytes) { [Array]::Clear($requestBytes) }
    if ($responseBytes) { [Array]::Clear($responseBytes) }
    if ($ackBytes) { [Array]::Clear($ackBytes) }
    if ($ackHeader) { [Array]::Clear($ackHeader) }
    if ($deadline) { $deadline.Dispose() }
    if ($pipe) { $pipe.Dispose() }
}
