import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  generateRandomAdminWardrobeItems,
  convertAdminItemToWardrobeItem,
  normalizeAdminTitle,
} from './adminGenerator';
import {
  AdminWardrobeItem,
  AdminFeedbackType,
  AdminOutfitCandidate,
  AdminOutfitEvaluation,
} from './adminTypes';
import * as db from './database';
import { generateOutfits, evaluateAdminOutfits } from './llmService';

const MAX_ITEM_GENERATION = 200;
const MAX_OUTFIT_REQUEST = 40;
const ADMIN_HISTORY_USER_ID = 'admin-portal';
const MAX_GENERATION_POOL = 100;
const CORE_CATEGORY_PRIORITY = ['Tops', 'Bottoms', 'Shoes'] as const;
type CoreCategory = typeof CORE_CATEGORY_PRIORITY[number];
const CORE_CATEGORY_SET = new Set<CoreCategory>(CORE_CATEGORY_PRIORITY);

const adminRouter = express.Router();

function extractAdminPassword(req: express.Request): string | undefined {
  const header = req.headers['x-admin-password'];
  if (Array.isArray(header)) {
    return header[0];
  }
  if (typeof header === 'string') {
    return header;
  }
  if (req.body && typeof req.body.adminPassword === 'string') {
    return req.body.adminPassword;
  }
  if (req.query && typeof req.query.adminPassword === 'string') {
    return req.query.adminPassword;
  }
  return undefined;
}

adminRouter.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  const requiredPassword = process.env.ADMIN_PASSWORD;
  if (!requiredPassword || requiredPassword.trim().length === 0) {
    return res.status(500).json({ error: 'Admin portal not configured. Set ADMIN_PASSWORD on the server.' });
  }
  const provided = extractAdminPassword(req);
  if (!provided || provided !== requiredPassword) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

adminRouter.get('/items', async (_req, res) => {
  try {
    const items = await db.getAdminWardrobeItems();
    res.json({ items });
  } catch (error) {
    console.error('[Admin] Failed to load wardrobe items:', error);
    res.status(500).json({ error: 'Failed to load admin wardrobe items' });
  }
});

adminRouter.post('/items/generate', async (req, res) => {
  const rawCount = Number(req.body?.count ?? 50);
  const count = Number.isFinite(rawCount)
    ? Math.max(1, Math.min(Math.floor(rawCount), MAX_ITEM_GENERATION))
    : 50;

  try {
    const items = generateRandomAdminWardrobeItems(count);
    await db.insertAdminWardrobeItems(items);
    res.status(201).json({ createdItems: items });
  } catch (error) {
    console.error('[Admin] Failed to generate wardrobe items:', error);
    res.status(500).json({ error: 'Failed to generate admin wardrobe items' });
  }
});

adminRouter.delete('/items', async (_req, res) => {
  try {
    await db.clearAdminWardrobeItems();
    res.status(204).send();
  } catch (error) {
    console.error('[Admin] Failed to clear wardrobe items:', error);
    res.status(500).json({ error: 'Failed to clear admin wardrobe items' });
  }
});

function buildItemsByCategory(adminItems: AdminWardrobeItem[]): Record<string, ReturnType<typeof convertAdminItemToWardrobeItem>[]> {
  return adminItems.reduce<Record<string, ReturnType<typeof convertAdminItemToWardrobeItem>[]>>((acc, adminItem) => {
    const wardrobeItem = convertAdminItemToWardrobeItem(adminItem);
    if (!acc[wardrobeItem.category]) {
      acc[wardrobeItem.category] = [];
    }
    acc[wardrobeItem.category].push(wardrobeItem);
    return acc;
  }, {});
}

