/**
 * Database Connection Management
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { getConfig } from '../config.js';
import { logger } from '../utils/logger.js';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let client: ReturnType<typeof postgres> | null = null;

/**
 * Initialize database connection
 */
export async function initDatabase(): Promise<ReturnType<typeof drizzle<typeof schema>>> {
  if (db) {
    return db;
  }

  const config = getConfig();

  logger.info('Initializing database connection', {
    host: new URL(config.database.url).hostname,
    database: new URL(config.database.url).pathname.slice(1),
  });

  try {
    client = postgres(config.database.url, {
      max: config.database.poolMax,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {}, // Suppress notices
    });

    db = drizzle(client, { schema });

    // Test connection
    await client`SELECT 1`;
    logger.info('Database connection established successfully');

    return db;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

/**
 * Get database instance
 */
export function getDatabase(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (client) {
    logger.info('Closing database connection');
    await client.end();
    client = null;
    db = null;
  }
}

/**
 * Execute a transaction
 */
export async function transaction<T>(
  fn: (tx: ReturnType<typeof drizzle<typeof schema>>) => Promise<T>
): Promise<T> {
  const database = getDatabase();
  // Drizzle ORM transaction support
  return await database.transaction(async (tx) => {
    return await fn(tx as ReturnType<typeof drizzle<typeof schema>>);
  });
}

// Export schema for use elsewhere
export { schema };
