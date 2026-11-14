# Authored fixture only. No real checkpoint, credentials, VM or SQL execution.
$ErrorActionPreference='Stop'
. "$PSScriptRoot/../../supabase/operations/recovery-password-prompt.ps1"
$oldLocalAppData=$env:LOCALAPPDATA
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('mw-m4-comparison-'+[Guid]::NewGuid().ToString('N'))
$env:LOCALAPPDATA=$fixture
$checkpoint='checkpoint-20000101T000000Z-aabbccdd'
$root=Join-Path $fixture 'MovieWishlist/RestoreTests/restore-20000101-qemu-aabbccdd'
$directory=Join-Path $fixture "MovieWishlist/Recovery/mttkectgdqqmejpenkrn/$checkpoint"
$keyPath=Join-Path $fixture "MovieWishlist/RecoveryKeys/$checkpoint.key.dpapi"
$fullName='restore-2000-01-01T00-00-00-000Z.status.json'
$checks=0
function Assert-Test($Condition){if(-not $Condition){throw 'Authored M4 wrapper assertion failed.'}}
function Refused([scriptblock]$Action){$failed=$false;try{& $Action|Out-Null}catch{$failed=$true};Assert-Test $failed}
function Run-AuthoredNode([string]$Script,$Config){
 $start=[Diagnostics.ProcessStartInfo]::new();$start.FileName=(Get-Command node.exe).Source
 $start.WorkingDirectory=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
 $start.UseShellExecute=$false;$start.CreateNoWindow=$true
 $start.RedirectStandardInput=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
 foreach($arg in @('--input-type=module','-e',$Script)){$start.ArgumentList.Add($arg)}
 foreach($name in @($start.Environment.Keys)){if($name -like 'PG*' -or $name -in @('NODE_OPTIONS','NODE_DEBUG','NODE_PATH','NODE_V8_COVERAGE','SSLKEYLOGFILE')){$start.Environment.Remove($name)|Out-Null}}
 $p=[Diagnostics.Process]::new();$p.StartInfo=$start
 try{
  $p.Start()|Out-Null;$p.StandardInput.Write(($Config|ConvertTo-Json -Depth 20 -Compress));$p.StandardInput.Close()
  $out=$p.StandardOutput.ReadToEndAsync();$err=$p.StandardError.ReadToEndAsync()
  if(-not $p.WaitForExit(60000)){$p.Kill($true);$p.WaitForExit();throw 'Authored helper timeout.'}
  $err.GetAwaiter().GetResult()|Out-Null;$result=$out.GetAwaiter().GetResult()
  Assert-Test ($p.ExitCode -eq 0);return $result
 }finally{$p.Dispose()}
}
$key=[byte[]]::new(32);[Security.Cryptography.RandomNumberGenerator]::Fill($key)
try{
 foreach($path in @($fixture,$root,$directory,[IO.Path]::GetDirectoryName($keyPath),(Join-Path $root 'attempt-restore-1'))){New-RecoveryPrivateDirectory $path|Out-Null}
 [IO.File]::WriteAllBytes($keyPath,[Security.Cryptography.ProtectedData]::Protect($key,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser))
 $json=& node (Join-Path $PSScriptRoot 'recovery-m4-compare.test.mjs') --fixture-json
 Assert-Test ($LASTEXITCODE -eq 0)
 $authored=($json -join "`n")|ConvertFrom-Json -Depth 20
 $setup=@'
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';
import {encryptBytes} from './supabase/operations/recovery-archive.mjs';
import {copyBlocks,normalizeSchema} from './supabase/operations/recovery-local.mjs';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const c=JSON.parse(Buffer.concat(chunks).toString());
const key=Buffer.from(c.keyBase64,'base64'),f=c.authored,sha=b=>createHash('sha256').update(b).digest('hex');
const attempt=path.join(c.root,'attempt-restore-1'),acl=f.aclRows.map(x=>JSON.stringify(x)).join('\n')+'\n';
const inputs={'source-schema.sql':f.sourceSchema,'target-schema.sql':f.targetSchema,'source-data.sql':f.sourceData,'target-data.sql':f.targetData,'acl-comparison.jsonl':acl};
for(const [n,s] of Object.entries(inputs))await writeFile(path.join(attempt,n),s,{flag:'wx'});
await writeFile(path.join(c.root,'latest-restore.json'),JSON.stringify({share:'attempt-restore-1'}),{flag:'wx'});
const status={at:'2000-01-01T00:00:00.000Z',actualRestore:true,verified:false};
await writeFile(path.join(c.directory,c.fullName),JSON.stringify(status),{flag:'wx'});
const proof={at:status.at,schema:{source:sha(normalizeSchema(f.sourceSchema)),target:sha(normalizeSchema(f.targetSchema))},copyBlocks:{source:[...copyBlocks(f.sourceData)],target:[...copyBlocks(f.targetData)]}};
await encryptBytes(Buffer.from(JSON.stringify(proof)),path.join(c.directory,c.fullName.replace('.status.json','-comparisons.aesgcm')),key);
await encryptBytes(Buffer.from(JSON.stringify({'acl-comparison.jsonl':acl})),path.join(c.directory,c.fullName.replace('.status.json','-details.aesgcm')),key);
const files=[];
for(const n of ['database','roles-before','roles-after','source-inventory','archive-toc','archive-read-test','checkpoint-record']){
 const name=n+'.aesgcm';await encryptBytes(Buffer.from('AUTHORED, not a database archive'),path.join(c.directory,name),key);
 const b=await readFile(path.join(c.directory,name));files.push({name,bytes:b.length,sha256:sha(b)});
}
await writeFile(path.join(c.directory,'status.json'),JSON.stringify({project:'mttkectgdqqmejpenkrn',backupComplete:true,files}),{flag:'wx'});
key.fill(0);
'@
 Run-AuthoredNode $setup @{root=$root;directory=$directory;fullName=$fullName;authored=$authored;keyBase64=[Convert]::ToBase64String($key)}|Out-Null
 $manifest=Join-Path $directory 'status.json';$fullPath=Join-Path $directory $fullName
 $pins=@{VmRoot=$root;Checkpoint=$checkpoint;ManifestSha256=(Get-FileHash -LiteralPath $manifest).Hash.ToLowerInvariant();KeySha256=(Get-FileHash -LiteralPath $keyPath).Hash.ToLowerInvariant();FullStatusName=$fullName;FullStatusSha256=(Get-FileHash -LiteralPath $fullPath).Hash.ToLowerInvariant()}
 $wrapper=Join-Path $PSScriptRoot '../../supabase/operations/recovery-m4-compare.ps1'
 $result=& $wrapper @pins|ConvertFrom-Json
 Assert-Test ($result.m4ArchivedReplayMatches -eq $true -and $result.fullVerifierVerified -eq $false -and $result.wholeProjectRecoveryEstablished -eq $false);$checks++
 Assert-Test ((Get-FileHash -LiteralPath $fullPath).Hash.ToLowerInvariant() -eq $pins.FullStatusSha256 -and (Get-Content -LiteralPath $fullPath -Raw|ConvertFrom-Json).verified -eq $false);$checks++
 $outputs=@(Get-ChildItem -LiteralPath $directory -Filter 'm4-replay-*.status.json')
 Assert-Test ($outputs.Count -eq 1 -and @(Get-ChildItem -LiteralPath $directory -Filter 'restore-*.status.json').Count -eq 1);$checks++
 $readback=@'
import {readFile} from 'node:fs/promises';import path from 'node:path';
import {decryptSmallArtifact,verifyArtifact} from './supabase/operations/recovery-archive.mjs';
import {compareM4,assertM4InputBinding} from './supabase/operations/recovery-m4-compare.mjs';
const chunks=[];for await(const x of process.stdin)chunks.push(x);const c=JSON.parse(Buffer.concat(chunks).toString()),key=Buffer.from(c.keyBase64,'base64');
await verifyArtifact(c.file,key);const bytes=await decryptSmallArtifact(c.file,key),p=JSON.parse(bytes.toString());bytes.fill(0);key.fill(0);
assertM4InputBinding(p.input,p.fullStatus,p.fullProof,{'acl-comparison.jsonl':p.input['acl-comparison.jsonl']});
const r=compareM4({sourceSchema:p.input['source-schema.sql'],targetSchema:p.input['target-schema.sql'],sourceData:p.input['source-data.sql'],targetData:p.input['target-data.sql'],aclRows:p.input['acl-comparison.jsonl'].trim().split('\n').map(JSON.parse),fullStatus:p.fullStatus});
if(!r.m4ArchivedReplayMatches||r.fullVerifierVerified!==false||r.wholeProjectRecoveryEstablished!==false)throw Error('authored replay refused');
console.log('AUTHORED_ENCRYPTED_INPUT_REPLAY_MATCHED');
'@
 $cipher=$outputs[0].FullName.Replace('.status.json','.aesgcm')
 Assert-Test ((Run-AuthoredNode $readback @{file=$cipher;keyBase64=[Convert]::ToBase64String($key)}).Trim() -eq 'AUTHORED_ENCRYPTED_INPUT_REPLAY_MATCHED');$checks++
 $badPins=$pins.Clone();$badPins.FullStatusSha256='0'*64
 Refused {& $wrapper @badPins};$checks++
 $source=Join-Path $root 'attempt-restore-1/source-schema.sql';[IO.File]::AppendAllText($source,"`n-- authored tamper")
 Refused {& $wrapper @pins};$checks++
 Assert-Test (@(Get-ChildItem -LiteralPath $directory -Filter 'm4-replay-*.status.json').Count -eq 1);$checks++
 Assert-Test ((Get-FileHash -LiteralPath $manifest).Hash.ToLowerInvariant() -eq $pins.ManifestSha256 -and (Get-FileHash -LiteralPath $keyPath).Hash.ToLowerInvariant() -eq $pins.KeySha256);$checks++
 "PASS: $checks authored wrapper checks, exact79 fixture; no real backup, VM, SQL or network."
}finally{
 [Array]::Clear($key,0,$key.Length);$env:LOCALAPPDATA=$oldLocalAppData
 $resolved=[IO.Path]::GetFullPath($fixture)
 if([IO.Path]::GetDirectoryName($resolved) -ne [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd([IO.Path]::DirectorySeparatorChar) -or [IO.Path]::GetFileName($resolved) -notmatch '^mw-m4-comparison-[a-f0-9]{32}$'){throw 'Authored cleanup path refused.'}
 if(Test-Path -LiteralPath $resolved){Remove-Item -LiteralPath $resolved -Recurse -Force}
}
