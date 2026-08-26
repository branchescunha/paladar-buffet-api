import { createServer } from 'node:http';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { createApp } from './app.js';

const server = createServer(createApp());

server.listen(env.PORT, () => {
  console.info(`Paladar Buffet API listening on port ${env.PORT}.`);
});

async function shutdown(signal: string) {
  console.info(`${signal} received. Shutting down.`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
