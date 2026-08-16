import { Pool } from "pg";

// Single shared pool (server-side only). DATABASE_URL is never exposed to the client.
const globalForPg = globalThis as unknown as { _pgPool?: Pool };

export const pool =
  globalForPg._pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 3,
    ssl: false,
  });

if (process.env.NODE_ENV !== "production") globalForPg._pgPool = pool;
