#!/bin/bash
# Public software only, run offline inside the disposable guest/chroot.
set -euo pipefail
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/nix/var/nix/profiles/default/bin
printf '%s  %s\n' e082e9c3c1eb2315c000f241baf782564c9f926b22cc41c848bb33dd0c8758f8 /recovery/pg_net.tar.gz | sha256sum -c -
mkdir -p /tmp/pgnet-build
tar -xzf /recovery/pg_net.tar.gz -C /tmp/pgnet-build --strip-components=1
cd /tmp/pgnet-build
gcc --version | head -1
pg_config --version
core_config=/nix/store/q8ih5lpb472cx4ip22m1dsajsmj2nm73-postgresql-17.6/bin/pg_config
test -f "$("$core_config" --includedir-server)/postgres.h"
libdir=$(pg_config --pkglibdir)
old_module=$(find /nix/store -maxdepth 5 -type f -name pg_net-0.19.5.so -print -quit)
test -f "$old_module"
ldd "$old_module"
curl_library=$(ldd "$old_module" | awk '$1=="libcurl.so.4"{print $3}')
test -f "$curl_library"
printf '%s  %s\n' 16c62a9c4af0f703d28bda6d7bbf37ba47055ad3414d70dec63e2e6336f2a82d /recovery/curl-source.tar.xz | sha256sum -c -
tar -xJf /recovery/curl-source.tar.xz -C /tmp
make CC=gcc with_llvm=no PG_CONFIG="$core_config" CPPFLAGS="$("$core_config" --cppflags) -I/tmp/curl-8.4.0/include" SHLIB_LINK="$curl_library" PG_LDFLAGS="-Wl,-rpath,$(dirname "$curl_library")"
# Runtime image's pg_config rewrites its include prefix to /usr; compile with
# the verified real PG headers, then install into the actual plugin locations.
install -m 0755 pg_net.so "$libdir/pg_net.so"
install -m 0644 pg_net.control sql/pg_net--*.sql "$(pg_config --sharedir)/extension/"
for module in pg_cron supabase_vault; do
 if ! test -f "$libdir/$module.so"; then
  native_module=$(find /nix/store -maxdepth 5 -type f -name "$module.so" -print -quit)
  test -f "$native_module"
  ln -s "$native_module" "$libdir/$module.so"
 fi
 ldd "$libdir/$module.so" > "/recovery/$module.dependencies.txt"
 if grep -q 'not found' "/recovery/$module.dependencies.txt"; then exit 1; fi
done
cat "$(pg_config --sharedir)/extension/pg_net.control"
ldd "$libdir/pg_net.so" > /recovery/pg-net-built.dependencies.txt
if grep -q 'not found' /recovery/pg-net-built.dependencies.txt; then exit 1; fi
sha256sum "$(pg_config --pkglibdir)/pg_net.so" > /recovery/pg-net-built.sha256
