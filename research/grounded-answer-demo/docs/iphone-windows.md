# Windows + iPhone manual test guide (trusted home LAN only)

MW-FUT-01 remains Discovery. Three digital scenarios now have limited
[owner-reported observations](digital-ua-owner-validation.md), not a general
accuracy assessment. Amazon-region scenarios remain live-unvalidated.
No SSH, firewall, network profile, service or router setting is changed by the
demo/helpers. Commands below are for the owner to review and run manually.

## Security and process model

LAN is opt-in: `DEMO_ACCESS=lan`, a **specific assigned RFC1918 IPv4**, and
`DEMO_LAN_PASSWORD` are required. No `0.0.0.0`, public IP, loopback LAN alias,
wildcard Host/Origin, CORS wildcard, proxy or internet access. LAN authentication
protects every route, including assets, `/session`, `/answer` and unknown paths.
The fixed Basic username is **`demo`**. Use a new strong password unrelated to
your Windows/SSH or Google credentials. The password is entered into Safari's
native Basic Auth prompt, not returned in page/session data.

**HTTP Basic is base64, not encryption.** Anyone able to observe trusted-LAN
HTTP traffic can recover credentials and read answers. SSH encrypts only the
Termius control connection, not Safari traffic. Use only a trusted private home
Wi-Fi/subnet, no guest/public/shared Wi-Fi, VPN, router port forwarding, internet
tunnel or cellular URL. This is not a production-security recommendation.
Do not start PowerShell transcripts, HTTP debug logging, process dumps, HAR
exports or screen recording of secrets/live answers. Local admins/OS tooling can
inspect process memory/environment; no secure-memory-erasure promise is made.

