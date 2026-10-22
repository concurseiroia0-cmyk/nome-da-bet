#!/usr/bin/env node
/**
 * Sobe API (server) e front-end (client) simultaneamente com um único
 * `npm run dev` na raiz do projeto.
 */
import { spawn } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const procs = [
  { name: 'server', color: '\x1b[33m', args: ['run', 'dev', '-w', 'server'] },
  { name: 'client', color: '\x1b[36m', args: ['run', 'dev', '-w', 'client'] },
].map(({ name, color, args }) => {
  const child = spawn(npmCmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const prefix = (line) => `${color}[${name}]\x1b[0m ${line}`;
  const pipe = (stream) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) console.log(prefix(line));
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on('exit', (code) => {
    console.log(prefix(`encerrado (code=${code ?? 'signal'})`));
    shutdown(code ?? 1);
  });
  return child;
});

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const p of procs) {
    if (!p.killed) p.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
