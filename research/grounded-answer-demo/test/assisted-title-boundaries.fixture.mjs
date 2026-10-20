// Author-written shapes only. No live DOM, source body or inferred source selectors.
import { markup } from './assisted-kinobaza.fixture.mjs';

const original = '<h2>Authored original</h2>';
const stableConflict = '<tr><td>IMDb:</td><td>tt999900002</td></tr>';
const scopeReason = 'source-original-title-scope-unestablished';
export const titleBoundaryCases = [
  { name: 'one supported candidate', html: markup(), status: 'matched', reason: 'explicit-title-year-director-match' },
  { name: 'inline nested text in the one H2', html: markup().replace(original, '<h2><span>Authored</span> <em>original</em></h2>'), status: 'matched', reason: 'explicit-title-year-director-match' },
  { name: 'same text repeated inside an authored metadata container is not proof that source supports that container',
    html: markup().replace(original, '<section data-authored-role="film-metadata"><h2>Authored original</h2><h2>Authored original</h2></section>'), status: 'unresolved', reason: scopeReason },
  { name: 'repeated normalized value has no established multi-node source scope',
    html: markup().replace(original, '<h2>Authored original</h2><h2> AUTHORED   original </h2>'), status: 'unresolved', reason: scopeReason },
  { name: 'a matching original plus conflicting value cannot pick the convenient match',
    html: markup().replace(original, '<h2>Authored original</h2><h2>Other authored original</h2>'), status: 'unresolved', reason: scopeReason },
  { name: 'conflicting value before matching original cannot pick the last match',
    html: markup().replace(original, '<h2>Other authored original</h2><h2>Authored original</h2>'), status: 'unresolved', reason: scopeReason },
  { name: 'different known aliases do not establish original-title roles',
    html: markup().replace(original, '<h2>Authored original</h2><h2>Вигаданий фільм</h2>'), status: 'unresolved', reason: scopeReason },
  { name: 'unrecognized recommendations heading inside offset range is not silently ignored',
    html: markup().replace(original, '<h2>Authored original</h2><section><h2>Authored recommendations</h2></section>'), status: 'unresolved', reason: scopeReason },
  { name: 'unrecognized availability heading before accordion is not silently ignored',
    html: markup().replace(original, '<h2>Authored original</h2><section><h2>Authored availability</h2></section>'), status: 'unresolved', reason: scopeReason },
  { name: 'right value only after viewing boundary cannot repair wrong metadata',
    html: markup({ original: 'Unestablished metadata title' }).replace('</body>', '<section><h2>Authored original</h2></section></body>'), status: 'unresolved', reason: 'source-original-title-unestablished' },
  { name: 'H2 before H1 is not card-metadata corroboration',
    html: markup({ original: 'Unestablished metadata title' }).replace('<body>', '<body><h2>Authored original</h2>'), status: 'unresolved', reason: 'source-original-title-unestablished' },
  { name: 'H2 inside known excluded navigation cannot repair missing alias',
    html: markup({ original: 'Unestablished metadata title' }).replace('</h1>', '</h1><nav><h2>Authored original</h2></nav>'), status: 'unresolved', reason: 'source-original-title-unestablished' },
  { name: 'unrelated heading after boundary does not contaminate a valid candidate',
    html: markup().replace('</body>', '<h2>Other authored film</h2></body>'), status: 'matched', reason: 'explicit-title-year-director-match' },
  { name: 'availability H2s inside accordion are not original-title candidates', html: markup(), status: 'matched', reason: 'explicit-title-year-director-match' },
  { name: 'missing H2', html: markup().replace(original, ''), status: 'unresolved', reason: 'source-identity-structure-incomplete' },
  { name: 'missing H1', html: markup().replace(/<h1>[^<]*<\/h1>/, ''), status: 'unresolved', reason: 'source-identity-structure-incomplete' },
  { name: 'missing viewing boundary', html: markup().replace('id="availabilityAccordion"', 'id="authored-other"'), status: 'unresolved', reason: 'source-identity-structure-incomplete' },
  { name: 'duplicate viewing boundaries cannot select the first', html: markup().replace('</body>', '<div id="availabilityAccordion"></div></body>'), status: 'unresolved', reason: 'source-identity-structure-incomplete' },
  { name: 'viewing boundary before title gives no supported metadata interval', html: markup().replace('<body>', '<body><div id="availabilityAccordion"></div>').replace('id="availabilityAccordion"><div class=', 'id="authored-other"><div class='), status: 'unresolved', reason: 'source-identity-structure-incomplete' },
  { name: 'neutral nesting of a single candidate does not invent a selector', html: markup().replace(original, '<section><div><h2>Authored original</h2></div></section>'), status: 'matched', reason: 'explicit-title-year-director-match' },
  { name: 'director table before H2 retains existing offset scope, not a guessed adjacency rule', html: markup().replace(original, '').replace('</table>', '</table>' + original), status: 'matched', reason: 'explicit-title-year-director-match' },
  { name: 'stable-ID conflict wins despite unchanged title year director', html: markup({ stable: stableConflict }), status: 'mismatch', reason: 'source-stable-id-conflict' },
  { name: 'stable-ID conflict wins over competing H2 values', html: markup({ stable: stableConflict }).replace(original, original + '<h2>Other original</h2>'), status: 'mismatch', reason: 'source-stable-id-conflict' },
  { name: 'agreeing stable ID does not erase unresolved title scope', html: markup({ stable: '<tr><td>IMDb:</td><td>tt999900001</td></tr>' }).replace(original, original + '<h2>Other original</h2>'), status: 'unresolved', reason: scopeReason },
  { name: 'stable-ID conflict wins over missing viewing boundary', html: markup({ stable: stableConflict }).replace('id="availabilityAccordion"', 'id="authored-other"'), status: 'mismatch', reason: 'source-stable-id-conflict' },
];
