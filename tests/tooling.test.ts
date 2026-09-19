/** 用真实搬迁后的项目副本验证开发命令的输出归属，以及宿主验收的目录边界。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, cp, mkdtemp, mkdir, readFile, readdir, realpath, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import type createArtifactRun from '../scripts/artifact-run.cjs';

type HostLocation = { readonly vault: { readonly adapter: { getBasePath(): string } } };
const run = promisify(execFile);
const project = fileURLToPath(new URL('../', import.meta.url));
const load = createRequire(import.meta.url);

test('development commands follow a relocated project and reject a different host vault', async () => {
  const temporary = await mkdtemp(join(tmpdir(), 'subvaults-relocation-'));
  try {
    const initial = join(temporary, 'Original checkout');
    await mkdir(initial);
    for (const entry of ['src', 'scripts', 'manifest.json', 'package.json', 'tests/obsidian']) {
      await cp(join(project, entry), join(initial, entry), { recursive: true });
    }
    await symlink(join(project, 'node_modules'), join(initial, 'node_modules'), 'junction');
    const unrelated = join(temporary, 'Caller directory');
    await mkdir(unrelated);
    await run(process.execPath, [join(initial, 'scripts/prepare-debug.mjs')], { cwd: unrelated });
    const moved = join(temporary, 'Renamed plugin 中文');
    await rename(initial, moved);
    await run(process.execPath, [join(moved, 'scripts/build.mjs')], { cwd: unrelated });
    await run(process.execPath, [join(moved, 'scripts/sync-debug.mjs')], { cwd: unrelated });

    const vault = join(moved, 'TestVaults/Debug-Vault');
    for (const file of ['main.js', 'manifest.json', 'styles.css']) {
      assert.deepEqual(await readFile(join(moved, 'dist', file)), await readFile(join(vault, '.obsidian/plugins/subvaults', file)));
    }
    assert.deepEqual(await readFile(join(moved, 'src/styles.css')), await readFile(join(moved, 'dist/styles.css')));
    await access(join(vault, 'Testing/Long list/Note 159.md'));
    await assert.rejects(access(join(unrelated, 'dist')), { code: 'ENOENT' });
    await assert.rejects(access(join(unrelated, 'TestVaults')), { code: 'ENOENT' });

    const validate = load(join(moved, 'tests/obsidian/debug-vault.cjs')) as (app: HostLocation) => string;
    const wrong: HostLocation = { vault: { adapter: { getBasePath: () => unrelated } } };
    assert.throws(() => validate(wrong), /Expected the project Debug-Vault/);
    await assert.rejects(access(join(moved, '.artifacts')), { code: 'ENOENT' });
    assert.equal(validate({ vault: { adapter: { getBasePath: () => vault } } }), await realpath(moved));
    await assert.rejects(access(join(moved, '.artifacts')), { code: 'ENOENT' });
    for (const file of ['verify.cjs', 'verify-interactions.cjs']) {
      const suite = load(join(moved, 'tests/obsidian', file)) as (app: HostLocation) => Promise<unknown>;
      await assert.rejects(suite(wrong), /Expected the project Debug-Vault/);
    }
    await assert.rejects(access(join(moved, '.artifacts')), { code: 'ENOENT' });
    const createRun = load(join(moved, 'scripts/artifact-run.cjs')) as typeof createArtifactRun;
    const artifacts = createRun('relocation-check', ['logs', 'tests']);
    assert.match(artifacts.name, /^\d{8}-\d{6}-\d{3}-relocation-check-\d+$/);
    for (const category of ['logs', 'tests'] as const) {
      assert.equal(artifacts.directories[category], join(await realpath(moved), '.artifacts/scratch', category, artifacts.name));
      await access(artifacts.directories[category]);
    }
    await assert.rejects(access(join(moved, '.artifacts/scratch/previews')), { code: 'ENOENT' });
    await assert.rejects(access(join(unrelated, '.artifacts')), { code: 'ENOENT' });

    const metadataPath = join(moved, 'package.json');
    const metadataText = await readFile(metadataPath, 'utf8');
    const metadata = JSON.parse(metadataText) as { version: string };
    const packageCommand = [join(moved, 'scripts/package-release.mjs'), metadata.version];
    await assert.rejects(run(process.execPath, [packageCommand[0]!, `v${metadata.version}`], { cwd: unrelated }), /Usage:/);
    await writeFile(metadataPath, JSON.stringify({ ...metadata, version: '0.0.0' }));
    await assert.rejects(run(process.execPath, packageCommand, { cwd: unrelated }), /versions must match/);
    await writeFile(metadataPath, metadataText);
    await run(process.execPath, packageCommand, { cwd: unrelated });
    const release = join(moved, '.artifacts/releases', metadata.version);
    const archive = join(release, `subvaults-${metadata.version}.zip`);
    const files = ['main.js', 'manifest.json', 'styles.css'];
    assert.deepEqual((await readdir(release)).sort(), [...files, `subvaults-${metadata.version}.zip`].sort());
    assert.deepEqual((await run('unzip', ['-Z1', archive])).stdout.trim().split('\n').sort(), [...files].sort());
    for (const file of files) {
      const bytes = await readFile(join(moved, 'dist', file));
      assert.deepEqual(await readFile(join(release, file)), bytes);
      assert.equal((await run('unzip', ['-p', archive, file])).stdout, bytes.toString());
    }
    await assert.rejects(run(process.execPath, packageCommand, { cwd: unrelated }), /EEXIST/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});
