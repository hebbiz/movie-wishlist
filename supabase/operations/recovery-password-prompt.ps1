# Local operator helper only. Never run in CI, a transcript, or a recorded terminal.
# No production writes. Dot-source for offline tests; -PrepareOnly never asks for a password.
[CmdletBinding()]
param([switch]$PrepareOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function New-RecoveryPrivateDirectory {
    param([Parameter(Mandatory)][string]$Path)
    $resolved = [IO.Path]::GetFullPath($Path)
    $ancestor = $resolved
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw 'Recovery path contains a reparse point; refusing.'
            }
        }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
    [IO.Directory]::CreateDirectory($resolved) | Out-Null
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $directory = [IO.DirectoryInfo]::new($resolved)
    $ownership = [IO.FileSystemAclExtensions]::GetAccessControl($directory, [Security.AccessControl.AccessControlSections]::Owner)
    if ($ownership.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner.Value) {
        throw 'Recovery directory is not owned by the current Windows user; refusing.'
    }
    # Access-only API: do not request SACL/audit or ownership privileges.
    $acl = [IO.FileSystemAclExtensions]::GetAccessControl($directory, [Security.AccessControl.AccessControlSections]::Access)
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($rule in @($acl.GetAccessRules($true, $false, [Security.Principal.SecurityIdentifier]))) {
        $acl.RemoveAccessRuleSpecific($rule)
    }
    foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            $sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    }
    [IO.FileSystemAclExtensions]::SetAccessControl($directory, $acl)
    return $resolved
}

function Get-RecoveryVerifiedRoot {
    param([Parameter(Mandatory)][string]$Destination)
    # Explicit Supabase CA from its official dashboard's download URL, not peer trust/TOFU.
    # No permissive validation callback, no global trust-store change, no DB authentication.
    $caSource = Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11/prod-ca-2021.crt'
    if ((Get-FileHash -LiteralPath $caSource -Algorithm SHA256).Hash -ne
        '700723581420DD1AC98FD7E9AC529F0EF210EADCAF87FC868A3AD7D114C2F3B7') {
        throw 'Supabase CA file differs from the reviewed download; refusing.'
    }
    $trustedRoot = [Security.Cryptography.X509Certificates.X509Certificate2]::CreateFromPem([IO.File]::ReadAllText($caSource))
    $tcp = [Net.Sockets.TcpClient]::new()
    $tls = $null
    try {
        $connect = $tcp.ConnectAsync('aws-1-eu-north-1.pooler.supabase.com', 5432)
        if (-not $connect.Wait(15000)) { throw 'Pooler TCP connection timed out.' }
        $connect.GetAwaiter().GetResult() | Out-Null
        $stream = $tcp.GetStream()
        $stream.ReadTimeout = 15000
        $stream.WriteTimeout = 15000
        $sslRequest = [byte[]]@(0, 0, 0, 8, 4, 210, 22, 47)
        $stream.Write($sslRequest, 0, $sslRequest.Length)
        if ($stream.ReadByte() -ne 83) { throw 'Pooler did not accept PostgreSQL TLS.' }
        $tls = [Net.Security.SslStream]::new($stream, $false)
        $options = [Net.Security.SslClientAuthenticationOptions]::new()
        $options.TargetHost = 'aws-1-eu-north-1.pooler.supabase.com'
        $options.EnabledSslProtocols = [Security.Authentication.SslProtocols]::Tls12 -bor [Security.Authentication.SslProtocols]::Tls13
        $policy = [Security.Cryptography.X509Certificates.X509ChainPolicy]::new()
        $policy.TrustMode = [Security.Cryptography.X509Certificates.X509ChainTrustMode]::CustomRootTrust
        $policy.CustomTrustStore.Add($trustedRoot) | Out-Null
        $policy.VerificationFlags = [Security.Cryptography.X509Certificates.X509VerificationFlags]::NoFlag
        # Same boundary as libpq verify-full without a separately supplied CRL:
        # CA chain + validity + hostname verified; revocation is not attested.
        $policy.RevocationMode = [Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
        $options.CertificateChainPolicy = $policy
        $deadline = [Threading.CancellationTokenSource]::new(20000)
        try { $tls.AuthenticateAsClientAsync($options, $deadline.Token).GetAwaiter().GetResult() | Out-Null }
        finally { $deadline.Dispose() }
        if (-not $tls.IsEncrypted -or -not $tls.IsAuthenticated) { throw 'TLS validation failed.' }
        [IO.File]::WriteAllText($Destination, $trustedRoot.ExportCertificatePem(), [Text.UTF8Encoding]::new($false))
        return [ordered]@{
            tls = $tls.SslProtocol.ToString()
            hostnameVerified = $true
            chainVerified = $true
            revocation = 'not checked; no CRL configured'
            rootSha256 = $trustedRoot.GetCertHashString([Security.Cryptography.HashAlgorithmName]::SHA256)
        }
    }
    finally { if ($tls) { $tls.Dispose() }; $tcp.Dispose(); $trustedRoot.Dispose() }
}

function New-RecoveryPgStartInfo {
    param([string]$Psql, [string]$RootCertificate, [Security.SecureString]$Password)
    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Psql
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($key in @($start.Environment.Keys)) {
        if ($key -like 'PG*' -or $key -in @('SSL_CERT_FILE', 'SSL_CERT_DIR')) {
            $start.Environment.Remove($key) | Out-Null
        }
    }
    $start.Environment['PGHOST'] = 'aws-1-eu-north-1.pooler.supabase.com'
    $start.Environment['PGPORT'] = '5432'
    $start.Environment['PGDATABASE'] = 'postgres'
    $start.Environment['PGUSER'] = 'postgres.mttkectgdqqmejpenkrn'
    $start.Environment['PGSSLMODE'] = 'verify-full'
    $start.Environment['PGSSLROOTCERT'] = $RootCertificate
    $start.Environment['PGSSLMINPROTOCOLVERSION'] = 'TLSv1.2'
    $start.Environment['PGCONNECT_TIMEOUT'] = '15'
    $start.Environment['PGAPPNAME'] = 'mw-recovery-access-check'
    $start.Environment['PGOPTIONS'] = '-c default_transaction_read_only=on -c statement_timeout=15000'
    $secretPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    try { $start.Environment['PGPASSWORD'] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPtr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPtr) }
    foreach ($arg in @('-X', '-w', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c',
        (Get-RecoveryAccessCheckSql))) {
        $start.ArgumentList.Add($arg)
    }
    return $start
}

