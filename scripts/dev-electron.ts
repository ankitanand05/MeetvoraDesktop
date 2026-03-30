/**
 * dev-electron.ts
 *
 * Spawns the Electron process in development mode after Vite is ready.
 * Called by `npm run dev` via concurrently + wait-on.
 *
 * Steps:
 *  1. Compile Electron TypeScript with tsc
 *  2. Launch Electron pointing at the compiled main entry
 *
 * Key Windows notes:
 *  - .cmd scripts MUST be spawned with shell:true OR via cmd.exe /c
 *  - require('electron') returns the path to the real electron.exe binary,
 *    which can be spawned with shell:false on all platforms.
 */

import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let electronProcess: ChildProcess | null = null;

function getElectronExe(): string {
  // The 'electron' package exports the absolute path to the platform binary
  return require('electron') as string;
}

function startElectron() {
  const mainEntry = path.join(root, 'dist-electron', 'main', 'index.js');

  console.log('[dev-electron] Compiling Electron TypeScript...');

  // Step 1: compile electron TS — pass command as a string (avoids DEP0190 warning on Node 24)
  const tsc = spawn('npx tsc -p tsconfig.electron.json', [], {
    cwd: root,
    shell: true,
    stdio: 'inherit',
  });

  tsc.on('error', (err) => {
    console.error('[dev-electron] Failed to run tsc:', err.message);
    process.exit(1);
  });

  tsc.on('close', (code) => {
    if (code !== 0) {
      console.error(`[dev-electron] tsc exited with code ${code}`);
      process.exit(1);
    }

    console.log('[dev-electron] Compile done. Launching Electron...');

    const electronBin = getElectronExe();

    // Step 2: launch Electron using the real binary path (shell:false, cross-platform)
    electronProcess = spawn(electronBin, [mainEntry], {
      cwd: root,
      shell: false,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        ELECTRON_DISABLE_SECURITY_WARNINGS: '1',
        ELECTRON_ENABLE_LOGGING: '1',
      },
    });

    electronProcess.on('error', (err) => {
      console.error('[dev-electron] Failed to launch Electron:', err.message);
      process.exit(1);
    });

    electronProcess.on('close', (exitCode) => {
      console.log(`[dev-electron] Electron exited (${exitCode})`);
      // Exit 0 when user closes the window (normal), propagate real errors
      process.exit(exitCode ?? 0);
    });
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  electronProcess?.kill();
  process.exit(0);
});

process.on('SIGINT', () => {
  electronProcess?.kill();
  process.exit(0);
});

startElectron();