function hasCoreCoverage(items: AdminWardrobeItem[]): boolean {
  let hasTop = false;
  let hasBottom = false;
  let hasShoes = false;

  items.forEach(item => {
    if (item.category === 'Tops' || item.category === 'Outerwear' || item.category === 'Dresses & One-Pieces') {
      hasTop = true;
    }
    if (item.category === 'Bottoms' || item.category === 'Dresses & One-Pieces') {
      hasBottom = true;
    }
    if (item.category === 'Shoes') {
      hasShoes = true;
    }
  });

  return hasTop && hasBottom && hasShoes;
}

function isCoreCategory(category: string): category is CoreCategory {
  return CORE_CATEGORY_SET.has(category as CoreCategory);
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function takeRandomItem<T>(pool: T[]): T | undefined {
  if (!pool.length) {
    return undefined;
  }
  const index = Math.floor(Math.random() * pool.length);
  const [item] = pool.splice(index, 1);
  return item;
}

function selectAdminGenerationPool(allItems: AdminWardrobeItem[]): AdminWardrobeItem[] {
  if (allItems.length <= MAX_GENERATION_POOL) {
    return shuffleArray(allItems);
  }

  const corePools = new Map<CoreCategory, AdminWardrobeItem[]>();
  CORE_CATEGORY_PRIORITY.forEach(category => {
    corePools.set(category, []);
  });
  const otherPool: AdminWardrobeItem[] = [];

  allItems.forEach(item => {
    if (isCoreCategory(item.category)) {
      corePools.get(item.category)!.push(item);
    } else {
      otherPool.push(item);
    }
  });

  const totalTarget = Math.min(MAX_GENERATION_POOL, allItems.length);
  const selected: AdminWardrobeItem[] = [];
  const selectedIds = new Set<string>();

  const selectAndTrack = (item: AdminWardrobeItem | undefined) => {
    if (!item) {
      return false;
    }
    if (selectedIds.has(item.id)) {
      return false;
    }
    selected.push(item);
    selectedIds.add(item.id);
    return true;
  };

  let remainingSlots = totalTarget;

  // Ensure at least one from each core category when available
  CORE_CATEGORY_PRIORITY.forEach(category => {
    const pool = corePools.get(category);
    if (pool && pool.length && remainingSlots > 0) {
      const pick = takeRandomItem(pool);
      if (selectAndTrack(pick)) {
        remainingSlots -= 1;
      }
    }
  });

  const currentCoreCount = selected.filter(item => isCoreCategory(item.category)).length;
  const remainingCorePoolSize =
    Array.from(corePools.values()).reduce((sum, pool) => sum + pool.length, 0);
  const desiredCoreCount = Math.min(
    Math.round(totalTarget * 0.7),
    currentCoreCount + remainingCorePoolSize
  );
  let additionalCoreNeeded = Math.max(0, desiredCoreCount - currentCoreCount);

  while (additionalCoreNeeded > 0 && remainingSlots > 0) {
    const availableCategories = CORE_CATEGORY_PRIORITY.filter((category: CoreCategory) => {
      const pool = corePools.get(category);
      return pool != null && pool.length > 0;
    });
    if (!availableCategories.length) {
      break;
    }
    const category =
      availableCategories[Math.floor(Math.random() * availableCategories.length)] as CoreCategory;
    const pool = corePools.get(category)!;
    if (!pool.length) {
      continue;
    }
    const pick = takeRandomItem(pool);
    if (selectAndTrack(pick)) {
      remainingSlots -= 1;
      additionalCoreNeeded -= 1;
    }
  }

  // Fill remaining slots with non-core first
  while (remainingSlots > 0 && otherPool.length > 0) {
    const pick = takeRandomItem(otherPool);
    if (selectAndTrack(pick)) {
      remainingSlots -= 1;
    }
  }

  // If still slots remaining, use any remaining core items
  if (remainingSlots > 0) {
    const remainingCoreItems = Array.from(corePools.values()).flat();
    const shuffledCore = shuffleArray(remainingCoreItems);
    for (const item of shuffledCore) {
      if (remainingSlots <= 0) {
        break;
      }
      if (selectAndTrack(item)) {
        remainingSlots -= 1;
      }
    }
  }

  if (remainingSlots > 0) {
    const fallbackPool = allItems.filter(item => !selectedIds.has(item.id));
    const fallbackPicks = shuffleArray(fallbackPool).slice(0, remainingSlots);
    fallbackPicks.forEach(item => selectAndTrack(item));
  }

  return shuffleArray(selected).slice(0, totalTarget);
}

adminRouter.post('/outfits/generate', async (req, res) => {
  const rawCount = Number(req.body?.count ?? 12);
  const count = Number.isFinite(rawCount)
    ? Math.max(1, Math.min(Math.floor(rawCount), MAX_OUTFIT_REQUEST))
    : 12;
  const prompt = typeof req.body?.prompt === 'string' && req.body.prompt.trim().length > 0
    ? req.body.prompt.trim()
    : undefined;

  try {
    const adminItems = await db.getAdminWardrobeItems();
    if (!adminItems.length) {
      return res.status(400).json({ error: 'Generate wardrobe items before creating outfits.' });
    }

    if (!hasCoreCoverage(adminItems)) {
      return res.status(400).json({
        error: 'Admin wardrobe must include at least one top, one bottom, and one pair of shoes before generating outfits.',
      });
    }

    const generationPool = selectAdminGenerationPool(adminItems);

    if (!hasCoreCoverage(generationPool)) {
      return res.status(400).json({
        error: 'Unable to build a balanced wardrobe sample; add more tops, bottoms, and shoes.',
      });
    }

    const itemsByCategory = buildItemsByCategory(generationPool);
    const adminItemMap = new Map<string, AdminWardrobeItem>(
      generationPool.map(item => [normalizeAdminTitle(item.title), item])
    );

    type PendingAdminOutfit = {
      id: string;
      itemIds: string[];
      itemTitles: string[];
      items: Array<{
        id: string;
        title: string;
        category: string;
        subCategory?: string;
        brand?: string;
        colors?: string[];
        silhouettes?: string[];
        pattern?: string;
        fit?: string;
        formalities?: string[];
        styleTags?: string[];
        seasons?: string[];
        occasions?: string[];
      }>;
      justification: string;
      stylingSuggestions: string[];
      evaluation: AdminOutfitEvaluation | null;
      status: 'pending';
    };

    type ApprovedAdminOutfit = {
      id: string;
      itemIds: string[];
      itemTitles: string[];
      items: PendingAdminOutfit['items'];
      justification: string;
      stylingSuggestions: string[];
      evaluation: AdminOutfitEvaluation;
    };

    const aggregatedOutfits: PendingAdminOutfit[] = [];
    const aggregatedEvaluations: AdminOutfitEvaluation[] = [];
    const aggregatedAutoApproved: ApprovedAdminOutfit[] = [];
    const aggregatedAutoRejected: AdminOutfitEvaluation[] = [];
    const generationTimestamp = new Date().toISOString();

    const maxBatchSize = 5;
    let produced = 0;
    let safetyCounter = 0;

    while (produced < count) {
      safetyCounter += 1;
      if (safetyCounter > 20) {
        console.warn('[Admin] Generation loop aborted after too many iterations.');
        break;
      }

      const batchTarget = Math.min(maxBatchSize, count - produced);
      const generated = await generateOutfits(
        itemsByCategory,
        undefined,
        prompt,
        undefined,
        [],
        undefined,
        ADMIN_HISTORY_USER_ID,
        {
          targetCount: batchTarget,
          forceFallback: process.env.NODE_ENV === 'test',
        }
      );

      if (!generated.length) {
        break;
      }

      produced += generated.length;

      const outfits = generated
        .map(outfit => {
          const resolvedItems = outfit.items
            .map(title => {
              const match = adminItemMap.get(normalizeAdminTitle(title));
              return match ?? null;
            })
            .filter((item): item is AdminWardrobeItem => item !== null);

          if (!resolvedItems.length) {
            return null;
          }

          const uniqueItems = Array.from(new Map(resolvedItems.map(item => [item.id, item])).values());

          return {
            id: uuidv4(),
            itemIds: uniqueItems.map(item => item.id),
            itemTitles: uniqueItems.map(item => item.title),
            items: uniqueItems.map(item => ({
              id: item.id,
              title: item.title,
              category: item.category,
              subCategory: item.subCategory,
              brand: item.brand,
              colors: item.colors,
              silhouettes: item.silhouettes,
              pattern: item.pattern,
              fit: item.fit,
              formalities: item.formalities,
              styleTags: item.styleTags,
              seasons: item.seasons,
              occasions: item.occasions,
            })),
            justification: outfit.justification,
            stylingSuggestions: Array.isArray(outfit.stylingSuggestions) ? outfit.stylingSuggestions : [],
          };
        })
        .filter((outfit): outfit is NonNullable<typeof outfit> => outfit !== null);

      if (!outfits.length) {
        continue;
      }

      const candidates: AdminOutfitCandidate[] = outfits.map(outfit => ({
        ...outfit,
        prompt,
      }));

      const evaluations: AdminOutfitEvaluation[] = await evaluateAdminOutfits(candidates, prompt);
      aggregatedEvaluations.push(...evaluations);

      const evaluationMap = new Map<string, AdminOutfitEvaluation>(
        evaluations.map((entry: AdminOutfitEvaluation) => [entry.outfitId, entry])
      );

      const autoApproved: Array<{ outfit: typeof outfits[number]; evaluation: AdminOutfitEvaluation }> = [];
      const autoRejected: Array<{ outfit: typeof outfits[number]; evaluation: AdminOutfitEvaluation }> = [];
      const filteredOutfits = outfits.filter(outfit => {
        const evaluation = evaluationMap.get(outfit.id);
        if (!evaluation) {
          return true;
        }
        if (evaluation.autoRejected) {
          autoRejected.push({ outfit, evaluation });
          return false;
        }
        if (evaluation.autoApproved) {
          autoApproved.push({ outfit, evaluation });
          return false;
        }
        return true;
      });

      if (autoApproved.length > 0) {
        for (const { outfit, evaluation } of autoApproved) {
          try {
            const commentParts: string[] = [];
            if (evaluation.finalRationale) {
              commentParts.push(evaluation.finalRationale);
            }
            if (evaluation.structuralIssues && evaluation.structuralIssues.length > 0) {
              commentParts.push(`Structure check: ${evaluation.structuralIssues.join(' ')}`);
            }
            if (evaluation.aiNotes) {
              commentParts.push(evaluation.aiNotes);
            }

            await db.insertOutfitTrainingRecord({
              id: uuidv4(),
              itemIds: outfit.itemIds,
              itemTitles: outfit.itemTitles,
              prompt,
              context: prompt,
              stylingNotes: outfit.stylingSuggestions.join(' | '),
              feedbackType: 'like',
              feedbackComment: commentParts.join(' ') || 'Auto-approved by AI triage.',
              anchorItemId: null,
              generationMetadata: {
                justification: outfit.justification,
                stylingSuggestions: outfit.stylingSuggestions,
                evaluation,
              },
              createdAt: generationTimestamp,
            });
          } catch (error) {
            console.error('[Admin] Failed to persist auto-approved outfit training record:', error);
          }
        }
      }

      if (autoRejected.length > 0) {
        for (const { outfit, evaluation } of autoRejected) {
          try {
            const commentParts: string[] = [];
            if (evaluation?.finalRationale) {
              commentParts.push(evaluation.finalRationale);
            }
            if (evaluation?.structuralIssues && evaluation.structuralIssues.length > 0) {
              commentParts.push(`Structure check: ${evaluation.structuralIssues.join(' ')}`);
            }
            if (evaluation?.aiNotes) {
              commentParts.push(evaluation.aiNotes);
            }

            await db.insertOutfitTrainingRecord({
              id: uuidv4(),
              itemIds: outfit.itemIds,
              itemTitles: outfit.itemTitles,
              prompt,
              context: prompt,
              stylingNotes: outfit.stylingSuggestions.join(' | '),
              feedbackType: 'dislike',
              feedbackComment: commentParts.join(' ') || 'Auto-rejected by AI triage.',
              anchorItemId: null,
              generationMetadata: {
                justification: outfit.justification,
                stylingSuggestions: outfit.stylingSuggestions,
                evaluation,
              },
              createdAt: generationTimestamp,
            });
          } catch (error) {
            console.error('[Admin] Failed to persist auto-rejected outfit training record:', error);
          }
        }
      }

      const responseOutfits = filteredOutfits.map(outfit => ({
        ...outfit,
        evaluation: evaluationMap.get(outfit.id) ?? null,
        status: 'pending' as const,
      }));

      aggregatedOutfits.push(...responseOutfits);
      aggregatedAutoApproved.push(
        ...autoApproved.map(({ outfit, evaluation }) => ({
          ...outfit,
          evaluation,
        }))
      );
      aggregatedAutoRejected.push(...autoRejected.map(({ evaluation }) => evaluation));

      if (aggregatedOutfits.length >= count) {
        break;
      }
    }

    if (!aggregatedOutfits.length && aggregatedAutoApproved.length === 0 && aggregatedAutoRejected.length === 0) {
      return res.json({ outfits: [] });
    }

    const trimmedOutfits = aggregatedOutfits.slice(0, count);

    const storageRecords = trimmedOutfits.map(outfit => ({
      id: outfit.id,
      itemIds: outfit.itemIds,
      itemTitles: outfit.itemTitles,
      items: outfit.items,
      prompt,
      context: prompt,
      justification: outfit.justification,
      stylingSuggestions: outfit.stylingSuggestions,
      evaluation: outfit.evaluation ?? null,
      status: 'pending' as const,
      createdAt: generationTimestamp,
    }));

    if (storageRecords.length > 0) {
      try {
        await db.insertAdminGeneratedOutfits(storageRecords);
      } catch (error) {
        console.error('[Admin] Failed to persist generated outfit queue:', error);
      }
    }

    res.json({
      outfits: trimmedOutfits,
      evaluations: aggregatedEvaluations,
      autoApproved: aggregatedAutoApproved,
      autoRejected: aggregatedAutoRejected,
    });
  } catch (error) {
    console.error('[Admin] Failed to generate outfits:', error);
    res.status(500).json({ error: 'Failed to generate admin outfits' });
  }
});

adminRouter.get('/outfits/pending', async (_req, res) => {
  try {
    const outfits = await db.listAdminGeneratedOutfits();
    res.json({ outfits });
  } catch (error) {
    console.error('[Admin] Failed to load pending outfits:', error);
    res.status(500).json({ error: 'Failed to load pending outfits' });
  }
});

type TrainingPayload = {
  outfitId?: unknown;
  itemIds?: unknown;
  itemTitles?: unknown;
  feedbackType?: unknown;
  feedbackComment?: unknown;
  prompt?: unknown;
  context?: unknown;
  justification?: unknown;
  stylingSuggestions?: unknown;
  anchorItemId?: unknown;
};

function normalizeFeedbackType(value: unknown): AdminFeedbackType | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.toLowerCase() as AdminFeedbackType;
  if (normalized === 'like' || normalized === 'dislike' || normalized === 'neutral') {
    return normalized;
  }
  return null;
}

