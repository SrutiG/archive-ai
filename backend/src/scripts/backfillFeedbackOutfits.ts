import 'dotenv/config';
import {
  initializeSchema,
  getAllUsers,
  getItemsByUser,
  getAllUserOutfits,
  getFeedback,
  insertSavedOutfit,
  updateSavedOutfitStyleMetrics,
  updateSavedOutfitSavedFlag,
  updateFeedbackOutfitRefs,
  isPostgresDatabase,
} from '../database';
import { computeMetricsFromWardrobeItems } from '../styleMetrics';
import type { SavedOutfit, WardrobeItem } from '../index';
import type { OutfitFeedback } from '../outfitFeedback';
import type { StyleMetrics } from '../styleMetricsTypes';

function normalizeTitle(value: string | undefined | null): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '');
}

function buildTitleSignature(titles: string[]): string {
  return titles
    .map(title => normalizeTitle(title))
    .filter(Boolean)
    .sort()
    .join('|');
}

function getOutfitTitles(outfit: SavedOutfit, byId: Map<string, WardrobeItem>): string[] {
  if (outfit.itemTitles && outfit.itemTitles.length > 0) {
    return outfit.itemTitles;
  }
  if (outfit.itemIds && outfit.itemIds.length > 0) {
    return outfit.itemIds
      .map(id => byId.get(id)?.title)
      .filter((title): title is string => Boolean(title));
  }
  return [];
}

function getFeedbackTitles(entry: OutfitFeedback, byId: Map<string, WardrobeItem>): string[] {
  if (entry.itemTitles && entry.itemTitles.length > 0) {
    return entry.itemTitles;
  }
  if (entry.itemIds && entry.itemIds.length > 0) {
    return entry.itemIds
      .map(id => byId.get(id)?.title)
      .filter((title): title is string => Boolean(title));
  }
  return [];
}

function resolveItems(
  titles: string[],
  entry: OutfitFeedback,
  byId: Map<string, WardrobeItem>
): WardrobeItem[] {
  const resolved = new Map<string, WardrobeItem>();

  (entry.itemIds || []).forEach(id => {
    const item = byId.get(id);
    if (item) {
      resolved.set(item.id, item);
    }
  });

  titles.forEach(title => {
    const normalized = normalizeTitle(title);
    const match = Array.from(byId.values()).find(
      item => normalizeTitle(item.title) === normalized
    );
    if (match) {
      resolved.set(match.id, match);
    }
  });

  return Array.from(resolved.values());
}

