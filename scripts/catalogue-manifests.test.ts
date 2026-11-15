import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { CATALOGUE_INDEX } from '../src/core/songs/catalogue-index';
import {
  CATALOGUE_MANIFESTS, EXPECTED_RANGE_REJECTIONS, assertExpectedRejections, readCatalogueManifests,
} from './catalogue-tools';

function withFolder(files: Record<string, unknown>, run: (folder: string) => void) {
  const folder = mkdtempSync(join(tmpdir(), 'catalogue-manifests-'));
  try {
    for (const [name, content] of Object.entries(files)) writeFileSync(join(folder, name), JSON.stringify(content));
    run(folder);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

test('a listed manifest that is missing fails the read', () => {
  withFolder({ 'a.json': [{ id: 'one' }] }, folder => {
    assert.throws(() => readCatalogueManifests(['a.json', 'b.json'], folder), /b\.json/);
  });
});

test('a selection id repeated across manifests fails the read', () => {
  withFolder({ 'a.json': [{ id: 'one' }], 'b.json': [{ id: 'one' }] }, folder => {
    assert.throws(() => readCatalogueManifests(['a.json', 'b.json'], folder), /Duplicate.*one/);
  });
});

test('selections keep the listed file order', () => {
  withFolder({ 'a.json': [{ id: 'one' }], 'b.json': [{ id: 'two' }] }, folder => {
    assert.deepEqual(readCatalogueManifests(['b.json', 'a.json'], folder).map(item => item.id), ['two', 'one']);
  });
});

test('range rejections must equal the expected set in both directions', () => {
  assert.doesNotThrow(() => assertExpectedRejections([...EXPECTED_RANGE_REJECTIONS].reverse()));
  assert.throws(() => assertExpectedRejections([...EXPECTED_RANGE_REJECTIONS, 'new-song']), /new-song/);
  assert.throws(() => assertExpectedRejections(EXPECTED_RANGE_REJECTIONS.slice(1)), new RegExp(EXPECTED_RANGE_REJECTIONS[0]));
});

test('every manifest file on disk is registered', () => {
  const onDisk = readdirSync('scripts').filter(name => /^catalogue-.*manifest\.json$/.test(name)).sort();
  assert.deepEqual([...CATALOGUE_MANIFESTS].sort(), onDisk);
});

test('registered selections, minus the expected rejections, are the catalogue index', () => {
  const rejected = new Set<string>(EXPECTED_RANGE_REJECTIONS);
  const ids = readCatalogueManifests().filter(item => !rejected.has(item.id)).map(item => `catalogue-${item.id}`);
  assert.deepEqual(ids, CATALOGUE_INDEX.map(song => song.id));
});
