import dotenv from 'dotenv';
import * as db from '../database';
import { WardrobeItem, WardrobeSilhouetteOption } from '../index';

dotenv.config();

const allowedSilhouettes = new Set([
  'a-line',
  'column',
  'fit-and-flare',
  'cocoon',
  'trapeze',
  'bodycon',
  'wide-leg',
  'straight-leg',
  'cropped',
  'long-sleeve',
  'short-sleeve',
  'sleeveless',
  'peplum',
  'asymmetrical-hem',
  'v-neck',
  'boat-neck',
  'mock-neck',
  'turtleneck',
  'crew-neck',
  'scoop-neck',
  'square-neck',
  'sweetheart',
  'off-the-shoulder',
  'halter-neck',
  'cowl-neck',
  'hooded',
  'collared',
  'collarless',
  'other',
]);

const allowedFits = new Set([
  'second-skin',
  'slim',
  'regular',
  'relaxed',
  'oversized',
  'tailored',
  'other',
]);

const silhouetteAliases: Record<string, string | undefined> = {
  'straight': 'straight-leg',
  'straight leg': 'straight-leg',
  'straight-leg': 'straight-leg',
  'fit and flare': 'fit-and-flare',
  'fit & flare': 'fit-and-flare',
  'flared': 'wide-leg',
  'flare': 'wide-leg',
  'wide leg': 'wide-leg',
  'aline': 'a-line',
  'a line': 'a-line',
  'sheath': 'column',
  'boxy': 'cocoon',
  'ballgown': 'fit-and-flare',
  'long sleeve': 'long-sleeve',
  'long-sleeve': 'long-sleeve',
  'long-sleeved': 'long-sleeve',
  'short sleeve': 'short-sleeve',
  'short-sleeve': 'short-sleeve',
  'short-sleeved': 'short-sleeve',
  'tank': 'sleeveless',
  'camisole': 'sleeveless',
  'camis': 'sleeveless',
  'asymmetrical hem': 'asymmetrical-hem',
  'asymmetric hem': 'asymmetrical-hem',
  'high-low': 'asymmetrical-hem',
  'v neck': 'v-neck',
  'v-neck': 'v-neck',
  'boat neck': 'boat-neck',
  'boat-neck': 'boat-neck',
  'bateau': 'boat-neck',
  'sailor neck': 'boat-neck',
  'turtleneck': 'turtleneck',
  'mock neck': 'mock-neck',
  'mock-neck': 'mock-neck',
  'peplum': 'peplum',
  'crew neck': 'crew-neck',
  'crew-neck': 'crew-neck',
  'crewneck': 'crew-neck',
  'scoop neck': 'scoop-neck',
  'scoop-neck': 'scoop-neck',
  'scoopneck': 'scoop-neck',
  'square neck': 'square-neck',
  'square-neck': 'square-neck',
  'sweetheart': 'sweetheart',
  'off the shoulder': 'off-the-shoulder',
  'off-the-shoulder': 'off-the-shoulder',
  'halter neck': 'halter-neck',
  'halter-neck': 'halter-neck',
  'halter': 'halter-neck',
  'cowl neck': 'cowl-neck',
  'cowl-neck': 'cowl-neck',
  'hooded': 'hooded',
  'hoodie': 'hooded',
  'collared': 'collared',
  'collarless': 'collarless',
  'no collar': 'collarless',
  'with collar': 'collared',
};

const silhouetteToFit: Record<string, string> = {
  'fitted': 'slim',
  'tailored': 'tailored',
  'regular': 'regular',
  'relaxed': 'relaxed',
  'oversized': 'oversized',
  'boxy': 'oversized',
};

const fitAliases: Record<string, string> = {
  'fitted': 'slim',
  'skinny': 'second-skin',
  'bodycon': 'second-skin',
  'loose': 'relaxed',
  'boxy': 'oversized',
  'regular fit': 'regular',
  'tailored fit': 'tailored',
};

