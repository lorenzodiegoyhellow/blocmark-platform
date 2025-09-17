import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Clean up the DATABASE_URL format (remove psql prefix and decode HTML entities)
const cleanDatabaseUrl = process.env.DATABASE_URL
  .replace(/^psql\s+'/, '') // Remove 'psql ' prefix
  .replace(/'$/, '') // Remove trailing quote
  .replace(/&amp;/g, '&'); // Decode HTML entities

// Create a PostgreSQL pool for all database operations (avoids TLS proxy issues in Replit)
export const pool = new Pool({
  connectionString: cleanDatabaseUrl,
  ssl: {
    rejectUnauthorized: false // Allow self-signed certificates for Neon in development
  },
  max: 10, // Increased pool size for main database operations
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Create the Drizzle database instance using node-postgres (works in both Replit and AWS)
export const db = drizzle(pool, { schema });
