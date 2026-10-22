// Operator-only worker. Password comes from a private child environment; key via stdin.
// stdout contains only allowlisted stage/status codes, never database contents.
import { createRequire } from 'node:module';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { encryptStream, encryptBytes, verifyArtifact, decryptSmallArtifact, decryptStream } from './recovery-archive.mjs';

let config, key, client;
const records = { format: 1, project: 'mttkectgdqqmejpenkrn', backupComplete: false, restoreVerified: false, stages: [] };
const progress = stage => { records.stages.push({ stage, time: new Date().toISOString() }); console.log(stage); };
const ident = value => '"' + value.replaceAll('"', '""') + '"';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const savePrivate = async (name, value) => encryptBytes(Buffer.from(JSON.stringify(value)), path.join(config.directory, name + '.aesgcm'), key);
const safeError = e => ({ code: /^[A-Z0-9_]{2,40}$/.test(e?.code ?? '') ? e.code : 'OPERATION_FAILED' });

function remoteEnvironment(password) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^PG/i.test(k)));
  Object.assign(env, { PGHOST: 'aws-1-eu-north-1.pooler.supabase.com', PGPORT: '5432', PGDATABASE: 'postgres',
    PGUSER: 'postgres.mttkectgdqqmejpenkrn', PGPASSWORD: password, PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: config.caFile, PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'mw-recovery-export',
    PGOPTIONS: '-c default_transaction_read_only=on -c statement_timeout=900000' });
  return env;
}
function native(tool, args, env, input) {
  const child = spawn(path.join(config.bin, tool + '.exe'), args, { env, windowsHide: true, stdio: ['pipe','pipe','pipe'] });
  const timer = setTimeout(() => child.kill(), 900000);
  let errorBytes = 0; const errors = [];
  child.stderr.on('data', chunk => { if (errorBytes < 1024 * 1024) errors.push(chunk); errorBytes += chunk.length; });
  const completed = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', code => { clearTimeout(timer); resolve({ code, stderr: Buffer.concat(errors).toString('utf8') }); });
  });
  const feeding = input ? pipeline(Readable.from(input), child.stdin).catch(() => {}) : (child.stdin.end(), Promise.resolve());
  return { child, completed, feeding };
}
async function dumpEncrypted(tool, args, env, name) {
  const operation = native(tool, args, env);
  await encryptStream(operation.child.stdout, path.join(config.directory, name + '.aesgcm'), key);
  const status = await operation.completed;
  await savePrivate(name + '-diagnostics', status);
  if (status.code !== 0) { const e = new Error('native export failed'); e.code = 'EXPORT_FAILED'; throw e; }
  return status;
}
async function captureNative(tool, args, env, input) {
  const operation = native(tool, args, env, input);
  const chunks = []; let size = 0;
  for await (const chunk of operation.child.stdout) {
    size += chunk.length;
    if (size > 32 * 1024 * 1024) { operation.child.kill(); throw new Error('native-output-bound'); }
    chunks.push(chunk);
  }
  await operation.feeding;
  return { ...await operation.completed, output: Buffer.concat(chunks) };
}