function normalizeSilhouetteValue(raw?: string | null): { silhouette?: string; movedFit?: string } {
  if (!raw) {
    return {};
  }

  const value = raw.trim().toLowerCase();

  if (allowedSilhouettes.has(value)) {
    return { silhouette: value };
  }

  if (silhouetteAliases[value]) {
    return { silhouette: silhouetteAliases[value] };
  }

  if (silhouetteToFit[value]) {
    return { movedFit: silhouetteToFit[value] };
  }

  return { silhouette: 'other' };
}

function normalizeSilhouetteList(
  item: WardrobeItem
): { silhouettes?: WardrobeSilhouetteOption[]; movedFit?: string } {
  const candidates: string[] = [];

  if (Array.isArray(item.silhouettes)) {
    candidates.push(...item.silhouettes);
  }
  if (item.silhouette) {
    candidates.push(item.silhouette);
  }

  const normalized: WardrobeSilhouetteOption[] = [];
  let movedFit: string | undefined;

  candidates.forEach((candidate) => {
    const { silhouette, movedFit: fromValue } = normalizeSilhouetteValue(candidate);
    if (silhouette) {
      if (!normalized.includes(silhouette as WardrobeSilhouetteOption)) {
        normalized.push(silhouette as WardrobeSilhouetteOption);
      }
    }
    if (fromValue && !movedFit) {
      movedFit = fromValue;
    }
  });

  if (normalized.length === 0) {
    return movedFit ? { movedFit } : {};
  }

  return { silhouettes: normalized, movedFit };
}

function normalizeFit(raw?: string | null, fallback?: string): string | undefined {
  let candidate = raw?.trim().toLowerCase() || fallback;
  if (!candidate) {
    return undefined;
  }

  if (fitAliases[candidate]) {
    candidate = fitAliases[candidate];
  }

  if (!allowedFits.has(candidate)) {
    return 'other';
  }

  return candidate;
}

async function run() {
  console.log('[NormalizeAttributes] Harmonizing silhouette and fit attributes across wardrobe items');
  const users = await db.getAllUsers();

  let inspected = 0;
  let updated = 0;

  for (const user of users ?? []) {
    const items: WardrobeItem[] = await db.getItemsByUser(user.id);

    for (const item of items) {
      inspected += 1;
      const updates: Partial<WardrobeItem> = {};

      const { silhouettes, movedFit } = normalizeSilhouetteList(item);
      let fit = normalizeFit(item.fit, movedFit);

      if (silhouettes) {
        const original = Array.isArray(item.silhouettes) ? item.silhouettes : [];
        const differs =
          silhouettes.length !== original.length ||
          silhouettes.some((value, index) => value !== original[index]);
        if (differs) {
          updates.silhouettes = silhouettes as any;
        }
        // keep legacy silhouette in sync with first entry
        const legacyValue =
          silhouettes.length > 0 ? (silhouettes[0] as WardrobeSilhouetteOption) : undefined;
        if (legacyValue && legacyValue !== item.silhouette) {
          updates.silhouette = legacyValue as any;
        } else if (!legacyValue && item.silhouette) {
          updates.silhouette = 'other' as any;
        }
      }

      if (fit && fit !== item.fit) {
        updates.fit = fit as any;
      }

      if (Object.keys(updates).length > 0) {
        await db.updateItem(item.id, updates);
        updated += 1;
        console.log(
          `[NormalizeAttributes] Updated "${item.title}" (user ${user.id})` +
            (updates.silhouettes ? ` | silhouettes -> ${JSON.stringify(updates.silhouettes)}` : '') +
            (updates.silhouette ? ` | legacy silhouette -> ${updates.silhouette}` : '') +
            (updates.fit ? ` | fit -> ${updates.fit}` : '')
        );
      }
    }
  }

  console.log(
    `[NormalizeAttributes] Completed. Inspected ${inspected} item${inspected === 1 ? '' : 's'}; updated ${updated}.`
  );

  if (typeof db.closeDatabase === 'function') {
    await db.closeDatabase();
  }
}

run().catch(async (error) => {
  console.error('[NormalizeAttributes] Failed to normalize attributes:', error);
  if (typeof db.closeDatabase === 'function') {
    await db.closeDatabase();
  }
  process.exit(1);
});

