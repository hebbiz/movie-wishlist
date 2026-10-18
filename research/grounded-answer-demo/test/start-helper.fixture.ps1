param([string]$DemoRoot, [int]$Port, [string]$LanIPv4, [switch]$UrlContext, [switch]$Kinobaza)
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
$env:DEMO_FILM = 'coherence'
$env:DEMO_RETRIEVAL = if ($UrlContext) { 'url-context' } else { 'search' }
if ($Kinobaza) { $env:DEMO_URL_SOURCE = 'kinobaza' } else { Remove-Item Env:DEMO_URL_SOURCE -ErrorAction SilentlyContinue }
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
if ($LanIPv4) {
    # Deliberately public offline-test fixture, never an owner's credential.
    $password = ConvertTo-SecureString 'offline-integration-password' -AsPlainText -Force
    & (Join-Path $DemoRoot 'windows/Start-Demo.ps1') -Port $Port -Access lan -BindIPv4 $LanIPv4 -LanPassword $password
} else { & (Join-Path $DemoRoot 'windows/Start-Demo.ps1') -Port $Port }
# The caller waits for this entire launching PowerShell process to exit.
