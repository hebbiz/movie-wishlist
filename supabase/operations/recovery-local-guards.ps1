# Shared fail-closed Windows guards. No network, decryption, restore or deletion.
# Dot-source only; callers supply independently recorded non-secret hash pins.
Set-StrictMode -Version Latest

function Assert-RecoveryLocalAcl {
    param([Parameter(Mandatory)]$Acl,[switch]$RequireProtected,[switch]$AllowHistoricalOwner)
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $allowedOwners = @($owner)
    # The sole recorded historical exception is built-in Administrators on
    # non-consumed handoff metadata. An arbitrary owner can change its DACL even
    # when the current DACL is private; neither SYSTEM nor unknown owners are
    # implicitly accepted by this exception. Actual inputs never use it.
    if ($AllowHistoricalOwner) { $allowedOwners += 'S-1-5-32-544' }
    if ($Acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $allowedOwners) { throw 'Recovery current-user ownership required.' }
    $rules = @($Acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]))
    if (-not $rules.Count) { throw 'Recovery private ACL required.' }
    foreach ($rule in $rules) {
        if ($rule.IdentityReference.Value -notin @($owner, 'S-1-5-18') -or $rule.AccessControlType -ne 'Allow') { throw 'Recovery private ACL required.' }
    }
    foreach ($sid in @($owner, 'S-1-5-18')) {
        if (-not @($rules | Where-Object { $_.IdentityReference.Value -eq $sid -and ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::FullControl) -eq [Security.AccessControl.FileSystemRights]::FullControl }).Count) { throw 'Recovery owner/SYSTEM full control required.' }
    }
    if ($RequireProtected -and -not $Acl.AreAccessRulesProtected) { throw 'Recovery root must disable ACL inheritance.' }
}

function Assert-RecoveryLocalPrivatePath {
    param([Parameter(Mandatory)][string]$Path, [switch]$Recurse,[switch]$AllowHistoricalOwner)
    if (-not $IsWindows -or -not [IO.Path]::IsPathFullyQualified($Path)) { throw 'Recovery requires an absolute Windows path.' }
    $resolved = [IO.Path]::GetFullPath($Path).TrimEnd([IO.Path]::DirectorySeparatorChar)
    $ancestor = $resolved
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Recovery reparse point refused.' }
        }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
    $item = Get-Item -LiteralPath $resolved -Force -ErrorAction Stop
    $items = @($item)
    if ($Recurse -and $item.PSIsContainer) {
        # Do not enumerate recursively through a junction before checking it.
        $pending = [Collections.Generic.Queue[IO.DirectoryInfo]]::new()
        $pending.Enqueue([IO.DirectoryInfo]::new($resolved))
        while ($pending.Count) {
            foreach ($child in Get-ChildItem -LiteralPath $pending.Dequeue().FullName -Force) {
                if ($child.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Recovery reparse point refused.' }
                $items += $child
                if ($child.PSIsContainer) { $pending.Enqueue([IO.DirectoryInfo]::new($child.FullName)) }
            }
        }
    }
    foreach ($entry in $items) {
        $info = if ($entry.PSIsContainer) { [IO.DirectoryInfo]::new($entry.FullName) } else { [IO.FileInfo]::new($entry.FullName) }
        $acl = [IO.FileSystemAclExtensions]::GetAccessControl($info, [Security.AccessControl.AccessControlSections]::Owner -bor [Security.AccessControl.AccessControlSections]::Access)
        Assert-RecoveryLocalAcl $acl -RequireProtected:($entry.FullName -eq $resolved -and $entry.PSIsContainer) -AllowHistoricalOwner:$AllowHistoricalOwner
    }
    return $resolved
}

