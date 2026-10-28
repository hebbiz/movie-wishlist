// Native Windows authorization and full fake-key local IPC lifecycle. No HTTP;
// synthetic NETWORK membership/fake sessions are not a real SSH handshake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const repo = fileURLToPath(new URL('../', import.meta.url));
const helper = fileURLToPath(new URL('../scripts/m4-practical-session.ps1', import.meta.url));
const pwsh = [
  join(process.env.USERPROFILE ?? '', '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'),
  join(process.env.ProgramFiles ?? '', 'PowerShell/7/pwsh.exe')
].find(path => existsSync(path));
const nativeSkip = process.platform !== 'win32' ? 'Windows-only pipe authorization' : !pwsh ? 'PowerShell7 unavailable' : false;

test('native local pipe grants the current SID with NETWORK membership; old NETWORK deny rejects it', { skip: nativeSkip }, () => {
  const code = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile('${helper.replaceAll("'", "''")}', [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw 'helper-parse-failed' }
$wanted = @('Initialize-M4LocalPipeNative', 'New-M4Pipe')
$functions = @($ast.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -cin $wanted }, $false))
if ($functions.Count -ne 2) { throw 'pipe-functions-required' }
# Only the two function definitions execute; the owner's prompts/session never run.
foreach ($definition in $functions) { . ([ScriptBlock]::Create($definition.Extent.Text)) }
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class M4PipeAuthzRegression {
    [StructLayout(LayoutKind.Sequential)]
    private struct Luid { public uint Low; public int High; }
    [StructLayout(LayoutKind.Sequential)]
    private struct SidAndAttributes { public IntPtr Sid; public uint Attributes; }
    [StructLayout(LayoutKind.Sequential)]
    private struct Request {
        public uint DesiredAccess;
        public IntPtr PrincipalSelfSid;
        public IntPtr ObjectTypeList;
        public uint ObjectTypeListLength;
        public IntPtr OptionalArguments;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct Reply {
        public uint ResultListLength;
        public IntPtr GrantedAccessMask;
        public IntPtr SaclEvaluationResults;
        public IntPtr Error;
    }
    [DllImport("authz.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AuthzInitializeResourceManager(uint flags, IntPtr accessCheck,
        IntPtr computeGroups, IntPtr freeGroups, string name, out IntPtr resourceManager);
    [DllImport("authz.dll", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AuthzInitializeContextFromSid(uint flags, byte[] sid,
        IntPtr resourceManager, IntPtr expirationTime, Luid identifier, IntPtr dynamicGroups,
        out IntPtr context);
    [DllImport("authz.dll", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AuthzAddSidsToContext(IntPtr context,
        [In] SidAndAttributes[] sids, uint sidCount, IntPtr restrictedSids,
        uint restrictedSidCount, out IntPtr newContext);
    [DllImport("authz.dll", SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AuthzAccessCheck(uint flags, IntPtr context, ref Request request,
        IntPtr auditEvent, byte[] securityDescriptor, IntPtr optionalDescriptors,
        uint optionalDescriptorCount, ref Reply reply, IntPtr results);
    [DllImport("authz.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AuthzFreeContext(IntPtr context);
    [DllImport("authz.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool AuthzFreeResourceManager(IntPtr resourceManager);
    private static void Require(bool ok) {
        if (!ok) throw new Win32Exception(Marshal.GetLastWin32Error());
    }
    private static int Check(IntPtr context, byte[] descriptor) {
        IntPtr granted = Marshal.AllocHGlobal(4);
        IntPtr error = Marshal.AllocHGlobal(4);
        IntPtr sacl = Marshal.AllocHGlobal(4);
        try {
            Marshal.WriteInt32(granted, 0);
            Marshal.WriteInt32(error, 0);
            Marshal.WriteInt32(sacl, 0);
            // Specific pipe ReadData | WriteData; no generic-rights mapping is needed.
            var request = new Request { DesiredAccess = 3 };
            var reply = new Reply { ResultListLength = 1, GrantedAccessMask = granted, SaclEvaluationResults = sacl, Error = error };
            Require(AuthzAccessCheck(0, context, ref request, IntPtr.Zero, descriptor,
                IntPtr.Zero, 0, ref reply, IntPtr.Zero));
            int result = Marshal.ReadInt32(error);
            if (result == 0 && (Marshal.ReadInt32(granted) & 3) != 3)
                throw new InvalidOperationException("incomplete-pipe-grant");
            return result;
        } finally {
            Marshal.FreeHGlobal(granted);
            Marshal.FreeHGlobal(error);
            Marshal.FreeHGlobal(sacl);
        }
    }
    public static int[] Compare(byte[] userSid, byte[] networkSid, byte[] current, byte[] old) {
        IntPtr manager = IntPtr.Zero, user = IntPtr.Zero, networkUser = IntPtr.Zero;
        var pin = GCHandle.Alloc(networkSid, GCHandleType.Pinned);
        try {
            // NO_AUDIT and SKIP_TOKEN_GROUPS avoid auditing and account/group lookups.
            Require(AuthzInitializeResourceManager(1, IntPtr.Zero, IntPtr.Zero,
                IntPtr.Zero, "M4 authored pipe ACL regression", out manager));
            Require(AuthzInitializeContextFromSid(2, userSid, manager, IntPtr.Zero,
                new Luid(), IntPtr.Zero, out user));
            var groups = new[] { new SidAndAttributes { Sid = pin.AddrOfPinnedObject(), Attributes = 4 } };
            Require(AuthzAddSidsToContext(user, groups, 1, IntPtr.Zero, 0, out networkUser));
            return new[] { Check(user, old), Check(networkUser, old), Check(networkUser, current) };
        } finally {
            if (networkUser != IntPtr.Zero) AuthzFreeContext(networkUser);
            if (user != IntPtr.Zero) AuthzFreeContext(user);
            if (manager != IntPtr.Zero) AuthzFreeResourceManager(manager);
            pin.Free();
        }
    }
}
'@
$pipe = $null
try {
    $pipe = New-M4Pipe ('mw-m4-authz-' + [Guid]::NewGuid().ToString('N'))
    $actual = [IO.Pipes.PipesAclExtensions]::GetAccessControl($pipe)
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $rules = @($actual.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))
    if (-not $pipe.IsAsync -or -not $actual.AreAccessRulesProtected -or $rules.Count -ne 1 -or
        $rules[0].IdentityReference -ne $sid -or
        $rules[0].AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or
        $rules[0].PipeAccessRights -ne [IO.Pipes.PipeAccessRights]::FullControl) { throw 'actual-pipe-contract' }
    if ([M4PracticalLocalPipe]::RejectRemoteClients -ne 8) { throw 'remote-transport-flag' }
    $network = [Security.Principal.SecurityIdentifier]::new([Security.Principal.WellKnownSidType]::NetworkSid, $null)
    $old = [IO.Pipes.PipeSecurity]::new()
    $old.SetSecurityDescriptorBinaryForm($actual.GetSecurityDescriptorBinaryForm())
    $old.AddAccessRule([IO.Pipes.PipeAccessRule]::new($network, [IO.Pipes.PipeAccessRights]::FullControl, [Security.AccessControl.AccessControlType]::Deny))
    $userBytes = [byte[]]::new($sid.BinaryLength)
    $networkBytes = [byte[]]::new($network.BinaryLength)
    $sid.GetBinaryForm($userBytes, 0)
    $network.GetBinaryForm($networkBytes, 0)
    $checked = [M4PipeAuthzRegression]::Compare($userBytes, $networkBytes,
        $actual.GetSecurityDescriptorBinaryForm(), $old.GetSecurityDescriptorBinaryForm())
    @{ baselineOld = $checked[0]; networkOld = $checked[1]; networkCurrent = $checked[2];
       protectedCurrentSidOnly = $true; asynchronous = $pipe.IsAsync; sourceRequests = 0; credentialPrompts = 0 } | ConvertTo-Json -Compress
} finally { if ($pipe) { $pipe.Dispose() } }
`;
  const checked = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(code, 'utf16le').toString('base64')], {
    cwd: repo, encoding: 'utf8', timeout: 30_000
  });
  assert.ifError(checked.error);
  assert.equal(checked.status, 0, checked.stderr);
  assert.equal(checked.stderr, '');
  assert.deepEqual(JSON.parse(checked.stdout), {
    baselineOld: 0, networkOld: 5, networkCurrent: 0,
    protectedCurrentSidOnly: true, asynchronous: true, sourceRequests: 0, credentialPrompts: 0
  });

  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', timeout: 10_000 });
  assert.ifError(commit.error);
  assert.equal(commit.status, 0, commit.stderr);
  const sha = commit.stdout.trim();
  assert.match(sha, /^[a-f0-9]{40}$/);
  for (const study of ['practical-five','pilot-retrieval']) {
  const preflight = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', helper, '-ExpectedCommit', sha, '-Study', study, '-CheckPrerequisites'], {
    cwd: repo, encoding: 'utf8', timeout: 30_000
  });
  assert.ifError(preflight.error);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.equal(preflight.stderr, '');
  const report = JSON.parse(preflight.stdout);
  assert.equal(report.status, 'prerequisites-ok');
  assert.equal(report.study, study);
  assert.equal(report.localCheckoutSha, sha);
  assert.equal(report.explicitSidAcl, true);
  assert.equal(report.remoteClientsRejected, true);
  assert.equal(report.localRoundTrip, true);
  assert.equal(report.workerStatusRoundTrip, true);
  assert.equal(report.sourceRequests, 0);
  assert.equal(report.credentialPrompts, 0);
  }
});

test('full fake-key broker reconnects after two status requests and an abandoned client, then stops', { skip: nativeSkip, timeout: 60_000 }, async () => {
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8', timeout: 10_000 });
  assert.ifError(commit.error);
  assert.equal(commit.status, 0, commit.stderr);
  const sha = commit.stdout.trim();
  assert.match(sha, /^[a-f0-9]{40}$/);
  const pipeName = `mw-m4-lifecycle-${randomUUID().replaceAll('-', '')}`;
  const psString = value => `'${value.replaceAll("'", "''")}'`;
  const replaceOnce = (source, from, to) => {
    assert.equal(source.split(from).length, 2, `one replacement required: ${from}`);
    return source.replace(from, to);
  };
  let serverSource = readFileSync(helper, 'utf8');
  serverSource = replaceOnce(serverSource, '$repoPath = Split-Path -Parent $PSScriptRoot', `$repoPath = ${psString(repo)}`);
  serverSource = replaceOnce(serverSource, "$runnerPath = Join-Path $PSScriptRoot 'm4-practical-series.mjs'", `$runnerPath = ${psString(join(repo, 'scripts/m4-practical-series.mjs'))}`);
  serverSource = replaceOnce(serverSource, "'mw-m4-practical-series-v1'", psString(pipeName));
  serverSource = replaceOnce(serverSource, 'if ([Console]::IsInputRedirected)', 'if ($false)');
  serverSource = replaceOnce(serverSource, "Read-Host 'TMDB_READ_ACCESS_TOKEN (hidden)' -AsSecureString", "ConvertTo-SecureString 'AUTHORED_FAKE_TMDB_TOKEN' -AsPlainText -Force");
  serverSource = replaceOnce(serverSource, "Read-Host 'TAVILY_API_KEY (hidden)' -AsSecureString", "ConvertTo-SecureString 'AUTHORED_FAKE_TAVILY_KEY' -AsPlainText -Force");
  const clientPath = fileURLToPath(new URL('../scripts/m4-practical-request.ps1', import.meta.url));
  const clientSource = replaceOnce(readFileSync(clientPath, 'utf8'), "'mw-m4-practical-series-v1'", psString(pipeName));
  // Source stays in memory. Compression avoids Windows' command-line length limit;
  // dot-sourcing preserves the production script's $script: state across requests.
  const encodedSource = (source, args) => {
    const data = gzipSync(Buffer.from(source, 'utf8')).toString('base64');
    const wrapper = `$memory=[IO.MemoryStream]::new([Convert]::FromBase64String('${data}'));$gzip=[IO.Compression.GZipStream]::new($memory,[IO.Compression.CompressionMode]::Decompress);$reader=[IO.StreamReader]::new($gzip);$source=$reader.ReadToEnd();$reader.Dispose();. ([ScriptBlock]::Create($source)) ${args}`;
    return Buffer.from(wrapper, 'utf16le').toString('base64');
  };
  const psArgs = encoded => ['-NoProfile', '-NonInteractive', '-OutputFormat', 'Text', '-EncodedCommand', encoded];
  const server = spawn(pwsh, psArgs(encodedSource(serverSource, `-ExpectedCommit ${sha} -Study pilot-retrieval`)), { cwd: repo, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  server.stdout.setEncoding('utf8').on('data', text => { stdout += text; });
  server.stderr.setEncoding('utf8').on('data', text => { stderr += text; });
  const exited = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('close', (code, signal) => resolve({ code, signal }));
  });
  const client = action => {
    const checked = spawnSync(pwsh, psArgs(encodedSource(clientSource, `-Action ${action}`)), { cwd: repo, encoding: 'utf8', timeout: 16_000, windowsHide: true });
    assert.equal(checked.error,undefined,`fake client ${action}: ${checked.error?.message ?? ''}; server: ${stdout} ${stderr}`);
    assert.equal(checked.status, 0, checked.stderr || checked.stdout);
    assert.equal(checked.stderr, '');
    const report = JSON.parse(checked.stdout);
    assert.equal(report.execution, 'local-diagnostic');
    assert.equal(report.acknowledgementSent, true);
    assert.equal(report.localCheckoutSha, sha);
    assert.equal(report.session.sourceCounts.total, 0);
    assert.equal(report.session.countsIncomplete, false);
    return report;
  };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => finish(new Error(`fake broker readiness timed out: ${stdout} ${stderr}`)), 15_000);
      const check = () => {
        if (stdout.includes('Session ready for Codex.')) finish();
        else if (stdout.includes('session-not-started')) finish(new Error(stdout));
      };
      const onExit = () => finish(new Error(`fake broker exited before readiness: ${stdout} ${stderr}`));
      const finish = error => {
        clearTimeout(timer);
        server.stdout.off('data', check);
        server.off('exit', onExit);
        if (error) reject(error); else resolve();
      };
      server.stdout.on('data', check);
      server.once('exit', onExit);
      check();
    });
    for (const expectedOperations of [1, 2]) {
      const report = client('status');
      assert.equal(report.result.status, 'ready');
      assert.equal(report.result.counts.total, 0);
      assert.equal(report.session.completedOperations, expectedOperations);
    }
    const director = client('InSpEcT-DiReCtOr -Film 1');
    assert.equal(director.result.action, 'inspect-director');
    assert.equal(director.result.status, 'cached-single-director-required');
    assert.equal(director.result.counts.total, 0);
    assert.equal(director.session.completedOperations, 3);
    const abandonCode = `$pipe=[IO.Pipes.NamedPipeClientStream]::new('.',${psString(pipeName)},[IO.Pipes.PipeDirection]::InOut,[IO.Pipes.PipeOptions]::Asynchronous);try {$pipe.Connect(5000)} finally {$pipe.Dispose()}`;
    const abandoned = spawnSync(pwsh, psArgs(Buffer.from(abandonCode, 'utf16le').toString('base64')), { cwd: repo, encoding: 'utf8', timeout: 10_000, windowsHide: true });
    assert.ifError(abandoned.error);
    assert.equal(abandoned.status, 0, abandoned.stderr);
    assert.equal(abandoned.stderr, '');
    const recovered = client('status');
    assert.equal(recovered.result.status, 'ready');
    assert.equal(recovered.result.counts.total, 0);
    assert.equal(recovered.session.completedOperations, 4);
    const stopped = client('stop');
    assert.equal(stopped.result.status, 'session-stopped');
    assert.equal(stopped.result.sourceRequests, 0);
    assert.equal(stopped.session.completedOperations, 4);
    const exit = await Promise.race([exited, new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('fake broker did not exit after stop')), 5000); timer.unref(); })]);
    assert.equal(exit.code, 0, stderr || stdout);
    assert.equal(stderr, '');
    assert.match(stdout, /Local series session ended/);
  } finally {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    await exited;
  }
});
