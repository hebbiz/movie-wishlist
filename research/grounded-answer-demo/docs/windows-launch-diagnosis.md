# Windows detached-launch diagnosis and fix

October 18, 2026; follow-up in PR #176. MW-FUT-01 remains **Discovery**.
No live API, system/SSH/firewall/profile changes, fallback or owner-demo stop.

## Conclusion: shared code defect, not a URL Context regression or job denial

`Get-Command node.exe -CommandType Application` returns **two application
matches in this runner**. Taking `.Source` produced an array. PowerShell's
conversion to the native method's string parameter did not supply a single
valid executable path. `CreateProcessW` returned **123 / ERROR_INVALID_NAME**.

Minimal fix: select the first application result before taking `.Source`.
This preserves PATH precedence and still uses one absolute executable path.
It does not change `DETACHED_PROCESS`, `CREATE_NEW_PROCESS_GROUP`,
`CREATE_UNICODE_ENVIRONMENT`, `CREATE_BREAKAWAY_FROM_JOB`, no inherited handles,
Basic Auth, Host/Origin, one-shot sessions or safe stop. No session-bound fallback.

The defect exists in **both reviewed commits**, predating URL Context. It can be
latent on a host with a single Node match; the owner's earlier working scenario
is not contradicted. The previous report's unestablished cause is resolved by
this controlled comparison, not retrospectively called a passing old test.

## Same-runner comparison

Refs: #175 `01db2331da3c169ce7c7b267fe69adadefe6952a` and reviewed #176
`6f280b9009fdf754992ba9056bcc759c73173b09`.

One invocation of [launch-matrix.ps1](../test/launch-matrix.ps1) exported both
refs into unique temporary copies. Every probe used the same PowerShell 7.6.5
executable, `-NoProfile -File`, `ProcessStartInfo` with shell execution off,
hidden window and redirected harness output; Node v24.22.0; synthetic Coherence
digital-UA; free loopback ports. No change to runner policy/PATH between rows.
No real credentials or responses were printed/persisted. Baseline #175 has no
URL Context implementation, so its URL row is explicitly unsupported, not a
silently ignored switch presented as a successful URL test.

Three phases: untouched exports; the same diagnostic-only C# overlay on each;
then just the one-line executable-selection substitution in each archived helper.
The overlay/substitution never modifies either Git ref. Reviewed native launcher
sources were identical, SHA256
`F607DA13AEF9D4449D929076EFB1B536B0AD6541C3C980E10A83C53D039B598A`.

| Reviewed ref / synthetic retrieval | Original | Diagnostic-only overlay | Diagnostic + single-executable fix |
| --- | --- | --- | --- |
| #175 Search | Win32 123 | CreateProcessW / Win32Exception / 123 | Started; synthetic `/answer` succeeds |
| #175 URL Context | Unsupported; not run | Unsupported; not run | Unsupported; not run |
| #176 Search | Win32 123 | CreateProcessW / Win32Exception / 123 | Started; synthetic `/answer` succeeds |
| #176 URL Context | Win32 123 | CreateProcessW / Win32Exception / 123 | Started; synthetic `/answer` succeeds |

Every supported row reported two Node candidates and the same read-only job
probe: `InJob=true`, `LimitFlags=10240` (`0x2800`), `BreakawayOK=true`,
`SilentBreakawayOK=false`, `QueryError=null`. This queries the **immediate** job,
not all ancestor jobs. More importantly, corrected launches succeed with the
same creation flags in the same runner: no runner/job bypass was needed.

