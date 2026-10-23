// Native Windows authorization only. Synthetic NETWORK membership is not an SSH handshake.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  const preflight = spawnSync(pwsh, ['-NoProfile', '-NonInteractive', '-File', helper, '-ExpectedCommit', sha, '-CheckPrerequisites'], {
    cwd: repo, encoding: 'utf8', timeout: 30_000
  });
  assert.ifError(preflight.error);
  assert.equal(preflight.status, 0, preflight.stderr || preflight.stdout);
  assert.equal(preflight.stderr, '');
  const report = JSON.parse(preflight.stdout);
  assert.equal(report.status, 'prerequisites-ok');
  assert.equal(report.localCheckoutSha, sha);
  assert.equal(report.explicitSidAcl, true);
  assert.equal(report.remoteClientsRejected, true);
  assert.equal(report.localRoundTrip, true);
  assert.equal(report.workerStatusRoundTrip, true);
  assert.equal(report.sourceRequests, 0);
  assert.equal(report.credentialPrompts, 0);
});
