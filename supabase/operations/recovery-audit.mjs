// Offline only. Reads encrypted checkpoint/key via parent, emits no DB rows/counts.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { decryptSmallArtifact, verifyArtifact, encryptBytes } from './recovery-archive.mjs';
const input = [];
for await (const chunk of process.stdin) input.push(chunk);
const config = JSON.parse(Buffer.concat(input).toString('utf8'));
const key = Buffer.from(config.keyBase64,'base64');
delete config.keyBase64;
try {
  const file = name => path.join(config.directory,name);
  const status = JSON.parse(await readFile(file('status.json'),'utf8'));
  let hashesMatch = true;
  for (const artifact of status.files) {
    // Manifest cannot redirect this reader outside the checkpoint.
    if (path.basename(artifact.name) !== artifact.name || !/^[a-z-]+\.aesgcm$/.test(artifact.name)) throw new Error('invalid-artifact-name');
    const data = await readFile(file(artifact.name));
    hashesMatch &&= createHash('sha256').update(data).digest('hex') === artifact.sha256;
    await verifyArtifact(file(artifact.name),key);
  }
  for (const name of (await readdir(config.directory)).filter(name=>name.endsWith('.aesgcm'))) await verifyArtifact(file(name),key);
  if (!hashesMatch) throw new Error('checksum-mismatch');
  const inventory = JSON.parse((await decryptSmallArtifact(file('source-inventory.aesgcm'),key)).toString('utf8'));
  const toc = JSON.parse((await decryptSmallArtifact(file('archive-toc.aesgcm'),key)).toString('utf8')).toc;
  const controls = new Set((await readdir(path.join(config.bin,'../share/extension'))).filter(s=>s.endsWith('.control')).map(s=>s.slice(0,-8)));
  const missingExtensions = inventory.extensions.filter(e=>!controls.has(e.extname)).map(e=>e.extname);
  const unreadable = inventory.counts.filter(c=>c.unreadable);
  const notArchived = [];
  const ambiguous = [];
  const extensionTableExclusions = [];
  const tables = new Set(), data = new Set();
  for (const line of toc.split(/\r?\n/)) {
    const record = line.match(/^\d+; \d+ \d+ TABLE( DATA)? (\S+) (\S+) /);
    if(record) (record[1]?data:tables).add(record[2]+'.'+record[3]);
  }
  for(const table of inventory.tables) {
    const pointer=table.schema+'.'+table.name;
    if(!/^[a-z_][a-z0-9_]*$/.test(table.schema)||!/^[a-z_][a-z0-9_]*$/.test(table.name)) { ambiguous.push(pointer); continue; }
    if(table.extension) {
      if(!data.has(pointer)) extensionTableExclusions.push(pointer);
    } else if(!tables.has(pointer)||(table.relkind==='r'&&!data.has(pointer))) notArchived.push(pointer);
  }
  const storageObjects = inventory.counts.find(c=>c.schema==='storage'&&c.name==='objects');
  let nativeExportsNoWarnings=true;
  for(const name of ['database','roles-before','roles-after']) {
    const diagnostic=JSON.parse((await decryptSmallArtifact(file(name+'-diagnostics.aesgcm'),key)).toString('utf8'));
    nativeExportsNoWarnings &&= diagnostic.code===0 && diagnostic.stderr.trim()==='';
  }
  const summary = {
    hashesMatch, allRetainedArtifactsAuthenticated:true,
    nativeExportsNoWarnings,
    rolesStableDuringExport:status.rolesStableDuringExport,
    applicationAndManagedNonExtensionTablesAccountedFor:notArchived.length===0&&ambiguous.length===0,
    allSnapshotCountsReadable:unreadable.length===0,
    authSchemaAndDataRepresented:toc.includes('TABLE DATA auth '),
    storageSchemaAndDataRepresented:toc.includes('TABLE DATA storage '),
    extensionOwnedTablesOutsideArchive:extensionTableExclusions.length>0,
    extensionOwnedTableExclusions:extensionTableExclusions,
    localMissingExtensionBinaries:missingExtensions,
    storageObjectFiles:'not exported; SQL metadata does not establish object-store completeness',
    localDataRestore:'not attempted; protected encrypted staging not verified',
    sourceCountComparisonToRestore:'not performed; no restored target',
    scopeQualifiedRecoveryReady:false
  };
  const auditName='audit-'+new Date().toISOString().replaceAll(/[^0-9TZ]/g,'')+'-'+randomUUID().slice(0,8);
  const auditFile=file(auditName+'.aesgcm');
  await encryptBytes(Buffer.from(JSON.stringify({summary,notArchived,ambiguous,extensionTableExclusions,unreadable,storageObjects},null,2)),auditFile,key);
  await verifyArtifact(auditFile,key);
  const integrity=[];
  for(const name of (await readdir(config.directory)).filter(name=>name.endsWith('.aesgcm'))) {
    const bytes=await readFile(file(name));
    integrity.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
  }
  await writeFile(file(auditName+'.status.json'),JSON.stringify({summary,integrity},null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify(summary));
} catch { console.log('OFFLINE_AUDIT_FAILED_NO_DATA_OUTPUT'); process.exitCode=1; }
finally { key.fill(0); }
