import type { ItemTraitSource, StyleMetrics } from './styleMetricsTypes';

export interface OutfitFeedback {
  id: string;
  itemIds?: string[];
  itemTitles?: string[];
  type: 'like' | 'dislike';
  feedback?: string;
  createdAt: string;
  prompt?: string;
  styleMetrics?: StyleMetrics | null;
  outfitId?: string;
  outfit?: {
    id: string;
    itemIds: string[];
    itemTitles: string[];
    prompt?: string;
    notes?: string;
    styleMetrics?: StyleMetrics | null;
    createdAt: string;
    saved?: boolean;
  } | null;
}

export interface FeedbackPairingSummary {
  pairing: string;
  count: number;
}

export interface FeedbackNoteSummary {
  snippet: string;
  count: number;
}

export interface FeedbackSignalSummary {
  totalSamples: number;
  likedPairings: FeedbackPairingSummary[];
  dislikedPairings: FeedbackPairingSummary[];
  likeNotes: FeedbackNoteSummary[];
  dislikeNotes: FeedbackNoteSummary[];
}

export interface SummarizeFeedbackOptions {
  limits?: {
    pairings?: number;
    notes?: number;
  };
  resolveItemTraits?: (title: string, id?: string) => ItemTraitSource | null;
  getEntryContext?: (entry: OutfitFeedback) => { prompt?: string } | null | undefined;
}

const DEFAULT_PAIRING_LIMIT = 5;
const DEFAULT_NOTE_LIMIT = 5;

export function normalizeFeedbackSummaryPayload(raw: unknown): FeedbackSignalSummary | null {
  if (!raw) {
    return null;
  }

  let payload: any = raw;
  if (typeof raw === 'string') {
    try {
      payload = JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const totalSamples = Number(payload.totalSamples) || 0;
  const likedPairings = normalizePairingSummary(payload.likedPairings);
  const dislikedPairings = normalizePairingSummary(payload.dislikedPairings);
  const likeNotes = normalizeNoteSummary(payload.likeNotes);
  const dislikeNotes = normalizeNoteSummary(payload.dislikeNotes);

  return {
    totalSamples,
    likedPairings,
    dislikedPairings,
    likeNotes,
    dislikeNotes,
  };
}

function normalizePairingSummary(value: unknown): FeedbackPairingSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => {
      if (typeof entry === 'string') {
        return { pairing: entry, count: 0 };
      }
      if (entry && typeof entry === 'object') {
        const pairing = typeof (entry as any).pairing === 'string'
          ? (entry as any).pairing
          : typeof (entry as any).label === 'string'
            ? (entry as any).label
            : '';
        const count = Number((entry as any).count) || 0;
        if (pairing) {
          return { pairing, count };
        }
      }
      return null;
    })
    .filter((entry): entry is FeedbackPairingSummary => entry !== null);
}

function normalizeNoteSummary(value: unknown): FeedbackNoteSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map(entry => {
      if (typeof entry === 'string') {
        return { snippet: entry, count: 0 };
      }
      if (entry && typeof entry === 'object' && typeof (entry as any).snippet === 'string') {
        const snippet = (entry as any).snippet;
        const count = Number((entry as any).count) || 0;
        return { snippet, count };
      }
      return null;
    })
    .filter((entry): entry is FeedbackNoteSummary => entry !== null);
}

export function shouldPersistFeedbackSummary(summary: FeedbackSignalSummary | null): summary is FeedbackSignalSummary {
  return !!summary && summary.totalSamples > 0;
}

