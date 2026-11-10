#!/bin/bash
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/nix/var/nix/profiles/default/bin
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 LOCALE_ARCHIVE=/usr/lib/locale/locale-archive
unset PGPASSWORD PGHOST PGPORT PGUSER PGDATABASE PGOPTIONS PGSERVICE PGSERVICEFILE
install -D -m 0644 /recovery/locale-archive /usr/lib/locale/locale-archive
pgbin=$(dirname "$(command -v postgres)")
dpkg-deb -x /recovery/pg-client17.11.deb /opt/recovery-client17.11
clientbin=/opt/recovery-client17.11/usr/lib/postgresql/17/bin
clientlibs=$(pg_config --libdir)
LD_LIBRARY_PATH="$clientlibs:/usr/lib/x86_64-linux-gnu" "$clientbin/pg_dump" --version > /recovery/aligned-client-version.txt
postgres --version > /recovery/target-version.txt
"$pgbin/pg_config" --sharedir > /recovery/target-sharedir.txt
sharedir=$(cat /recovery/target-sharedir.txt)
libdir=$("$pgbin/pg_config" --pkglibdir)
for module in pg_cron pg_net supabase_vault pg_stat_statements pgcrypto uuid-ossp plpgsql; do
 if ! test -f "$libdir/$module.so"; then
  native_module=/nix/store/1h5zql3fk1aan2fpbkhyxkc9bp0l8anp-postgresql-and-plugins-17.6/lib/$module.so
  test -f "$native_module"
  ln -s "$native_module" "$libdir/$module.so"
 fi
 ldd "$libdir/$module.so" > "/recovery/native-$module.dependencies.txt"
 if grep -q 'not found' "/recovery/native-$module.dependencies.txt"; then exit 1; fi
done
printf '{"verified":true,"modules":7}\n' > /recovery/native-dependencies.json
sha256sum "$libdir/pg_net.so" > /recovery/pg-net-built.sha256
for extension in pg_cron pg_net supabase_vault; do
 test -f "$sharedir/extension/$extension.control"
 cat "$sharedir/extension/$extension.control" >> /recovery/extension-controls.txt
done
# Initdb uses a distinct bootstrap role; restored cloud roles remain unchanged.
data=/var/lib/postgresql/recovery-test
socket=/var/run/postgresql/recovery-test
if test -d "$data"; then
 test "$(readlink -f "$data")" = /var/lib/postgresql/recovery-test
 test ! -f "$data/postmaster.pid"
 mv "$data" "$data.previous-$(date +%s)"
