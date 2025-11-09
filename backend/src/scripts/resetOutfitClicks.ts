import dotenv from 'dotenv';
import * as db from '../database';

dotenv.config();

async function run() {
  const resetDate = new Date().toDateString();
  console.log(`[ResetClicks] Resetting outfit generation clicks for all users (reset date: ${resetDate})`);

  try {
    const users = await db.getAllUsers();
    const totalUsers = users?.length ?? 0;

    await db.resetAllUserClicks(resetDate);

    console.log(`[ResetClicks] Successfully reset clicks for ${totalUsers} user${totalUsers === 1 ? '' : 's'}.`);
  } catch (error) {
    console.error('[ResetClicks] Failed to reset outfit generation clicks:', error);
    process.exit(1);
  } finally {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
  }
}

run();

