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
  const fk=(table,target)=>inventory.constraints.some(c=>c.schema==='public'&&c.table_name===table&&c.contype==='f'&&target.test(c.definition));
  const users=/REFERENCES (?:auth\.)?users\(/;
  const groups=/REFERENCES (?:public\.)?groups\(/;
  const movies=/REFERENCES (?:public\.)?movies\(/;
  const profiles=/REFERENCES (?:public\.)?profiles\(/;
  const profileToUsers=fk('profiles',users);
  const capturedKeyRelationships={groupMembershipToGroups:fk('group_members',groups),groupMembershipToUsers:fk('group_members',users)||(fk('group_members',profiles)&&profileToUsers),movieGroupListToGroups:fk('movie_group_lists',groups),movieGroupListToMovies:fk('movie_group_lists',movies)};
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
    capturedKeyRelationships,
    authSchemaAndDataRepresented:toc.includes('TABLE DATA auth '),
    storageSchemaAndDataRepresented:toc.includes('TABLE DATA storage '),
    extensionOwnedTablesOutsideArchive:extensionTableExclusions.length>0,
    extensionOwnedTableExclusions:extensionTableExclusions,
    windowsClientBundleMissingExtensionBinaries:missingExtensions,
    storageObjectFiles:'not exported; SQL metadata does not establish object-store completeness',
    localDataRestore:'no dated restore evidence found',
    sourceCountComparisonToRestore:'not established by archive authentication alone',
    scopeQualifiedRecoveryReady:false
  };
  const restored=(await readdir(config.directory)).filter(x=>/^restore-\d{4}-\d{2}-\d{2}T.*\.status\.json$/.test(x)).sort().at(-1);
  if(restored){
    const r=JSON.parse(await readFile(file(restored),'utf8'));
    Object.assign(summary,{restoreEvidence:restored,localDataRestore:r.actualRestore?'executed in isolated PG17; see comparison boundaries':'not completed in this dated attempt',
      sourceCountComparisonToRestore:r.rowCounts===true?'passed captured snapshot counts':'not verified',restoredCopyDataMatches:r.copyData===true,
      restoredRolesMatch:r.roles===true,restoredAclMatches:r.aclEffective===true,restoredSchemaSqlMatches:r.schemaSql===true,
      restoredForeignKeysValidated:r.relationships===true&&r.catalog?.constraints===true,
      restoredTargetNativeDependenciesVerified:r.nativeDependencies===true,scopeQualifiedRecoveryReady:r.verified===true});
  }
  const assessed=(await readdir(config.directory)).filter(x=>/^focused-assessment-\d+\.aesgcm$/.test(x)).sort().at(-1);
  if(assessed){
    const a=JSON.parse((await decryptSmallArtifact(file(assessed),key)).toString());
    summary.m4MigrationRecoveryQualified=a.m4MigrationRecoveryQualified===true;
    summary.focusedAssessment=assessed;
    // The older all-object round-trip verdict stays false, not overwritten by
    // this narrower migration-safety assessment.
    summary.fullProjectRoundTripVerified=a.fullProjectRoundTripVerified===true;
  }
  const cleaned=(await readdir(config.directory)).filter(x=>/^restore-cleanup-.*\.status\.json$/.test(x)).sort().at(-1);
  if(cleaned){const c=JSON.parse(await readFile(file(cleaned),'utf8'));summary.temporaryEnvironmentRemoved=c.temporaryEnvironmentRemoved===true;summary.originalEncryptedBackupPreserved=c.encryptedBackupPreserved===true;}
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