fi
install -d -m 0700 -o postgres -g postgres "$data" "$socket"
aspostgres(){ runuser -u postgres -- "$@"; }
psql(){ aspostgres "$pgbin/psql" -X -h "$socket" -U mw_restore_bootstrap -v ON_ERROR_STOP=1 "$@"; }
restore(){ aspostgres env LD_LIBRARY_PATH="$clientlibs:/usr/lib/x86_64-linux-gnu" "$clientbin/pg_restore" -h "$socket" -U mw_restore_bootstrap --exit-on-error "$@" /recovery/database.dump; }
aspostgres "$pgbin/initdb" -D "$data" -U supabase_admin --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=C.UTF-8 > /recovery/initdb.log 2>&1
cat >> "$data/postgresql.conf" <<'CONF'
listen_addresses = ''
unix_socket_directories = '/var/run/postgresql/recovery-test'
unix_socket_permissions = 0700
shared_preload_libraries = ''
cron.database_name = 'postgres'
cron.launch_active_jobs = off
pg_net.database_name = 'template1'
pg_net.batch_size = 0
shared_buffers = '16MB'
max_connections = 10
work_mem = '1MB'
maintenance_work_mem = '32MB'
logging_collector = off
log_statement = 'none'
log_min_error_statement = 'panic'
jit = off
CONF
stop(){ aspostgres "$pgbin/pg_ctl" -D "$data" -m fast -w stop >> /recovery/shutdown.log 2>&1 || true; cp "$data/server.log" /recovery/server.log || true; }
trap stop EXIT
aspostgres "$pgbin/pg_ctl" -D "$data" -l /var/lib/postgresql/recovery-test/server.log -w start > /recovery/start.log 2>&1
# Local imported roles have NO role passwords; no network listener exists.
aspostgres "$pgbin/psql" -X -h "$socket" -U supabase_admin -d template1 -v ON_ERROR_STOP=1 -c 'CREATE ROLE mw_restore_bootstrap SUPERUSER LOGIN;' > /recovery/operator-role.log 2>&1
psql -d template1 -f /recovery/roles-replay.sql > /recovery/roles-restore.log 2>&1
psql -d template1 -c 'DROP DATABASE postgres;' > /recovery/drop-empty-local.log 2>&1
# Enable cron's required library only AFTER dropping initdb's empty database:
# even a disabled launcher can hold a connection and prevent DROP DATABASE.
aspostgres "$pgbin/pg_ctl" -D "$data" -m fast -w stop > /recovery/preload-restart.log 2>&1
printf "\nshared_preload_libraries = 'pg_cron,pg_net'\n" >> "$data/postgresql.conf"
aspostgres "$pgbin/pg_ctl" -D "$data" -l /var/lib/postgresql/recovery-test/server.log -w start >> /recovery/preload-restart.log 2>&1
# Vault data must not be encrypted a second time; restored webhook triggers do
# not fire during import. pg_net is preloaded as required by its real API, but
# its worker is isolated in untouched template1 with LIMIT 0, never postgres.
# Restore the complete archive with the same minor client as the export:
# no section filtering of dependency-free ACL/comment entries.
PGOPTIONS='-c session_replication_role=replica' restore --create --role=supabase_admin -d template1 > /recovery/full-restore.log 2>&1
psql -At -d postgres -f /recovery/target-inventory.sql > /recovery/target-inventory.json 2> /recovery/inventory.log
psql -At -d postgres -f /recovery/counts.sql > /recovery/target-counts.jsonl 2> /recovery/counts.log
psql -At -d postgres -f /recovery/acl-checks.sql > /recovery/acl-comparison.jsonl 2> /recovery/acl-checks.log
psql -d postgres -f /recovery/target-relationships.sql > /recovery/relationships.log 2>&1
aspostgres env LD_LIBRARY_PATH="$clientlibs:/usr/lib/x86_64-linux-gnu" "$clientbin/pg_dump" -h "$socket" -U mw_restore_bootstrap -d postgres --data-only --file=/var/lib/postgresql/recovery-test/target-data.sql > /recovery/redump-data.log 2>&1
cp /var/lib/postgresql/recovery-test/target-data.sql /recovery/target-data.sql
aspostgres env LD_LIBRARY_PATH="$clientlibs:/usr/lib/x86_64-linux-gnu" "$clientbin/pg_dump" -h "$socket" -U mw_restore_bootstrap -d postgres --schema-only --file=/var/lib/postgresql/recovery-test/target-schema.sql > /recovery/redump-schema.log 2>&1
cp /var/lib/postgresql/recovery-test/target-schema.sql /recovery/target-schema.sql
aspostgres "$pgbin/pg_dumpall" -h "$socket" -U mw_restore_bootstrap --roles-only --no-role-passwords > /recovery/target-roles.sql 2> /recovery/redump-roles.log
psql -At -d postgres -c "SELECT json_build_object('serverVersion',current_setting('server_version_num'),'cronDisabled',current_setting('cron.launch_active_jobs')='off','noTcp',current_setting('listen_addresses')='','pgNetWorkerAbsent',NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE backend_type ILIKE '%pg_net%'),'pgNetProcessingDisabled',current_setting('pg_net.batch_size')='0','pgNetIsolated',current_setting('pg_net.database_name')='template1' AND NOT EXISTS(SELECT 1 FROM pg_stat_activity WHERE backend_type ILIKE '%pg_net%' AND datname IS DISTINCT FROM 'template1'),'httpQueueEmpty',NOT EXISTS(SELECT 1 FROM net.http_request_queue),'validatedForeignKeysNoOrphans',true);" > /recovery/restore-complete.json
