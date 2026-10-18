using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

// Intentionally no InnerException: PowerShell must not print a raw exception
// message that could contain command/environment arguments.
public sealed class DemoDetachedLaunchException : Exception {
    public string Stage { get; private set; }
    public int? NativeErrorCode { get; private set; }
    public string FailureType { get; private set; }
    public DemoDetachedLaunchException(string stage, Exception failure)
        : base("Detached launch failed; Stage=" + stage + "; NativeErrorCode=" +
            (failure is Win32Exception ? ((Win32Exception)failure).NativeErrorCode.ToString(System.Globalization.CultureInfo.InvariantCulture) : "not-applicable") +
            "; ExceptionType=" + failure.GetType().FullName + "; no session-bound fallback was started.") {
        Stage = stage;
        NativeErrorCode = failure is Win32Exception ? (int?)((Win32Exception)failure).NativeErrorCode : null;
        FailureType = failure.GetType().FullName;
    }
}

// No tasks/services, console inheritance, command-line secrets, files or logging.
public static class DemoDetachedProcess {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct StartupInfo {
        public int cb; public string reserved, desktop, title;
        public int x, y, xSize, ySize, xChars, yChars, fill, flags;
        public short showWindow, reservedSize; public IntPtr reservedPtr, stdin, stdout, stderr;
    }
    [StructLayout(LayoutKind.Sequential)]
    struct ProcessInfo { public IntPtr process, thread; public int pid, tid; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern bool CreateProcessW(string app, StringBuilder command, IntPtr pa, IntPtr ta,
        bool inherit, uint flags, IntPtr env, string directory, ref StartupInfo si, out ProcessInfo pi);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    public static System.Diagnostics.Process Start(string app, string command, string directory, string[] environment) {
        string stage = "BuildEnvironment";
        try { return StartCore(app, command, directory, environment, ref stage); }
        catch (Exception failure) { throw new DemoDetachedLaunchException(stage, failure); }
    }
    static System.Diagnostics.Process StartCore(string app, string command, string directory, string[] environment, ref string stage) {
        // DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_UNICODE_ENVIRONMENT |
        // CREATE_BREAKAWAY_FROM_JOB. No fallback if the SSH job forbids breakaway.
        const uint flags = 0x00000008 | 0x00000200 | 0x00000400 | 0x01000000;
        string block = String.Join("\0", environment) + "\0\0";
        stage = "AllocateEnvironment";
        IntPtr memory = Marshal.StringToHGlobalUni(block);
        try {
            stage = "InitializeStartupInfo";
            var si = new StartupInfo(); si.cb = Marshal.SizeOf(typeof(StartupInfo));
            ProcessInfo pi;
            stage = "CreateProcessW";
            if (!CreateProcessW(app, new StringBuilder(command), IntPtr.Zero, IntPtr.Zero,
                false, flags, memory, directory, ref si, out pi))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Detached launch failed; no session-bound fallback was started.");
            try {
                stage = "GetProcessById";
                var process = System.Diagnostics.Process.GetProcessById(pi.pid);
                // Pin a managed handle before releasing native handles: no PID-reuse gap.
                stage = "PinProcessHandle";
                var handle = process.Handle;
                return process;
            } finally { CloseHandle(pi.thread); CloseHandle(pi.process); }
        } finally {
            // Environment contains secrets: clear unmanaged storage after CreateProcess.
            for (int i = 0; i < block.Length * 2; i++) Marshal.WriteByte(memory, i, 0);
            Marshal.FreeHGlobal(memory);
        }
    }
}
