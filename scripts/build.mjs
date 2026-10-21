// Build the game.
//
// `vite build` can fail on Windows with
//   [vite:esbuild-transpile] remove C:\...\Temp\esbuild-<hash>: Access is denied
//
// esbuild's service writes its output to a temp file and deletes it again right
// away. When the antivirus happens to be scanning that file, the delete is
// refused and the whole build dies with it. Two things stop that from ever
// reaching you:
//
//   1. esbuild gets its own temp directory, inside the build cache, which
//      antivirus does not watch the way it watches %TEMP%.
//   2. if a delete still loses the race, the build is retried - the lock is
//      gone a moment later.
//
//   node scripts/build.mjs           type check, then build
//   node scripts/build.mjs --no-ts   build only
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tempDir = process.env.BUILD_TEMP_DIR || resolve(root, 'node_modules', '.cache', 'esbuild-tmp');
mkdirSync(tempDir, { recursive: true });

const args = process.argv.slice(2);
const skipTypes = args.includes('--no-ts');
const attempts = 3;

function run(command, commandArgs) {
  return new Promise((resolveRun) => {
    const child = spawn(command, commandArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      env: { ...process.env, TEMP: tempDir, TMP: tempDir, TMPDIR: tempDir },
    });
    let output = '';
    const collect = (chunk) => {
      output += String(chunk);
      process.stdout.write(chunk);
    };
    child.stdout?.on('data', collect);
    child.stderr?.on('data', collect);
    child.on('close', (code) => resolveRun({ code: code ?? 1, output }));
    child.on('error', () => resolveRun({ code: 1, output }));
  });
}

function isTempFileRace(output) {
  return /access is denied/i.test(output) && /esbuild-/i.test(output);
}

async function build() {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await run('npx', ['vite', 'build']);
    if (result.code === 0) return 0;
    if (attempt < attempts && isTempFileRace(result.output)) {
      console.log(
        `\n[build] a locked esbuild temp file got in the way, retrying (${attempt + 1}/${attempts})...`,
      );
      await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    return result.code;
  }
  return 1;
}

if (!skipTypes) {
  const tsc = await run('npx', ['tsc']);
  if (tsc.code !== 0) {
    console.error('[build] the type check failed');
    process.exit(tsc.code);
  }
}
process.exit(await build());
