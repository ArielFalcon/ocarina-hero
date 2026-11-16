import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compareDists, compareSignatures, pageSignature } from './dist-parity';

const page = (head: string, body: string) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const baseline = page(
  '<title>Song &amp; Tab</title><meta name="description" content="Play it"><link rel="canonical" href="https://x.app/song/a/">'
  + '<script type="application/ld+json">{"@type":"WebPage","name":"A"}</script><script type="module" src="/assets/a.js"></script>',
  '<h1>Song</h1><p>Play  the\n tab</p><a href="/song/b/">B</a>',
);

test('serialisation and whitespace changes keep a page signature equal', () => {
  const rewritten = page(
    '<title>Song &#38; Tab</title>\n<meta content="Play it" name="description">\n<link href="https://x.app/song/a/" rel="canonical">'
    + '<script type="application/ld+json">{"name":"A","@type":"WebPage"}</script><script src="/_astro/b.js" type="module"></script>',
    '\n<h1>\n Song </h1>\n<p>Play the tab</p>\n<a href="/song/b/">B</a>\n',
  );
  assert.deepEqual(compareSignatures('a', pageSignature(baseline), pageSignature(rewritten)), []);
});

test('a changed title, an extra H1, an inline script or a lost link is reported by field', () => {
  const changed = page(
    '<title>Other</title><meta name="description" content="Play it"><link rel="canonical" href="https://x.app/song/a/">'
    + '<script type="application/ld+json">{"@type":"WebPage","name":"A"}</script><script>boot()</script>',
    '<h1>Song</h1><h1>Catalog</h1><p>Play the tab</p>',
  );
  const fields = compareSignatures('a', pageSignature(baseline), pageSignature(changed)).map(line => line.split(':')[1]!.trim().split(' ')[0]);
  assert.deepEqual(fields.sort(), ['headings', 'inlineScripts', 'links', 'text', 'title']);
  assert.deepEqual(compareSignatures('a', pageSignature(baseline), pageSignature(changed), new Set(['title', 'headings', 'inlineScripts', 'links', 'text'])), []);
});

test('two dists differ when a page is missing or added, or a contract file changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'dist-parity-'));
  try {
    const write = (dist: string, file: string, contents: string) => {
      mkdirSync(join(root, dist, file, '..'), { recursive: true });
      writeFileSync(join(root, dist, file), contents);
    };
    for (const dist of ['old', 'new']) write(dist, 'index.html', baseline);
    write('old', 'song/a/index.html', baseline);
    write('new', 'song/c/index.html', baseline);
    write('old', 'sitemap.xml', '<urlset/>');
    write('new', 'sitemap.xml', '<urlset></urlset>');
    assert.deepEqual(compareDists(join(root, 'old'), join(root, 'new')).differences, [
      'song/a/index.html: missing from candidate',
      'song/c/index.html: added in candidate',
      'sitemap.xml: contents differ',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