function Get-RecoveryAccessCheckSql {
    # Pooler startup options alone are not evidence of the actual transaction mode.
    # Explicit transaction control is read-only; no database objects/data are changed.
    return "BEGIN READ ONLY; SET LOCAL statement_timeout = '15s'; SELECT json_build_object('database',current_database(),'user',session_user,'version_num',current_setting('server_version_num'),'read_only',current_setting('transaction_read_only'))::text; ROLLBACK;"
}

function ConvertFrom-RecoveryAccessCheck {
    param([string]$OutputText)
    try { $result = ConvertFrom-Json -InputObject $OutputText -AsHashtable -ErrorAction Stop }
    catch { throw 'Recovery check refused: malformed-metadata. No credential handoff saved.' }
    if ($result -isnot [Collections.IDictionary]) {
        throw 'Recovery check refused: malformed-metadata. No credential handoff saved.'
    }
    $reasons = [Collections.Generic.List[string]]::new()
    if ($result['database'] -isnot [string] -or $result['database'] -cne 'postgres') { $reasons.Add('database-not-expected') }
    if ($result['user'] -isnot [string] -or $result['user'] -cne 'postgres') { $reasons.Add('role-not-expected') }
    $version = 0
    $validVersion = $result['version_num'] -is [string] -and $result['version_num'] -cmatch '^[0-9]{6}$' -and
        [int]::TryParse($result['version_num'], [ref]$version)
    if (-not $validVersion -or $version -lt 170000 -or $version -ge 180000) { $reasons.Add('server-major-not-17') }
    if ($result['read_only'] -isnot [string] -or $result['read_only'] -cne 'on') { $reasons.Add('transaction-not-read-only') }
    if ($reasons.Count -gt 0) {
        # Only fixed reason codes: never echo server text, names, JSON or stderr.
        throw "Recovery check refused: $($reasons -join ', '). No credential handoff saved."
    }
    return [ordered]@{ database = 'postgres'; user = 'postgres'; serverVersionNum = $version.ToString(); readOnly = $true }
}

