# No process launch, environment/credentials/provider data, or system changes.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -Path (Join-Path $PSScriptRoot '../windows/DetachedProcess.cs')
$sentinel = 'SYNTHETIC_SENSITIVE_TEXT_MUST_NOT_ESCAPE'
foreach ($failure in @([ComponentModel.Win32Exception]::new(123,$sentinel), [InvalidOperationException]::new($sentinel))) {
    $safe = [DemoDetachedLaunchException]::new('CreateProcessW',$failure)
    if ($safe.ToString().Contains($sentinel) -or $safe.InnerException) { throw 'Diagnostic leaks raw exception content.' }
    if (-not $safe.Message.Contains('Stage=CreateProcessW') -or -not $safe.Message.Contains('ExceptionType=' + $failure.GetType().FullName)) { throw 'Missing diagnostic stage/type.' }
    if ($failure -is [ComponentModel.Win32Exception]) {
        if ($safe.NativeErrorCode -ne 123 -or -not $safe.Message.Contains('NativeErrorCode=123')) { throw 'Missing native code.' }
    } elseif ($null -ne $safe.NativeErrorCode -or -not $safe.Message.Contains('NativeErrorCode=not-applicable')) { throw 'Invented native code.' }
}
$launcher = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../windows/Start-Demo.ps1') -Raw
if (-not $launcher.Contains('(Get-Command node.exe -CommandType Application | Select-Object -First 1).Source')) { throw 'Single-executable regression.' }
Write-Output 'PASS: native/managed exception stage/type/code, no raw message/inner exception leakage, single executable selection.'
