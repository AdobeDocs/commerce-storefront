import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import concurrently from 'concurrently';

const root = fileURLToPath(new URL('../', import.meta.url));
const previewUrl = 'http://localhost:3000/commerce/storefront/';
const services = [
  { name: 'content', cwd: root, port: 3003, command: 'npm run dev' },
  { name: 'connector', cwd: resolve(root, '../devsite-runtime-connector'), port: 3002, command: 'npm run dev' },
  { name: 'assets', cwd: resolve(root, '../adp-devsite'), port: 3001, command: 'npm run dev:aem' },
  { name: 'frontend', cwd: resolve(root, '../adp-devsite'), port: 3000, command: 'node dev.mjs' },
];

function isListening(port) {
  return new Promise((resolveListening) => {
    const socket = createConnection({ host: 'localhost', port });
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

async function openPreview(signal) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (signal.aborted) return;
    try {
      if (await isListening(3001)) {
        const response = await fetch(previewUrl, {
          signal: AbortSignal.any([signal, AbortSignal.timeout(2000)]),
        });
        await response.body?.cancel();
        if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
          console.log(`\nPreview ready: ${previewUrl}`);
          const opener = process.platform === 'darwin' ? 'open'
            : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
          spawn(opener, [previewUrl], { stdio: 'ignore' }).on('error', () => {
            console.log('Open the preview URL in your browser.');
          });
          return;
        }
      }
    } catch {
      if (signal.aborted) return;
    }
    await delay(1000, undefined, { signal });
  }
  console.error(`Preview is not ready yet. Check the server output, then open ${previewUrl}`);
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) {
    throw new Error('Node 24 or newer is required. Run nvm use default first.');
  }

  const commands = [];
  for (const service of services) {
    if (await isListening(service.port)) {
      console.log(`Reusing ${service.name} on port ${service.port}.`);
      continue;
    }
    try {
      await access(resolve(service.cwd, 'package.json'));
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
    killOthers: ['success', 'failure'],
  });
  const opening = openPreview(controller.signal).catch((error) => {
    if (!controller.signal.aborted) console.error(error.message);
  });
  let interrupted = false;
  const onInterrupt = () => { interrupted = true; };
  process.once('SIGINT', onInterrupt);
  process.once('SIGTERM', onInterrupt);
  try {
    await runner.result;
  } catch {
    if (!interrupted) {
      throw new Error('A preview service stopped unexpectedly. Check its output above.');
    }
  } finally {
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
