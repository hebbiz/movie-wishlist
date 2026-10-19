using System;
using System.Runtime.InteropServices;

// Read-only diagnostics of the calling process's immediate job. No Set/Assign,
// process creation, token/account inspection or ancestor-job bypass.
public static class DemoJobProbe {
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits {
        public long processTime, jobTime;
        public uint flags;
        public UIntPtr minWorkingSet, maxWorkingSet;
        public uint activeProcesses;
        public UIntPtr affinity;
        public uint priority, scheduling;
    }
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool QueryInformationJobObject(IntPtr job, int infoClass, out BasicLimits info, int length, IntPtr returnedLength);
    public sealed class Result {
        public bool? InJob;
        public uint? LimitFlags;
        public bool? BreakawayOK, SilentBreakawayOK;
        public int? QueryError;
    }
    public static Result Read() {
        var result = new Result(); bool inJob;
        if (!IsProcessInJob(GetCurrentProcess(), IntPtr.Zero, out inJob)) {
            result.QueryError = Marshal.GetLastWin32Error(); return result;
        }
        result.InJob = inJob;
        if (!inJob) return result;
        BasicLimits limits;
        if (!QueryInformationJobObject(IntPtr.Zero, 2, out limits, Marshal.SizeOf(typeof(BasicLimits)), IntPtr.Zero)) {
            result.QueryError = Marshal.GetLastWin32Error(); return result;
        }
        result.LimitFlags = limits.flags;
        result.BreakawayOK = (limits.flags & 0x00000800) != 0;
        result.SilentBreakawayOK = (limits.flags & 0x00001000) != 0;
        return result;
    }
}