adminRouter.post('/outfits/training', async (req, res) => {
  const payload: TrainingPayload = req.body ?? {};
  const outfitId = typeof payload.outfitId === 'string' && payload.outfitId.trim().length > 0
    ? payload.outfitId.trim()
    : null;
  const itemIds = Array.isArray(payload.itemIds) ? payload.itemIds.filter(id => typeof id === 'string') as string[] : [];
  const itemTitles = Array.isArray(payload.itemTitles) ? payload.itemTitles.filter(title => typeof title === 'string') as string[] : [];
  const feedbackType = normalizeFeedbackType(payload.feedbackType);
  const feedbackComment = typeof payload.feedbackComment === 'string' && payload.feedbackComment.trim().length > 0
    ? payload.feedbackComment.trim()
    : undefined;
  const prompt = typeof payload.prompt === 'string' && payload.prompt.trim().length > 0 ? payload.prompt.trim() : undefined;
  const context = typeof payload.context === 'string' && payload.context.trim().length > 0 ? payload.context.trim() : undefined;
  const justification = typeof payload.justification === 'string' ? payload.justification.trim() : '';
  const stylingSuggestions = Array.isArray(payload.stylingSuggestions)
    ? payload.stylingSuggestions.filter(s => typeof s === 'string').map(s => s.trim()).filter(Boolean)
    : [];
  const anchorItemId = typeof payload.anchorItemId === 'string' && payload.anchorItemId.trim().length > 0
    ? payload.anchorItemId.trim()
    : null;

  if (!itemIds.length || !itemTitles.length) {
    return res.status(400).json({ error: 'itemIds and itemTitles are required.' });
  }
  if (!feedbackType) {
    return res.status(400).json({ error: 'feedbackType must be like, dislike, or neutral.' });
  }

  try {
    const adminItems = await db.getAdminWardrobeItems();
    const itemMap = new Map(adminItems.map(item => [item.id, item]));

    const missingId = itemIds.find(id => !itemMap.has(id));
    if (missingId) {
      return res.status(400).json({ error: `Unknown admin wardrobe item id: ${missingId}` });
    }

    const record = {
      id: uuidv4(),
      itemIds,
      itemTitles,
      prompt,
      context,
      stylingNotes: stylingSuggestions.join(' | '),
      feedbackType,
      feedbackComment,
      anchorItemId,
      generationMetadata: {
        justification,
        stylingSuggestions,
      },
      createdAt: new Date().toISOString(),
    };

    await db.insertOutfitTrainingRecord(record);
    if (outfitId) {
      await db.deleteAdminGeneratedOutfit(outfitId);
    }
    res.status(201).json({ record, clearedOutfitId: outfitId });
  } catch (error) {
    console.error('[Admin] Failed to store training outfit:', error);
    res.status(500).json({ error: 'Failed to store outfit training data' });
  }
});

