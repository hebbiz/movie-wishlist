import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { spawn, spawnSync } from 'node:child_process';
import { connect } from 'node:net';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readControlCredentials } from '../scripts/m4-control-credentials.mjs';

const authored = {tmdbToken:'AUTHORED_TMDB_SECRET',tavilyKey:'AUTHORED_TAVILY_SECRET'};
const runner = fileURLToPath(new URL('../scripts/m4-control-diagnostic.mjs',import.meta.url));
const pwsh = [
  join(process.env.USERPROFILE??'', '.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe'),
  join(process.env.ProgramFiles??'', 'PowerShell/7/pwsh.exe')
].find(path=>existsSync(path));
const nativeSkip = process.platform!=='win32' ? 'Windows-only prompt/IPC' : !pwsh ? 'PowerShell7 unavailable' : false;

test('bounded stdin accepts exactly two nonempty keys only after EOF, without altering env',async()=>{
  const before=process.env.TMDB_READ_ACCESS_TOKEN;
  const json=JSON.stringify(authored);
  const result=await readControlCredentials(Readable.from([json.slice(0,15),json.slice(15)]));
  assert.deepEqual(result,authored);assert.equal(process.env.TMDB_READ_ACCESS_TOKEN,before);
});
test('empty/cancelled/malformed/extra/oversize stdin fails closed with fixed non-secret error',async()=>{
  for(const input of ['', 'null', '[]', '{', JSON.stringify({...authored,extra:'PRIVATE'}), JSON.stringify({...authored,tmdbToken:''}), JSON.stringify({...authored,tavilyKey:'white space'}), JSON.stringify({...authored,tmdbToken:'x'.repeat(4097)}), 'x'.repeat(16_385),Buffer.from([0xff])]){
    await assert.rejects(readControlCredentials(Readable.from([input])),{message:'invalid-local-credentials'});
  }
  await assert.rejects(readControlCredentials(Readable.from((async function*(){yield '{';throw Error('PRIVATE_STREAM');})())),{message:'invalid-local-credentials'});
});
test('stdin CLI has no credential argv/env fallback; authored fetch stub makes ZERO network calls',()=>{
  // Startup import is TEST ONLY. The real prompt removes inherited Node hooks.
  const blockNetwork='data:text/javascript,'+encodeURIComponent('globalThis.fetch=()=>{throw Error("AUTHORED_TMDB_SECRET PRIVATE_TRANSPORT")};');
  const env={...process.env,NODE_OPTIONS:'',TMDB_READ_ACCESS_TOKEN:'INHERITED_PRIVATE_TMDB',TAVILY_API_KEY:'INHERITED_PRIVATE_TAVILY'};
  const child=input=>spawnSync(process.execPath,['--import',blockNetwork,runner,'--live-control','--credentials-stdin'],{input,encoding:'utf8',env,timeout:10_000});
  const ok=child(JSON.stringify(authored));assert.equal(ok.status,0,ok.stderr);
  const result=JSON.parse(ok.stdout);assert.equal(result.execution,'local-diagnostic');
  assert.deepEqual(result.counts,{tmdb:2,search:0,cards:0,total:2});
  assert.ok(result.cases.every(c=>c.attempts.length===1&&c.attempts[0].outcome==='transport-outcome-unknown'));
  assert.doesNotMatch(ok.stdout+ok.stderr,/AUTHORED_.*SECRET|INHERITED_PRIVATE|PRIVATE_TRANSPORT/);
  for(const input of ['','{','{}']){
    const invalid=child(input);assert.equal(invalid.status,2);
    assert.deepEqual(JSON.parse(invalid.stdout),{execution:'local-diagnostic',status:'local-run-failed-no-retry'});
    assert.equal(invalid.stderr,''); // Invalid stdin NEVER uses inherited credentials.
  }
});
test('hidden Windows prompt parses and uses stdin/CurrentUserOnly IPC, not a disk/environment handoff',{skip:nativeSkip},async()=>{
  const helper=fileURLToPath(new URL('../scripts/m4-control-password-prompt.ps1',import.meta.url));
  const source=await readFile(helper,'utf8');
  const parseCode=`$tokens=$null; $errors=$null; [void][Management.Automation.Language.Parser]::ParseFile('${helper.replaceAll("'","''")}',[ref]$tokens,[ref]$errors); if($errors.Count){ $errors | ForEach-Object { $_.Message }; exit 1 }`;
  const parse=spawnSync(pwsh,['-NoProfile','-EncodedCommand',Buffer.from(parseCode,'utf16le').toString('base64')],{encoding:'utf8',timeout:10_000});
  assert.equal(parse.status,0,parse.stderr);
  assert.equal((source.match(/Read-Host .*?-AsSecureString/g)??[]).length,2);
  assert.match(source,/StandardInput\.Write\(\$payload\)/);
  assert.match(source,/StandardInput\.Close\(\)/);
  assert.match(source,/PipeOptions\]::CurrentUserOnly/);
  assert.match(source,/WriteAsync\(\$reportBytes, 0, \$reportBytes.Length, \$deadline.Token\)/);
  assert.doesNotMatch(source,/Set-Content|Out-File|WriteAll|Write-Output|SetEnvironmentVariable|Start-Transcript|ConvertFrom-SecureString|\$env:|HttpListener|TcpListener/);
  for(const line of source.split(/\r?\n/).filter(s=>/Write-Host/.test(s)))assert.doesNotMatch(line,/\$tmdbText|\$tavilyText|\$payload|\$_/);
});
test('native Windows current-user-only named pipe hands off authored safe JSON without a disk/network listener',{skip:nativeSkip},async()=>{
  const name='mw-m4-authored-'+randomUUID(),expected={execution:'local-diagnostic',counts:{total:0}};
  const code=`$ErrorActionPreference='Stop'; $pipe=[IO.Pipes.NamedPipeServerStream]::new('${name}',[IO.Pipes.PipeDirection]::Out,1,[IO.Pipes.PipeTransmissionMode]::Byte,([IO.Pipes.PipeOptions]::Asynchronous -bor [IO.Pipes.PipeOptions]::CurrentUserOnly)); $cts=[Threading.CancellationTokenSource]::new(5000); try { Write-Output 'READY'; [void]$pipe.WaitForConnectionAsync($cts.Token).GetAwaiter().GetResult(); $bytes=[Text.UTF8Encoding]::new($false).GetBytes('${JSON.stringify(expected)}'); [void]$pipe.WriteAsync($bytes,0,$bytes.Length,$cts.Token).GetAwaiter().GetResult(); [void]$pipe.FlushAsync($cts.Token).GetAwaiter().GetResult(); [Array]::Clear($bytes) } finally { $pipe.Dispose();$cts.Dispose() }`;
  const child=spawn(pwsh,['-NoProfile','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{stdio:['ignore','pipe','pipe']});
  let stderr='',stdout='',text='',socket;
  const exited=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
  child.stderr.on('data',d=>{stderr+=d;});
  try{
    await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(Error('authored pipe startup timed out')),5000);
      child.stdout.on('data',d=>{stdout+=d;if(stdout.includes('READY')){clearTimeout(timeout);resolve();}});
      child.once('exit',()=>{clearTimeout(timeout);reject(Error('authored pipe exited before ready'));});
    });
    await new Promise((resolve,reject)=>{
      socket=connect('\\\\.\\pipe\\'+name);socket.setTimeout(5000,()=>socket.destroy(Error('authored pipe read timeout')));
      socket.on('data',d=>{text+=d;});socket.once('end',resolve);socket.once('error',reject);
    });
    assert.equal(await exited,0,stderr);assert.equal(stderr,'');assert.deepEqual(JSON.parse(text),expected);
  }finally{socket?.destroy();if(child.exitCode===null)child.kill();}
});
