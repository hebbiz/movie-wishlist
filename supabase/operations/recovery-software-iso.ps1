# Public software only. No backup material may be present in the source tree.
param([Parameter(Mandatory)][string]$Root)
$ErrorActionPreference='Stop'
$resolved=[IO.Path]::GetFullPath($Root)
$expected=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'MovieWishlist/RestoreTests/restore-20261022-qemu-7c2c8e21'))
if($resolved -ne $expected){throw 'Unexpected temporary environment path'}
$source=Join-Path $resolved 'share';$software=Join-Path $resolved 'software'
if(-not(Test-Path -LiteralPath $software)){
 if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($source)) -ne $resolved -or [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($software)) -ne $resolved){throw 'Move outside temporary environment refused'}
 Move-Item -LiteralPath $source -Destination $software
 New-Item -ItemType Directory -Path $source | Out-Null
}
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
public static class RecoveryIsoStream {
 public static void Save(object value,string path) {
  IStream source=(IStream)value;
  byte[] buffer=new byte[1024*1024];
  IntPtr pointer=Marshal.AllocHGlobal(4);
  try { using(FileStream output=new FileStream(path,FileMode.CreateNew,FileAccess.Write)) {
   while(true){source.Read(buffer,buffer.Length,pointer);int count=Marshal.ReadInt32(pointer);if(count==0)break;output.Write(buffer,0,count);}
  }} finally{Marshal.FreeHGlobal(pointer);}
 }
}
'@
$image=New-Object -ComObject IMAPI2FS.MsftFileSystemImage
try{
 $image.FileSystemsToCreate=3
 $image.FreeMediaBlocks=4194304
 $image.VolumeName='MWSOFTWARE'
 $image.Root.AddTree($software,$false)
 $result=$image.CreateResultImage()
 [RecoveryIsoStream]::Save($result.ImageStream,(Join-Path $resolved 'software.iso'))
 'READ_ONLY_SOFTWARE_ISO_CREATED'
}finally{[Runtime.InteropServices.Marshal]::ReleaseComObject($image)|Out-Null}
