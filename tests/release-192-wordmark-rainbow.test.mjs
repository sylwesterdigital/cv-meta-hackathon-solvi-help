import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');
const html=read('index.html'), css=read('styles.css');
const cssSnippet=css.slice(css.indexOf('/* v0.2.192 — Isolated'));

test('only .help gets a rainbow overlay; SOLVI and version retain original text markup', () => {
  assert.match(html, /<div class="wordmark" aria-label="SOLVI.help">SOLVI<span class="wordmark-rainbow" data-text="\.help">\.help<\/span><small id="version">v0\.2\.213<\/small><\/div>/);
  assert.match(cssSnippet, /\.wordmark > span\.wordmark-rainbow::after/);
  assert.doesNotMatch(cssSnippet, /\.wordmark::after|\.wordmark small::after/);
});

test('base .help style remains visible whenever the effect is hidden', () => {
  assert.match(css, /\.wordmark>span\{color:#99a8bf\}/);
  assert.match(cssSnippet, /content: attr\(data-text\)/);
  assert.match(cssSnippet, /opacity: 0;/);
  assert.match(cssSnippet, /pointer-events: none;/);
  assert.match(cssSnippet, /position: absolute;/);
});

test('rainbow repeats without a jump and is animated vertically', () => {
  assert.match(cssSnippet, /background-image: linear-gradient\(to bottom,/);
  assert.match(cssSnippet, /#ff4767 0%/);
  assert.match(cssSnippet, /#ff4767 50%/);
  assert.match(cssSnippet, /#ff4767 100%/);
  assert.match(cssSnippet, /background-size: 100% 200%/);
  assert.match(cssSnippet, /solvi-help-rainbow-vertical 6s linear infinite/);
  assert.match(cssSnippet, /to\s*\{ background-position: 0 100%; \}/);
});

test('rainbow blinks on and back off periodically without JavaScript', () => {
  assert.match(cssSnippet, /solvi-help-rainbow-blink 9s ease-in-out infinite/);
  assert.match(cssSnippet, /0%, 15%, 46%, 100% \{ opacity: 0; \}/);
  assert.match(cssSnippet, /19%, 40% \{ opacity: 1; \}/);
  assert.doesNotMatch(read('js/main.js'), /wordmark-rainbow|solvi-help-rainbow/);
});

test('reduced motion disables both animations and preserves the original mark', () => {
  assert.match(cssSnippet, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSnippet, /animation: none;\s*opacity: 0;/);
  assert.equal(JSON.parse(read('package.json')).version,'0.2.213');
  assert.equal(JSON.parse(read('releases.json')).currentVersion,'0.2.213');
});
