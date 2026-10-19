# Same runner, shell and ProcessStartInfo path for every row. Synthetic only.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../..'))
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$matrixRoot = Join-Path $tempBase ('mw-launch-matrix-' + [Guid]::NewGuid().ToString('D'))
$shell = (Get-Process -Id $PID).Path
$null = New-Item -ItemType Directory -Path $matrixRoot
function Free-Port {
    $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 0)
    try { $listener.Start(); return $listener.LocalEndpoint.Port } finally { $listener.Stop() }
}
try {
    $refs = @(
        @{ label='baseline-175'; sha='01db2331da3c169ce7c7b267fe69adadefe6952a' },
        @{ label='reviewed-176'; sha='6f280b9009fdf754992ba9056bcc759c73173b09' }
    )
    foreach ($reference in $refs) {
        $archive = Join-Path $matrixRoot ($reference.label + '.zip')
        & git -C $repository archive --format=zip --output=$archive $reference.sha research/grounded-answer-demo
        if ($LASTEXITCODE) { throw 'Could not export comparison ref.' }
        $snapshot = Join-Path $matrixRoot $reference.label
        Expand-Archive -LiteralPath $archive -DestinationPath $snapshot
        $reference.root = Join-Path $snapshot 'research/grounded-answer-demo'
    }
    # Native launcher source is identical in both reviewed commits. Verify, not assume.
    $nativePath = 'windows/DetachedProcess.cs'
    $hashes = @($refs | ForEach-Object { (Get-FileHash -LiteralPath (Join-Path $_.root $nativePath) -Algorithm SHA256).Hash })
    if ($hashes[0] -cne $hashes[1]) { throw 'Reviewed native launcher differs; comparison needs review.' }
    [ordered]@{ shellVersion=$PSVersionTable.PSVersion.ToString(); shell=$shell; nodeVersion=(& node --version); nativeSourcesIdentical=$true; nativeSHA256=$hashes[0] } | ConvertTo-Json -Compress
    foreach ($phase in @('original','diagnostics-only','single-executable-fix')) {
        foreach ($reference in $refs) {
            if ($phase -ne 'original') {
                # Diagnostic-only overlay, explicitly labelled. Never modifies the ref.
                Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../windows/DetachedProcess.cs') -Destination (Join-Path $reference.root $nativePath)
            }
            if ($phase -eq 'single-executable-fix') {
                # Controlled fixture-only mechanical substitution in the exported
                # original helper, not a replacement with a newer implementation.
                $helperPath = Join-Path $reference.root 'windows/Start-Demo.ps1'
                $helper = [IO.File]::ReadAllText($helperPath)
                $before = '$node = (Get-Command node.exe -CommandType Application).Source'
                $after = '$node = (Get-Command node.exe -CommandType Application | Select-Object -First 1).Source'
                if (-not $helper.Contains($before)) { throw 'Expected original executable selection not found.' }
                [IO.File]::WriteAllText($helperPath, $helper.Replace($before,$after))
            }
            foreach ($retrieval in @('search','url-context')) {
                if ($reference.label -eq 'baseline-175' -and $retrieval -eq 'url-context') {
                    [ordered]@{ ref=$reference.label; sha=$reference.sha; retrieval=$retrieval; phase=$phase; outcome='unsupported-in-baseline-not-run' } | ConvertTo-Json -Compress
                    continue
                }
                $launch = [Diagnostics.ProcessStartInfo]::new($shell)
                $launch.UseShellExecute=$false; $launch.CreateNoWindow=$true
                $launch.RedirectStandardOutput=$true; $launch.RedirectStandardError=$true
                $launch.Arguments = '-NoProfile -File "{0}" -DemoRoot "{1}" -Port {2} -Retrieval {3}' -f (Join-Path $PSScriptRoot 'launch-probe.fixture.ps1'), $reference.root, (Free-Port), $retrieval
                $parent = [Diagnostics.Process]::Start($launch)
                try {
                    $output = $parent.StandardOutput.ReadToEnd(); $errorText = $parent.StandardError.ReadToEnd()
                    if (-not $parent.WaitForExit(20000) -or $parent.ExitCode -ne 0 -or $errorText) { throw 'Probe harness failed; raw output deliberately withheld.' }
                    $row = $output | ConvertFrom-Json
                    [ordered]@{ ref=$reference.label; sha=$reference.sha; retrieval=$retrieval; phase=$phase; probe=$row } | ConvertTo-Json -Depth 6 -Compress
                    if ($phase -eq 'single-executable-fix' -and $row.outcome -ne 'started-synthetic') { throw 'Corrected launcher failed; inspect safe matrix diagnostics, no fallback.' }
                } finally { $parent.Dispose() }
            }
        }
    }
} finally {
    if (Get-Variable -Name refs -ErrorAction SilentlyContinue) {
        foreach ($reference in $refs) {
            if ($reference.ContainsKey('root') -and (Test-Path -LiteralPath (Join-Path $reference.root '.run/instance.json'))) {
                $null = & (Join-Path $reference.root 'windows/Stop-Demo.ps1')
            }
        }
    }
    # Never target a checkout or owner .run. Only this generated, validated temp root.
    $resolved = [IO.Path]::GetFullPath($matrixRoot)
    if (-not $resolved.StartsWith($tempBase.TrimEnd('\') + '\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($resolved) -notmatch '^mw-launch-matrix-[0-9a-f-]{36}$') { throw 'Unsafe matrix cleanup path.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
