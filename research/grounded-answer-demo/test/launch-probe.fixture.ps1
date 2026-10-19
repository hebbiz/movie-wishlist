param([string]$DemoRoot, [int]$Port, [ValidateSet('search','url-context')][string]$Retrieval)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
$env:DEMO_FILM = 'coherence'
$env:DEMO_RETRIEVAL = $Retrieval
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
Remove-Item Env:DEMO_SYNTHETIC_SCENARIO -ErrorAction SilentlyContinue
Remove-Item Env:GEMINI_API_KEY -ErrorAction SilentlyContinue
Add-Type -Path (Join-Path $PSScriptRoot 'JobProbe.cs')
$job = [DemoJobProbe]::Read()
$nodeCandidates = @(Get-Command node.exe -CommandType Application).Count
$stage = 'InvokeStartHelper'
try {
    # Discard only helper status strings, never capture/print environment or answers.
    $null = & (Join-Path $DemoRoot 'windows/Start-Demo.ps1') -Port $Port
    $stage = 'VerifySyntheticSession'
    $session = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/session" -NoProxy
    if ($session.mode -ne 'synthetic' -or $session.discovery -ne 'digital-ua' -or $session.film.id -ne 'coherence') { throw 'Unexpected session configuration.' }
    $selected = if ($session.PSObject.Properties['retrieval']) { $session.retrieval } else { 'search' }
    if ($selected -ne $Retrieval) { throw 'Unexpected retrieval mode.' }
    # Only synthetic /answer, no provider transport. Never print its content.
    $result = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/answer" -Method Post -Headers @{ Origin="http://127.0.0.1:$Port"; 'x-demo-session'=$session.token } -NoProxy
    if ($result.mode -ne 'synthetic') { throw 'Expected synthetic response.' }
    [ordered]@{ outcome='started-synthetic'; stage='SyntheticAnswer'; NativeErrorCode=$null; ExceptionType=$null; nodeCandidates=$nodeCandidates; job=$job } | ConvertTo-Json -Depth 4 -Compress
} catch {
    $failure = $_.Exception
    $leaf = $failure
    while ($leaf.InnerException) { $leaf = $leaf.InnerException }
    $nativeCode = $null
    if ($leaf -is [ComponentModel.Win32Exception]) { $nativeCode = $leaf.NativeErrorCode }
    elseif ($leaf.PSObject.Properties['NativeErrorCode']) { $nativeCode = $leaf.NativeErrorCode }
    $failureType = if ($leaf.PSObject.Properties['FailureType']) { $leaf.FailureType } else { $leaf.GetType().FullName }
    $failureStage = if ($leaf.PSObject.Properties['Stage']) { $leaf.Stage } else { $stage }
    [ordered]@{ outcome='failed'; stage=$failureStage; NativeErrorCode=$nativeCode; ExceptionType=$failureType; WrapperType=$failure.GetType().FullName; nodeCandidates=$nodeCandidates; job=$job } | ConvertTo-Json -Depth 4 -Compress
} finally {
    # Only this temporary copy's identity-verified state is ever stopped.
    if (Test-Path -LiteralPath (Join-Path $DemoRoot '.run/instance.json')) { $null = & (Join-Path $DemoRoot 'windows/Stop-Demo.ps1') }
}
