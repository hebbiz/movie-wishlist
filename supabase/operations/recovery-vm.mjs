// Dedicated portable software VM. No NIC, forwarding, monitor, API or GUI.
// Commands never contain data/credentials; private serial output is not echoed.
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativeAclChecks} from './recovery-acl-checks.mjs';
const root=path.resolve(process.argv[2]),mode=process.argv[3]??'prepare';
if(!/^restore-\d{8}-qemu-[a-f0-9]{8}$/.test(path.basename(root)))throw new Error('invalid temporary VM root');
if(!['prepare','inspect','build-pgnet','software-console','restore'].includes(mode))throw new Error('invalid VM operation');
if(mode==='software-console'){
 for(const file of ['private-data-staged.json','share/database.dump','share/source-inventory.json']){
  try{await access(path.join(root,file));throw new Error('private data forbids software console')}catch(e){if(e.code!=='ENOENT')throw e}
 }
}
if(mode==='build-pgnet'){
 const script=(await readFile(new URL('recovery-build-pgnet.sh',import.meta.url),'utf8')).replaceAll('\r\n','\n');
 const scriptFile=path.join(root,'share/build-pgnet.sh');
 await writeFile(scriptFile,script);
}
let shareDirectory=path.join(root,'share');
if(mode==='restore'){
 for(const [source,dest]of [['recovery-guest.sh','guest-restore.sh'],['recovery-guest-inside.sh','guest-inside.sh'],['recovery-target-inventory.sql','target-inventory.sql'],['recovery-target-relationships.sql','target-relationships.sql']]){
  await writeFile(path.join(root,'share',dest),(await readFile(new URL(source,import.meta.url),'utf8')).replaceAll('\r\n','\n'));
 }
 const roles=await readFile(path.join(root,'share/roles.sql'),'utf8');
 const lines=roles.replaceAll('\r\n','\n').split('\n');
 if(lines.filter(x=>x==='CREATE ROLE supabase_admin;').length!==1||!lines.some(x=>x.startsWith('ALTER ROLE supabase_admin '))||!lines.some(x=>x.startsWith('GRANT ')&&x.endsWith('GRANTED BY supabase_admin;')))throw new Error('bootstrap reconciliation evidence absent');
 await writeFile(path.join(root,'share/roles-replay.sql'),lines.filter(x=>x!=='CREATE ROLE supabase_admin;').join('\n'));
 await writeFile(path.join(root,'share/bootstrap-reconciliation.json'),JSON.stringify({at:new Date().toISOString(),originalRoleExportUnchanged:true,skippedExistingBootstrapCreateOnly:true,grantStatementsUnchanged:true,sourceSystemOidsNotExported:true}));
 // vvfat must not truncate/rewrite an old output file across VM runs. Each
 // attempt gets new inputs/outputs; the authenticated original staging remains
 // outside the guest's writable share and every failed run can be audited.
 const name='attempt-restore-'+Date.now();shareDirectory=path.join(root,name);
 await mkdir(shareDirectory);
 for(const file of ['database.dump','roles.sql','roles-replay.sql','source-inventory.json','counts.sql','source-schema.sql','source-data.sql','guest-restore.sh','guest-inside.sh','target-inventory.sql','target-relationships.sql','bootstrap-reconciliation.json'])await copyFile(path.join(root,'share',file),path.join(shareDirectory,file));
 const localeFile=path.join(root,'assets/locale-software/usr/lib/locale/locale-archive');
 if(createHash('sha256').update(await readFile(localeFile)).digest('hex')!=='fe8f499312f54f3e25df424a1eca6f464a458a4205dd42d0f8ebd21a7a835c1b')throw new Error('official locale payload integrity refused');
 await copyFile(localeFile,path.join(shareDirectory,'locale-archive'));
 const clientFile=path.join(root,'assets/pg-client17.11.deb');
 if(createHash('sha256').update(await readFile(clientFile)).digest('hex')!=='b3b071b67a814a382516d6f6241b529c52f909672457e2f48083acce047b634f')throw new Error('official client payload integrity refused');
 await copyFile(clientFile,path.join(shareDirectory,'pg-client17.11.deb'));
 await writeFile(path.join(shareDirectory,'acl-checks.sql'),nativeAclChecks(JSON.parse(await readFile(path.join(shareDirectory,'source-inventory.json'),'utf8'))));
 await writeFile(path.join(root,'latest-restore.json'),JSON.stringify({share:name,at:new Date().toISOString()}));
}
const assets=JSON.parse(await readFile(path.join(root,'assets/assets.json'),'utf8'));
const qemu=path.join(root,'qemu/qemu-system-x86_64.exe');
const args=['-machine','pc','-accel','tcg,thread=multi','-cpu','max','-smp','2','-m','768',
 '-nodefaults','-no-user-config','-display','none','-monitor','none','-serial','stdio','-nic','none','-parallel','none',
 '-kernel',path.join(root,'alpine/boot/vmlinuz-virt'),'-initrd',path.join(root,'alpine/boot/initramfs-virt'),
 '-append','console=ttyS0,115200 modules=loop,squashfs,sd-mod,ata_piix,sr_mod,virtio_pci,virtio_blk,ext4 alpine_dev=sr0:iso9660 quiet',
 '-drive',`file=${path.join(root,'assets',assets.iso)},media=cdrom,if=ide,readonly=on`,
 '-drive',`file=${path.join(root,'software.iso')},media=cdrom,if=ide,readonly=on`,
 '-drive',`file=${path.join(root,'work.qcow2')},format=qcow2,if=virtio`,
 '-drive',`file=fat:rw:${shareDirectory.replaceAll('\\','/')},format=raw,if=virtio`];