async function run() {
  const input = [];
  for await (const chunk of process.stdin) input.push(chunk);
  config = JSON.parse(Buffer.concat(input).toString('utf8'));
  key = Buffer.from(config.keyBase64, 'base64'); delete config.keyBase64;
  const password = process.env.PGPASSWORD;
  delete process.env.PGPASSWORD;
  if (!password || key.length !== 32) throw new Error('missing-private-input');
  const { Client } = createRequire(import.meta.url)(config.pgModule);
  const ca = await readFile(config.caFile, 'utf8');
  client = new Client({ host: 'aws-1-eu-north-1.pooler.supabase.com', port: 5432, database: 'postgres',
    user: 'postgres.mttkectgdqqmejpenkrn', password, ssl: { ca, rejectUnauthorized: true,
      servername: 'aws-1-eu-north-1.pooler.supabase.com', minVersion: 'TLSv1.2' },
    connectionTimeoutMillis: 15000, query_timeout: 130000, application_name: 'mw-recovery-snapshot' });
  client.on('error', () => {});
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await client.query("SET LOCAL statement_timeout='120s'; SET LOCAL idle_in_transaction_session_timeout='900s'; SET LOCAL row_security=off");
  const identity = (await client.query("SELECT current_database() AS database, session_user AS role, current_setting('server_version_num') AS version, current_setting('transaction_read_only') AS read_only, clock_timestamp() AS observed_at, pg_export_snapshot() AS snapshot")).rows[0];
  if (identity.database !== 'postgres' || identity.role !== 'postgres' || !/^17\d{4}$/.test(identity.version) || identity.read_only !== 'on') throw new Error('source-identity-refused');
  records.snapshotAt = identity.observed_at.toISOString();
  records.serverVersion = identity.version;
  progress('SNAPSHOT_HELD_READ_ONLY');
  const extensions = (await client.query('SELECT extname, extversion, extnamespace::regnamespace::text AS schema FROM pg_extension ORDER BY extname')).rows;
  const tables = (await client.query(`SELECT n.nspname AS schema,c.relname AS name,c.relkind,c.relrowsecurity,c.relforcerowsecurity,
    pg_get_userbyid(c.relowner) AS owner,c.relacl::text AS acl,e.extname AS extension
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_depend d ON d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e'
    LEFT JOIN pg_extension e ON e.oid=d.refobjid
    WHERE c.relkind IN ('r','p') AND n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
    ORDER BY n.nspname,c.relname`)).rows;
  const counts = [];
  for (const table of tables) {
    await client.query('SAVEPOINT count_table');
    try {
      const count = (await client.query(`SELECT count(*)::text AS count FROM ${ident(table.schema)}.${ident(table.name)}`)).rows[0].count;
      counts.push({ schema: table.schema, name: table.name, count });
      await client.query('RELEASE SAVEPOINT count_table');
    } catch (e) {
      await client.query('ROLLBACK TO SAVEPOINT count_table');
      await client.query('RELEASE SAVEPOINT count_table');
      counts.push({ schema: table.schema, name: table.name, unreadable: safeError(e) });
    }
  }
  const schemas = (await client.query("SELECT nspname,pg_get_userbyid(nspowner) AS owner,nspacl::text AS acl FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema' ORDER BY nspname")).rows;
  const constraints = (await client.query(`SELECT n.nspname AS schema,c.relname AS table_name,x.conname,x.contype,x.convalidated,pg_get_constraintdef(x.oid,true) AS definition
    FROM pg_constraint x JOIN pg_class c ON c.oid=x.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema' ORDER BY n.nspname,c.relname,x.conname`)).rows;
  await savePrivate('source-inventory', { identity, schemas, extensions, tables, counts, constraints });
  progress('SNAPSHOT_INVENTORY_ENCRYPTED');
  const env = remoteEnvironment(password);
  await dumpEncrypted('pg_dumpall', ['--roles-only','--no-role-passwords','--no-password'], env, 'roles-before');
  progress('ROLES_EXPORTED_WITHOUT_PASSWORDS');
  await dumpEncrypted('pg_dump', ['--format=custom', '--snapshot=' + identity.snapshot, '--lock-wait-timeout=10s', '--no-password'], env, 'database');
  records.backupComplete = true;
  records.backupCompletedAt = new Date().toISOString();
  progress('DATABASE_DUMP_ENCRYPTED');
  await dumpEncrypted('pg_dumpall', ['--roles-only','--no-role-passwords','--no-password'], env, 'roles-after');
  delete env.PGPASSWORD;
  await client.query('ROLLBACK'); await client.end(); client = null;
  const before = await decryptSmallArtifact(path.join(config.directory,'roles-before.aesgcm'), key);
  const after = await decryptSmallArtifact(path.join(config.directory,'roles-after.aesgcm'), key);
  // pg_dumpall random \restrict keys differ even when roles do not.
  const normalizeRoles = buffer => buffer.toString('utf8').split(/\r?\n/).filter(line => !/^\\(?:un)?restrict\b/.test(line)).join('\n');
  records.rolesStableDuringExport = sha(normalizeRoles(before)) === sha(normalizeRoles(after));
  progress('SNAPSHOT_RELEASED');
  const localEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^PG/i.test(k)));
  const archive = path.join(config.directory, 'database.aesgcm');
  records.decryptionVerified = await verifyArtifact(archive, key) > 0;
  const toc = await captureNative('pg_restore', ['--list'], localEnv, decryptStream(archive, key));
  await savePrivate('archive-toc', { exit: toc.code, stderr: toc.stderr, toc: toc.output.toString('utf8') });
  if (toc.code !== 0) throw new Error('archive-toc-failed');
  const streamCheck = await captureNative('pg_restore', ['--file=NUL'], localEnv, decryptStream(archive, key));
  await savePrivate('archive-read-test', { code: streamCheck.code, stderr: streamCheck.stderr });
  records.archiveReadVerified = streamCheck.code === 0;
  records.restoreVerified = false;
  records.restoreBlocker = 'ENCRYPTED_LOCAL_STAGING_NOT_VERIFIED';
  records.coverage = {
    database: 'full pg_dump, no schema/data filters; inspect TOC and extension-owned exclusions',
    auth: 'schema/data in DB archive, service settings/keys excluded', roles: 'definitions/memberships without role passwords; object ACLs in DB archive',
    extensions: 'definitions/config only, not native binaries or Vault root key',
    storage: 'SQL metadata only; object files not exported', externalConfiguration: 'excluded'
  };
  progress('ARCHIVE_AUTHENTICATED_AND_READ_WITHOUT_EXECUTION');
}
try { await run(); }
catch (e) { records.failure = safeError(e); console.log('RECOVERY_EXPORT_NOT_COMPLETE_OR_NOT_VERIFIED'); process.exitCode = 1; }
finally {
  if (client) { await client.query('ROLLBACK').catch(() => {}); await client.end().catch(() => {}); }
  if (key && config) {
    await savePrivate('checkpoint-record', records).catch(() => {});
    // Public-safe file is deliberately only operation state, hashes, paths, timestamps.
    const files = [];
    for (const name of ['database','roles-before','roles-after','source-inventory','archive-toc','archive-read-test','checkpoint-record']) {
      const file = path.join(config.directory, name + '.aesgcm');
      try { const h = createHash('sha256'); for await (const chunk of createReadStream(file)) h.update(chunk); files.push({ name: path.basename(file), bytes:(await stat(file)).size, sha256:h.digest('hex') }); } catch {}
    }
    await writeFile(path.join(config.directory,'status.json'), JSON.stringify({ ...records, files }, null, 2), { flag:'wx', mode:0o600 }).catch(() => {});
    key.fill(0);
  }
}