export function summarizeFeedbackSignals(
  feedback: OutfitFeedback[] | undefined,
  normalizeTitleKey: (title: string) => string,
  options: SummarizeFeedbackOptions = {}
): FeedbackSignalSummary | null {
  if (!feedback || feedback.length === 0) {
    return null;
  }

  const pairingLimit = Math.max(1, options.limits?.pairings ?? DEFAULT_PAIRING_LIMIT);
  const noteLimit = Math.max(1, options.limits?.notes ?? DEFAULT_NOTE_LIMIT);

  const likePairCounts = new Map<string, number>();
  const dislikePairCounts = new Map<string, number>();
  const likeNotes = new Map<string, number>();
  const dislikeNotes = new Map<string, number>();

  feedback.forEach(entry => {
    const uniqueTitles = Array.from(
      new Set(
        (entry.itemTitles || [])
          .map(title => title?.trim())
          .filter((title): title is string => Boolean(title && title.length > 0))
      )
    );

    const pairs = buildPairings(uniqueTitles, normalizeTitleKey);
    const targetPairs = entry.type === 'like' ? likePairCounts : dislikePairCounts;
    pairs.forEach(pair => targetPairs.set(pair, (targetPairs.get(pair) ?? 0) + 1));

    if (entry.feedback) {
      const normalized = entry.feedback.trim();
      if (normalized.length > 0) {
        const targetNotes = entry.type === 'like' ? likeNotes : dislikeNotes;
        targetNotes.set(normalized, (targetNotes.get(normalized) ?? 0) + 1);
      }
    }
  });

  const likedPairings = Array.from(likePairCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, pairingLimit)
    .map(([pairing, count]) => ({ pairing, count }));

  const dislikedPairings = Array.from(dislikePairCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, pairingLimit)
    .map(([pairing, count]) => ({ pairing, count }));

  const likeNoteSummary = Array.from(likeNotes.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, noteLimit)
    .map(([snippet, count]) => ({ snippet, count }));

  const dislikeNoteSummary = Array.from(dislikeNotes.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, noteLimit)
    .map(([snippet, count]) => ({ snippet, count }));

  const totalSamples = feedback.length;

  if (
    likedPairings.length === 0 &&
    dislikedPairings.length === 0 &&
    likeNoteSummary.length === 0 &&
    dislikeNoteSummary.length === 0
  ) {
    return null;
  }

  return {
    totalSamples,
    likedPairings,
    dislikedPairings,
    likeNotes: likeNoteSummary,
    dislikeNotes: dislikeNoteSummary,
  };
}

function buildPairings(titles: string[], normalizeTitleKey: (title: string) => string): string[] {
  const normalizedTitles = titles.map(title => ({
    raw: title,
    key: normalizeTitleKey(title),
  }));
  const result: string[] = [];
  for (let i = 0; i < normalizedTitles.length; i += 1) {
    for (let j = i + 1; j < normalizedTitles.length; j += 1) {
      const first = normalizedTitles[i];
      const second = normalizedTitles[j];
      if (!first.key || !second.key) {
        continue;
      }
      const pairing = [first.raw, second.raw].sort((a, b) => a.localeCompare(b)).join(' + ');
      result.push(pairing);
    }
  }
  return result;
}

export interface ItemTrait {
  id?: string;
  canonicalTitle: string;
  keywords: string[];
  traitTokens: string[];
  category?: string;
}

export function createItemTraitResolver(
  items: ItemTraitSource[],
  normalizeTitleKey: (title: string) => string
): (title: string, id?: string) => ItemTrait | null {
  const byId = new Map<string, ItemTrait>();
  const byTitle = new Map<string, ItemTrait>();

  items.forEach(item => {
    const trait: ItemTrait = {
      id: item.id,
      canonicalTitle: item.title,
      keywords: buildKeywordList(item),
      traitTokens: buildTraitTokens(item),
      category: item.category,
    };
    if (item.id) {
      byId.set(item.id, trait);
    }
    const key = normalizeTitleKey(item.title);
    if (key) {
      byTitle.set(key, trait);
    }
  });

  return (title: string, id?: string) => {
    if (id && byId.has(id)) {
      return byId.get(id) ?? null;
    }
    const key = normalizeTitleKey(title);
    if (!key) {
      return null;
    }
    return byTitle.get(key) ?? null;
  };
}

function buildKeywordList(item: ItemTraitSource): string[] {
  const keywords = new Set<string>();
  keywords.add(item.title.toLowerCase());
  if (item.category) {
    keywords.add(item.category.toLowerCase());
  }
  if (item.subCategory) {
    keywords.add(item.subCategory.toLowerCase());
  }
  (item.colors || []).forEach(color => keywords.add(color.toLowerCase()));
  (item.styleTags || []).forEach(tag => keywords.add(tag.toLowerCase()));
  return Array.from(keywords);
}

function buildTraitTokens(item: ItemTraitSource): string[] {
  const tokens: string[] = [];
  if (item.category) {
    tokens.push(`category:${item.category.toLowerCase()}`);
  }
  if (item.subCategory) {
    tokens.push(`subcategory:${item.subCategory.toLowerCase()}`);
  }
  (item.colors || []).forEach(color => tokens.push(`color:${color.toLowerCase()}`));
  (item.styleTags || []).forEach(tag => tokens.push(`style:${tag.toLowerCase()}`));
  return tokens;
}