Helpers create a hidden, console-detached Node using native `CreateProcessW`
with `CREATE_BREAKAWAY_FROM_JOB`, explicit environment and no inherited handles.
No task definition, service, output log or reboot auto-start is created. A job
that disallows breakaway causes failure; there is **no session-bound fallback**.
See Microsoft's [creation flags](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags)
and [job behavior](https://learn.microsoft.com/en-us/windows/win32/procthread/job-objects).
This design is not, by itself, proof of SSH-disconnect survival on your host.

## One-time Windows setup — at the Windows console

Use the actual Windows machine running this checkout, not an IP copied from a
different home project. Keep local console access while changing SSH/firewall.

### 1. Inspect first (no installation or settings changes)

```powershell
whoami
$PSVersionTable.PSVersion
Get-Command powershell.exe,node.exe,git.exe
Get-Service sshd -ErrorAction SilentlyContinue
Get-NetIPAddress -AddressFamily IPv4 | Select-Object IPAddress,InterfaceAlias,InterfaceIndex,AddressState
Get-NetConnectionProfile | Select-Object InterfaceAlias,InterfaceIndex,NetworkCategory
```

Use Windows PowerShell **5.1+** or PowerShell 7, Node 24. Verify Node is available
in the SSH account's PATH; restart the shell after installation/PATH changes.
Helpers were integration-tested in the available PowerShell 7 runtime. The
stock Windows PowerShell 5.1 test was blocked by this machine's existing script
execution policy; it was not bypassed or changed. Validate the chosen SSH shell
and owner-approved script policy before relying on these commands.
Know the Windows account/password or prepare SSH key authentication yourself.
A Windows Hello PIN is **not** the account password. Do not give Termius your
LAN Basic password as SSH authentication. If SSH lands in cmd.exe, run
`powershell.exe -NoProfile` (or an already installed `pwsh.exe -NoProfile`);
no registry/default-shell change is required by this guide.

Select the active home Wi-Fi/Ethernet IPv4 and its matching interface/profile,
not a virtual adapter or `169.254.*` address. The profile must be **Private**.
If Public, stop and have the owner review the network locally; do not switch
Public → Private automatically. The server validates assigned private IPv4 but
does not modify/check the Windows firewall profile on your behalf.

### 2. Only if OpenSSH Server is missing (admin console)

Use [Microsoft's OpenSSH setup](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)
for your Windows version. Inspect before installing:

```powershell
Get-WindowsCapability -Online | Where-Object Name -like 'OpenSSH.Server*'
# Only if State is NotPresent:
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
# Only if installed but stopped:
Start-Service sshd
```

Do not run installation/start commands if already installed/running. No service
startup policy is changed here. After reboot, a manual service start may be
needed. Key/password authentication and authorized_keys permissions follow the
[Windows OpenSSH configuration](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-server-configuration).
Do not weaken permissions or disable host verification to solve login failures.

Verify the server host fingerprint **locally**, after host keys exist:

```powershell
& "$env:WINDIR\System32\OpenSSH\ssh-keygen.exe" -lf "$env:ProgramData\ssh\ssh_host_ed25519_key.pub"
```

Compare the matching SHA256/key algorithm shown by Termius before trusting it.
An unexpected changed fingerprint requires investigation, not blind acceptance.

### 3. Narrow firewall rules — owner-reviewed admin commands

Replace the prompt with the IPv4 verified in step 1 (example addresses are not
deployment configuration). Resolve Node from the intended SSH account/runtime:

```powershell
$windowsIPv4 = Read-Host 'Verified private IPv4 of THIS Windows machine'
$demoNode = (Get-Command node.exe -CommandType Application).Source
Get-NetFirewallRule -Name OpenSSH-Server-In-TCP -ErrorAction SilentlyContinue |
    Select-Object Name,Enabled,Profile
# Create only missing named rules; inspect existing rules rather than replacing them:
if (-not (Get-NetFirewallRule -Name MW-PoC-SSH -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name MW-PoC-SSH -DisplayName 'MW PoC SSH home subnet' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 22 -LocalAddress $windowsIPv4 -RemoteAddress LocalSubnet -Profile Private -Service sshd
}
if (-not (Get-NetFirewallRule -Name MW-PoC-Demo -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -Name MW-PoC-Demo -DisplayName 'MW PoC demo home subnet' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4317 -LocalAddress $windowsIPv4 -RemoteAddress LocalSubnet -Profile Private -Program $demoNode
}
```

Inspect existing inbound allow rules too: narrower rules **do not cancel** a
broader enabled rule. OpenSSH installation may add `OpenSSH-Server-In-TCP`.
Record its prior enabled/profile state. From the Windows console, after the
Private/LocalSubnet rule is ready, disable that broader default rule **only if
it is enabled and the owner has confirmed this will not break another use**:

```powershell
Disable-NetFirewallRule -Name OpenSSH-Server-In-TCP
```

Inspect any other enabled port-22/Node allow rules with your administrator;
don't automatically disable unrelated rules. Test a new SSH connection before
leaving the Windows console. Only port 22 for SSH and 4317 for this Node copy
are needed. No inbound Google/API ports or router changes are needed.

Rollback (admin console, only rules this guide created):

```powershell
Remove-NetFirewallRule -Name MW-PoC-Demo -ErrorAction SilentlyContinue
Remove-NetFirewallRule -Name MW-PoC-SSH -ErrorAction SilentlyContinue
# Only if the default rule was enabled before YOU disabled it, restore that prior state:
# Enable-NetFirewallRule -Name OpenSSH-Server-In-TCP
```

Stop the demo first. Do not uninstall/stop an SSH installation used elsewhere.
Rollback of optional SSH installation/service changes is an owner/admin decision,
not performed by these helpers.

## Daily workflow — Termius and Safari on iPhone

### 1. Connect and select the correct copy

Termius Host: actual Windows IPv4, SSH port **22**, verified Windows account and
its password or configured SSH key. Verify fingerprint, use the same home LAN.
In the PowerShell SSH shell, navigate to the real PoC checkout and inspect:

```powershell
Set-Location 'C:\Users\DenysLis\movie-wishlist-codex' # only if this is your intended copy
git status --short --branch
git branch --show-current
git rev-parse HEAD
git fetch --prune origin
```

For PR #175, use `codex/mw-fut-01-digital-ua-amazon`, not main/develop or PR #173.
For the separate stacked URL-only experiment, use
`codex/mw-fut-01-url-context` and the [URL Context guide](url-context-poc.md)
instead; it depends on PR #175 and has its own exact checkout/switch commands.
For the subsequent Kinobaza source experiment, use
`codex/mw-fut-01-kinobaza-url-context` (stacked on #176), with the
[standalone commands below](#kinobaza-url-context-one-line-owner-commands).
If tracked/local changes overlap or a running helper owns this copy, stop and
resolve/preserve those changes. Do not reset, clean, stash automatically or pull
over unknown work. With the correct branch selected and no conflicting changes:

```powershell
git switch codex/mw-fut-01-digital-ua-amazon
git merge --ff-only origin/codex/mw-fut-01-digital-ua-amazon
```

No fallback merge/reset for divergence. Existing untracked research data is not
deleted. Do not copy a PID file from another checkout.

### 2. Synthetic LAN smoke test first

```powershell
$windowsIPv4 = Read-Host 'Verified private IPv4 of THIS Windows machine'
$env:DEMO_MODE = 'synthetic'
$env:DEMO_FILM = 'coherence'
$env:DEMO_DISCOVERY = 'digital-ua'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
.\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4
.\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Enter the separate LAN Basic password at the **hidden** prompt. No plaintext
password/key arguments, env assignments in shell history or files. The helper
prints the exact **`http://<actual-Windows-IPv4>:4317`** URL (substitute the actual
value; do not type the angle brackets). Safari username: **`demo`**, password:
the one just entered. Do not put credentials in the URL. Safari may warn about
HTTP/insecure credentials: proceed only in the trusted-LAN constraints above.

Switch Termius → Safari, reload, check film/mode/region/prompt and click once.
Prompt, button, complete synthetic answer, citation and Search Suggestions
should be reachable by scrolling. Fixture links are invented, not stock or UA
availability evidence. To verify survival, explicitly disconnect SSH in Termius,
then reload Safari and repeat a synthetic attempt. Reconnect SSH and run status.
The owner reports that iPhone/Safari LAN HTTP + Basic Auth works and that a
synthetic request succeeded after explicitly disconnecting SSH. This is not an
independent implementation-agent test. Repeat the smoke test after environment
changes; the result does not prove survival of Windows sign-out/reboot or sleep.

### 3. Status, stop, change scenario, then explicitly choose live

```powershell
.\research\grounded-answer-demo\windows\Status-Demo.ps1
.\research\grounded-answer-demo\windows\Stop-Demo.ps1
# Example: isolated physical Amazon Germany, then restart:
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'physical'
$env:DEMO_FILM = 'blade-runner-final-cut'
$env:DEMO_AMAZON_REGION = 'de' # us / uk / de / it
.\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4
```

Start while already running reports its PID/URL; it does not replace it or
apply new switches. Stop/restart is required; then reload Safari for a fresh
token. Specify `-Access lan -BindIPv4 ...` on every LAN restart; helper default
is localhost. Password changes can require closing the Safari private tab or
clearing that origin's cached HTTP authentication before signing in again.

Only after synthetic smoke testing and an explicit owner decision:

```powershell
.\research\grounded-answer-demo\windows\Stop-Demo.ps1
$env:DEMO_MODE = 'live'
.\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4
```

Hidden prompts request the LAN password and `GEMINI_API_KEY`. They go only into
the child's environment, not command line, PID metadata, task definitions or
logs. The helper ignores any inherited API key and asks explicitly in live mode.
Starting/status/reloading makes **no Gemini call**; only clicking sends one.
Model/settings/prompts remain unchanged by the LAN iteration. The URL-only PoC
adds `DEMO_RETRIEVAL` to the helper's server-environment allowlist, not a browser
URL input. Set it to `search` when returning to the original scenarios; stop and
restart to change it, and remove `DEMO_URL_SOURCE`. The new source switch is
forwarded only in the child's allowed environment; it never goes on the command
line or into service metadata. Review digital
rights/localization with a Ukrainian account without VPN as in the main README.
Do not archive live output or conclude accuracy from a handful of requests.

Stop targets only this copy's verified PID + creation time + executable + exact
server command/instance marker. Identity mismatch fails closed; investigate, do
not kill all `node.exe`. `.run/instance.json` holds service metadata only and is
ignored by Git. If it is missing/corrupt while a process exists, inspect locally;
don't delete unknown state or terminate an unverified process to force a start.
No automatic restart after reboot, logoff, crash or sleep. SSH disconnect and
Windows sign-out/reboot are different events.

## Troubleshooting / validation status

- Windows sleep/hibernation pauses access; keep it awake manually for the test.
- If DHCP changes the IP, verify the new address/profile locally, stop/restart
  with that IP and review the named firewall LocalAddress rules manually.
- Ensure both devices share the home subnet, not guest Wi-Fi; client isolation
  may block device-to-device traffic. Never fix this with internet port forwarding.
- A 401 challenge means Basic Auth is required; 403 means wrong Host/Origin.
  Use the exact printed IP/port, not localhost, another alias, saved stale URL or
  an SSH tunnel. Token 409: reload after restart/one attempt; don't add retries.
- If detached start fails, inspect config/port/job policy. Do not silently fall
  back to a session-bound process. No security-policy changes are automated.
  Native launch failures now include safe `Stage`, `NativeErrorCode` and
  `ExceptionType`, never command/environment/credential/provider content. See
  the [paired Windows diagnosis](windows-launch-diagnosis.md): the reproduced
  error 123 was a multiple-Node-path bug, not evidence that breakaway was denied.
- Execution policy blocking scripts: inspect the local policy and review scripts
  with the owner/admin. This guide does not set machine policy or recommend
  disabling security controls. Helpers need CIM/process/network inspection rights.

Independently checked here: loopback auth/mocks, desktop suites, narrow Edge
viewport, Windows helper duplicate/restart/safe-stop, a child remaining available
after its launching PowerShell exits, and same-host synthetic LAN Basic Auth.
At the implementation baseline, real iPhone/Safari and actual SSH disconnect
were not independently tested: OpenSSH Server and the WebKit binary were absent
in that test environment (no download). The mobile test is not a real-iPhone
test. Windows PowerShell 5.1 execution was blocked by existing script policy;
only PowerShell 7 helper integration completed. That independent 5.1 check
remains incomplete; do not infer the owner's shell/version from a working flow.

Subsequently, the owner confirmed real iPhone/Safari LAN HTTP + Basic Auth,
a synthetic request after explicit SSH disconnection, and three digital-UA live
scenarios through iPhone. This establishes that tested home-network path, not
all firewall/client-isolation configurations or universal SSH-job behavior.
Two later URL Context live answers through Safari are recorded separately in
the same owner record. They do not establish a new-mode SSH-disconnect test
after the launcher fix or independent implementation-agent device validation.
See the owner record for results and limits. Other environments, auth-cache edge
cases and the Amazon-region live scenarios remain unvalidated. The
[next-experiment proposal](regional-card-proposal.md) preserves this workflow;
it does not authorize new automatic calls or change the current prompts.

## Kinobaza URL Context: one-line owner commands

**Historical reproduction commands:** the owner completed both Kinobaza live
tests; neither returned provider URLs. See the [owner checkpoint](digital-ua-owner-validation.md#kinobaza-url-context--two-completed-owner-run-tests).
No repeat live calls are recommended now. Exact new-test device/runtime details
and a new-source SSH-disconnect check are not established by this report.
For context, read the [bounded test plan](url-context-poc.md#owner-comparison-not-run-by-the-implementation-agent)
and [terms/feasibility](regional-card-proposal.md#kinobaza-url-context-decision)
first. No destination-page checks or offer verification in this experiment.
The commands below intentionally stop/restart **only this checkout's verified
demo**, when the owner chooses; the implementation agent does not run them
against the active owner copy. No system/SSH/firewall changes.

If SSH opens **cmd.exe**, first enter PowerShell (separate command):

```text
powershell.exe -NoProfile
```

An installed `pwsh.exe -NoProfile` is an alternative; existing script policy
must permit reviewed helpers. Do not bypass/change policy. Confirm the shell
with `$PSVersionTable.PSVersion`. Then inspect status and update the correct
copy without overwriting changes. After stopping that copy at the owner's
choice and only with no conflicting changes:

```powershell
Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; git status --short --branch; git fetch --prune origin
```

Select `codex/mw-fut-01-kinobaza-url-context`; if not local, use
`git switch --track origin/codex/mw-fut-01-kinobaza-url-context`. If already local,
use `git switch codex/mw-fut-01-kinobaza-url-context`, then
`git merge --ff-only origin/codex/mw-fut-01-kinobaza-url-context` and inspect HEAD.
Stop on conflicts/divergence; no reset/clean/force. Preserve untracked files.

Each following code block is **one PowerShell line** with explicit `;`, resets
all scenario switches, asks for this Windows host's actual LAN IPv4 again and
passes port/access explicitly. No variables need to survive a prior SSH session.
Hidden prompts collect a separate LAN password and, only in live mode, API key.
No secrets in commands/history/files; inherited secret values are cleared from
the launching shell rather than reused. Enter the API key only when prompted.

First, synthetic Coherence (no API call):

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'synthetic'; $env:DEMO_RETRIEVAL = 'url-context'; $env:DEMO_URL_SOURCE = 'kinobaza'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Safari: **`http://<actual-Windows-IPv4>:4317`**, substitute the verified IP just
entered; username **`demo`**, password from the hidden LAN prompt. The helper
prints the exact URL; no guessed IP, localhost, credentials in URL or tunnel.
Reload Safari, check `DEMO_URL_SOURCE: kinobaza`, Coherence and the exact source
URL/full prompt, then click once. Explicitly disconnect SSH and repeat a
synthetic check after reload if validating survival; record that separately.
HTTP Basic is unencrypted: trusted home LAN only, not guest/public Wi-Fi.

Only after synthetic and the owner's rights review, live Coherence:

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'url-context'; $env:DEMO_URL_SOURCE = 'kinobaza'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Reload, verify configuration and click once. Start/status/reload alone never
calls Gemini. Then separately, live Dune (a standalone fresh-session command):

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'url-context'; $env:DEMO_URL_SOURCE = 'kinobaza'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'dune-part-two'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Reload Safari and inspect the changed film/source before one click. An error
consumes the session; do not automatically retry or increase output limits.
Keep the same LAN password if desired; Safari may cache Basic Auth. Stop with
`.\research\grounded-answer-demo\windows\Stop-Demo.ps1` when finished. To return
to Apple use `DEMO_URL_SOURCE=apple-tv`; to return to Search remove the source
variable and set `DEMO_RETRIEVAL=search`, then explicitly configure/restart/reload.
Do not infer any provider offer/audio/price from a returned candidate link.