function Test-RecoveryDatabaseAccess {
    param([string]$Psql, [string]$RootCertificate, [Security.SecureString]$Password)
    $start = New-RecoveryPgStartInfo $Psql $RootCertificate $Password
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $start
    try {
        $process.Start() | Out-Null
        # Copies of the secret can exist briefly in libpq/child memory, never argv/files/logs.
        $start.Environment.Remove('PGPASSWORD') | Out-Null
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(35000)) {
            $process.Kill($true)
            $process.WaitForExit()
            throw 'Read-only connection check timed out; no credential handoff saved.'
        }
        if ($process.ExitCode -ne 0) {
            # Do not echo uncontrolled libpq error content into the terminal/transcript.
            throw "Read-only connection check failed (psql exit $($process.ExitCode)); no credential handoff saved."
        }
        $outputText = $stdout.GetAwaiter().GetResult().Trim()
        $stderr.GetAwaiter().GetResult() | Out-Null
        return ConvertFrom-RecoveryAccessCheck $outputText
    }
    finally { $start.Environment.Remove('PGPASSWORD') | Out-Null; $process.Dispose() }
}

function Save-RecoveryCredentialHandoff {
    param([string]$Directory, [Security.SecureString]$Password, [object]$TlsEvidence, [object]$DatabaseEvidence)
    $credentialFile = Join-Path $Directory 'credential.pending.clixml'
    $statusFile = Join-Path $Directory 'pending.json'
    if ((Test-Path -LiteralPath $credentialFile) -or (Test-Path -LiteralPath $statusFile)) {
        throw 'A pending handoff already exists; do not overwrite it. Ask the recovery operator to consume/remove it.'
    }
    # Windows Export-Clixml protects SecureString with DPAPI CurrentUser.
    # Cannot be decrypted by a different Windows identity or on a different machine.
    $credential = [PSCredential]::new('postgres.mttkectgdqqmejpenkrn', $Password)
    $credential | Export-Clixml -LiteralPath $credentialFile -NoClobber
    $created = [DateTimeOffset]::UtcNow
    $status = [ordered]@{
        purpose = 'one-recovery-operation'; project = 'mttkectgdqqmejpenkrn'
        createdAt = $created.ToString('o'); expiresAt = $created.AddHours(2).ToString('o')
        protection = 'Windows DPAPI CurrentUser plus owner/SYSTEM-only NTFS ACL'
        tls = $TlsEvidence; database = $DatabaseEvidence
        backupCreated = $false; restoreVerified = $false
    } | ConvertTo-Json -Depth 6
    $stream = [IO.File]::Open($statusFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $writer = [IO.StreamWriter]::new($stream, [Text.UTF8Encoding]::new($false))
    try { $writer.Write($status) } finally { $writer.Dispose() }
}

function Start-RecoveryPasswordPrompt {
    if (-not $IsWindows -or $PSVersionTable.PSVersion.Major -lt 7) { throw 'Requires Windows PowerShell 7+.' }
    $toolRoot = Join-Path $env:LOCALAPPDATA 'MovieWishlist/RecoveryTools/pg17.11'
    $psql = Join-Path $toolRoot 'pgsql/bin/psql.exe'
    if (-not (Test-Path -LiteralPath $psql -PathType Leaf)) { throw 'Prepared PostgreSQL 17 tools are missing.' }
    $toolVersion = & $psql --version
    if ($LASTEXITCODE -ne 0 -or $toolVersion -notmatch '^psql \(PostgreSQL\) 17\.') { throw 'Requires PostgreSQL 17 psql.' }
    $pending = New-RecoveryPrivateDirectory (Join-Path $env:LOCALAPPDATA 'MovieWishlist/Recovery/mttkectgdqqmejpenkrn/pending')
    if ((Test-Path -LiteralPath (Join-Path $pending 'credential.pending.clixml')) -or
        (Test-Path -LiteralPath (Join-Path $pending 'pending.json'))) { throw 'Pending handoff already exists; refusing overwrite.' }
    $rootCertificate = Join-Path $pending 'verified-pooler-root.pem'
    $tlsEvidence = Get-RecoveryVerifiedRoot $rootCertificate
    Write-Host 'TLS chain and exact pooler hostname verified. No database password used yet.'
    if ($PrepareOnly) { return }
    $password = Read-Host 'Existing Supabase database password (hidden; not the API key)' -AsSecureString
    try {
        if ($password.Length -eq 0) { throw 'Empty password; no connection attempted.' }
        $databaseEvidence = Test-RecoveryDatabaseAccess $psql $rootCertificate $password
        Save-RecoveryCredentialHandoff $pending $password $tlsEvidence $databaseEvidence
        Write-Host 'Read-only PostgreSQL 17 connection verified. Encrypted local handoff ready for backup.'
        Write-Host 'No backup or restore has run yet. Tell Codex that the local prompt completed; do not send the password.'
    }
    finally { $password.Dispose() }
}

if ($MyInvocation.InvocationName -ne '.') { Start-RecoveryPasswordPrompt }