adminRouter.get('/outfits/training', async (req, res) => {
  const rawLimit = Number(req.query?.limit ?? 50);
  const rawOffset = Number(req.query?.offset ?? 0);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(Math.floor(rawLimit), 200)) : 50;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, Math.floor(rawOffset)) : 0;

  try {
    const records = await db.listOutfitTrainingData(limit, offset);
    res.json({ records });
  } catch (error) {
    console.error('[Admin] Failed to load training data:', error);
    res.status(500).json({ error: 'Failed to load outfit training data' });
  }
});

adminRouter.delete('/outfits/training', async (req, res) => {
  if (req.query?.all !== 'true') {
    return res.status(400).json({ error: 'Specify ?all=true to clear training data.' });
  }
  try {
    await db.clearOutfitTrainingData();
    res.status(204).send();
  } catch (error) {
    console.error('[Admin] Failed to clear training data:', error);
    res.status(500).json({ error: 'Failed to clear outfit training data' });
  }
});

adminRouter.delete('/outfits/training/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Training record id is required.' });
  }

  try {
    await db.deleteOutfitTrainingRecord(id);
    res.status(204).send();
  } catch (error) {
    console.error('[Admin] Failed to delete training record:', error);
    res.status(500).json({ error: 'Failed to delete outfit training record' });
  }
});

export default adminRouter;

