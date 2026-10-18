[CmdletBinding()]
param(
    [ValidateSet('localhost', 'lan')][string]$Access = 'localhost',
    [string]$BindIPv4,
    [ValidateRange(1024, 65535)][int]$Port = 4317,
    [Security.SecureString]$LanPassword,
    [Security.SecureString]$ApiKey
)
. (Join-Path $PSScriptRoot 'Common.ps1')
$lock = Enter-DemoLock
$process = $null
$plainPassword = ''
$plainKey = ''
try {
    $old = Read-DemoState
    $existing = Get-OwnedDemoProcess $old
    if ($existing) {
        try { Write-Output "Already running: PID $($existing.Id), $($old.url). Stop before changing scenarios." } finally { $existing.Dispose() }
        return
    }
    if ($old) { Remove-Item -LiteralPath $script:StatePath }
    if ($Access -eq 'lan') {
        $parsed = $null
        if (-not [Net.IPAddress]::TryParse($BindIPv4, [ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork -or $parsed.ToString() -cne $BindIPv4) { throw 'Supply the actual Windows private LAN IPv4 with -BindIPv4.' }
        if (-not $LanPassword) { $LanPassword = Read-Host 'LAN Basic Auth password (username: demo; trusted home HTTP only)' -AsSecureString }
        $plainPassword = [Net.NetworkCredential]::new('', $LanPassword).Password
        if (-not $plainPassword.Trim()) { throw 'LAN password is required.' }
    } elseif ($BindIPv4) { throw 'Do not set -BindIPv4 in localhost mode.' }
    $mode = if ($env:DEMO_MODE) { $env:DEMO_MODE } else { 'synthetic' }
    $needsMotn = $mode -eq 'live' -and $env:DEMO_RETRIEVAL -eq 'motn-api'
    $needsTmdb = $mode -eq 'live' -and $env:DEMO_RETRIEVAL -eq 'tmdb-data'
    $needsGemini = $mode -eq 'live' -and $env:DEMO_RETRIEVAL -notin @('kinobaza-html', 'motn-api', 'tmdb-data')
    if ($needsGemini -or $needsMotn -or $needsTmdb) {
        $keyName = if ($needsTmdb) { 'TMDB_READ_ACCESS_TOKEN' } elseif ($needsMotn) { 'MOTN_API_KEY' } else { 'GEMINI_API_KEY' }
        if (-not $ApiKey) { $ApiKey = Read-Host "$keyName (server memory only)" -AsSecureString }
        $plainKey = [Net.NetworkCredential]::new('', $ApiKey).Password
        if (-not $plainKey.Trim()) { throw 'Live mode requires a key.' }
    }
    # -CommandType can return multiple PATH matches; CreateProcessW requires
    # one executable, never PowerShell's space-joined string conversion of an array.
    $node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source
    $instance = [Guid]::NewGuid().ToString('D')
    $command = '"{0}" "{1}" --demo-instance={2}' -f $node, $script:ServerPath, $instance
    $child = [Collections.Generic.SortedDictionary[string,string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($name in @('Path', 'SystemRoot', 'SystemDrive', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'ProgramData', 'OS', 'USERNAME', 'USERDOMAIN', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($null -ne $value) { $child[$name] = $value }
    }
    foreach ($name in @('DEMO_FILM', 'DEMO_DISCOVERY', 'DEMO_AMAZON_REGION', 'DEMO_SYNTHETIC_SCENARIO', 'DEMO_RETRIEVAL', 'DEMO_URL_SOURCE')) {
        $value = [Environment]::GetEnvironmentVariable($name)
        if ($null -ne $value) { $child[$name] = $value }
    }
    $child['DEMO_MODE'] = $mode
    $child['DEMO_PORT'] = $Port.ToString()
    $child['DEMO_ACCESS'] = $Access
    if ($Access -eq 'lan') { $child['DEMO_BIND_IPV4'] = $BindIPv4; $child['DEMO_LAN_PASSWORD'] = $plainPassword }
    if ($needsGemini) { $child['GEMINI_API_KEY'] = $plainKey }
    if ($needsMotn) { $child['MOTN_API_KEY'] = $plainKey }
    if ($needsTmdb) { $child['TMDB_READ_ACCESS_TOKEN'] = $plainKey }
    if (-not ('DemoDetachedProcess' -as [type])) { Add-Type -Path (Join-Path $PSScriptRoot 'DetachedProcess.cs') }
    $environment = @($child.GetEnumerator() | ForEach-Object { $_.Key + '=' + $_.Value })
    $process = [DemoDetachedProcess]::Start($node, $command, $script:DemoRoot, $environment)
    $demoId = $process.Id
    $address = if ($Access -eq 'lan') { $BindIPv4 } else { '127.0.0.1' }
    $url = "http://${address}:$Port"
    $ready = $false
    $httpStatus = 0
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        if ($process.HasExited) { break }
        $httpStatus = Get-DemoHttpStatus $url $plainPassword
        $listener = Get-NetTCPConnection -State Listen -LocalAddress $address -LocalPort $Port -ErrorAction SilentlyContinue
        if ($httpStatus -eq 200 -and @($listener | Where-Object OwningProcess -eq $demoId).Count -eq 1) { $ready = $true; break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $ready) {
        $exitStatus = if ($process.HasExited) { $process.ExitCode } else { 'still running' }
        throw "Demo not ready (process: $exitStatus, HTTP: $httpStatus). Check IP/port/config; foreground synthetic mode can diagnose. No session-bound fallback."
    }
    $state = [ordered]@{ pid = $demoId; startTicks = $process.StartTime.ToUniversalTime().Ticks.ToString(); server = $script:ServerPath; executable = $node; command = $command; instance = $instance; url = $url }
    $null = New-Item -ItemType Directory -Path $script:StateDirectory -Force
    # Only service metadata, no environment, credentials or response content.
    $state | ConvertTo-Json | Set-Content -LiteralPath $script:StatePath -Encoding UTF8
    Write-Output "Started PID $demoId. Safari: $url ; Basic username: demo (LAN only). Mode: $mode."
    $process.Dispose(); $process = $null
} finally {
    if ($process) { try { if (-not $process.HasExited) { $process.Kill(); $process.WaitForExit(3000) | Out-Null } } finally { $process.Dispose() } }
    $plainPassword = ''; $plainKey = ''; $environment = $null; $child = $null
    $lock.ReleaseMutex(); $lock.Dispose()
}
