#!/bin/bash
# Public software and one new empty cluster only. No checkpoint inputs.
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/nix/var/nix/profiles/default/bin
unset PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE PGOPTIONS PGSERVICE PGSERVICEFILE
id=${1:?public attempt identity required}
[[ "$id" =~ ^[0-9]{13}-[a-f0-9]{8}$ ]]
install -D -m 0644 /recovery/locale-archive /usr/lib/locale/locale-archive
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 LOCALE_ARCHIVE=/usr/lib/locale/locale-archive
pgbin=$(dirname "$(command -v postgres)")
libdir=$(pg_config --pkglibdir)
dpkg-deb -x /recovery/pg-client17.11.deb /opt/recovery-client17.11
clientbin=/opt/recovery-client17.11/usr/lib/postgresql/17/bin
LD_LIBRARY_PATH="$(pg_config --libdir):/usr/lib/x86_64-linux-gnu" "$clientbin/pg_restore" --version > /recovery/public-client-version.txt
grep -q '^pg_restore (PostgreSQL) 17\.11' /recovery/public-client-version.txt
postgres --version > /recovery/public-server-version.txt
grep -q '^postgres (PostgreSQL) 17\.6' /recovery/public-server-version.txt
for module in pg_cron pg_net supabase_vault pg_stat_statements pgcrypto uuid-ossp plpgsql; do
 test -f "$libdir/$module.so"
 ldd "$libdir/$module.so" > "/recovery/public-native-$module.txt"
 if grep -q 'not found' "/recovery/public-native-$module.txt"; then exit 1; fi
done
grep -q "default_version = '0.20.4'" "$(pg_config --sharedir)/extension/pg_net.control"
sha256sum "$libdir/pg_net.so" > /recovery/public-pgnet-native.sha256
data=/var/lib/postgresql/recovery-software-smoke-$id
socket=/var/run/postgresql/recovery-software-smoke-$id
test ! -e "$data"
test ! -e "$socket"
install -d -m 0700 -o postgres -g postgres "$data" "$socket"
aspostgres(){ runuser -u postgres -- "$@"; }
aspostgres "$pgbin/initdb" -D "$data" -U recovery_smoke --auth-local=trust --auth-host=reject --encoding=UTF8 --locale=C.UTF-8 > /recovery/public-initdb.log 2>&1
cat >> "$data/postgresql.conf" <<CONF
listen_addresses = ''
unix_socket_directories = '$socket'
unix_socket_permissions = 0700
shared_preload_libraries = 'pg_cron,pg_net'
cron.database_name = 'postgres'
cron.launch_active_jobs = off
pg_net.database_name = 'template1'
pg_net.batch_size = 0
shared_buffers = '16MB'
max_connections = 10
jit = off
CONF
stop(){ aspostgres "$pgbin/pg_ctl" -D "$data" -m fast -w stop > /recovery/public-stop.log 2>&1; }
trap 'result=$?; trap - EXIT; if ! stop; then exit 1; fi; exit "$result"' EXIT
aspostgres "$pgbin/pg_ctl" -D "$data" -l "$data/server.log" -w start > /recovery/public-start.log 2>&1
# Validate the separately reviewed catalog-only query on empty local PG before
# it is permitted to capture restored-target evidence. Never print its body.
aspostgres "$pgbin/psql" -X -q -At -h "$socket" -U recovery_smoke -d postgres -v ON_ERROR_STOP=1 -f /recovery/target-acl.sql > /recovery/public-empty-privileges.json 2> /recovery/public-empty-privileges.log
test -s /recovery/public-empty-privileges.json
result=$(aspostgres "$pgbin/psql" -X -At -h "$socket" -U recovery_smoke -d postgres -v ON_ERROR_STOP=1 -c "SELECT current_setting('listen_addresses')='', current_setting('unix_socket_permissions')='0700', current_setting('cron.launch_active_jobs')='off', current_setting('pg_net.database_name')='template1', current_setting('pg_net.batch_size')='0', NOT EXISTS(SELECT FROM pg_stat_activity WHERE backend_type ILIKE '%pg_net%' AND datname IS DISTINCT FROM 'template1'), NOT EXISTS(SELECT FROM pg_hba_file_rules WHERE address IS NOT NULL AND auth_method IS DISTINCT FROM 'reject');")
test "$result" = 't|t|t|t|t|t|t'
test "$(stat -c %a "$socket")" = 700
printf '{"verified":true,"emptyCluster":true,"modules":7,"noTcp":true,"socket0700":true,"cronDisabled":true,"pgNetIsolated":true,"pgNetBatchZero":true,"hostAuthenticationRejected":true}\n' > /recovery/public-smoke-result.json
printf 'MW_PUBLIC_SMOKE_PASS\n'
