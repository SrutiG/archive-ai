import dotenv from 'dotenv';
import * as db from '../database';

dotenv.config();

async function run() {
  console.log('[BackfillSavedOutfitIds] Starting backfill of saved outfit item IDs');
  try {
    await db.initializeSchema();
    await db.backfillSavedOutfitItemIds();
    console.log('[BackfillSavedOutfitIds] Backfill complete');
  } catch (error) {
    console.error('[BackfillSavedOutfitIds] Backfill failed:', error);
    process.exitCode = 1;
  } finally {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
  }
}

run();

