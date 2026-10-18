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

## Kinobaza HTML owner workflow

Separate owner-approved HTML experiment, not another Gemini run. The
[two-film owner-run checkpoint](digital-ua-owner-validation.md#kinobaza-html--completed-owner-run-checkpoint)
is complete for candidate extraction, not offer verification. Commands below
are retained reproduction instructions, **not a request for another owner test**.
Read the [public-rules and scope decision](regional-card-proposal.md#owner-approved-html-extraction-poc).
No email precondition for this bounded PoC; no approval for regular/commercial
integration. Existing trusted-home-LAN/Basic Auth/SSH safeguards above apply.
The implementation agent never runs these restart commands on the owner demo.

If Termius SSH opens cmd.exe, first enter PowerShell:

```text
powershell.exe -NoProfile
```

An installed `pwsh.exe -NoProfile` is an alternative; do not bypass execution
policy. In the correct checkout inspect first:

```powershell
Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; git status --short --branch; git fetch --prune origin
```

Preserve all tracked/untracked work. Only when ready to replace this copy's
running configuration, stop it with its verified `Stop-Demo.ps1`. With no
conflicting changes, select `codex/mw-fut-01-kinobaza-html`: if not local,
`git switch --track origin/codex/mw-fut-01-kinobaza-html`; if already local,
`git switch codex/mw-fut-01-kinobaza-html`, then
`git merge --ff-only origin/codex/mw-fut-01-kinobaza-html`. Inspect HEAD; stop on
divergence/conflicts, no reset/clean/force or automatic stash. This branch is
stacked on #177, not a second copy of the whole develop diff.

Install the isolated pinned parser once, or after a lockfile change:

```powershell
npm ci --prefix research/grounded-answer-demo --ignore-scripts --no-audit --no-fund
```

Each following block is **one standalone PowerShell line** with `;`. It sets
all scenario switches afresh, prompts again for this Windows host's actual
private LAN IPv4, and passes port/access explicitly. No environment retention
between SSH sessions. **No API key is required or prompted for in HTML mode**;
only the separate hidden LAN password prompt. Inherited key/password variables
are cleared from the launching shell, never printed or written to files.

First synthetic Coherence — no source GET:

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'synthetic'; $env:DEMO_RETRIEVAL = 'kinobaza-html'; $env:DEMO_URL_SOURCE = 'kinobaza'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Open the **exact URL printed by Start**, `http://<actual-Windows-IPv4>:4317`;
Safari username **demo**, password from the hidden LAN prompt. Use the actual
verified IP, not another project's address, localhost, a tunnel or internet
URL. HTTP Basic is not encryption: trusted home Wi-Fi only. Reload Safari and
check `kinobaza-html`, film, fixed source and operation before clicking once.
The synthetic result must say invented/no page fetched and show Example-only
providers in explicit UA/foreign/unknown groups, never real offer validation.

Explicitly disconnect SSH, then reload Safari and parse synthetic once to test
survival. Reconnect and inspect status. Record this owner check separately;
parent-process-exit tests are not actual Termius/Safari validation.

Then live Coherence — **one manual source GET after the click**, no model:

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'kinobaza-html'; $env:DEMO_URL_SOURCE = 'kinobaza'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Reload/verify/click once. Then separately live Dune, also self-contained:

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'kinobaza-html'; $env:DEMO_URL_SOURCE = 'kinobaza'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'dune-part-two'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Start/status/reload never fetches a Kinobaza card. The click consumes the token,
including failure; no retries. Do not use an error as a reason to bypass access
controls or immediately rerun. Stop on redirect/403/429/CAPTCHA, identity or
unsupported-markup results, or changed applicable rules. No destination links
are automatically opened; do not resolve redirects as part of this test.

Compare the extracted identity and provider labels with the source card. Verify
explicit UA versus foreign sections, territory-unknown badges, attribute `href`
versus source spelling `rawHref`, unchanged percent/query encoding and relative
values visibly marked as relative. Missing fields remain unresolved; links do
not prove availability/localization/prices/entitlement. Do not archive live HTML,
results, screenshots, account details or HAR; report concise owner observations.
Stop after these two films. HTML extraction is now owner-reported complete;
this mode's explicit SSH-disconnect behavior was not separately reported in that
checkpoint. No additional test is required for the documentation update. Stop
via this copy's helper when finished; old Gemini modes remain available under
their previous switches.

## Movie of the Night API owner workflow

Non-LLM UA probe; [two owner runs are now complete](digital-ua-owner-validation.md#movie-of-the-night--two-completed-owner-run-results).
Commands below are retained reproduction steps, **not a request to rerun**.
The year-only identity correction is offline-tested, not live-revalidated.
See [scope/terms](regional-card-proposal.md#approved-non-llm-api-probe)
and [fixed IDs/result contract](../README.md#movie-of-the-night-api-probe). Previous
LAN auth and detached-process safeguards apply unchanged. No systems changes.
The helper adds only credential routing for this provider; synthetic/mock Windows
tests cover it. No compulsory repeat SSH-disconnect or already confirmed card
checks. The original plan of **two requests**, one per film, is complete. The
optional synthetic smoke and live commands below are reproduction instructions
only. Do not run them on behalf of the owner or request another round now.

### Get a direct API key (owner action, no paid plan required)

1. Open the official [developer portal](https://developers.movieofthenight.com/),
   sign in/create a developer account using its normal flow, and review its
   [current Terms](https://developers.movieofthenight.com/terms-and-conditions).
2. Choose/activate **Free** if the console requires a plan choice. The
   [direct pricing page](https://www.movieofthenight.com/about/api/pricing), checked
   October 18, 2026, lists **1,000 requests/month**, all endpoints/catalogues,
   $0/month and no payment details. No paid upgrade is needed for these two
   requests. Stop if signup shows different requirements; do not authorize a
   payment/paid subscription automatically. Quota is a hard limit, not retries.
3. Obtain/copy the API key from the developer console as described in the
   [official getting-started docs](https://docs.movieofthenight.com/). Use the
   **direct portal** key, not a RapidAPI subscription/key. This transport is
   `https://api.movieofthenight.com/v4` with the `X-API-Key` header.
4. Do not paste the key into source, chat, a PowerShell command, file, task,
   transcript or screenshot. Each live helper start asks for **MOTN_API_KEY**
   through `Read-Host -AsSecureString`; paste only into that hidden prompt.
   `-ApiKey` accepts SecureString for programmatic callers, not a plaintext CLI
   argument. Gemini key is not used. Synthetic does not need an API key.

### Correct checkout, restart and Safari

If SSH initially opens cmd.exe, enter `powershell.exe -NoProfile` (or installed
`pwsh.exe -NoProfile`). Do not bypass execution policy. Inspect the right copy:

```powershell
Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; git status --short --branch; git fetch --prune origin
```

Preserve tracked/untracked files. When ready, stop only this copy's verified demo
before switching files. Select **codex/mw-fut-01-motn-api**: if not local,
`git switch --track origin/codex/mw-fut-01-motn-api`; otherwise
`git switch codex/mw-fut-01-motn-api`, then
`git merge --ff-only origin/codex/mw-fut-01-motn-api`. Inspect HEAD; stop on
conflict/divergence, no reset/clean/force/stash. This PR is stacked on #178.
No npm install is needed for this API mode.

Each block below is **one standalone PowerShell line**, redefines all relevant
switches after any SSH reconnect, clears stale key/source/region variables,
and asks for the actual private IPv4 of this Windows machine. Start asks for the
LAN password hidden; live also asks for the direct API key hidden. Secrets go
only into the detached child's environment, not arguments/state/logs. Do not
infer keys from an inherited SSH environment. Current owner demo is stopped only
when the owner deliberately runs these restart lines.

Optional synthetic Coherence (no API/network):

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'synthetic'; $env:DEMO_RETRIEVAL = 'motn-api'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_URL_SOURCE,Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:MOTN_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Live Coherence — one title GET after the click:

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'motn-api'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'coherence'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_URL_SOURCE,Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:MOTN_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Live Dune — one separate title GET:

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'motn-api'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = 'dune-part-two'; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_URL_SOURCE,Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:MOTN_API_KEY,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

Safari: **http://<actual-Windows-IPv4>:4317**, exact URL printed by Start,
username **demo**, separate LAN password. Trusted private home Wi-Fi only;
HTTP Basic is not encrypted. Reload after restart, verify film/IMDb, `motn-api`,
UA and fixed API URL **before** one click. Start/status/reload do not call the
provider. Waiting/finished/error consumes one token; do not automatically retry.
No Search/model call, country request or destination navigation follows.

Check compact per-offer fields and unknowns, without transferring audio/price
between offers or treating Apple service name as subscription. Record only a
short useful/missing/new-or-conflicting summary for each film; no full JSON or
metadata unless an error requires narrow diagnosis (never keys/account data).
Earlier dated card checks are not guaranteed current truth: repeat a specific
card check **only** for a new or materially conflicting observation, not all
platforms. Do not archive output/screenshots/HAR. Stop after the two requests;
errors/quota/identity mismatch are findings, not instructions to retry or scrape.
No data may be sent to an LLM or used for AI training/evaluation/improvement.
The current checkpoint does not request another live/synthetic/SSH-disconnect
test or card recheck. If a genuine disconnect problem appears, report status without secrets;
do not relax auth/Host/Origin or introduce a session-bound fallback.

## TMDb data owner workflow

Isolated non-LLM probe, fixed Coherence/Dune IDs, separate metadata A / UA
providers B. [Result contract](../README.md#tmdb-data-probe),
[scoped terms/readiness record](tmdb-probe-handoff.md#implementation-record).
New results are **live-unvalidated**. No compulsory repeat synthetic or
SSH-disconnect owner test: the existing detached/LAN workflow is unchanged;
only provider token routing was added and checked with a mock-only temp child.
Do not repeat MOTN or known streaming-card checks without a specific new issue.

### Token and readiness (once, owner only)

1. Sign in to your own [TMDb account/API settings](https://www.themoviedb.org/settings/api).
   If API access is not set up, follow the normal developer application flow
   linked there. Describe this actual personal, non-commercial research scope;
   do not invent a production URL or submit information on the owner's behalf.
2. Review the applicable current API/account agreement and attribution for this
   bounded non-LLM, transient-display use. Agent reads of the
   [complete Terms](https://www.themoviedb.org/api-terms-of-use) were robots-denied,
   including October 18, 2026. The current [FAQ](https://developer.themoviedb.org/docs/faq)
   describes conditional non-commercial use without an API fee, not zero total
   costs or full legal clearance. Commercial licensing is a separate question;
   no paid plan is selected or purchased here. If normal setup presents new
   requirements, stop rather than automatically accepting a paid upgrade.
   If direct conflict applies, stop. If text remains unavailable/ambiguous,
   retain synthetic only and keep live readiness conditional. No email is
   demanded just because the text was inaccessible. The local logo comes from
   official docs; include current approved-logo/attribution requirements in
   this review. Do not accept terms automatically via this demo.
3. In API settings copy **API Read Access Token**, not the v3 `api_key` value.
   [Official application authentication](https://developer.themoviedb.org/docs/authentication-application)
   documents `Authorization: Bearer` for v3/v4. No account/user token OAuth flow
   or TMDb/provider account password is needed by the demo.
4. Start prompts for `TMDB_READ_ACCESS_TOKEN` with `Read-Host -AsSecureString`
   (`-ApiKey` parameter is SecureString for tests/programmatic callers). Paste
   only in the hidden prompt, never commands/chat/files/transcripts/screenshots.
   Helper passes only this credential in the child's environment; no Gemini,
   MOTN or inherited production key. Separate hidden LAN password, username demo.

### Checkout and a single restart command

If Termius SSH opens cmd.exe, first run `powershell.exe -NoProfile` (or installed
`pwsh.exe -NoProfile`). Do not bypass execution policy. Inspect your actual copy:

```powershell
Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; git status --short --branch; git fetch --prune origin
```

Preserve all tracked/untracked files. Before switching/updating running demo
files, the **owner**, not the agent/test, deliberately stops only this copy with
`.\research\grounded-answer-demo\windows\Stop-Demo.ps1`. Then select
`codex/mw-fut-01-tmdb-data` (if absent locally:
`git switch --track origin/codex/mw-fut-01-tmdb-data`; otherwise
`git switch codex/mw-fut-01-tmdb-data`), then
`git merge --ff-only origin/codex/mw-fut-01-tmdb-data`. Inspect HEAD and scope;
stop on divergence/conflict, no reset/clean/stash/force. This branch is stacked
on #179, not a reason to merge its parents. No npm install for TMDb mode.

**One standalone PowerShell restart line**, after the terms readiness condition.
It resets every relevant switch/key after SSH reconnect. Enter `coherence` for
the first film, `dune-part-two` for the second; enter THIS Windows host's actual
private IPv4, not another device/project's IP. Start prompts for LAN password and
TMDb token hidden. Secrets are not arguments/state/logs; no response archive.

```powershell
$ErrorActionPreference = 'Stop'; Set-Location 'C:\Users\DenysLis\movie-wishlist-codex'; $tmdbFilm = Read-Host 'Film: coherence or dune-part-two'; if ($tmdbFilm -notin @('coherence','dune-part-two')) { throw 'Unsupported fixed film' }; $windowsIPv4 = Read-Host 'Actual private IPv4 of THIS Windows machine'; .\research\grounded-answer-demo\windows\Stop-Demo.ps1; $env:DEMO_MODE = 'live'; $env:DEMO_RETRIEVAL = 'tmdb-data'; $env:DEMO_DISCOVERY = 'digital-ua'; $env:DEMO_FILM = $tmdbFilm; $env:DEMO_SYNTHETIC_SCENARIO = 'grounded'; Remove-Item Env:DEMO_URL_SOURCE,Env:DEMO_AMAZON_REGION,Env:GEMINI_API_KEY,Env:MOTN_API_KEY,Env:TMDB_READ_ACCESS_TOKEN,Env:DEMO_LAN_PASSWORD -ErrorAction SilentlyContinue; .\research\grounded-answer-demo\windows\Start-Demo.ps1 -Access lan -BindIPv4 $windowsIPv4 -Port 4317; .\research\grounded-answer-demo\windows\Status-Demo.ps1
```

For optional synthetic use only (not an additional required owner test), change
that line's `DEMO_MODE` to `synthetic`; no API token prompt or network request.
Status/stop remain the existing helpers. Each live start asks for the token
again; no reliance on prior SSH environment. Detached process keeps the token
only in memory until stopped; no storage or service/task configuration.

### One short Safari session, two clicks total

Open **http://<actual-Windows-IPv4>:4317**, exactly Start's printed URL, Basic
username **demo**, separate LAN password. Trusted private home Wi-Fi only; HTTP
Basic credentials are not encrypted. No firewall/SSH/network/service changes.
Reload after each restart, check film/IDs, `tmdb-data`, UA, uk-UA, both planned
URLs and max-two cap before clicking **once**. The existing Termius → Safari
workflow works independently of an active SSH session; there is no requirement
to repeat the earlier disconnect demonstration for this iteration.

First Coherence, then restart with the same command choosing Dune and reload
Safari. **One click per film**, at most two serial title-level HTTP requests
each (four total). B is not requested if A fails primary identity. Missing append
stays partial, errors/quota/identity conflicts are findings: stop, no retry or
follow-up round. Start/status/reload alone makes no TMDb request.

Report four concise points per film in the
[pending owner record](digital-ua-owner-validation.md#tmdb-data-probe--owner-validation-pending):
useful cross-source identity fields; actual UA providers/access buckets/states;
explicit Ukrainian catalogue text vs indirect language clues; useful new data
over dated MOTN/Kinobaza observations. Requested locale/UA alias/original audio
is not provider dubbing/subtitles. TMDb watch-page link is not a provider deep
link; JustWatch overlap is not independent confirmation or account entitlement.
No general accuracy, full JSON, screenshots or output archive. Reopen a known
streaming card only for a **concrete new material discrepancy**, not by default.
Stop only this copy via its Stop helper when finished.
