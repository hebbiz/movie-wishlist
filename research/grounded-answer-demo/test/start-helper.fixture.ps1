param([string]$DemoRoot, [int]$Port, [string]$LanIPv4, [switch]$UrlContext, [switch]$Kinobaza, [switch]$Html, [switch]$Motn)
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
$env:DEMO_FILM = 'coherence'
$env:DEMO_RETRIEVAL = if ($Motn) { 'motn-api' } elseif ($Html) { 'kinobaza-html' } elseif ($UrlContext) { 'url-context' } else { 'search' }
if ($Kinobaza -or $Html) { $env:DEMO_URL_SOURCE = 'kinobaza' } else { Remove-Item Env:DEMO_URL_SOURCE -ErrorAction SilentlyContinue }
$env:DEMO_SYNTHETIC_SCENARIO = 'grounded'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
if ($LanIPv4) {
    # Deliberately public offline-test fixture, never an owner's credential.
    $password = ConvertTo-SecureString 'offline-integration-password' -AsPlainText -Force
    & (Join-Path $DemoRoot 'windows/Start-Demo.ps1') -Port $Port -Access lan -BindIPv4 $LanIPv4 -LanPassword $password
} else { & (Join-Path $DemoRoot 'windows/Start-Demo.ps1') -Port $Port }
# The caller waits for this entire launching PowerShell process to exit.
