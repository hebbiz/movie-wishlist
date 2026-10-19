. (Join-Path $PSScriptRoot 'Common.ps1')
$lock = Enter-DemoLock
try {
    $state = Read-DemoState
    $process = Get-OwnedDemoProcess $state
    if ($process) {
        try { $process.Kill(); if (-not $process.WaitForExit(5000)) { throw 'Process has not exited; metadata retained for review.' } } finally { $process.Dispose() }
    }
    if ($state) { Remove-Item -LiteralPath $script:StatePath }
    Write-Output 'Demo stopped. Only this copy''s verified process/metadata was targeted.'
} finally { $lock.ReleaseMutex(); $lock.Dispose() }
