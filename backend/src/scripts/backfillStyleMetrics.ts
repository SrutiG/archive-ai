import 'dotenv/config';
import { initializeSchema, getAllUsers, getItemsByUser, getAllUserOutfits, updateSavedOutfitStyleMetrics, listAdminGeneratedOutfits, updateAdminGeneratedOutfitStyleMetrics, isPostgresDatabase } from '../database';
import { computeMetricsFromWardrobeItems, computeMetricsFromAdminItems } from '../styleMetrics';
import type { StyleMetrics } from '../styleMetricsTypes';
import type { SavedOutfit, WardrobeItem } from '../index';
import type { AdminGeneratedOutfitRecord } from '../adminTypes';
import type { BasicWardrobeItem } from '../styleMetrics';

async function backfillSavedOutfits(): Promise<number> {
  const users = await getAllUsers();
  let updated = 0;

  for (const user of users) {
    const userId: string = user.id;
    const [wardrobeItems, savedOutfits] = await Promise.all([
      getItemsByUser(userId),
      getAllUserOutfits(userId),
    ]);

    if (!savedOutfits || savedOutfits.length === 0) {
      continue;
    }

    const itemById = new Map<string, BasicWardrobeItem>(
      wardrobeItems.map((item: WardrobeItem): [string, BasicWardrobeItem] => [item.id, item])
    );

    for (const outfit of savedOutfits as SavedOutfit[]) {
      const sourceItems = outfit.itemIds
        .map((id: string) => itemById.get(id))
        .filter((item): item is BasicWardrobeItem => Boolean(item));

      if (sourceItems.length === 0) {
        continue;
      }

      const metrics = computeMetricsFromWardrobeItems(sourceItems);
      await updateSavedOutfitStyleMetrics(outfit.id, metrics as StyleMetrics);
      updated += 1;
    }
  }

  return updated;
}

async function backfillAdminOutfits(): Promise<number> {
  const outfits = await listAdminGeneratedOutfits();
  let updated = 0;

  for (const outfit of outfits as AdminGeneratedOutfitRecord[]) {
    if (!outfit.items || outfit.items.length === 0) {
      continue;
    }
    const metrics = computeMetricsFromAdminItems(outfit.items);
    await updateAdminGeneratedOutfitStyleMetrics(outfit.id, metrics as StyleMetrics);
    updated += 1;
  }

  return updated;
}

async function main() {
  const dbKind = isPostgresDatabase() ? 'PostgreSQL' : 'SQLite';
  console.log(`[StyleMetrics][Backfill] Starting backfill using ${dbKind} database...`);

  try {
    await initializeSchema().catch(() => undefined);

    const [savedUpdated, adminUpdated] = await Promise.all([
      backfillSavedOutfits(),
      backfillAdminOutfits(),
    ]);

    console.log(`[StyleMetrics][Backfill] Updated ${savedUpdated} saved outfits and ${adminUpdated} admin-generated outfits.`);
    console.log('[StyleMetrics][Backfill] Done.');
    process.exit(0);
  } catch (error) {
    console.error('[StyleMetrics][Backfill] Failed:', error);
    process.exit(1);
  }
}

main();
