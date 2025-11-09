import dotenv from 'dotenv';
import * as db from '../database';
import { formatQuickEntryTitle } from '../llmService';

dotenv.config();

async function run() {
  const userId = process.argv[2];

  if (!userId) {
    console.error('Usage: ts-node src/scripts/cleanWardrobeTitles.ts <userId>');
    process.exit(1);
  }

  console.log(`[CleanTitles] Normalising wardrobe item titles for user "${userId}"`);

  try {
    const items = await db.getItemsByUser(userId);
    if (!items || items.length === 0) {
      console.log('[CleanTitles] No items found for this user. Nothing to update.');
      return;
    }

    let updatedCount = 0;
    for (const item of items) {
      const cleanedTitle = formatQuickEntryTitle(item.title || '');
      if (!cleanedTitle || cleanedTitle === item.title) {
        continue;
      }

      await db.updateItem(item.id, { title: cleanedTitle });
      updatedCount += 1;
      console.log(`[CleanTitles] Updated "${item.title}" -> "${cleanedTitle}"`);
    }

    if (updatedCount === 0) {
      console.log('[CleanTitles] All titles already normalised. No changes made.');
    } else {
      console.log(`[CleanTitles] Completed. Updated ${updatedCount} item${updatedCount === 1 ? '' : 's'}.`);
    }
  } catch (error) {
    console.error('[CleanTitles] Failed to normalise titles:', error);
    process.exit(1);
  } finally {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
  }
}

run();

