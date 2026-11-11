// An ephemeral display hint, never an authorization or a diagnostics grant.
// Availability is per authenticated app session, never tied to a film, group
// role or editing permission. Explicit initialization/auth refresh invalidates
// this memory-only hint; server actions always reauthorize independently.
export function createEntryAccessPreparation({ scope, request, now = Date.now, ttlMs = Infinity }) {
  const key = value => value?.userId ? JSON.stringify([value.userId]) : null;
  let epoch = 0, record = null, pending = null;
  function invalidate() {
    epoch++; record = null; pending?.controller.abort(); pending = null;
  }
  function remainingMs(context = scope()) {
    const current = key(scope());
    return current && key(context) === current && record?.key === current ? Math.max(0, record.expiresAt - now()) : 0;
  }
  function peek(context = scope()) {
    return remainingMs(context) > 0 && record.allowed === true;
  }
  function prepare(context, { force = false } = {}) {
    const current = key(scope());
    if (!current || key(context) !== current) return Promise.resolve(false);
    if (pending?.key === current) return pending.promise;
    if (!force && remainingMs(context) > 0) return Promise.resolve(record.allowed === true);
    if (pending || record?.key !== current) invalidate();
    // A new authoritative check supersedes actions sent under the previous
    // hint even for the same film/user. Retain the hint while forced refresh
    // is pending; only its fresh outcome may change the displayed permission.
    const generation = ++epoch, controller = new AbortController();
    const flight = { key: current, controller, promise: null };
    // Pass only the local auth scope. The HTTP availability request itself has
    // no client-supplied user, region, group, role or movie fields.
    flight.promise = Promise.resolve().then(() => request({ userId: context.userId }, controller.signal)).then(value => {
      if (generation !== epoch || key(scope()) !== current) return false;
      const allowed = value?.mykola_media_advice === true;
      record = { key: current, allowed, expiresAt: now() + ttlMs };
      return allowed;
    }, () => {
      if (generation === epoch && key(scope()) === current) record = { key: current, allowed: false, expiresAt: now() + ttlMs };
      return false;
    }).finally(() => { if (pending === flight) pending = null; });
    pending = flight;
    return flight.promise;
  }
  return { peek, prepare, invalidate, remainingMs, revision: () => epoch };
}
