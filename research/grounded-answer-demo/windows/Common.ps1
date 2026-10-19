Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:DemoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$script:ServerPath = Join-Path $script:DemoRoot 'server.mjs'
$script:StateDirectory = Join-Path $script:DemoRoot '.run'
$script:StatePath = Join-Path $script:StateDirectory 'instance.json'

function Enter-DemoLock {
    $bytes = [Text.Encoding]::UTF8.GetBytes($script:DemoRoot.ToLowerInvariant() + [Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $name = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '') } finally { $sha.Dispose() }
    $mutex = [Threading.Mutex]::new($false, "Global\MWGroundedDemo-$name")
    $held = $false
    try { $held = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { $mutex.Dispose(); throw 'Another demo command is running. Retry after it finishes.' }
    return $mutex
}

function Read-DemoState {
    if (-not (Test-Path -LiteralPath $script:StatePath)) { return $null }
    return (Get-Content -LiteralPath $script:StatePath -Raw | ConvertFrom-Json)
}

function Get-OwnedDemoProcess($state) {
    if (-not $state) { return $null }
    if ($state.server -cne $script:ServerPath -or $state.command -cne ('"{0}" "{1}" --demo-instance={2}' -f $state.executable, $script:ServerPath, $state.instance)) { throw 'PID metadata identity mismatch. No process will be touched.' }
    try { $process = [Diagnostics.Process]::GetProcessById([int]$state.pid) } catch [ArgumentException] { return $null }
    try {
        # Acquire the handle before checks/kill; do not kill by a subsequently reused PID.
        $null = $process.Handle
        $info = Get-CimInstance Win32_Process -Filter "ProcessId=$($process.Id)"
        if (-not $info -or $info.CommandLine -cne $state.command -or
            -not [string]::Equals($info.ExecutablePath, $state.executable, [StringComparison]::OrdinalIgnoreCase) -or
            $process.StartTime.ToUniversalTime().Ticks.ToString() -cne $state.startTicks) {
            throw 'Process does not match this demo metadata. Refusing to stop or replace it.'
        }
        return $process
    } catch { $process.Dispose(); throw }
}

function Get-DemoHttpStatus([string]$url, [string]$password = '') {
    Add-Type -AssemblyName System.Net.Http
    $handler = [Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $handler.AllowAutoRedirect = $false
    $client = [Net.Http.HttpClient]::new($handler)
    $client.Timeout = [TimeSpan]::FromSeconds(2)
    try {
        if ($password) {
            $basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("demo:$password"))
            $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', $basic)
        }
        $response = $client.GetAsync($url, [Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
        try { return [int]$response.StatusCode } finally { $response.Dispose() }
    } catch { return 0 } finally { $client.Dispose(); $handler.Dispose() }
}