function Assert-RecoveryVmStopped {
    param([Parameter(Mandatory)][string]$VmRoot)
    foreach ($process in @(Get-Process -Name 'qemu-system-*' -ErrorAction SilentlyContinue)) {
        try { $executable = $process.Path } catch { throw 'Unable to establish VM process isolation.' }
        if (-not $executable) { throw 'Unable to establish VM process isolation.' }
        if ([IO.Path]::GetFullPath($executable).StartsWith($VmRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'VM still running; operation refused.' }
    }
}

function Assert-RecoveryVmRoot {
    param([Parameter(Mandatory)][string]$VmRoot)
    if (-not [IO.Path]::IsPathFullyQualified($VmRoot)) { throw 'Invalid private test path.' }
    $parent = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'MovieWishlist/RestoreTests'))
    $resolved = [IO.Path]::GetFullPath($VmRoot).TrimEnd([IO.Path]::DirectorySeparatorChar)
    if ([IO.Path]::GetDirectoryName($resolved) -ne $parent -or [IO.Path]::GetFileName($resolved) -cnotmatch '^restore-\d{8}-qemu-[a-f0-9]{8}$') { throw 'Invalid private test path.' }
    Assert-RecoveryLocalPrivatePath $resolved -Recurse | Out-Null
    Assert-RecoveryVmStopped $resolved
    return $resolved
}

function Assert-RecoveryPublicSoftwareOnly {
    param([Parameter(Mandatory)][string]$VmRoot)
    foreach ($item in Get-ChildItem -LiteralPath $VmRoot -Recurse -Force -File) {
        if ($item.Name -in @('private-data-staged.json','database.dump','roles.sql','roles-replay.sql','source-inventory.json','source-data.sql','target-data.sql','source-schema.sql','target-schema.sql','counts.sql','target-inventory.json','target-counts.jsonl') -or $item.Name -match '\.(aesgcm|dpapi)$') { throw 'Private recovery material forbids software-only operation.' }
    }
}

function Assert-RecoveryCheckpoint {
    param([Parameter(Mandatory)][string]$Checkpoint, [Parameter(Mandatory)][string]$ManifestSha256, [Parameter(Mandatory)][string]$KeySha256)
    if ($Checkpoint -cnotmatch '^checkpoint-\d{8}T\d{6}Z-[a-f0-9]{8}$' -or $ManifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or $KeySha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Explicit checkpoint and SHA256 pins required.' }
    $directory = Join-Path $env:LOCALAPPDATA "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$Checkpoint"
    $keyPath = Join-Path $env:LOCALAPPDATA "MovieWishlist/RecoveryKeys/$Checkpoint.key.dpapi"
    # Historical handoff/evidence files are not consumed. Validate the directory
    # and each actual input strictly without modifying unrelated original files.
    Assert-RecoveryLocalPrivatePath $directory | Out-Null
    Assert-RecoveryLocalPrivatePath $keyPath | Out-Null
    $manifestFile = Join-Path $directory 'status.json'
    Assert-RecoveryLocalPrivatePath $manifestFile | Out-Null
    if ((Get-FileHash -LiteralPath $manifestFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestSha256 -or (Get-FileHash -LiteralPath $keyPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $KeySha256) { throw 'Original checkpoint/key pin mismatch.' }
    $manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json
    $names = @('database.aesgcm','roles-before.aesgcm','roles-after.aesgcm','source-inventory.aesgcm','archive-toc.aesgcm','archive-read-test.aesgcm','checkpoint-record.aesgcm')
    if ($manifest.project -cne 'mttkectgdqqmejpenkrn' -or $manifest.backupComplete -ne $true -or @($manifest.files).Count -ne $names.Count -or @($manifest.files.name | Sort-Object -Unique).Count -ne $names.Count) { throw 'Completed full export manifest required.' }
    foreach ($record in $manifest.files) {
        if ($record.name -cnotin $names -or $record.sha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'Unexpected original artifact manifest.' }
        $file = Join-Path $directory $record.name
        Assert-RecoveryLocalPrivatePath $file | Out-Null
        if ((Get-Item -LiteralPath $file).Length -ne $record.bytes -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $record.sha256) { throw 'Original artifact integrity refused.' }
    }
    # Only non-consumed historical metadata/evidence may retain the recorded
    # Administrators owner (never an arbitrary owner).
    # It still must have owner/SYSTEM-only DACL and no reparse points. Actual
    # root/status/key/seven ciphers have already passed strict ownership above.
    Assert-RecoveryLocalPrivatePath $directory -Recurse -AllowHistoricalOwner | Out-Null
    return @{ Directory=$directory; KeyPath=$keyPath; ManifestSha256=$ManifestSha256; KeySha256=$KeySha256; ArchiveSha256=($manifest.files | Where-Object name -CEQ 'database.aesgcm').sha256 }
}
