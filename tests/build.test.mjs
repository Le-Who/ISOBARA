import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('production JavaScript bundle parses successfully', () => {
  const build = spawnSync(process.execPath, ['tools/build.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);

  const syntax = spawnSync(process.execPath, ['--check', 'dist/game.js'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(syntax.status, 0, `${syntax.stdout}\n${syntax.stderr}`);
});