[Microsoft's creation flags](https://learn.microsoft.com/en-us/windows/win32/procthread/process-creation-flags)
require job breakaway permission for `CREATE_BREAKAWAY_FROM_JOB`.
[QueryInformationJobObject](https://learn.microsoft.com/en-us/windows/win32/api/jobapi2/nf-jobapi2-queryinformationjobobject)
documents the immediate-job query, and the
[basic limits structure](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information)
defines the flags. [Win32 error 123](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-)
is invalid filename/directory/volume syntax, not an access-denied diagnosis.
These observations establish this failure's code cause; other runners/SSH jobs
may still forbid breakaway and must fail closed.

## Safe diagnostics and regression checks

The native launcher reports only fixed stage, underlying exception type and
Win32 `NativeErrorCode` (or `not-applicable` for a managed error). It does not
attach a raw inner exception, print command arguments, environment values,
credentials, provider content or raw native error text. Allocation, native
creation and process-handle stages remain distinguishable. Diagnostics do not
retry or alter launch flags. The fixture reports the PowerShell wrapper type
separately; it does not mistake `MethodInvocationException` for the native cause.

After the fix, both `windows.test.ps1` and `windows.test.ps1 -UrlContext` pass in
temporary copies: actual launching parent exits, configuration inheritance,
duplicate-start guard, refusal to kill an unrelated Node from forged metadata,
safe stop and fresh restart. Diagnostic native/managed error tests verify that
synthetic sensitive exception text cannot escape via message/inner exception.
The full Node/HTTP/browser regression suite passes **121 checks, 3 skipped**
(missing WebKit twice, optional same-host LAN IP not supplied); no failures.
Only test-created processes/copies are stopped/removed. This is **not** an actual
SSH disconnect or real Safari test of the new mode.

Reproduce from PowerShell 7 in the correct reviewed checkout (no owner stop):
Use a fresh shell after updating: `Add-Type` caches the launcher type in a
PowerShell process. Reconnecting SSH does not itself stop an already detached
owner Node process; do not call the original checkout's Stop helper.

```powershell
.\research\grounded-answer-demo\test\launch-diagnostics.test.ps1
.\research\grounded-answer-demo\test\launch-matrix.ps1
.\research\grounded-answer-demo\test\windows.test.ps1
.\research\grounded-answer-demo\test\windows.test.ps1 -UrlContext
```

No execution-policy bypass, installation or machine configuration change. The
matrix only exports the two fixed commits; it reads job limits and does not set
them. It writes temporary test copies, not an environment/response archive.

## Optional owner Termius/Safari synthetic check, without stopping owner demo

First run the isolated loopback tests above through the already configured
Termius PowerShell 7 shell. For Safari, a separate test listener needs a **free
port already allowed for the selected Node executable by the owner's existing
trusted-LAN firewall policy**.
Do not assume 4318 is allowed, do not change rules here, and do not stop the
existing listener on 4317. If no suitable port is already available, leave the
owner demo running and record Safari validation pending; localhost tests remain
usable. Existing [LAN safety/setup guidance](iphone-windows.md) still applies.

Create a distinct temporary checkout from the fetched remote branch; inspect
the intended commit first. No secrets go in Git/archive or command arguments:

```powershell
git status --short --branch
git fetch --prune origin
git log -1 --oneline origin/codex/mw-fut-01-url-context
$probeRoot = Join-Path ([IO.Path]::GetTempPath()) ('mw-owner-launch-' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $probeRoot | Out-Null
$probeZip = Join-Path $probeRoot 'source.zip'
git archive --format=zip --output=$probeZip origin/codex/mw-fut-01-url-context research/grounded-answer-demo
if ($LASTEXITCODE) { throw 'Archive failed' }
Expand-Archive -LiteralPath $probeZip -DestinationPath $probeRoot
$probeDemo = Join-Path $probeRoot 'research/grounded-answer-demo'
Write-Output "Test copy — retain this nonsecret path after SSH reconnect: $probeDemo"
$windowsIPv4 = Read-Host 'Verified IPv4 of THIS Windows machine'
$probePort = [int](Read-Host 'Free port already permitted by existing Private/LocalSubnet demo firewall policy')
if ($probePort -lt 1024 -or $probePort -gt 65535) { throw 'Invalid port' }
if (Get-NetTCPConnection -State Listen -LocalPort $probePort -ErrorAction SilentlyContinue) { throw 'Port occupied; do not stop its owner' }
$env:DEMO_MODE = 'synthetic'
$env:DEMO_DISCOVERY = 'digital-ua'
$env:DEMO_FILM = 'coherence'
$env:DEMO_RETRIEVAL = 'search'
Remove-Item Env:DEMO_AMAZON_REGION -ErrorAction SilentlyContinue
Remove-Item Env:DEMO_SYNTHETIC_SCENARIO -ErrorAction SilentlyContinue
& (Join-Path $probeDemo 'windows/Start-Demo.ps1') -Access lan -BindIPv4 $windowsIPv4 -Port $probePort
& (Join-Path $probeDemo 'windows/Status-Demo.ps1')
```

Enter a separate LAN password at the hidden prompt; **no API key is needed**.
Safari: exact printed `http://<actual-Windows-IP>:<probePort>`, Basic username
**demo**. Check synthetic mode/film, explicitly disconnect SSH, reload Safari
and click once. Confirm the invented response, then reconnect Termius. To check
URL Context in that same isolated copy/port:

```powershell
& (Join-Path $probeDemo 'windows/Stop-Demo.ps1')
$env:DEMO_RETRIEVAL = 'url-context'
& (Join-Path $probeDemo 'windows/Start-Demo.ps1') -Access lan -BindIPv4 $windowsIPv4 -Port $probePort
& (Join-Path $probeDemo 'windows/Status-Demo.ps1')
```

Reload Safari; check URL and full prompt before one synthetic click. Explicitly
disconnect SSH again before that check. Simulated retrieval success is not a
real page read. Reconnect and stop **only** the test copy:

```powershell
& (Join-Path $probeDemo 'windows/Stop-Demo.ps1')
```

`$probeDemo`, `$windowsIPv4` and `$probePort` are shell variables; after a fresh
SSH login restore them to the exact test-copy directory/IP/port (retain the
nonsecret path/port before disconnecting). Do not run Stop from the original
owner checkout or copy its PID file. Do not weaken auth/flags, forward ports,
change firewall/service settings or launch live to troubleshoot. Explicit owner
SSH-disconnect validation of this new-mode fix remains pending. Two later
[URL-only live answers through Safari](digital-ua-owner-validation.md#url-context-evaluation-checkpoint--two-owner-run-live-tests)
are owner-reported, not an independent device test or proof of SSH-disconnect
survival after this fix.
