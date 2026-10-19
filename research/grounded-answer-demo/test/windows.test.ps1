# Explicit Windows integration test. No ssh/firewall/services/real credentials/API.
param([string]$LanIPv4, [switch]$UrlContext, [switch]$Kinobaza, [switch]$Html, [switch]$Motn, [switch]$Tmdb, [switch]$Megogo, [switch]$Discovery)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Kinobaza -and -not $UrlContext) { throw '-Kinobaza requires -UrlContext.' }
if ($Html -and ($UrlContext -or $Kinobaza)) { throw '-Html is separate from Gemini URL Context.' }
if ($Motn -and ($Html -or $UrlContext -or $Kinobaza)) { throw '-Motn is a separate non-LLM probe.' }
if ($Tmdb -and ($Motn -or $Html -or $UrlContext -or $Kinobaza)) { throw '-Tmdb is a separate non-LLM probe.' }
if ($Megogo -and ($Tmdb -or $Motn -or $Html -or $UrlContext -or $Kinobaza)) { throw '-Megogo is a separate non-LLM probe.' }
if ($Discovery -and ($Megogo -or $Tmdb -or $Motn -or $Html -or $UrlContext -or $Kinobaza)) { throw '-Discovery is a separate composition mode.' }
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
    foreach ($file in @('server.mjs','network.mjs','config.mjs','synthetic.mjs','url-context.mjs','html-source.mjs','kinobaza-localization.mjs','motn.mjs','tmdb.mjs','megogo.mjs','megogo-synthetic.mjs','discovery.mjs')) { Copy-Item -LiteralPath (Join-Path $source $file) -Destination $copy }
    foreach ($folder in @('public','windows')) { Copy-Item -LiteralPath (Join-Path $source $folder) -Destination $copy -Recurse }
    if ($Html -or $Megogo -or $Discovery) {
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
    if ($Motn) { $launch.Arguments += ' -Motn' }
    if ($Tmdb) { $launch.Arguments += ' -Tmdb' }
    if ($Megogo) { $launch.Arguments += ' -Megogo' }
    if ($Discovery) { $launch.Arguments += ' -Discovery' }
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
    $expectedFilm = if ($Megogo) { 'dune-part-two' } else { 'coherence' }
    Assert ($response.discovery -eq 'digital-ua' -and $response.film.id -eq $expectedFilm) 'Server switches not inherited.'
    Assert ($response.mode -ceq 'synthetic') 'Fixture must remain synthetic before any /answer test.'
    $expectedRetrieval = if ($Discovery) { 'ua-discovery' } elseif ($Megogo) { 'megogo-html' } elseif ($Tmdb) { 'tmdb-data' } elseif ($Motn) { 'motn-api' } elseif ($Html) { 'kinobaza-html' } elseif ($UrlContext) { 'url-context' } else { 'search' }
    Assert ($response.retrieval -eq $expectedRetrieval) 'Retrieval switch not inherited.'
    if ($UrlContext -or $Html) {
        $expectedSource = if ($Kinobaza -or $Html) { 'kinobaza' } else { 'apple-tv' }
        $expectedURL = if ($Kinobaza -or $Html) { 'https://kinobaza.com.ua/titles/coherence' } else { 'https://tv.apple.com/ua/movie/coherence/umc.cmc.hdoayzcx3u9ofxfawjrt3hgc' }
        Assert ($response.urlSource -ceq $expectedSource -and $response.sourceURL -ceq $expectedURL) 'URL source/catalogue mismatch.'
        if ($Html) { Assert ($null -eq $response.model -and $null -eq $response.prompt -and $response.operation.Contains('One GET')) 'HTML unexpectedly configured a model.' }
        else { Assert ($response.prompt.Contains($expectedURL)) 'URL prompt mismatch.' }
    }
    if ($Motn) {
        Assert ($response.country -ceq 'ua' -and $response.imdbId -ceq 'tt2866360' -and $response.sourceURL -ceq 'https://api.movieofthenight.com/v4/shows/tt2866360?country=ua' -and $null -eq $response.model) 'Movie of the Night configuration not inherited.'
    }
    if ($Tmdb) {
        Assert ($response.country -ceq 'UA' -and $response.tmdbId -eq 220289 -and $response.imdbId -ceq 'tt2866360' -and $response.requestBudget -eq 2 -and $null -eq $response.model) 'TMDb switches not inherited.'
    }
    if ($Megogo) {
        Assert ($response.sourceURL -ceq 'https://megogo.net/ua/view/22027436-dyuna-chastina-druga.html' -and $response.expectedIds.nativeId -ceq '22027436' -and $null -eq $response.model -and $response.requestBudget -eq 1) 'MEGOGO fixed config mismatch.'
    }
    if ($Discovery) { Assert ($response.kinobaza -ceq 'on' -and $response.requestBudget -eq 5 -and $response.films.Count -eq 2) 'Discovery config not inherited.' }
    if ($Html -or $Motn -or $Tmdb -or $Megogo -or $Discovery) {
        $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
        $client = [Net.Http.HttpClient]::new($handler)
        if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
        $client.DefaultRequestHeaders.Add('Origin', $state.url)
        $client.DefaultRequestHeaders.Add('x-demo-session', $response.token)
        try {
            $answer = $client.PostAsync($state.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            $payload = $answer.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            $identityStatus = if ($Tmdb) { $payload.result.identity.identity.status } else { $payload.result.identity.status }
            $expectedIdentity = if ($Discovery) { 'independent-source-gates' } else { 'matched' }
            Assert ([int]$answer.StatusCode -eq 200 -and $payload.mode -ceq 'synthetic' -and $identityStatus -ceq $expectedIdentity) 'Synthetic parser/projection in detached child failed.'
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
    $env:DEMO_MODE = 'synthetic'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = $expectedFilm
    $env:DEMO_RETRIEVAL = $expectedRetrieval
    if ($Discovery) { $env:DEMO_KINOBAZA = 'on' } else { Remove-Item Env:DEMO_KINOBAZA -ErrorAction SilentlyContinue }
    $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'
    # Live HTML readiness must NOT ask for an API key or fetch a source before /answer.
    if ($Html) { $env:DEMO_MODE = 'live' }
    Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
    if ($Kinobaza -or $Html) { $env:DEMO_URL_SOURCE = 'kinobaza' } else { Remove-Item Env:DEMO_URL_SOURCE -ErrorAction SilentlyContinue }
    # Exercise the inherited key in a mock-only temporary server. No external
    # transport exists in this fixture; the owner's server is never modified.
    $restartArgs = @{ Port = $port }
    if ($Motn) {
        Copy-Item -LiteralPath (Join-Path $copy 'server.mjs') -Destination (Join-Path $copy 'server-core.mjs')
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'motn-launch.fixture.mjs') -Destination (Join-Path $copy 'server.mjs')
        $env:DEMO_MODE = 'live'; $restartArgs.ApiKey = ConvertTo-SecureString 'offline-motn-key-sentinel' -AsPlainText -Force
    }
    if ($Tmdb) {
        Copy-Item -LiteralPath (Join-Path $copy 'server.mjs') -Destination (Join-Path $copy 'server-core.mjs')
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'tmdb-launch.fixture.mjs') -Destination (Join-Path $copy 'server.mjs')
        $env:DEMO_MODE = 'live'; $restartArgs.ApiKey = ConvertTo-SecureString 'offline-tmdb-token-sentinel' -AsPlainText -Force
    }
    if ($Megogo) {
        Copy-Item -LiteralPath (Join-Path $copy 'server.mjs') -Destination (Join-Path $copy 'server-core.mjs')
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'megogo-launch.fixture.mjs') -Destination (Join-Path $copy 'server.mjs')
        $env:DEMO_MODE = 'live'
    }
    if ($Discovery) {
        Copy-Item -LiteralPath (Join-Path $copy 'server.mjs') -Destination (Join-Path $copy 'server-core.mjs')
        Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'discovery-launch.fixture.mjs') -Destination (Join-Path $copy 'server.mjs')
        $env:DEMO_MODE = 'live'
        $restartArgs.TmdbToken = ConvertTo-SecureString 'offline-discovery-tmdb' -AsPlainText -Force
        $restartArgs.MotnKey = ConvertTo-SecureString 'offline-discovery-motn' -AsPlainText -Force
        $env:GEMINI_API_KEY = 'unrelated-key-not-inherited'
    }
    if ($LanIPv4) { $restartArgs.Access = 'lan'; $restartArgs.BindIPv4 = $LanIPv4; $restartArgs.LanPassword = ConvertTo-SecureString 'offline-integration-password' -AsPlainText -Force }
    & (Join-Path $copy 'windows/Start-Demo.ps1') @restartArgs
    $restarted = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    Assert ($restarted.instance -ne $state.instance) 'Restart did not create fresh instance.'
    $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
    $client = [Net.Http.HttpClient]::new($handler)
    if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
    try { $afterRestart = $client.GetStringAsync($restarted.url + '/session').GetAwaiter().GetResult() | ConvertFrom-Json } finally { $client.Dispose(); $handler.Dispose() }
    Assert ($afterRestart.retrieval -ceq $response.retrieval -and $afterRestart.prompt -ceq $response.prompt) 'Restart changed scenario/prompt.'
    if ($Megogo) {
        Assert ($afterRestart.mode -ceq 'live' -and $afterRestart.sourceURL -ceq $response.sourceURL -and $afterRestart.operation -ceq $response.operation) 'MEGOGO restart changed fixed operation.'
        $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
        $client = [Net.Http.HttpClient]::new($handler)
        if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
        $client.DefaultRequestHeaders.Add('Origin', $restarted.url); $client.DefaultRequestHeaders.Add('x-demo-session', $afterRestart.token)
        try {
            $answer = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            $payload = $answer.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            Assert ($payload.result.identity.status -ceq 'matched' -and $payload.result.httpStatus -eq 200) 'MEGOGO mock-only live transport failed.'
            $answer.Dispose()
            $again = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            Assert ([int]$again.StatusCode -eq 409) 'MEGOGO detached child replay failed.'; $again.Dispose()
        } finally { $client.Dispose(); $handler.Dispose() }
    }
    if ($Html) { Assert ($afterRestart.mode -ceq 'live' -and $afterRestart.model -eq $null -and $afterRestart.sourceURL -ceq $expectedURL) 'HTML live readiness/source mismatch.' }
    if ($Motn) {
        Assert ($afterRestart.mode -ceq 'live' -and $afterRestart.country -ceq 'ua' -and $afterRestart.sourceURL -ceq $response.sourceURL) 'Movie of the Night readiness/config mismatch.'
        $metadata = Get-Content -LiteralPath $statePath -Raw
        Assert (-not (($afterRestart | ConvertTo-Json -Depth 10) + $metadata -match 'offline-motn-key-sentinel|MOTN_API_KEY')) 'API key reached state/session.'
        $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
        $client = [Net.Http.HttpClient]::new($handler)
        if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
        $client.DefaultRequestHeaders.Add('Origin', $restarted.url); $client.DefaultRequestHeaders.Add('x-demo-session', $afterRestart.token)
        try {
            $answer = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            $payload = $answer.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            Assert ($payload.result.status -ceq 'ok' -and $payload.result.options.Count -eq 2) 'Inherited key did not reach mock-only child transport.'
            $answer.Dispose()
            $again = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            Assert ([int]$again.StatusCode -eq 409) 'Detached child one-shot replay failed.'; $again.Dispose()
        } finally { $client.Dispose(); $handler.Dispose() }
    }
    if ($Tmdb) {
        Assert ($afterRestart.mode -ceq 'live' -and $afterRestart.country -ceq 'UA' -and $afterRestart.providersURL -ceq $response.providersURL) 'TMDb readiness/config mismatch.'
        $metadata = Get-Content -LiteralPath $statePath -Raw
        Assert (-not (($afterRestart | ConvertTo-Json -Depth 10) + $metadata -match 'offline-tmdb-token-sentinel|TMDB_READ_ACCESS_TOKEN')) 'Token reached state/session.'
        $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
        $client = [Net.Http.HttpClient]::new($handler)
        if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
        $client.DefaultRequestHeaders.Add('Origin', $restarted.url); $client.DefaultRequestHeaders.Add('x-demo-session', $afterRestart.token)
        try {
            $answer = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            $payload = $answer.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
            Assert ($payload.result.identity.status -ceq 'ok' -and $payload.result.providers.status -ceq 'ok' -and $payload.result.requestsMade -eq 2) 'Token did not reach the two-request mock-only child.'
            $answer.Dispose()
            $again = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
            Assert ([int]$again.StatusCode -eq 409) 'TMDb detached child replay failed.'; $again.Dispose()
        } finally { $client.Dispose(); $handler.Dispose() }
    }
    if ($Discovery) {
        Assert ($afterRestart.mode -ceq 'live' -and $afterRestart.kinobaza -ceq 'on' -and $afterRestart.requestBudget -eq 5) 'Discovery restart config mismatch.'
        $handler = [Net.Http.HttpClientHandler]::new(); $handler.UseProxy = $false
        $client = [Net.Http.HttpClient]::new($handler)
        if ($LanIPv4) { $client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Basic', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('demo:offline-integration-password'))) }
        try {
            foreach ($film in @('coherence','dune-part-two')) {
                $session = $client.GetStringAsync($restarted.url + '/session?film=' + $film).GetAwaiter().GetResult() | ConvertFrom-Json
                $client.DefaultRequestHeaders.Remove('x-demo-session') | Out-Null
                $client.DefaultRequestHeaders.Add('Origin', $restarted.url)
                $client.DefaultRequestHeaders.Add('x-demo-session', $session.token)
                $answer = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
                $text = $answer.Content.ReadAsStringAsync().GetAwaiter().GetResult()
                $payload = $text | ConvertFrom-Json
                Assert ([int]$answer.StatusCode -eq 200 -and $payload.result.metrics.requestsMade -eq 4 -and $payload.result.rows.Count -ge 3 -and $payload.result.film.id -ceq $film) 'Discovery mock multi-key/fixed-film flow failed.'
                Assert (-not ($text -match 'offline-discovery-tmdb|offline-discovery-motn|unrelated-key-not-inherited')) 'Credential echo reached response.'
                $answer.Dispose()
                $again = $client.PostAsync($restarted.url + '/answer', [Net.Http.StringContent]::new('{}')).GetAwaiter().GetResult()
                Assert ([int]$again.StatusCode -eq 409) 'Discovery replay not blocked.'; $again.Dispose()
                $client.DefaultRequestHeaders.Remove('Origin') | Out-Null
            }
            $metadata = Get-Content -LiteralPath $statePath -Raw
            Assert (-not ($metadata -match 'offline-discovery|API_KEY|ACCESS_TOKEN|Authorization')) 'Credential persisted in metadata.'
        } finally { $client.Dispose(); $handler.Dispose() }
    }
    Assert (-not ($saved -match 'offline-integration-password|PASSWORD|GEMINI_API_KEY|MOTN_API_KEY|TMDB_READ_ACCESS_TOKEN|Authorization|SYNTHETIC ONLY')) 'Metadata contains content/secret fields.'
    & (Join-Path $copy 'windows/Stop-Demo.ps1')
    Write-Output 'PASS: parent-exit survival, scenario inheritance, duplicate start, identity refusal, safe stop and restart. SSH disconnect not tested.'
} finally {
    if (Test-Path -LiteralPath (Join-Path $copy '.run/instance.json')) { & (Join-Path $copy 'windows/Stop-Demo.ps1') }
    if ($sentinel) { try { if (-not $sentinel.HasExited) { $sentinel.Kill(); $null = $sentinel.WaitForExit(3000) } } finally { $sentinel.Dispose() } }
    $resolved = [IO.Path]::GetFullPath($copy)
    if (-not $resolved.StartsWith($tempBase.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^mw-grounded-test-[0-9a-f-]{36}$') { throw 'Unsafe test cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
