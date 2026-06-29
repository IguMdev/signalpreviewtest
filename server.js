import dotenv from 'dotenv';
dotenv.config({ override: true });
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import fs from 'fs';
import path from 'path';

// Import the TanStack Start server handler
import handler from './dist/server/server.js';

// Prevent GramJS timeouts and other unhandled rejections from crashing the PM2 process
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Do not exit the process. PM2 will not restart it, allowing it to survive intermittent network errors.
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  // Same here, keep the bot alive.
});

const app = new Hono();

// Middlewares for Speed and Security
app.use('*', secureHeaders());
app.use('*', compress());

// Serve static assets from dist/client
app.use('/*', serveStatic({ 
  root: './dist/client',
  getContent: async (path, c) => {
    try {
      if (fs.existsSync(path) && fs.statSync(path).isFile()) {
        return fs.readFileSync(path);
      }
    } catch (e) {
      return null;
    }
    return null;
  }
}));

// Fallback to TanStack Start SSR handler for any unhandled routes
app.use('/*', async (c) => {
  return await handler.fetch(c.req.raw, process.env, {});
});

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
}, (info) => {
  console.log(`Listening on http://localhost:${info.port}`);
});
