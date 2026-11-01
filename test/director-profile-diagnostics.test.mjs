// Authored diagnostic objects only: there are no live responses or credentials.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeDirectorProfileDiagnostic } from '../shared/director-profile-diagnostics.mjs';

const fixture = () => ({ status: 'confirmed', reason: 'confirmed-person-profile-facts', basis: 'exact-name-birthdate-role', sourceAttempts: 2,
  reservationRequests: 2, reservationsAcknowledged: 2, tmdbPersonCalls: 1, kinobazaPersonCalls: 1,
  attempts: [{ stage: 'tmdb-person', status: 'response-received', httpStatus: 200 }, { stage: 'kinobaza-person', status: 'response-received', httpStatus: 200 }],
  accounting: 'reserved-attempts-spent-no-retry',
  comparisons: { stableIdConflict: false, stableIdMatch: false, birthdayConflict: false, birthdayMatch: true, latinNameMatch: true, nativeAliasMatch: true } });

test('known completed, failed and not-requested diagnostics preserve bounded stages/counts/flags', () => {
  assert.deepEqual(safeDirectorProfileDiagnostic(fixture()), fixture());
  for (const reason of ['director-person-id-conflict', 'director-person-birthday-conflict', 'profile-canonical-conflict-or-ambiguous', 'tmdb-person-id-conflict', 'director-tmdb-quota-or-rate-limit', 'director-reservation-unavailable', 'director-profile-pair-unavailable', 'director-profile-timeout-no-retry']) {
    const d = safeDirectorProfileDiagnostic({ ...fixture(), status: 'unresolved', reason });
    assert.equal(d.reason, reason); assert.equal(d.status, 'unresolved');
  }
  assert.equal(safeDirectorProfileDiagnostic({ status: 'not-requested', reason: 'not-requested', accounting: 'no-extra-attempts' }).status, 'not-requested');
});

test('unknown labels, prefix lookalikes and all data-bearing fields are discarded rather than echoed', () => {
  const raw = { ...fixture(), status: 'confirmed PRIVATE_SECRET', reason: 'director-person-PRIVATE_SECRET', basis: 'PRIVATE_SECRET', accounting: 'PRIVATE_SECRET',
    sourceURL: 'https://kinobazaua.com/persons/PRIVATE_SECRET', names: ['PRIVATE_SECRET'], birthday: '1967-05-20', personId: 99999,
    aliases: ['PRIVATE_SECRET'], raw: '<html>PRIVATE_RESPONSE</html>', token: 'PRIVATE_SECRET',
    provenance: { sourceURL: 'https://private.example/PRIVATE_SECRET', reference: 'PRIVATE_SECRET' },
    attempts: [{ stage: 'tmdb-person?PRIVATE_SECRET', status: 'response-received PRIVATE_SECRET', httpStatus: 200, url: 'https://private.example', headers: { Authorization: 'Bearer PRIVATE_SECRET' }, body: 'PRIVATE_RESPONSE' }],
    comparisons: { ...fixture().comparisons, names: ['PRIVATE_SECRET'], source: 'PRIVATE_SECRET' } };
  const d = safeDirectorProfileDiagnostic(raw), serialized = JSON.stringify(d);
  assert.equal(d.status, 'unknown'); assert.equal(d.reason, 'unknown'); assert.equal(d.basis, null); assert.equal(d.accounting, 'unknown');
  assert.deepEqual(d.attempts, [{ stage: 'unknown', status: 'unknown', httpStatus: 200 }]);
  assert.doesNotMatch(serialized, /PRIVATE|https|birthday"|1967|aliases|names|provenance|Authorization|<html|99999/);
  assert.deepEqual(Object.keys(d.comparisons), ['stableIdConflict', 'stableIdMatch', 'birthdayConflict', 'birthdayMatch', 'latinNameMatch', 'nativeAliasMatch']);
});

test('all five counters permit only integers 0..2 without coercion and attempts are bounded to two', () => {
  for (const value of [0, 1, 2, -1, 3, 1.1, Infinity, NaN, '1', true, null, {}, ['2']]) {
    const raw = fixture(); for (const key of ['sourceAttempts', 'reservationRequests', 'reservationsAcknowledged', 'tmdbPersonCalls', 'kinobazaPersonCalls']) raw[key] = value;
    const d = safeDirectorProfileDiagnostic(raw);
    for (const key of ['sourceAttempts', 'reservationRequests', 'reservationsAcknowledged', 'tmdbPersonCalls', 'kinobazaPersonCalls']) assert.equal(d[key], Number.isSafeInteger(value) && value >= 0 && value <= 2 ? value : null);
  }
  const d = safeDirectorProfileDiagnostic({ ...fixture(), attempts: [...fixture().attempts, { stage: 'PRIVATE_THIRD', status: 'PRIVATE_SECRET', httpStatus: 200 }] });
  assert.equal(d.attempts.length, 2); assert.doesNotMatch(JSON.stringify(d), /PRIVATE/);
});

test('HTTP status and boolean flags are not derived from text or truthiness', () => {
  for (const value of [100, 200, 599, 99, 600, 200.1, '200', true, null, 'PRIVATE_SECRET']) {
    const raw = fixture(); raw.attempts[0].httpStatus = value; raw.comparisons.birthdayMatch = value;
    const d = safeDirectorProfileDiagnostic(raw);
    assert.equal(d.attempts[0].httpStatus, Number.isInteger(value) && value >= 100 && value <= 599 ? value : null);
    assert.equal(d.comparisons.birthdayMatch, typeof value === 'boolean' ? value : null);
  }
});

test('malformed/null input remains content-free and cannot mutate the source object', () => {
  for (const value of [undefined, null, 'PRIVATE_SECRET', 1, [], { attempts: 'PRIVATE_SECRET', comparisons: 'PRIVATE_SECRET' }, { attempts: [null, 'PRIVATE_SECRET'], comparisons: null }]) {
    const d = safeDirectorProfileDiagnostic(value);
    assert.equal(d.status, 'unknown'); assert.equal(d.reason, 'unknown'); assert.doesNotMatch(JSON.stringify(d), /PRIVATE/);
  }
  const raw = fixture(), before = JSON.stringify(raw), d = safeDirectorProfileDiagnostic(raw);
  d.attempts[0].stage = 'mutated'; d.comparisons.birthdayMatch = false;
  assert.equal(JSON.stringify(raw), before);
});

test('the projection is browser-safe with no Node/network/storage dependency', async () => {
  const code = await readFile(new URL('../shared/director-profile-diagnostics.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(code, /\bimport\s|\bBuffer\b|\bprocess\b|\bfetch\s*\(|localStorage|sessionStorage|console\./);
});
