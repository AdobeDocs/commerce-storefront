import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const previewPort = 3000;
const assetsPort = 3001;
const previewUrl = `http://localhost:${previewPort}/commerce/storefront/`;
const browserOpeners = { darwin: 'open', win32: 'explorer.exe' };

// Content supplies Markdown, the connector renders it, assets supply the runtime, and frontend joins them.
const services = [
  { name: 'content', cwd: root, port: 3003, command: 'npm run dev' },
  { name: 'connector', cwd: resolve(root, '../devsite-runtime-connector'), port: 3002, command: 'npm run dev' },
  { name: 'assets', cwd: resolve(root, '../adp-devsite'), port: assetsPort, command: 'npm run dev:aem' },
  { name: 'frontend', cwd: root, port: previewPort, command: 'node --watch scripts/preview-server.mjs' },
];

/**
 * Checks whether a local port accepts connections, with a one-second timeout.
 * This lets the launcher reuse running services instead of starting conflicting copies.
 */
function isListening(port) {
  return new Promise((resolveListening) => {
    const socket = createConnection({ host: 'localhost', port });
    // Report the probe result and close its socket so the check leaves no connection behind.
    const finish = (listening) => {
      socket.destroy();
      resolveListening(listening);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

/**
 * Checks the project manifest to identify a compatible preview server.
 * An occupied frontend port alone does not distinguish our preview from another app.
 */
async function isCompatiblePreview() {
  try {
    const response = await fetch(`${previewUrl}blocks/blocks.json`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok) {
      return false;
    }
    const manifest = await response.json();
    return typeof manifest?.storefronthome?.js === 'string'
      && typeof manifest?.storefronthome?.css === 'string';
  } catch {
    return false;
  }
}

/**
 * Checks that shared assets are listening and the preview responds with HTML.
 * Both are needed before opening the browser. HTML alone could still be unstyled.
 */
async function isPreviewReady(signal) {
  if (!await isListening(assetsPort)) {
    return false;
  }
  const response = await fetch(previewUrl, {
    signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
  });
  await response.body?.cancel();
  return response.ok && response.headers.get('content-type')?.includes('text/html');
}

/**
 * Retries readiness checks before opening the preview with the OS browser command.
 * Startup takes time, while the abort signal prevents opening a page during shutdown.
 */
async function openPreview(signal) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (signal.aborted) return;
    try {
      if (await isPreviewReady(signal)) {
        console.log(`\nPreview ready: ${previewUrl}`);
        const opener = browserOpeners[process.platform] || 'xdg-open';
        spawn(opener, [previewUrl], { stdio: 'ignore' }).on('error', () => {
          console.log('Open the preview URL in your browser.');
        });
        return;
      }
    } catch {
      if (signal.aborted) return;
    }
    await delay(1000, undefined, { signal });
  }
  console.error(`Preview is not ready yet. Check the server output, then open ${previewUrl}`);
}

/**
 * Validates local setup, starts missing services, and manages their shutdown.
 * Existing services remain independent so stopping this launcher does not stop them.
 */
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Node 24 or newer is required. Run nvm use default first.');
  }

  // Reused services stay independent. Only missing services enter the managed process group.
  const commands = [];
  for (const service of services) {
    if (await isListening(service.port)) {
      if (service.name === 'frontend' && !await isCompatiblePreview()) {
        throw new Error(`Port ${service.port} is occupied by an incompatible preview server. Stop that frontend server and rerun npm run preview.`);
      }
      console.log(`Reusing ${service.name} on port ${service.port}.`);
      continue;
    }
    try {
      await access(resolve(service.cwd, 'package.json'));
      // The content command installs its tools through npx. Sibling projects need installed dependencies.
      if (service.name !== 'content') {
        await access(resolve(service.cwd, 'node_modules'));
      }
    } catch {
      throw new Error(`Missing ${service.name} setup at ${service.cwd}. See the Local Preview section in README.md.`);
    }
    commands.push({ name: service.name, cwd: service.cwd, command: service.command });
  }

  console.log(`\nPreview: ${previewUrl}`);
  const controller = new AbortController();
  if (commands.length === 0) {
    console.log('All preview services are already running.');
    await openPreview(controller.signal);
    return;
  }

  console.log('The preview will open in your browser when ready.');
  console.log('Press Ctrl+C to stop services started by this command.\n');
  const runner = concurrently(commands, {
    prefix: 'name',
    // These services work as a unit. Stop the others if one exits.
    killOthers: ['success', 'failure'],
  });
  const opening = openPreview(controller.signal).catch((error) => {
    if (!controller.signal.aborted) console.error(error.message);
  });

  let interrupted = false;
  // Mark Ctrl+C and SIGTERM as intentional so runner rejection is not reported as a service failure.
  const onInterrupt = () => {
    interrupted = true;
  };
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onInterrupt);
  try {
    await runner.result;
  } catch {
    if (!interrupted) {
      throw new Error('A preview service stopped unexpectedly. Check its output above.');
    }
  } finally {
    // Stop readiness checks too, so shutdown cannot open a stale preview page.
    controller.abort();
    await opening;
    process.removeListener('SIGINT', onInterrupt);
    process.removeListener('SIGTERM', onInterrupt);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