const run=mode+'-'+Date.now();
await writeFile(path.join(root,'vm-invocation-'+run+'.json'),JSON.stringify({mode,args,noNetworkDevice:true,noPorts:true,startedAt:new Date().toISOString()},null,2));
const log=createWriteStream(path.join(root,'serial-'+run+'.log'),{flags:'wx'});
const errors=createWriteStream(path.join(root,'qemu-'+run+'.log'),{flags:'wx'});
const vm=spawn(qemu,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});
let buffer='',closed=false,exitCode,shellReady=false;
vm.stdout.on('data',chunk=>{log.write(chunk);if(mode==='software-console')process.stdout.write(chunk);const text=chunk.toString();buffer=(buffer+text).slice(-65536);if(text.includes('\x1b[6n'))vm.stdin.write('\x1b[1;1R')});
vm.stderr.on('data',chunk=>errors.write(chunk));
vm.on('close',code=>{closed=true;exitCode=code;if(mode==='software-console')process.stdin.destroy()});
async function until(expression,timeout=300000){
 const end=Date.now()+timeout;
 while(Date.now()<end){if(expression.test(buffer))return;if(closed)throw new Error('VM closed before expected marker');await new Promise(r=>setTimeout(r,200))}
 throw new Error('VM stage timeout');
}
async function send(text){for(const c of text){vm.stdin.write(c);await new Promise(r=>setTimeout(r,4))}}
let sequence=0;
async function command(text,marker,timeout){
 buffer='';const token='MW_COMMAND_'+(++sequence)+'_';
 await send("{ "+text+"; }; result=$?; printf '\\n"+token+"%s\\n' \"$result\"\n");
 await until(new RegExp(token+'[0-9]+'),timeout);
 const status=buffer.match(new RegExp(token+'([0-9]+)'))[1];
 if(status!=='0'||(marker&&!new RegExp(marker).test(buffer)))throw new Error('VM command did not pass');
}
try{
 await until(/login:/);
 await send('root\n');await until(/localhost:.*#|~ #/);await new Promise(r=>setTimeout(r,500));
 shellReady=true;
 await command("stty -echo; mkdir -p /host /target; mount /dev/vdb1 /host && printf 'MW_SHARE_%s\\n' READY",'MW_SHARE_READY');
 console.log('VM_BOOTED_WITHOUT_NETWORK');
 if(mode==='software-console'){
   await command("mount /dev/vda /target && r=/target/bundle/rootfs && mkdir -p $r/recovery && mount --bind /host $r/recovery && mount --bind /dev $r/dev && mount -t proc proc $r/proc && echo MW_CONSOLE_READY",'MW_CONSOLE_READY');
   console.log('PUBLIC_SOFTWARE_CONSOLE_NO_BACKUP_DATA');
   for await(const chunk of process.stdin){if(closed)break;await send(chunk.toString().replaceAll('\r\n','\n').replaceAll('\r','\n'))}
   if(!closed){buffer='';await send('sync; poweroff\n');await until(/Power down|reboot: Power down|System halted/,120000)}
 }else if(mode==='prepare'){
   await command("mkdir -p /software; mount -t iso9660 /dev/sr1 /software && apk add --no-network e2fsprogs >/host/filesystem-tools.log 2>&1 && mkfs.ext4 -F /dev/vda >/host/mkfs.log 2>&1 && mount /dev/vda /target && cp /software/umoci /tmp/umoci && chmod +x /tmp/umoci && /tmp/umoci unpack --image /software/oci:recovery /target/bundle >/host/unpack.log 2>&1 && echo MW_UNPACK_OK",'MW_UNPACK_OK',1200000);
   console.log('SUPABASE_OCI_ROOTFS_UNPACKED');
   await command("find /target/bundle/rootfs -name postgres -type f > /host/pgpaths.txt; find /target/bundle/rootfs -name pg_net.control -o -name pg_cron.control -o -name supabase_vault.control > /host/controls.txt; echo MW_PREFLIGHT_DONE",'MW_PREFLIGHT_DONE');
 }else if(mode==='inspect'){
   await command("mkdir -p /software; mount -t iso9660 /dev/sr1 /software && cp /software/umoci /tmp/umoci && chmod +x /tmp/umoci && /tmp/umoci raw unpack --help >/host/raw-unpack-help.txt && echo MW_HELP_DONE",'MW_HELP_DONE');
   await command("mount /dev/vda /target && chroot /target/bundle/rootfs /bin/bash -c 'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/nix/var/nix/profiles/default/bin; set -e; command -v postgres pg_config pg_ctl initdb psql pg_restore runuser; postgres --version; pg_config --sharedir; p=$(pg_config --sharedir); for e in pg_cron pg_net supabase_vault; do cat \"$p/extension/$e.control\"; done' >/host/image-info.txt 2>&1 && echo MW_INSPECT_DONE",'MW_INSPECT_DONE');
   console.log('SOFTWARE_INSPECTION_COMPLETE');
   await command("chroot /target/bundle/rootfs /bin/bash -c 'export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/nix/var/nix/profiles/default/bin; cat /etc/os-release; for p in gcc cc make clang pkg-config curl ld; do command -v $p || true; done; pg_config --includedir-server; pg_config --pgxs; find /nix/store -maxdepth 4 -type f \\( -name gcc -o -name make -o -name pg_config -o -name postgres.h -o -name curl.h \\) 2>/dev/null | head -40' >/host/build-capabilities.txt 2>&1; echo MW_CAPABILITIES_DONE",'MW_CAPABILITIES_DONE');
 }else if(mode==='build-pgnet'){
   await command("mount /dev/vda /target && r=/target/bundle/rootfs && mkdir -p $r/recovery && mount --bind /host $r/recovery && mount --bind /dev $r/dev && mount -t proc proc $r/proc && chroot $r /bin/bash /recovery/build-pgnet.sh >/host/build-pgnet.log 2>&1 && echo MW_BUILD_DONE",'MW_BUILD_DONE',1200000);
   console.log('EXACT_PG_NET_BUILT_OFFLINE');
 }else{
   await command("mount /dev/vda /target && /bin/sh /host/guest-restore.sh >/host/guest-driver.log 2>&1 && echo MW_RESTORE_DRIVER_DONE",'MW_RESTORE_DRIVER_DONE',1200000);
   console.log('RESTORE_DRIVER_FINISHED_INSPECT_PRIVATE_RESULTS');
 }
 if(!closed){buffer='';await send('sync; poweroff\n');await until(/Power down|reboot: Power down|System halted/,120000)}
}catch{
 console.log('VM_FAILED_SAFE_DETAILS_PRIVATE');process.exitCode=1;
 if(shellReady&&!closed){
  // Flush private diagnostics even on a failed command. Ctrl-C interrupts a
  // timed-out foreground software process before the guest shutdown command.
  try{buffer='';await send('\x03');await new Promise(r=>setTimeout(r,500));await send('sync; poweroff\n');await until(/Power down|reboot: Power down|System halted/,120000)}catch{}
 }
}
finally{
 if(!closed){vm.kill();await new Promise(r=>vm.once('close',r));}
 log.end();errors.end();
 console.log('VM_PROCESS_CLOSED');
}
