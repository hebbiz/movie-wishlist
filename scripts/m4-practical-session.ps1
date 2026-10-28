#Requires -Version 7.0
[CmdletBinding()]
param(
    [ValidatePattern('^[a-f0-9]{40}$')][string]$ExpectedCommit,
    [ValidateSet('practical-five','pilot-retrieval')][string]$Study = 'practical-five',
    [switch]$CheckPrerequisites
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoPath = Split-Path -Parent $PSScriptRoot
$runnerPath = Join-Path $PSScriptRoot 'm4-practical-series.mjs'
$nodePath = 'C:\Program Files\nodejs\node.exe'
$pipeName = 'mw-m4-practical-series-v1'
$utf8 = [Text.UTF8Encoding]::new($false, $true)
$maximumRequest = 4096
$maximumResponse = 524288
$pipe = $null
$secureTmdb = $null
$secureTavily = $null
$context = @{ study = $Study }
$startedAt = [DateTimeOffset]::UtcNow
$expiresAt = $startedAt.AddHours(4)
$completedOperations = 0
$countsIncomplete = $false
$sourceCounts = @{ total = 0; tmdb = 0; search = 0; cards = 0; personPages = 0 }
$failureCode = 'prerequisites'
$pipeCheckStep = $null
$preflightError = $null

function Initialize-M4LocalPipeNative {
    if ('M4PracticalLocalPipe' -as [type]) { return }
    # Compiled in memory, without an output assembly or any credential material.
    # https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-createnamedpipea
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
public static class M4PracticalLocalPipe {
    public const uint RejectRemoteClients = 0x00000008;
    [StructLayout(LayoutKind.Sequential)]
    private struct SecurityAttributes {
        public int Length;
        public IntPtr SecurityDescriptor;
        [MarshalAs(UnmanagedType.Bool)] public bool InheritHandle;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    private static extern SafePipeHandle CreateNamedPipeW(string name, uint openMode,
        uint pipeMode, uint instances, uint outputSize, uint inputSize, uint timeout,
        ref SecurityAttributes security);
    public static NamedPipeServerStream Create(string name, byte[] descriptor) {
        if (String.IsNullOrEmpty(name) || name.Length > 120 || name.IndexOfAny(new[]{'\\','/',':'}) >= 0)
            throw new ArgumentException("invalid-pipe-name");
        var pin = GCHandle.Alloc(descriptor, GCHandleType.Pinned);
        SafePipeHandle handle = null;
        try {
            var security = new SecurityAttributes {
                Length=Marshal.SizeOf<SecurityAttributes>(), SecurityDescriptor=pin.AddrOfPinnedObject(), InheritHandle=false
            };
            // DUPLEX | OVERLAPPED | FIRST_PIPE_INSTANCE. Byte/read-byte/wait are0.
            handle=CreateNamedPipeW(@"\\.\pipe\"+name, 0x40080003, RejectRemoteClients,
                1, 4096, 4096, 0, ref security);
            if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            var stream = new NamedPipeServerStream(PipeDirection.InOut, true, false, handle);
            handle=null; // Stream owns the safe handle, including failure/cancellation cleanup.
            return stream;
        } finally {
            if (handle != null) handle.Dispose();
            pin.Free();
        }
    }
}
'@
}

function New-M4Pipe([string]$Name) {
    Initialize-M4LocalPipeNative
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $security = [IO.Pipes.PipeSecurity]::new()
    $security.SetAccessRuleProtection($true, $false)
    $security.AddAccessRule([IO.Pipes.PipeAccessRule]::new($sid, [IO.Pipes.PipeAccessRights]::FullControl, [Security.AccessControl.AccessControlType]::Allow))
    # NETWORK is a logon-token SID, not a remote-transport test: denying it also
    # denies a legitimate LOCAL client in some SSH logon contexts. Keep a
    # current-user-only protected DACL and reject remote clients in the kernel.
    return [M4PracticalLocalPipe]::Create($Name, $security.GetSecurityDescriptorBinaryForm())
}

function Read-M4Exact([IO.Stream]$Stream, [byte[]]$Bytes, [Threading.CancellationToken]$Token) {
    $offset = 0
    while ($offset -lt $Bytes.Length) {
        $read = $Stream.ReadAsync($Bytes, $offset, $Bytes.Length - $offset, $Token).GetAwaiter().GetResult()
        if ($read -eq 0) { throw 'incomplete-frame' }
        $offset += $read
    }
}

function Read-M4Frame([IO.Stream]$Stream, [int]$Maximum, [int]$TimeoutMs) {
    $deadline = [Threading.CancellationTokenSource]::new($TimeoutMs)
    $header = [byte[]]::new(4)
    $bytes = $null
    try {
        Read-M4Exact $Stream $header $deadline.Token
        $length = [BitConverter]::ToInt32($header, 0)
        if ($length -lt 2 -or $length -gt $Maximum) { throw 'frame-size' }
        $bytes = [byte[]]::new($length)
        Read-M4Exact $Stream $bytes $deadline.Token
        return $utf8.GetString($bytes)
    } finally {
        [Array]::Clear($header)
        if ($bytes) { [Array]::Clear($bytes) }
        $deadline.Dispose()
    }
}

function Write-M4Frame([IO.Stream]$Stream, [string]$Text, [int]$TimeoutMs = 5000) {
    $bytes = $utf8.GetBytes($Text)
    if ($bytes.Length -gt $maximumResponse) { throw 'response-size' }
    $header = [BitConverter]::GetBytes([int]$bytes.Length)
    $deadline = [Threading.CancellationTokenSource]::new($TimeoutMs)
    try {
        [void]$Stream.WriteAsync($header, 0, 4, $deadline.Token).GetAwaiter().GetResult()
        [void]$Stream.WriteAsync($bytes, 0, $bytes.Length, $deadline.Token).GetAwaiter().GetResult()
        [void]$Stream.FlushAsync($deadline.Token).GetAwaiter().GetResult()
    } finally {
        [Array]::Clear($header)
        [Array]::Clear($bytes)
        $deadline.Dispose()
    }
}

function Test-M4LocalPipe {
    $server = $null
    $client = $null
    try {
        $name = 'mw-m4-prerequisites-' + [Guid]::NewGuid().ToString('N')
        $script:pipeCheckStep = 'create'
        $server = New-M4Pipe $name
        $waiting = $server.WaitForConnectionAsync()
        $client = [IO.Pipes.NamedPipeClientStream]::new('.', $name, [IO.Pipes.PipeDirection]::InOut, [IO.Pipes.PipeOptions]::Asynchronous)
        $script:pipeCheckStep = 'local-connect'
        $client.Connect(3000)
        if (-not $waiting.Wait(3000)) { throw 'acl-connect-timeout' }
        $script:pipeCheckStep = 'request-frame'
        Write-M4Frame $client '{"probe":true}'
        if ((Read-M4Frame $server 4096 3000) -cne '{"probe":true}') { throw 'acl-request' }
        $script:pipeCheckStep = 'response-frame'
        Write-M4Frame $server '{"ok":true}'
        if ((Read-M4Frame $client 4096 3000) -cne '{"ok":true}') { throw 'acl-response' }
        $script:pipeCheckStep = 'acl-check'
        $actual = [IO.Pipes.PipesAclExtensions]::GetAccessControl($server)
        $rules = @($actual.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        if ($rules.Count -ne 1 -or -not $actual.AreAccessRulesProtected -or
            $rules[0].IdentityReference -ne $sid -or $rules[0].AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
            $rules[0].PipeAccessRights -ne [IO.Pipes.PipeAccessRights]::FullControl) { throw 'acl-contract' }
        $script:pipeCheckStep = 'complete'
    } catch {
        $errorObject = $_.Exception.GetBaseException()
        $principal = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
        $script:preflightError = @{ step=$script:pipeCheckStep; exceptionType=$errorObject.GetType().FullName; hresult=$errorObject.HResult;
            networkLogon=$principal.IsInRole([Security.Principal.SecurityIdentifier]::new([Security.Principal.WellKnownSidType]::NetworkSid,$null)) }
        if ($errorObject -is [ComponentModel.Win32Exception]) { $script:preflightError.win32Code=$errorObject.NativeErrorCode }
        throw
    } finally {
        if ($client) { $client.Dispose() }
        if ($server) { $server.Dispose() }
    }
}

function ConvertTo-M4Operation([object]$Value) {
    if ($Value -isnot [Collections.IDictionary]) { throw 'operation-object-required' }
    foreach ($field in $Value.Keys) { if ($field -cnotin @('action', 'film', 'url')) { throw 'operation-field' } }
    if ($Value.action -isnot [string] -or $Value.action -cnotin @('identify', 'resolve', 'inspect-card', 'inspect-person', 'inspect-director', 'status', 'stop')) { throw 'operation-action' }
    $operation = @{ action = $Value.action }
    if ($Value.Contains('film')) {
        $filmNames = if ($Study -ceq 'pilot-retrieval') { @('Blade Runner', 'Mortal Kombat', 'Supergirl') } else { @('Blade Runner 2049', 'Mortal Kombat', 'Alien', 'Oppenheimer', 'Dune: Part Two') }
        if ($Value.film -is [string] -and $Value.film -cin $filmNames) { $operation.film = [Array]::IndexOf($filmNames, $Value.film) + 1 }
        elseif (($Value.film -is [int] -or $Value.film -is [long]) -and $Value.film -ge 1 -and $Value.film -le $filmNames.Count) { $operation.film = [int]$Value.film }
        else { throw 'operation-film' }
    } elseif ($Value.action -cnotin @('status', 'stop')) { throw 'operation-film-required' }
    if ($Value.action -cin @('inspect-card', 'inspect-person')) {
        if ($Value.url -isnot [string] -or $Value.url.Length -gt 512) { throw 'operation-url' }
        $uri = $null
        if (-not [Uri]::TryCreate($Value.url, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -cne 'https' -or $uri.Host -cne 'kinobazaua.com' -or $uri.Port -ne 443 -or $uri.UserInfo -or $uri.Query -or $uri.Fragment) { throw 'operation-url' }
        $route = if ($Value.action -ceq 'inspect-card') { 'titles' } else { 'persons' }
        if ($Value.url -cnotmatch ('^https://kinobazaua\.com/' + $route + '/[a-z0-9]+(?:-[a-z0-9]+)*$')) { throw 'operation-url' }
        # The worker independently admits this URL and verifies its relation to the film.
        $operation.url = $Value.url
    } elseif ($Value.Contains('url')) { throw 'operation-url-not-supported' }
    return $operation
}

function Get-M4PlainText([Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

function Invoke-M4Worker([hashtable]$Operation) {
    $child = $null
    $childStarted = $false
    $tmdbText = $null
    $tavilyText = $null
    $payload = $null
    $outputText = $null
    $output = [IO.MemoryStream]::new()
    $buffer = [byte[]]::new(4096)
    $deadline = [Threading.CancellationTokenSource]::new(120000)
    try {
        $tmdbText = Get-M4PlainText $secureTmdb
        $tavilyText = Get-M4PlainText $secureTavily
        if ($tmdbText -match '\s' -or $tavilyText -match '\s') { throw 'credential-format' }
        $payload = @{ tmdbToken = $tmdbText; tavilyKey = $tavilyText; operation = $Operation; context = $script:context } | ConvertTo-Json -Depth 40 -Compress
        $start = [Diagnostics.ProcessStartInfo]::new()
        $start.FileName = $nodePath
        $start.WorkingDirectory = $repoPath
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardInput = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        $start.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
        $start.StandardOutputEncoding = $utf8
        $start.StandardErrorEncoding = $utf8
        $start.ArgumentList.Add($runnerPath)
        $start.ArgumentList.Add('--session-worker')
        # A fresh fixed worker for each operation hot-reloads authorized local edits.
        # Empty inheritance removes all source credentials, Node hooks/debug and TLS overrides.
        $start.Environment.Clear()
        foreach ($name in @('SystemRoot', 'WINDIR', 'TEMP', 'TMP')) {
            $value = [Environment]::GetEnvironmentVariable($name)
            if ($value) { $start.Environment[$name] = $value }
        }
        $child = [Diagnostics.Process]::new()
        $child.StartInfo = $start
        if (-not $child.Start()) { throw 'worker-start' }
        $childStarted = $true
        # Drain errors without retaining or printing them, even when a source echoes a secret.
        $stderrDiscard = $child.StandardError.BaseStream.CopyToAsync([IO.Stream]::Null, $deadline.Token)
        [void]$child.StandardInput.WriteAsync($payload).WaitAsync($deadline.Token).GetAwaiter().GetResult()
        $child.StandardInput.Close()
        $payload = $null
        while (($read = $child.StandardOutput.BaseStream.ReadAsync($buffer, 0, $buffer.Length, $deadline.Token).GetAwaiter().GetResult()) -gt 0) {
            if ($output.Length + $read -gt $maximumResponse) { throw 'worker-output-limit' }
            $output.Write($buffer, 0, $read)
        }
        [void]$child.WaitForExitAsync($deadline.Token).GetAwaiter().GetResult()
        [void]$stderrDiscard.GetAwaiter().GetResult()
        if ($child.ExitCode -ne 0) { throw 'worker-failed' }
        $outputText = $utf8.GetString($output.GetBuffer(), 0, [int]$output.Length)
        if ($outputText.Contains($tmdbText) -or $outputText.Contains($tavilyText)) { throw 'worker-secret-leak' }
        $envelope = ConvertFrom-Json -InputObject $outputText -AsHashtable -Depth 40
        if ($envelope -isnot [Collections.IDictionary] -or -not $envelope.Contains('result') -or -not $envelope.Contains('context') -or $envelope.result -isnot [Collections.IDictionary]) { throw 'worker-contract' }
        foreach ($field in $envelope.Keys) { if ($field -cnotin @('result', 'context')) { throw 'worker-contract' } }
        # Both private context and safe result passed the literal-secret guard.
        $script:context = $envelope.context
        return $envelope.result
    } finally {
        if ($child) {
            if ($childStarted -and -not $child.HasExited) { try { $child.Kill($true); [void]$child.WaitForExit(3000) } catch {} }
            $child.Dispose()
        }
        [Array]::Clear($buffer)
        [Array]::Clear($output.GetBuffer())
        $output.Dispose()
        $deadline.Dispose()
        $payload = $null; $tmdbText = $null; $tavilyText = $null; $outputText = $null
    }
}

function Get-M4SessionSummary {
    return @{ startedAt = $startedAt.ToString('o'); expiresAt = $expiresAt.ToString('o'); completedOperations = $completedOperations; sourceCounts = $sourceCounts; countsIncomplete = $countsIncomplete }
}

try {
    if (-not $IsWindows -or -not $ExpectedCommit -or -not (Test-Path -LiteralPath $nodePath -PathType Leaf) -or -not (Test-Path -LiteralPath $runnerPath -PathType Leaf)) { throw 'prerequisites' }
    $initialCommit = & git -C $repoPath rev-parse HEAD 2>$null
    if ($LASTEXITCODE -ne 0 -or $initialCommit -cne $ExpectedCommit) { throw 'checkout' }
    if ([Diagnostics.FileVersionInfo]::GetVersionInfo($nodePath).ProductMajorPart -lt 22) { throw 'node-version' }
    $failureCode = 'local-pipe-prerequisites'
    Test-M4LocalPipe
    if ($CheckPrerequisites) {
        $failureCode = 'local-worker-prerequisites'
        # Authored placeholders, not env values. The status operation cannot fetch.
        $secureTmdb = ConvertTo-SecureString 'AUTHORED_TMDB_PLACEHOLDER' -AsPlainText -Force
        $secureTavily = ConvertTo-SecureString 'AUTHORED_TAVILY_PLACEHOLDER' -AsPlainText -Force
        $probe = Invoke-M4Worker @{ action = 'status' }
        if ($probe.execution -cne 'local-diagnostic' -or $probe.status -cne 'ready' -or $probe.counts.total -ne 0) { throw 'worker-round-trip' }
        @{ execution = 'local-diagnostic'; status = 'prerequisites-ok'; study = $Study; localCheckoutSha = $initialCommit; explicitSidAcl = $true; remoteClientsRejected = $true; localRoundTrip = $true; workerStatusRoundTrip = $true; sourceRequests = 0; credentialPrompts = 0 } | ConvertTo-Json -Compress
        exit 0
    }
    $failureCode = 'interactive-console-required'
    if ([Console]::IsInputRedirected) { throw 'interactive-console-required' }
    $pipe = New-M4Pipe $pipeName
    Write-Host ('Local diagnostic study: ' + $Study + '. Enter each key once; leave this owner SSH window open (maximum four hours).')
    Write-Host 'Keys stay in process memory. Use an unrecorded terminal; close the window or send stop to end the session.'
    $failureCode = 'hidden-input'
    $secureTmdb = Read-Host 'TMDB_READ_ACCESS_TOKEN (hidden)' -AsSecureString
    $secureTavily = Read-Host 'TAVILY_API_KEY (hidden)' -AsSecureString
    if ($secureTmdb.Length -lt 10 -or $secureTmdb.Length -gt 4096 -or $secureTavily.Length -lt 10 -or $secureTavily.Length -gt 4096) { throw 'hidden-input' }
    $startedAt = [DateTimeOffset]::UtcNow
    $expiresAt = $startedAt.AddHours(4)
    Write-Host 'Session ready for Codex. No source requests have been made. Leave this window open.'
    $stop = $false
    while (-not $stop -and [DateTimeOffset]::UtcNow -lt $expiresAt) {
        $waiting = [Threading.CancellationTokenSource]::new($expiresAt - [DateTimeOffset]::UtcNow)
        $replyText = $null
        $operation = $null
        $acceptedConnection = $false
        $failureCode = 'invalid-request'
        try {
            [void]$pipe.WaitForConnectionAsync($waiting.Token).GetAwaiter().GetResult()
            $acceptedConnection = $true
            $requestText = Read-M4Frame $pipe $maximumRequest 5000
            $operation = ConvertTo-M4Operation (ConvertFrom-Json -InputObject $requestText -AsHashtable -Depth 10)
            $requestText = $null
            $checkoutSha = & git -C $repoPath rev-parse HEAD 2>$null
            if ($LASTEXITCODE -ne 0 -or $checkoutSha -notmatch '^[a-f0-9]{40}$') { throw 'checkout' }
            & git -C $repoPath diff --quiet HEAD -- 2>$null
            if ($LASTEXITCODE -notin @(0, 1)) { throw 'checkout-diff' }
            $trackedEdits = $LASTEXITCODE -eq 1
            if ($operation.action -ceq 'stop') {
                $stop = $true
                $result = @{ execution = 'local-diagnostic'; status = 'session-stopped'; sourceRequests = 0 }
            } else {
                $failureCode = 'worker-failed-or-interrupted-no-automatic-retry'
                $result = Invoke-M4Worker $operation
                $completedOperations++
                if ($result.Contains('counts') -and $result.counts -is [Collections.IDictionary]) {
                    foreach ($name in @($sourceCounts.Keys)) {
                        if ($result.counts.Contains($name) -and ($result.counts[$name] -is [int] -or $result.counts[$name] -is [long]) -and $result.counts[$name] -ge 0) { $sourceCounts[$name] += $result.counts[$name] }
                    }
                }
            }
            $reply = @{ execution = 'local-diagnostic'; localCheckoutSha = $checkoutSha; localTrackedEdits = $trackedEdits; workerSha256 = (Get-FileHash -LiteralPath $runnerPath -Algorithm SHA256).Hash.ToLowerInvariant(); session = (Get-M4SessionSummary); result = $result }
            $replyText = $reply | ConvertTo-Json -Depth 40 -Compress -EscapeHandling EscapeNonAscii
            $failureCode = 'response-handoff-failed-operation-may-have-completed'
            Write-M4Frame $pipe $replyText
            # FlushAsync is not a pipe drain. Disconnect discards unread bytes;
            # wait for a bounded acknowledgement of the complete safe response.
            if ((Read-M4Frame $pipe 4096 5000) -cne '{"received":true}') { throw 'response-acknowledgement' }
        } catch {
            if ($waiting.IsCancellationRequested) { $stop = $true }
            else {
                if ($failureCode -cne 'invalid-request') { $countsIncomplete = $true }
                $safeError = @{ execution = 'local-diagnostic'; status = 'request-failed'; reason = $failureCode; session = (Get-M4SessionSummary) } | ConvertTo-Json -Depth 10 -Compress
                if ($pipe.IsConnected) {
                    try { Write-M4Frame $pipe $safeError; [void](Read-M4Frame $pipe 4096 5000) } catch {}
                }
            }
        } finally {
            $waiting.Dispose()
            # EOF can mark the stream Broken/IsConnected=false. It still needs
            # Disconnect before another WaitForConnectionAsync; otherwise a
            # single abandoned client wedges the entire credential session.
            if ($acceptedConnection) {
                try { $pipe.Disconnect() }
                catch { $pipe.Dispose(); $pipe = New-M4Pipe $pipeName }
            }
            $replyText = $null; $reply = $null; $result = $null; $operation = $null; $requestText = $null
        }
    }
    Write-Host 'Local series session ended. No credential or diagnostic file was created.'
} catch {
    $knownTotal = if ($countsIncomplete) { $null } else { $sourceCounts.total }
    @{ execution = 'local-diagnostic'; status = $(if ($completedOperations) { 'session-interrupted' } else { 'session-not-started' });
        reason = $failureCode; preflight=$preflightError; sourceRequests=$knownTotal; session=(Get-M4SessionSummary) } | ConvertTo-Json -Depth 6 -Compress
    exit 1
} finally {
    if ($pipe) { $pipe.Dispose() }
    if ($secureTmdb) { $secureTmdb.Dispose() }
    if ($secureTavily) { $secureTavily.Dispose() }
    $context = $null
    # Managed plaintext strings exist only during a child operation; terminating
    # this process ends their lifetime. No file, environment, clipboard or argv handoff.
}
