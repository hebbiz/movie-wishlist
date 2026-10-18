# Explicit Windows integration test. No ssh/firewall/services/real credentials/API.
param([string]$LanIPv4, [switch]$UrlContext, [switch]$Kinobaza, [switch]$Html)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Kinobaza -and -not $UrlContext) { throw '-Kinobaza requires -UrlContext.' }
if ($Html -and ($UrlContext -or $Kinobaza)) { throw '-Html is separate from Gemini URL Context.' }
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$copy = Join-Path $tempBase ('mw-grounded-test-' + [Guid]::NewGuid().ToString('D'))
$null = New-Item -ItemType Directory -Path $copy
$sentinel = $null
function Assert($condition, $message) { if (-not $condition) { throw $message } }
function Free-Port {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    $listener.Start(); $port = $listener.LocalEndpoint.Port; $listener.Stop(); return $port
}
try {
    foreach ($file in @('server.mjs','network.mjs','config.mjs','synthetic.mjs','url-context.mjs','html-source.mjs')) { Copy-Item -LiteralPath (Join-Path $source $file) -Destination $copy }
    foreach ($folder in @('public','windows')) { Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $copy -Recurse }
    if ($Html) {
        $null = New-Item -ItemType Directory -Path (Join-Path $copy 'node_modules')
        foreach ($dependency in @('parse5','entities')) { Copy-Item -LiteralPath (Join-Path $source "node_modules/$dependency") -Destination (Join-Path $copy 'node_modules') -Recurse }
    }
    $port = Free-Port
    $shell = (Get-Process -Id $PID).Path
    $launch = [Diagnostics.ProcessStartInfo]::new($shell)
    $launch.UseShellExecute = $false; $launch.CreateNoWindow = $true
    $launch.RedirectStandardOutput = $true; $launch.RedirectStandardError = $true
    $launch.Arguments = '-NoProfile -File "{0}" -DemoRoot "{1}" -Port {2}' -f (Join-Path $PSScriptRoot 'start-helper.fixture.ps1'), $copy, $port
    if ($UrlContext) { $launch.Arguments += ' -UrlContext' }
    if ($Kinobaza) { $launch.Arguments += ' -Kinobaza' }
    if ($Html) { $launch.Arguments += ' -Html' }
    if ($LanIPv4) {
        $parsed = $null
        Assert ([Net.IPAddress]::TryParse($LanIPv4, [ref]$parsed) -and $parsed.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and $parsed.ToString() -ceq $LanIPv4) 'Invalid test LAN IPv4.'
        $launch.Arguments += " -LanIPv4 $LanIPv4"
    }
    $parent = [Diagnostics.Process]::Start($launch)
    $output = $parent.StandardOutput.ReadToEnd(); $errors = $parent.StandardError.ReadToEnd()
    Assert ($parent.WaitForExit(15000) -and $parent.ExitCode -eq 0) "Launching parent failed: $errors"
    $parent.Dispose()
    Assert ($output -match 'Started PID') "Detached start did not report ready. Synthetic-test parent output: $output; errors: $errors"
    $statePath = Join-Path $copy '.run/instance.json'
    $state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    $before = $state.pid
    # Parent has fully exited: continue from a different process/context.
    & (Join-Path $copy 'windows/Status-Demo.ps1')
    Add-Type -AssemblyName System.Net.Http
    $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
    try { $response = $client.GetStringAsync($state.url + '/session').GetAwaiter().GetResult() | ConvertFrom-Json } finally { $client.Dispose(); $handler.Dispose() }
    Assert ($response.discovery -eq 'digital-ua' -and $response.film.id -eq 'coherence') 'Server switches not inherited.'
    Assert ($response.mode -ceq 'synthetic') 'Fixture must remain synthetic before any /answer test.'
    $expectedRetrieval = if ($Html) { 'kinobaza-html' } elseif ($UrlContext) { 'url-context' } else { 'search' }
    Assert ($response.retrieval -eq $expectedRetrieval) 'Retrieval switch not inherited.'
    if ($UrlContext -or $Html) {
        $expectedSource = if ($Kinobaza -or $Html) { 'kinobaza' } else { 'apple-tv' }
        $expectedURL = if ($Kinobaza -or $Html) { 'https://kinobaza.com.ua/titles/coherence' } else { 'https://tv.apple.com/ua/movie/coherence/umc.cmc.hdoayzcx3u9ofxfawjrt3hgc' }
        Assert ($response.urlSource -ceq $expectedSource -and $response.sourceURL -ceq $expectedURL) 'URL source/catalogue mismatch.'
        if ($Html) { Assert ($null -eq $response.model -and $null -eq $response.prompt -and $response.operation.Contains('One GET')) 'HTML unexpectedly configured a model.' }
        else { Assert ($response.prompt.Contains($expectedURL)) 'URL prompt mismatch.' }
    }
    if ($Html) {
        $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
        $client = [Net.Http.HttpClient]::new($handler)
        if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
        $client.DefaultRequestHeaders.Add('Origin', $state.url)
        $client.DefaultRequestHeaders.Add('x-demo-session', $response.token)
        try {
            $answer = $client.PostAsync($state.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            $payload = $answer.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            Assert ([int]$answer.StatusCode -eq 200 -and $payload.mode -ceq 'synthetic' -and $payload.result.identity.status -ceq 'matched') 'Synthetic HTML parser in detached child failed.'
            $answer.Dispose()
        } finally { $client.Dispose(); $handler.Dispose() }
    }
    & (Join-Path $copy 'windows/Start-Demo.ps1') -Port $port
    Assert ((Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json).pid -eq $before) 'Duplicate process created.'
    # A harmless unrelated Node must survive a forged/stale PID record and stop.
    $info = [Diagnostics.ProcessStartInfo]::new((Get-Command node.exe -CommandType Application | Select-Object -First 1).Source)
    $info.UseShellExecute = $false; $info.CreateNoWindow = $true
    $info.Arguments = '-e "setInterval(()=>{},1000)"'
    $sentinel = [Diagnostics.Process]::Start($info)
    $saved = Get-Content -LiteralPath $statePath -Raw
    $forged = $saved | ConvertFrom-Json; $forged.pid = $sentinel.Id
    $forged | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8
    $refused = $false
    try { & (Join-Path $copy 'windows/Stop-Demo.ps1') } catch { $refused = $true }
    Assert $refused 'Stop did not reject unrelated PID metadata.'
    Assert (-not $sentinel.HasExited) 'Unrelated Node was affected.'
    $saved | Set-Content -LiteralPath $statePath -Encoding UTF8
    & (Join-Path $copy 'windows/Stop-Demo.ps1')
    Assert (-not (Test-Path -LiteralPath $statePath)) 'Stop retained active PID metadata.'
    Assert (-not $sentinel.HasExited) 'Safe stop killed unrelated Node.'
    # Restart in the same synthetic scenario, independently of the test caller's env.
    $env:DEMO_MODE = 'synthetic'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'
    $env:DEMO_RETRIEVAL = $expectedRetrieval
    $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'
    # Live HTML readiness must NOT ask for an API key or fetch a source before /answer.
    if ($Html) { $env:DEMO_MODE = 'live' }
    Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
    if ($Kinobaza -or $Html) { $env:DEMO_URL_SOURCE = 'kinobaza' } else { Remove-Item Env:DEMO_URL_SOURCE -ErrorAction SilentlyContinue }
    if ($LanIPv4) {
        & (Join-Path $copy 'windows/Start-Demo.ps1') -Port $port -Access lan -BindIPv4 $LanIPv4 -LanPassword (ConvertTo-SecureString 'offline-integration-password' -AsPlainText -Force)
    } else { & (Join-Path $copy 'windows/Start-Demo.ps1') -Port $port }
    $restarted = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    Assert ($restarted.instance -ne $state.instance) 'Restart did not create fresh instance.'
    $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
    try { $afterRestart = $client.GetStringAsync($restarted.url + '/session').GetAwaiter().GetResult() | ConvertFrom-Json } finally { $client.Dispose(); $handler.Dispose() }
    Assert ($afterRestart.retrieval -ceq $response.retrieval -and $afterRestart.prompt -ceq $response.prompt) 'Restart changed scenario/prompt.'
    if ($Html) { Assert ($afterRestart.mode -ceq 'live' -and $afterRestart.model -eq $null -and $afterRestart.sourceURL -ceq $expectedURL) 'HTML live readiness/source mismatch.' }
    Assert (-not ($saved -match 'offline-integration-password|PASSWORD|GEMINI_API_KEY|Authorization|SYNTHETIC ONLY')) 'Metadata contains content/secret fields.'
    & (Join-Path $copy 'windows/Stop-Demo.ps1')
    Write-Output 'PASS: parent-exit survival, scenario inheritance, duplicate start, identity refusal, safe stop and restart. SSH disconnect not tested.'
} finally {
    if (Test-Path -LiteralPath (Join-Path $copy '.run/instance.json')) { & (Join-Path $copy 'windows/Stop-Demo.ps1') }
    if ($sentinel) { try { if (-not $sentinel.HasExited) { $sentinel.Kill(); $null = $sentinel.WaitForExit(3000) } } finally { $sentinel.Dispose() } }
    $resolved = [IO.Path]::GetFullPath($copy)
    if (-not $resolved.StartsWith($tempBase.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^mw-grounded-test-[0-9a-f-]{36}$') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
