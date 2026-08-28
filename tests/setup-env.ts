import 'dotenv/config';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/test';
process.env.DIRECT_URL ??= process.env.DATABASE_URL;
process.env.APP_URL ??= 'http://localhost:3333';
process.env.WEB_URL ??= 'http://localhost:5173';
process.env.SESSION_SECRET ??= '12345678901234567890123456789012';
