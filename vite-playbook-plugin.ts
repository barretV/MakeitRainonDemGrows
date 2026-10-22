import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Mirrors the browser playthrough ledger to balance/playthrough-log.json during dev. */
export function playbookSyncPlugin(): Plugin {
  const outPath = path.resolve(process.cwd(), 'balance', 'playthrough-log.json');
  return {
    name: 'playbook-sync',
    configureServer(server) {
      server.middlewares.use('/__playbook-sync', (req, res, next) => {
        if (req.method !== 'POST') {
          next();
          return;
        }
        const chunks: Buffer[] = [];
        req.on('data', (c: Buffer) => chunks.push(c));
        req.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            JSON.parse(body);
            fs.mkdirSync(path.dirname(outPath), { recursive: true });
            fs.writeFileSync(outPath, body, 'utf8');
            res.statusCode = 204;
            res.end();
          } catch {
            res.statusCode = 400;
            res.end('bad json');
          }
        });
      });
    },
  };
}
