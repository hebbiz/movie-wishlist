// An ephemeral display hint, never an authorization or a diagnostics grant.
// The real capability (including list relation), discover and apply stay fresh.
export function createEntryAccessPreparation({ scope, request, now = Date.now, ttlMs = 30000 }) {
  const key = value => value?.userId && value?.groupId ? JSON.stringify([value.userId, value.groupId]) : null;
  let epoch = 0, record = null, pending = null;
  function invalidate() {
    epoch++; record = null; pending?.controller.abort(); pending = null;
  }
  function peek(context = scope()) {
    const current = key(scope());
    return !!current && key(context) === current && record?.key === current && now() < record.expiresAt;
  }
  function prepare(context, { force = false } = {}) {
    const current = key(scope());
    if (!current || key(context) !== current || !/^tt\d{7,10}$/.test(context?.imdbId ?? '') || !context.formSession) return Promise.resolve(false);
    if (pending?.key === current) return pending.promise;
    if (!force && peek(context)) return Promise.resolve(true);
    if (pending || record?.key !== current) invalidate();
    const generation = epoch, controller = new AbortController();
    const flight = { key: current, controller, promise: null };
    // listId:null intentionally checks group eligibility, not this list row.
    flight.promise = Promise.resolve().then(() => request({ ...context, listId: null }, controller.signal)).then(value => {
      if (generation !== epoch || key(scope()) !== current) return false;
      const allowed = value?.mykola_media_advice === true;
      record = allowed ? { key: current, expiresAt: now() + ttlMs } : null;
      return allowed;
    }, () => {
      if (generation === epoch && key(scope()) === current) record = null;
      return false;
    }).finally(() => { if (pending === flight) pending = null; });
    pending = flight;
    return flight.promise;
  }
  return { peek, prepare, invalidate, revision: () => epoch };
}
