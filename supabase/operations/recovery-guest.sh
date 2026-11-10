#!/bin/sh
# QEMU guest only: no NIC, no container entrypoint, no Supabase services.
set -eu
rootfs=/target/bundle/rootfs
mkdir -p "$rootfs/recovery" "$rootfs/proc" "$rootfs/sys" "$rootfs/dev"
mount --bind /host "$rootfs/recovery"
mount --bind /dev "$rootfs/dev"
mount -t proc proc "$rootfs/proc"
mount -t sysfs sysfs "$rootfs/sys"
chroot "$rootfs" /bin/bash /recovery/guest-inside.sh
