/**
 * Database Seed Runner
 * Run with: npx tsx src/db/seeds/index.ts
 */

import { initDatabase, closeDatabase } from '../connection.js';
import { seedMedViro } from './medviro.js';

async function runSeeds() {
  console.log('Starting database seeding...\n');

  try {
    // Initialize database connection
    await initDatabase();

    // Run seeds
    await seedMedViro();

    console.log('\n✓ All seeds completed successfully!');
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
  }
}

// Run if called directly
runSeeds();
