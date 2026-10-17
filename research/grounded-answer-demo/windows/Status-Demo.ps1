. (Join-Path $PSScriptRoot 'Common.ps1')
$lock = Enter-DemoLock
try {
    $state = Read-DemoState
    $process = Get-OwnedDemoProcess $state
    if (-not $process) { Write-Output 'Stopped (or stale metadata; next start can clear an exited PID).'; return }
    try {
        $http = Get-DemoHttpStatus $state.url
        Write-Output "Running PID $($process.Id). URL: $($state.url). HTTP: $http (401 is expected in LAN mode)."
    } finally { $process.Dispose() }
} finally { $lock.ReleaseMutex(); $lock.Dispose() }