async function backfillFeedbackOutfits() {
  await initializeSchema().catch(() => undefined);
  const dbKind = isPostgresDatabase() ? 'PostgreSQL' : 'SQLite';
  console.log(`[FeedbackBackfill] Running on ${dbKind} database...`);

  const users = await getAllUsers();
  let createdOutfits = 0;
  let linkedFeedback = 0;

  for (const user of users) {
    const userId: string = user.id;
    const feedbackEntries: OutfitFeedback[] = await getFeedback(userId);
    if (!feedbackEntries.length) {
      continue;
    }

    const wardrobeItems = await getItemsByUser(userId);
    const wardrobeById = new Map<string, WardrobeItem>(
      wardrobeItems.map((item: WardrobeItem) => [item.id, item])
    );
    const existingOutfits = await getAllUserOutfits(userId);
    const outfitById = new Map<string, SavedOutfit>(
      existingOutfits.map((outfit: SavedOutfit) => [outfit.id, outfit])
    );
    const outfitsBySignature = new Map<string, SavedOutfit[]>();
    const outfitFeedbackStatus = new Map<string, { hasFeedback: boolean; hasLike: boolean; hasDislike: boolean }>();

    for (const outfit of existingOutfits as SavedOutfit[]) {
      const titles = getOutfitTitles(outfit, wardrobeById);
      const signature = buildTitleSignature(titles);
      if (!signature) {
        continue;
      }
      if (!outfitsBySignature.has(signature)) {
        outfitsBySignature.set(signature, []);
      }
      outfitsBySignature.get(signature)!.push(outfit);
    }

    for (const entry of feedbackEntries as OutfitFeedback[]) {
      const feedbackTitles = getFeedbackTitles(entry, wardrobeById);
      const feedbackSignature = buildTitleSignature(feedbackTitles);
      let candidateOutfit: SavedOutfit | undefined;

      if (entry.outfitId) {
        const existing = outfitById.get(entry.outfitId);
        if (existing) {
          const existingSignature = buildTitleSignature(getOutfitTitles(existing, wardrobeById));
          if (!feedbackSignature || existingSignature === feedbackSignature) {
            candidateOutfit = existing;
          }
        }
      }

      if (!candidateOutfit && feedbackSignature && outfitsBySignature.has(feedbackSignature)) {
        const matches = outfitsBySignature.get(feedbackSignature)!;
        candidateOutfit = matches[0];
      }

      if (candidateOutfit) {
        const resolvedItems = resolveItems(feedbackTitles, entry, wardrobeById);
        let metrics = candidateOutfit.styleMetrics ?? entry.styleMetrics ?? null;
        if (!metrics && resolvedItems.length > 0) {
          metrics = computeMetricsFromWardrobeItems(resolvedItems);
          await updateSavedOutfitStyleMetrics(candidateOutfit.id, metrics as StyleMetrics);
          candidateOutfit.styleMetrics = metrics as StyleMetrics;
        }
        await updateFeedbackOutfitRefs(entry.id, candidateOutfit.id, metrics);
        const status = outfitFeedbackStatus.get(candidateOutfit.id) || { hasFeedback: false, hasLike: false, hasDislike: false };
        status.hasFeedback = true;
        status.hasLike = status.hasLike || entry.type === 'like';
        status.hasDislike = status.hasDislike || entry.type === 'dislike';
        outfitFeedbackStatus.set(candidateOutfit.id, status);
        linkedFeedback += 1;
        continue;
      }

      const resolvedItems = resolveItems(feedbackTitles, entry, wardrobeById);
      if (!resolvedItems.length && !feedbackTitles.length) {
        continue;
      }

      const itemIds = resolvedItems.length
        ? resolvedItems.map(item => item.id)
        : (entry.itemIds || []);
      const itemTitles = resolvedItems.length
        ? resolvedItems.map(item => item.title)
        : feedbackTitles;

      const styleMetrics = resolvedItems.length
        ? (computeMetricsFromWardrobeItems(resolvedItems) as StyleMetrics)
        : (entry.styleMetrics as StyleMetrics | null);

      const newOutfit: SavedOutfit = {
        id: entry.outfitId || entry.id,
        itemIds,
        itemTitles,
        prompt: entry.prompt,
        notes: entry.feedback,
        createdAt: entry.createdAt,
        styleMetrics,
        saved: false,
      };

      await insertSavedOutfit(userId, newOutfit);
      outfitById.set(newOutfit.id, newOutfit);

      const newSignature = buildTitleSignature(itemTitles);
      if (newSignature) {
        if (!outfitsBySignature.has(newSignature)) {
          outfitsBySignature.set(newSignature, []);
        }
        outfitsBySignature.get(newSignature)!.push(newOutfit);
      }

      const status = outfitFeedbackStatus.get(newOutfit.id) || { hasFeedback: false, hasLike: false, hasDislike: false };
      status.hasFeedback = true;
      status.hasLike = status.hasLike || entry.type === 'like';
      status.hasDislike = status.hasDislike || entry.type === 'dislike';
      outfitFeedbackStatus.set(newOutfit.id, status);

      await updateFeedbackOutfitRefs(entry.id, newOutfit.id, styleMetrics);
      createdOutfits += 1;
      linkedFeedback += 1;
    }

    for (const [outfitId, outfit] of outfitById.entries()) {
      const status = outfitFeedbackStatus.get(outfitId);
      const shouldSave = status ? (status.hasLike || !status.hasFeedback) : true;
      if (outfit.saved !== shouldSave) {
        await updateSavedOutfitSavedFlag(outfitId, shouldSave);
        outfit.saved = shouldSave;
      }
    }
  }

  console.log(`[FeedbackBackfill] Created ${createdOutfits} outfits and linked ${linkedFeedback} feedback entries.`);
}

backfillFeedbackOutfits().catch(error => {
  console.error('[FeedbackBackfill] Failed:', error);
  process.exit(1);
});
