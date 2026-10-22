// Netlify synchronous limit is 60s. Budget starts before body/Auth/SQL work.
// Sources stop at 45s; finish may use the next 8s; response retains 2s,
// with another 5s outside this application budget for platform overhead.
export class HandlerDeadline extends Error {
  constructor() { super('handler-deadline'); }
}
export function createDeadline({ now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const entered = now();
  const remaining = (finish = false) => Math.max(0, (finish ? 53_000 : 45_000) - (now() - entered));
  async function wait(action, { finish = false, maxMs = 8_000, signal } = {}) {
    const ms = Math.min(maxMs, remaining(finish));
    if (ms <= 0 || signal?.aborted) throw new HandlerDeadline();
    const controller = new AbortController();
    let timer, onAbort;
    const expired = new Promise((_, reject) => {
      onAbort = () => { controller.abort(); reject(new HandlerDeadline()); };
      signal?.addEventListener('abort', onAbort, { once: true });
      timer = setTimer(onAbort, ms);
    });
    try {
      const result = await Promise.race([Promise.resolve().then(() => {
        if (controller.signal.aborted || remaining(finish) <= 0) throw new HandlerDeadline();
        return action(controller.signal);
      }), expired]);
      if (controller.signal.aborted || remaining(finish) <= 0) throw new HandlerDeadline();
      return result;
    } finally { clearTimer(timer); signal?.removeEventListener('abort', onAbort); }
  }
  return { wait, remaining };
}
