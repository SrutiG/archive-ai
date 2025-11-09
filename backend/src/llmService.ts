import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import {
  WardrobeItem,
  WardrobeFormalityOption,
  WardrobeOccasionOption,
  WardrobeSeasonOption,
  WardrobeStyleTagOption,
  SavedOutfit,
} from './index';
import { resolveSubCategory } from './wardrobeSubcategories';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const CATEGORIES = [
  'Tops',
  'Bottoms',
  'Dresses',
  'Outerwear',
  'Shoes',
  'Accessories',
  'Bags',
  'Jewelry',
  'Activewear',
  'Underwear & Sleepwear',
  'Swimwear',
];

export type CoreCategory = 'tops' | 'bottoms' | 'shoes' | 'accessories';

const CORE_CATEGORY_KEYWORDS: Record<CoreCategory, string[]> = {
  tops: [
    'top', 'tops', 'shirt', 'shirts', 'blouse', 'blouses', 'tee', 'tees', 't-shirt', 't-shirts',
    'tank', 'camisole', 'sweater', 'sweaters', 'cardigan', 'cardigans', 'hoodie', 'hoodies',
    'coat', 'coats', 'jacket', 'jackets', 'outerwear', 'blazer', 'blazers', 'vest', 'vests',
    'pullover', 'sweatshirt', 'sweatshirts', 'kimono', 'poncho', 'cape', 'bodysuit', 'bodysuits'
  ],
  bottoms: [
    'bottom', 'bottoms', 'pant', 'pants', 'trouser', 'trousers', 'jean', 'jeans', 'short', 'shorts',
    'skirt', 'skirts', 'culotte', 'culottes', 'legging', 'leggings', 'jogger', 'joggers', 'overall',
    'overalls', 'jumper', 'jumpsuit', 'romper', 'dress', 'dresses', 'gown', 'gowns'
  ],
  shoes: [
    'shoe', 'shoes', 'boot', 'boots', 'sneaker', 'sneakers', 'heel', 'heels', 'pump', 'pumps',
    'loafer', 'loafers', 'flat', 'flats', 'sandal', 'sandals', 'mule', 'mules', 'clog', 'clogs',
    'oxford', 'oxfords', 'trainer', 'trainers', 'wedge', 'wedges'
  ],
  accessories: [
    'accessory', 'accessories', 'belt', 'belts', 'bag', 'bags', 'handbag', 'handbags', 'purse', 'clutch',
    'backpack', 'scarf', 'scarves', 'hat', 'hats', 'beanie', 'earring', 'earrings', 'ring', 'rings',
    'bracelet', 'bracelets', 'necklace', 'necklaces', 'cuff', 'cuffs', 'watch', 'watches', 'glove', 'gloves',
    'sunglasses', 'brooch', 'brooches', 'pin', 'pins', 'hair', 'headband', 'shawl'
  ],
};

const MULTI_CATEGORY_KEYWORDS: Array<{ keywords: string[]; categories: CoreCategory[] }> = [
  { keywords: ['dress', 'dresses', 'gown', 'jumpsuit', 'romper', 'overall', 'overalls'], categories: ['tops', 'bottoms'] },
];

const FORMALITY_KEYWORDS_MAP: Record<WardrobeFormalityOption, string[]> = {
  casual: ['casual', 'laid back', 'laid-back', 'relaxed'],
  'smart-casual': ['smart casual', 'smart-casual'],
  'business-casual': ['business casual', 'business-casual'],
  'business-formal': ['business formal', 'boardroom', 'corporate formal'],
  evening: ['evening', 'cocktail', 'dressy', 'night out'],
  formal: ['formal', 'black tie', 'black-tie', 'gala'],
  athleisure: ['athletic', 'athleisure', 'gym', 'workout'],
  other: [],
};

const OCCASION_KEYWORDS_MAP: Record<WardrobeOccasionOption, string[]> = {
  work: ['work', 'office', 'meeting', 'client', 'presentation'],
  weekend: ['weekend', 'brunch', 'saturday', 'sunday', 'errands'],
  date: ['date', 'romantic', 'dinner date'],
  family: ['family', 'family lunch', 'family dinner', 'family gathering', 'family event', 'kids', 'lunch'],
  travel: ['travel', 'flight', 'airport', 'road trip', 'vacation', 'getaway'],
  party: ['party', 'celebration', 'birthday', 'festive'],
  'formal-event': ['formal event', 'ceremony', 'banquet'],
  outdoor: ['outdoor', 'hiking', 'camping', 'park', 'picnic'],
  athletic: ['gym', 'workout', 'run', 'running', 'training', 'athletic', 'yoga', 'pilates'],
  lounging: ['lounging', 'at home', 'movie night', 'relaxing', 'lazy day'],
  wedding: ['wedding', 'bridal', 'rehearsal dinner'],
  other: [],
};

const SEASON_KEYWORDS_MAP: Record<WardrobeSeasonOption, string[]> = {
  winter: ['winter', 'snow', 'snowy', 'freezing', 'cold', 'chilly', 'icy', 'frosty', 'below zero'],
  fall: ['fall', 'autumn', 'crisp', 'breezy', 'october', 'november', 'leaf'],
  spring: ['spring', 'bloom', 'april', 'may', 'rainy', 'drizzle', 'breezy'],
  summer: ['summer', 'heat', 'hot', 'humid', 'sweltering', 'beach', 'vacation weather', 'july', 'august'],
  'all-season': [],
};

const STYLE_TAG_KEYWORDS_MAP: Record<WardrobeStyleTagOption, string[]> = {
  minimalist: ['minimalist', 'minimal', 'clean lines'],
  classic: ['classic', 'timeless', 'traditional'],
  modern: ['modern', 'contemporary'],
  trendy: ['trendy', 'of the moment'],
  edgy: ['edgy', 'bold', 'avant garde', 'avant-garde'],
  boho: ['boho', 'bohemian'],
  preppy: ['preppy', 'ivy', 'collegiate'],
  athleisure: ['athleisure', 'sporty casual'],
  streetwear: ['streetwear', 'urban', 'street style'],
  romantic: ['romantic', 'feminine', 'soft'],
  feminine: ['feminine'],
  androgynous: ['androgynous', 'gender neutral'],
  workwear: ['workwear', 'utilitarian'],
  vintage: ['vintage', 'retro'],
  sporty: ['sporty', 'athletic inspired'],
  heritage: ['heritage', 'rugged'],
  other: [],
};

const ALWAYS_ALLOW_STYLE_TAGS = new Set<WardrobeStyleTagOption>(['minimalist', 'classic']);

const WEATHER_KEYWORD_RULES: Array<{ keywords: string[]; seasons: WardrobeSeasonOption[]; note: string }> = [
  { keywords: ['rain', 'rainy', 'drizzle', 'showers'], seasons: ['spring', 'fall'], note: 'rainy weather' },
  { keywords: ['snow', 'snowy', 'blizzard'], seasons: ['winter'], note: 'snowy conditions' },
  { keywords: ['humid', 'sticky', 'sweltering'], seasons: ['summer'], note: 'humid heat' },
  { keywords: ['heatwave', 'heat wave'], seasons: ['summer'], note: 'heat wave' },
  { keywords: ['cool', 'chilly', 'crisp', 'breezy'], seasons: ['fall', 'spring'], note: 'cool temperatures' },
];

const ANCHOR_SINGLETON_CATEGORIES = new Set([
  'Bags',
  'Shoes',
]);

function getAnchorUsageKey(item: WardrobeItem): string | undefined {
  if (item.id && typeof item.id === 'string' && item.id.trim().length > 0) {
    return item.id;
  }
  if (item.title && typeof item.title === 'string') {
    return item.title.trim().toLowerCase();
  }
  return undefined;
}

const RECENT_ANCHOR_HISTORY_SIZE = 20;
const RECENT_ANCHOR_WEIGHT = 3;
const anchorSelectionHistory = new Map<
  string,
  {
    counts: Map<string, number>;
    queue: string[];
  }
>();

function createSeededRandom(seed: number): () => number {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

const LOWER_WEIGHTED_RANDOM_CATEGORIES = new Set([
  'Underwear & Sleepwear',
  'Swimwear',
  'Activewear',
]);

function selectAnchorItems(
  itemsByCategory: Record<string, WardrobeItem[]>,
  outfitCount: number,
  seed: number,
  usageCounts?: Map<string, number>
): Array<{ category: string; anchorItem: WardrobeItem }> {
  const entries = Object.entries(itemsByCategory).filter(([, items]) => Array.isArray(items) && items.length > 0);
  if (entries.length === 0 || outfitCount <= 0) {
    return [];
  }

  const weightedCategories: string[] = [];
  entries.forEach(([category]) => {
    const baseWeight = LOWER_WEIGHTED_RANDOM_CATEGORIES.has(category) ? 1 : 3;
    for (let i = 0; i < baseWeight; i++) {
      weightedCategories.push(category);
    }
  });

  if (weightedCategories.length === 0) {
    return [];
  }

  const rng = createSeededRandom(seed);
  const usedItemIds = new Set<string>();
  const usedTitles = new Set<string>();
  const anchors: Array<{ category: string; anchorItem: WardrobeItem }> = [];

  for (let i = 0; i < outfitCount; i++) {
    const category = (() => {
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidateCategory = weightedCategories[Math.floor(rng() * weightedCategories.length)];
        const pool = itemsByCategory[candidateCategory] || [];
        if (pool.length > 0) {
          return candidateCategory;
        }
      }
      return entries[Math.floor(rng() * entries.length)][0];
    })();

    const pool = itemsByCategory[category] || [];
    if (pool.length === 0) {
      continue;
    }

    const unusedItems = pool.filter(item => {
      const key = getAnchorUsageKey(item);
      if (key) {
        return !usedItemIds.has(key);
      }
      if (item.title) {
        const normalized = item.title.trim().toLowerCase();
        return !usedTitles.has(normalized);
      }
      return true;
    });
    const selectionPool = unusedItems.length > 0 ? unusedItems : pool;
    const weightedPool = selectionPool.map(item => {
      const usageKey = getAnchorUsageKey(item);
      const usage = usageKey ? usageCounts?.get(usageKey) ?? 0 : 0;
      const weight = usage >= 0 ? 1 / (1 + usage) : 1;
      return { item, weight: Number.isFinite(weight) && weight > 0 ? weight : 1 };
    });

    const totalWeight = weightedPool.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) {
      continue;
    }
    let roll = rng() * totalWeight;
    let anchorItem = weightedPool[weightedPool.length - 1]?.item;
    for (const entry of weightedPool) {
      roll -= entry.weight;
      if (roll <= 0) {
        anchorItem = entry.item;
        break;
      }
    }

    if (!anchorItem) {
      continue;
    }

    const usageKey = getAnchorUsageKey(anchorItem);
    if (usageKey) {
      usedItemIds.add(usageKey);
      usedTitles.add(usageKey);
    } else if (anchorItem.title) {
      usedTitles.add(anchorItem.title.trim().toLowerCase());
    }
    if (usageCounts && usageKey) {
      usageCounts.set(usageKey, (usageCounts.get(usageKey) || 0) + 1);
    }
    anchors.push({ category, anchorItem });
  }

  return anchors;
}

export interface ExtractedContextFilters {
  formalities: Set<WardrobeFormalityOption>;
  occasions: Set<WardrobeOccasionOption>;
  seasons: Set<WardrobeSeasonOption>;
  styleTags: Set<WardrobeStyleTagOption>;
  temperatureNotes: string[];
  matchedKeywords: Set<string>;
}

export interface FilteredItemsResult {
  filteredItems: WardrobeItem[];
  appliedFilters: {
    formalities?: WardrobeFormalityOption[];
    occasions?: WardrobeOccasionOption[];
    seasons?: WardrobeSeasonOption[];
    styleTags?: WardrobeStyleTagOption[];
  };
}

function normalizePromptValue(value: string | undefined): string {
  return (value || '').toLowerCase();
}

function convertCelsiusToFahrenheit(tempC: number): number {
  return (tempC * 9) / 5 + 32;
}

function determineSeasonFromTemperature(tempF: number): WardrobeSeasonOption[] {
  if (tempF <= 40) {
    return ['winter'];
  }
  if (tempF <= 55) {
    return ['fall', 'winter'];
  }
  if (tempF <= 70) {
    return ['spring', 'fall'];
  }
  if (tempF <= 85) {
    return ['summer', 'spring'];
  }
  return ['summer'];
}

function ensureAllSeasonMatch(
  itemSeasons: WardrobeSeasonOption[] | undefined,
  filterSeasons: Set<WardrobeSeasonOption>
): boolean {
  if (!itemSeasons || itemSeasons.length === 0 || filterSeasons.size === 0) {
    return true;
  }
  if (itemSeasons.includes('all-season')) {
    return true;
  }
  return itemSeasons.some(season => filterSeasons.has(season));
}

function matchesAttributeFilter<T extends string>(
  itemValues: T[] | undefined,
  filterValues: Set<T>
): boolean {
  if (filterValues.size === 0) {
    return true;
  }
  if (!itemValues || itemValues.length === 0) {
    return true;
  }
  return itemValues.some(value => filterValues.has(value));
}

export function extractContextFilters(text?: string): ExtractedContextFilters {
  const normalized = normalizePromptValue(text);
  const result: ExtractedContextFilters = {
    formalities: new Set<WardrobeFormalityOption>(),
    occasions: new Set<WardrobeOccasionOption>(),
    seasons: new Set<WardrobeSeasonOption>(),
    styleTags: new Set<WardrobeStyleTagOption>(),
    temperatureNotes: [],
    matchedKeywords: new Set<string>(),
  };

  if (!normalized) {
    return result;
  }

  const addMatches = <T extends string>(map: Record<T, string[]>, setter: (key: T) => void) => {
    (Object.entries(map) as Array<[T, string[]]>).forEach(([value, keywords]) => {
      keywords.forEach(keyword => {
        const lowerKeyword = keyword.toLowerCase();
        if (lowerKeyword && normalized.includes(lowerKeyword)) {
          setter(value);
          result.matchedKeywords.add(lowerKeyword);
        }
      });
    });
  };

  addMatches(FORMALITY_KEYWORDS_MAP, key => result.formalities.add(key));
  addMatches(OCCASION_KEYWORDS_MAP, key => result.occasions.add(key));
  addMatches(SEASON_KEYWORDS_MAP, key => result.seasons.add(key));
  addMatches(STYLE_TAG_KEYWORDS_MAP, key => result.styleTags.add(key));

  WEATHER_KEYWORD_RULES.forEach(rule => {
    rule.keywords.forEach(keyword => {
      if (normalized.includes(keyword)) {
        rule.seasons.forEach(season => result.seasons.add(season));
        result.temperatureNotes.push(rule.note);
        result.matchedKeywords.add(keyword);
      }
    });
  });

  const temperatureRegex = /(-?\d+(?:\.\d+)?)\s*(?:°|degrees?|deg)?\s*(c|celsius|f|fahrenheit)?/gi;
  let match: RegExpExecArray | null;
  while ((match = temperatureRegex.exec(normalized)) !== null) {
    const rawValue = Number(match[1]);
    if (Number.isNaN(rawValue)) {
      continue;
    }
    const unit = match[2]?.toLowerCase();
    const tempF = unit && (unit.startsWith('c')) ? convertCelsiusToFahrenheit(rawValue) : rawValue;
    const rounded = Math.round(tempF);
    const inferredSeasons = determineSeasonFromTemperature(tempF);
    inferredSeasons.forEach(season => result.seasons.add(season));
    result.temperatureNotes.push(`${rounded}°F`);
    result.matchedKeywords.add(`${rounded}f`);
  }

  return result;
}

export function filterItemsForContext(
  items: WardrobeItem[],
  filters: ExtractedContextFilters,
  selectedItems: WardrobeItem[] = []
): FilteredItemsResult {
  const selectedIds = new Set<string>(selectedItems.map(item => item.id));
  const hasActiveFilters =
    filters.formalities.size > 0 ||
    filters.occasions.size > 0 ||
    filters.seasons.size > 0 ||
    filters.styleTags.size > 0;

  if (!hasActiveFilters) {
    return {
      filteredItems: items,
      appliedFilters: {},
    };
  }

  const filteredItems = items.filter(item => {
    if (selectedIds.has(item.id)) {
      return true;
    }

    const hasAlwaysAllowStyleTag =
      item.styleTags?.some(tag => ALWAYS_ALLOW_STYLE_TAGS.has(tag as WardrobeStyleTagOption)) ?? false;

    if (hasAlwaysAllowStyleTag) {
      return true;
    }

    if (!matchesAttributeFilter(item.formalities, filters.formalities)) {
      return false;
    }

    if (!matchesAttributeFilter(item.occasions, filters.occasions)) {
      return false;
    }

    if (!ensureAllSeasonMatch(item.seasons, filters.seasons)) {
      return false;
    }

    if (!matchesAttributeFilter(item.styleTags, filters.styleTags)) {
      return false;
    }

    return true;
  });

  return {
    filteredItems,
    appliedFilters: {
      formalities: filters.formalities.size > 0 ? Array.from(filters.formalities) : undefined,
      occasions: filters.occasions.size > 0 ? Array.from(filters.occasions) : undefined,
      seasons: filters.seasons.size > 0 ? Array.from(filters.seasons) : undefined,
      styleTags: filters.styleTags.size > 0 ? Array.from(filters.styleTags) : undefined,
    },
  };
}

export function buildContextFilterSummary(
  appliedFilters: FilteredItemsResult['appliedFilters'],
  filters: ExtractedContextFilters
): string | null {
  const parts: string[] = [];

  if (appliedFilters.formalities && appliedFilters.formalities.length > 0) {
    parts.push(`Formality preference: ${appliedFilters.formalities.join(', ')}`);
  }
  if (appliedFilters.occasions && appliedFilters.occasions.length > 0) {
    parts.push(`Occasion focus: ${appliedFilters.occasions.join(', ')}`);
  }
  if (appliedFilters.seasons && appliedFilters.seasons.length > 0) {
    parts.push(`Seasonal cues: ${appliedFilters.seasons.join(', ')}`);
  }
  if (appliedFilters.styleTags && appliedFilters.styleTags.length > 0) {
    parts.push(`Style direction: ${appliedFilters.styleTags.join(', ')}`);
  }
  if (filters.temperatureNotes.length > 0) {
    parts.push(`Weather notes: ${filters.temperatureNotes.join(', ')}`);
  }

  if (parts.length === 0) {
    return null;
  }

  return parts.join(' | ');
}

function buildItemAttributeSummary(item: WardrobeItem): string | null {
  const parts: string[] = [];
  if (item.colors && item.colors.length > 0) {
    parts.push(`Colors: ${item.colors.join(', ')}`);
  }
  if (item.fabrics && item.fabrics.length > 0) {
    parts.push(`Fabrics: ${item.fabrics.join(', ')}`);
  }
  if (item.pattern) {
    parts.push(`Pattern: ${item.pattern}`);
  }
  if (item.silhouettes && item.silhouettes.length > 0) {
    parts.push(`Silhouettes: ${item.silhouettes.join(', ')}`);
  } else if (item.silhouette) {
    parts.push(`Silhouette: ${item.silhouette}`);
  }
  if (item.fit) {
    parts.push(`Fit: ${item.fit}`);
  }
  if (item.formalities && item.formalities.length > 0) {
    parts.push(`Formality: ${item.formalities.join(', ')}`);
  }
  if (item.styleTags && item.styleTags.length > 0) {
    parts.push(`Style Tags: ${item.styleTags.join(', ')}`);
  }
  if (item.seasons && item.seasons.length > 0) {
    parts.push(`Seasons: ${item.seasons.join(', ')}`);
  }
  if (item.occasions && item.occasions.length > 0) {
    parts.push(`Occasions: ${item.occasions.join(', ')}`);
  }
  if (item.brand) {
    parts.push(`Brand: ${item.brand}`);
  }
  if (item.careNotes) {
    parts.push(`Care: ${item.careNotes}`);
  }
  return parts.length > 0 ? parts.join('; ') : null;
}

const FEEDBACK_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'without', 'this', 'that', 'from', 'into', 'onto', 'over', 'under',
  'after', 'before', 'while', 'when', 'where', 'what', 'why', 'dont', 'don', 'should', 'would', 'could',
  'make', 'making', 'have', 'has', 'had', 'been', 'will', 'shall', 'keep', 'no', 'not', 'please',
  'avoid', 'prefer', 'maybe', 'like', 'love', 'hate', 'family', 'lunch', 'dinner', 'event', 'wear',
  'wearing', 'look', 'looks', 'feel', 'feels', 'more', 'less', 'really', 'very', 'too', 'much', 'little',
  'any', 'some', 'just', 'can', 'cant', 'cannot', 'shouldnt', 'wouldnt', 'couldnt'
]);

const QUICK_ENTRY_MAX_TITLE_LENGTH = 60;

const QUICK_ENTRY_FILLER_PATTERNS = [
  /^i\s+(have|own|got)\s+/i,
  /^there\s+(is|are)\s+/i,
  /^these\s+/i,
  /^here\s+/i,
  /^my\s+/i,
];

const QUICK_ENTRY_ARTICLE_SPLIT_REGEX = /\band\s+(?=(?:a|an|the)\s)/gi;

const QUICK_ENTRY_DIRECT_CATEGORY_MAP: Record<string, string> = {
  dress: 'Dresses',
  dresses: 'Dresses',
};

function normalizeCategory(rawCategory: string | undefined, fallbackText: string): string {
  if (rawCategory) {
    const trimmed = rawCategory.trim();
    if (trimmed) {
      const lower = trimmed.toLowerCase();
      const exact = CATEGORIES.find(cat => cat.toLowerCase() === lower);
      if (exact) return exact;
      const partial = CATEGORIES.find(cat => cat.toLowerCase().includes(lower) || lower.includes(cat.toLowerCase()));
      if (partial) return partial;
    }
  }

  const lowerFallback = fallbackText.toLowerCase();
  if (/\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|loafer|loafers|flat|flats|sandal|sandals|mule|mules)\b/.test(lowerFallback)) {
    return 'Shoes';
  }
  if (/\b(pant|pants|trouser|trousers|jean|jeans|short|shorts|skirt|skirts|bottom|bottoms|legging|leggings|jogger|joggers)\b/.test(lowerFallback)) {
    return 'Bottoms';
  }
  if (/\b(dress|gown)\b/.test(lowerFallback)) {
    return 'Dresses';
  }
  if (/\b(coat|jacket|blazer|outerwear|cardigan|sweater|sweatshirt|hoodie|top|tops|shirt|tee|t-shirt|tank)\b/.test(lowerFallback)) {
    return 'Tops';
  }
  if (/\b(swim|swimsuit|bikini|tankini|rashguard|rash guard|boardshort|board short)\b/.test(lowerFallback)) {
    return 'Swimwear';
  }
  if (/\b(pajama|pyjama|sleep|nightgown|nightdress|nightwear|lingerie|underwear|panty|brief|robe)\b/.test(lowerFallback)) {
    return 'Underwear & Sleepwear';
  }
  if (/\b(bag|purse|belt|hat|scarf|glove|watch|ring|bracelet|necklace|jewelry|earring|earrings|cuff|pendant)\b/.test(lowerFallback)) {
    return 'Accessories';
  }
  return 'Accessories';
}

function sanitizeDescription(description: string | undefined, fallbackText: string): string | undefined {
  const value = (description || fallbackText || '').trim();
  if (!value) return undefined;
  return value.length > 200 ? `${value.slice(0, 197)}...` : value;
}

function dedupeItems(items: GeneratedWardrobeDraftItem[]): GeneratedWardrobeDraftItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export interface GeneratedWardrobeDraftItem {
  title: string;
  category: string;
  description?: string;
  subCategory?: string;
}

function stripLeadingMarkers(value: string): string {
  return value.replace(/^[\s]*[-•*·+]+[\s]*/, '');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function removeTrailingPunctuation(value: string): string {
  return value.replace(/[,\.;:\-]+$/g, '').trim();
}

function enforceTitleLength(value: string): string {
  if (value.length <= QUICK_ENTRY_MAX_TITLE_LENGTH) {
    return value;
  }
  return `${value.slice(0, QUICK_ENTRY_MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}

export function formatQuickEntryTitle(raw: string): string {
  const cleaned = enforceTitleLength(
    normalizeWhitespace(removeTrailingPunctuation(stripLeadingMarkers(raw || '')))
  );
  const titleCased = cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return titleCased;
}

function splitQuickEntrySegments(input: string): string[] {
  const preprocessed = input
    .replace(/\n+/g, ', ')
    .replace(/\s+[-•–—]+\s+/g, ', ');

  let segments = preprocessed
    .split(/[,;]+/)
    .map(segment => normalizeWhitespace(segment))
    .filter(Boolean);

  segments = segments.flatMap(segment => {
    if (/^(?:a|an|the)\s/i.test(segment) && QUICK_ENTRY_ARTICLE_SPLIT_REGEX.test(segment)) {
      return segment
        .split(QUICK_ENTRY_ARTICLE_SPLIT_REGEX)
        .map(part => normalizeWhitespace(part))
        .filter(Boolean);
    }
    return segment;
  });

  segments = segments
    .map(segment => {
      let result = segment;
      QUICK_ENTRY_FILLER_PATTERNS.forEach(pattern => {
        if (pattern.test(result)) {
          result = result.replace(pattern, '').trim();
        }
      });
      return normalizeWhitespace(result);
    })
    .filter(segment => segment && segment.length > 1);

  return segments;
}

const tokenize = (value: string): string[] =>
  (value || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(token => token.trim())
    .filter(token => token && !FEEDBACK_STOP_WORDS.has(token));

export function getCoreCategoryFlags(item?: WardrobeItem, fallbackTitle?: string): CoreCategory[] {
  const flags = new Set<CoreCategory>();
  const collectedStrings: string[] = [];

  if (item?.category) {
    const normalized = item.category.toLowerCase();
    collectedStrings.push(normalized);
    collectedStrings.push(...normalized.split(/[\s/,-]+/));
  }

  const title = fallbackTitle || item?.title || '';
  if (title) {
    const normalizedTitle = title.toLowerCase();
    collectedStrings.push(normalizedTitle);
    collectedStrings.push(...normalizedTitle.split(/[\s/,-]+/));
  }

  collectedStrings.forEach(value => {
    if (!value) return;
    (Object.keys(CORE_CATEGORY_KEYWORDS) as CoreCategory[]).forEach(category => {
      if (CORE_CATEGORY_KEYWORDS[category].some(keyword => value.includes(keyword))) {
        flags.add(category);
      }
    });
  MULTI_CATEGORY_KEYWORDS.forEach(entry => {
    if (entry.keywords.some(keyword => value.includes(keyword))) {
      entry.categories.forEach(category => flags.add(category));
    }
  });
  });

  return Array.from(flags);
}

export function resolveCoreCategory(item?: WardrobeItem, fallbackTitle?: string): CoreCategory | null {
  const categories = getCoreCategoryFlags(item, fallbackTitle);
  return categories.length > 0 ? categories[0] : null;
}

function fallbackGenerateWardrobeItems(input: string): GeneratedWardrobeDraftItem[] {
  console.log('[LLM] Using fallback parsing for quick entry items');
  const segments = splitQuickEntrySegments(input);

  if (segments.length === 0) {
    const cleaned = normalizeWhitespace(removeTrailingPunctuation(stripLeadingMarkers(input)));
    if (!cleaned) {
      return [];
    }
    segments.push(cleaned);
  }

  const drafts: GeneratedWardrobeDraftItem[] = [];
  for (const segment of segments) {
    const title = formatQuickEntryTitle(segment);
    if (!title) {
      continue;
    }

    const directCategory = Object.entries(QUICK_ENTRY_DIRECT_CATEGORY_MAP).find(
      ([keyword]) => title.toLowerCase().includes(keyword)
    )?.[1];

    const category = directCategory ?? normalizeCategory(undefined, segment);
    const description = sanitizeDescription(
      `Quick entry draft item described as: ${segment}`,
      `Quick entry draft item described as: ${segment}`
    );
    const subCategory = resolveSubCategory(category, undefined, title, description);

    drafts.push({
      title,
      category,
      ...(description ? { description } : {}),
      ...(subCategory ? { subCategory } : {})
    });
  }

  return dedupeItems(drafts);
}

export async function generateWardrobeItemsFromText(input: string): Promise<GeneratedWardrobeDraftItem[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  if (!OPENAI_API_KEY || !openai) {
    return fallbackGenerateWardrobeItems(trimmed);
  }

  try {
    console.log(`[LLM] Parsing quick entry wardrobe text (${trimmed.length} characters)`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a wardrobe assistant. The user will share a free-form stream of consciousness describing clothing or accessory items they own. Extract each distinct item and return a JSON object with a single key "items" that maps to an array. Each array element must include:
- "title": human-friendly title in Title Case, ideally 3-8 words.
- "category": one of the following exactly: ${CATEGORIES.join(', ')}.
- "description": short sentence (max 160 characters) summarizing the item's color, fabric, fit, or style.
Use only the listed categories. Respond with valid JSON only. If no items are found, return {"items": []}.`
        },
        {
          role: 'user',
          content: trimmed
        }
      ],
      max_tokens: 600,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn('[LLM] Empty response when parsing wardrobe items, using fallback');
      return fallbackGenerateWardrobeItems(trimmed);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('[LLM] Failed to parse JSON response, using fallback', parseError);
      return fallbackGenerateWardrobeItems(trimmed);
    }

    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.warn('[LLM] Parsed response missing items, using fallback parser');
      return fallbackGenerateWardrobeItems(trimmed);
    }

    const sanitized = parsed.items
      .map((item: any) => {
        const rawTitle = (item?.title || '').toString();
        const title = formatQuickEntryTitle(rawTitle);
        if (!title) {
          return null;
        }
        const category = normalizeCategory((item?.category || '').toString(), title);
        const description = sanitizeDescription(item?.description ? item.description.toString() : '', title);
        const subCategory = resolveSubCategory(category, undefined, title, description);
        return {
          title,
          category,
          ...(description ? { description } : {}),
          ...(subCategory ? { subCategory } : {})
        } as GeneratedWardrobeDraftItem;
      })
      .filter((item: GeneratedWardrobeDraftItem | null): item is GeneratedWardrobeDraftItem => item !== null);

    if (sanitized.length === 0) {
      console.warn('[LLM] Sanitized response produced no items, using fallback parser');
      return fallbackGenerateWardrobeItems(trimmed);
    }

    return dedupeItems(sanitized);
  } catch (error) {
    console.error('[LLM] Error parsing wardrobe items:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
    }
    return fallbackGenerateWardrobeItems(trimmed);
  }
}
export async function categorizeItem(title: string, imagePath: string): Promise<string> {
  if (!openai) {
    console.warn('[LLM] OpenAI API key missing, falling back to heuristic categorization');
    return normalizeCategory(undefined, title);
  }
  try {
    console.log(`[LLM] Starting categorization for: "${title}"`);
    console.log(`[LLM] Image path: ${imagePath}`);
    
    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageSizeKB = (imageBuffer.length / 1024).toFixed(2);
    console.log(`[LLM] Image size: ${imageSizeKB} KB`);
    
    // Determine the image MIME type
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.webp') mimeType = 'image/webp';
    
    console.log('[LLM] Calling OpenAI API for categorization...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion categorization assistant. Based on the image and title, categorize the item into one of these categories: ${CATEGORIES.join(', ')}. Return only the category name, nothing else.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Categorize this item: "${title}". Return only the category name from this list: ${CATEGORIES.join(', ')}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const category = response.choices[0]?.message?.content?.trim();
    if (!category) {
      console.error('[LLM] No category returned from API');
      throw new Error('No category returned from LLM');
    }

    // Validate category
    const normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    if (CATEGORIES.includes(normalizedCategory)) {
      console.log(`[LLM] Categorized "${title}" as: ${normalizedCategory}`);
      return normalizedCategory;
    }

    // Fallback: try to find closest match
    const closestCategory = CATEGORIES.find(cat => 
      cat.toLowerCase().includes(category.toLowerCase()) || 
      category.toLowerCase().includes(cat.toLowerCase())
    );
    
    if (closestCategory) {
      console.log(`[LLM] Categorized "${title}" as: ${closestCategory} (normalized from "${category}")`);
      return closestCategory;
    }

    console.log(`[LLM] Could not match category "${category}", using fallback`);
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  } catch (error) {
    console.error('[LLM] Error categorizing item:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  }
}

export interface OutfitFeedback {
  id: string;
  itemTitles: string[];
  type: 'like' | 'dislike';
  feedback?: string;
  createdAt: string;
  prompt?: string;
}

export interface GeneratedOutfit {
  items: string[];
  justification: string;
  stylingSuggestions: string[];
}

export async function generateOutfits(
  itemsByCategory: Record<string, WardrobeItem[]>,
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string; brands?: string[]; hairColor?: string; hairTexture?: string; skinColor?: string },
  prompt?: string,
  feedback?: OutfitFeedback[],
  selectedItems?: WardrobeItem[],
  savedOutfits?: SavedOutfit[],
  userId?: string
): Promise<GeneratedOutfit[]> {
  const parsedOutfitCount = Number.parseInt(process.env.OUTFIT_COUNT ?? '', 10);
  const targetOutfitCount = Number.isFinite(parsedOutfitCount) && parsedOutfitCount > 0 ? parsedOutfitCount : 5;
  const generationCount = Math.max(targetOutfitCount * 2, targetOutfitCount + 2);
  const selectedList = selectedItems ?? [];
  const savedOutfitList = savedOutfits ?? [];
  const normalizeTitleKey = (value: string): string =>
    normalizeWhitespace(stripLeadingMarkers(value || '')).toLowerCase();

  const allItemsList = Object.values(itemsByCategory).flat();
  const allItemsMap = new Map<string, WardrobeItem>();
  const itemsByCoreCategory: Record<CoreCategory, WardrobeItem[]> = {
    tops: [],
    bottoms: [],
    shoes: [],
    accessories: [],
  };

  allItemsList.forEach(item => {
    const key = normalizeTitleKey(item.title);
    allItemsMap.set(key, item);
    const categories = getCoreCategoryFlags(item, item.title);
    if (categories.length === 0) {
      return;
    }
    categories.forEach(category => {
      if (!itemsByCoreCategory[category].some(existing => normalizeTitleKey(existing.title) === key)) {
        itemsByCoreCategory[category].push(item);
      }
    });
  });

  const savedOutfitIdSets: Array<Set<string>> = savedOutfitList
    .map(outfit => {
      const ids = (outfit.itemIds || []).filter((id): id is string => typeof id === 'string' && id.length > 0);
      return new Set(ids);
    })
    .filter(set => set.size > 0);

  const anchorUsageCounts = new Map<string, number>();
  if (userId) {
    const history = anchorSelectionHistory.get(userId);
    if (history) {
      history.counts.forEach((count, key) => {
        const existing = anchorUsageCounts.get(key) || 0;
        anchorUsageCounts.set(key, existing + count * RECENT_ANCHOR_WEIGHT);
      });
    }
  }

  const hasAccessories = itemsByCoreCategory.accessories.length > 0;
  const coreCategoriesRequired: CoreCategory[] = hasAccessories
    ? ['tops', 'bottoms', 'shoes', 'accessories']
    : ['tops', 'bottoms', 'shoes'];

  const selectedTitleKeys = new Set<string>(selectedList.map(item => normalizeTitleKey(item.title)));

  const dislikedEntries = (feedback || []).filter(entry => entry.type === 'dislike');
  const dislikeInstructions = dislikedEntries
    .map(entry => (entry.feedback || '').trim())
    .filter(Boolean);
  const dislikedCombinationSummaries = dislikedEntries
    .map(entry => {
      const parts: string[] = [];
      if (entry.prompt && entry.prompt.trim().length > 0) {
        parts.push(`context: "${entry.prompt.trim()}"`);
      }
      if (entry.itemTitles.length > 0) {
        parts.push(`items: ${entry.itemTitles.join(', ')}`);
      }
      if (entry.feedback && entry.feedback.trim().length > 0) {
        parts.push(`note: ${entry.feedback.trim()}`);
      }
      if (parts.length === 0) {
        return '';
      }
      return parts.join(' | ');
    })
    .filter(summary => summary.length > 0);

  const shouldAvoidTitle = (_title: string): boolean => false;

  const coreCategoryInstruction = `CORE CATEGORY REQUIREMENTS:
- Every outfit must include at least one TOP (shirts, knits, blouses, outerwear layers all count as tops).
- Every outfit must include at least one BOTTOM (pants, jeans, shorts, skirts, dresses, jumpsuits, rompers, overalls all satisfy the bottom requirement).
- Every outfit must include at least one pair of SHOES.${hasAccessories ? '\n- Accessories are available; include at least one accessory (bags, belts, hats, jewelry, scarves, etc.) in every outfit.' : '\n- Accessories are optional if none are available.'}
- Garments like dresses, jumpsuits, rompers, and overalls count as BOTH the top and bottom requirements simultaneously.
Layering multiple tops or outerwear is encouraged, but you must still include a bottom (or a garment that covers both) and shoes in every outfit.`;


  const anchorPlan: Array<{ category: string; anchorItem: WardrobeItem }> = [];
  let anchorContext = '';

  if (selectedList.length === 0) {
    const now = Date.now();
    let seed = Number(now % 2147483647);
    if (typeof process !== 'undefined' && typeof process.hrtime === 'function') {
      try {
        const hr = process.hrtime.bigint();
        seed = (seed + Number(hr % 2147483647n)) % 2147483647;
      } catch (err) {
        // ignore
      }
    }
    try {
      seed = (seed + crypto.randomInt(1, 2147483646)) % 2147483647;
    } catch (err) {
      seed = (seed + Math.floor(Math.random() * 2147483646)) % 2147483647;
    }
    if (seed <= 0) {
      seed = Math.floor(Math.random() * 2147483646) + 1;
    }

    anchorPlan.push(...selectAnchorItems(itemsByCategory, generationCount, seed, anchorUsageCounts));
    if (anchorPlan.length > 0) {
      const anchorSummary = anchorPlan
        .map((anchor, index) => {
          const label = anchor.anchorItem.category || anchor.category;
          return `Outfit ${index + 1}: "${anchor.anchorItem.title}" (${label})`;
        })
        .join('; ');
      console.log(`[LLM] Anchor plan selected: ${anchorSummary}`);
      anchorContext = `ANCHOR REQUIREMENTS:
${anchorPlan
  .map(
    (anchor, index) =>
      {
        const anchorCategory = anchor.anchorItem.category || anchor.category;
        const heroSummary = `- Outfit ${index + 1}: "${anchor.anchorItem.title}" (${anchorCategory}) is the hero piece. Build the full look to showcase this item — reference its colors, textures, proportions, and styling details.`;
        const duplicateRule = ANCHOR_SINGLETON_CATEGORIES.has(anchorCategory || '')
          ? ' Do not include additional items from this same category (e.g., no second bag or second pair of shoes) unless the user explicitly selected them.'
          : ' You may include additional pieces from this category only when the layering is intentional (e.g., skirt over pants, trench over blazer, stacked jewelry, multiple hair accessories) and clearly supports the hero without feeling redundant. Bags are always limited to one.';
        return `${heroSummary}${duplicateRule} Highlight the anchor through supporting pieces, styling notes, and the justification copy, without explicitly mentioning that it was pre-selected.`;
      }
  )
  .join('\n')}
Do NOT mention to the user that any item was pre-selected as an anchor or that an outfit was intentionally centered around it. Present each outfit naturally.`;
    }
  }

  if (userId && anchorPlan.length > 0) {
    let history = anchorSelectionHistory.get(userId);
    if (!history) {
      history = { counts: new Map<string, number>(), queue: [] };
      anchorSelectionHistory.set(userId, history);
    }
    const { counts, queue } = history;
    anchorPlan.forEach(({ anchorItem }) => {
      const key = getAnchorUsageKey(anchorItem);
      if (!key) {
        return;
      }
      queue.push(key);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    while (queue.length > RECENT_ANCHOR_HISTORY_SIZE) {
      const removed = queue.shift();
      if (!removed) {
        continue;
      }
      const current = counts.get(removed);
      if (current === undefined) {
        continue;
      }
      if (current <= 1) {
        counts.delete(removed);
      } else {
        counts.set(removed, current - 1);
      }
    }
  }

  const fallbackRunner = () =>
    generateFallbackOutfits(
      itemsByCoreCategory,
      coreCategoriesRequired,
      allItemsMap,
      {
        normalizeTitleKey,
        shouldAvoidTitle,
        selectedItems: selectedList,
        anchorItems: anchorPlan.map(plan => plan.anchorItem),
      },
      generationCount
    );

  if (!openai) {
    console.warn('[LLM] OpenAI API key missing, using fallback outfit generator');
    return fallbackRunner();
  }
  try {
    console.log('[LLM] Starting outfit generation...');
    
    // Build a detailed description of available items with descriptions
    const itemsDescription = Object.entries(itemsByCategory)
      .map(([category, items]) => {
        const itemsList = items.map(item => {
          let itemDesc = item.title;
          const attributeSummary = buildItemAttributeSummary(item);
          if (attributeSummary) {
            itemDesc += ` {${attributeSummary}}`;
          }
          if (item.description) {
            itemDesc += ` — ${item.description}`;
          }
          if (item.measurements) {
            const measurementsStr = Object.entries(item.measurements)
              .filter(([_, v]) => v !== undefined && v !== null)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            if (measurementsStr) {
              itemDesc += ` [${measurementsStr}]`;
            }
          }
          return itemDesc;
        }).join(', ');
        return `${category}: ${itemsList}`;
      })
      .join('\n');
    
    const totalItems = Object.values(itemsByCategory).flat().length;
    console.log(`[LLM] Generating outfits from ${totalItems} items across ${Object.keys(itemsByCategory).length} categories`);
    console.log(`[LLM] Items description length: ${itemsDescription.length} characters`);
    
    // Build user profile context
    let userContext = '';
    if (userProfile) {
      const contextParts: string[] = [];
      
      if (userProfile.height && userProfile.weight) {
        contextParts.push(`Height ${userProfile.height} ${userProfile.heightUnit || 'inches'}, Weight ${userProfile.weight} ${userProfile.weightUnit || 'lbs'}`);
      }
      
      if (userProfile.stylePreferences) {
        contextParts.push(`Style preferences: ${userProfile.stylePreferences}`);
      }
      
      // Appearance details
      const appearanceParts: string[] = [];
      if (userProfile.hairColor) {
        appearanceParts.push(`hair color: ${userProfile.hairColor}`);
      }
      if (userProfile.hairTexture) {
        appearanceParts.push(`hair texture: ${userProfile.hairTexture}`);
      }
      if (userProfile.skinColor) {
        appearanceParts.push(`skin color: ${userProfile.skinColor}`);
      }
      if (appearanceParts.length > 0) {
        contextParts.push(`Appearance: ${appearanceParts.join(', ')}`);
      }
      
      if (contextParts.length > 0) {
        userContext = `User profile: ${contextParts.join('. ')}. `;
      }
    }

    // Add selected items context if provided
    let selectedItemsContext = '';
    let exclusionRules = '';
    if (selectedItems && selectedItems.length > 0) {
      const selectedItemsDesc = selectedItems.map(item => {
        let desc = item.title;
        if (item.category) {
          desc += ` (Category: ${item.category})`;
        }
        if (item.description) {
          desc += ` - Description: ${item.description}`;
        }
        if (item.measurements) {
          const measurementsStr = Object.entries(item.measurements)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          if (measurementsStr) {
            desc += ` - Measurements: ${measurementsStr}`;
          }
        }
        return desc;
      }).join('\n');
      const selectedItemTitles = selectedItems.map(item => item.title).join(', ');
      
      // Detect items that cover the lower body to prevent redundant items
      const lowerBodyCoveringKeywords = ['overall', 'jumpsuit', 'romper', 'dress', 'onesie'];
      const hasLowerBodyCovering = selectedItems.some(item => {
        const titleLower = item.title.toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const categoryLower = (item.category || '').toLowerCase();
        return lowerBodyCoveringKeywords.some(keyword => 
          titleLower.includes(keyword) || descLower.includes(keyword) || categoryLower.includes(keyword)
        );
      });
      
      if (hasLowerBodyCovering) {
        exclusionRules = `\n\nCRITICAL EXCLUSION RULE: The selected items include a lower-body-covering garment (overalls, jumpsuit, romper, dress, etc.). DO NOT include any of the following items in the generated outfits: pants, trousers, shorts, skirts, or any other bottom-wear items. The selected lower-body-covering item already serves as the bottom piece. Only suggest tops, outerwear, shoes, accessories, and other items that complement the selected lower-body-covering item. `;
        console.log(`[LLM] Detected lower-body-covering item in selected items - excluding pants/shorts/skirts`);
      }
      
      selectedItemsContext = `CRITICAL REQUIREMENT: The user has selected these specific items that MUST be included in EVERY single generated outfit: ${selectedItemTitles}. \n\nEach of the ${generationCount} generated outfits MUST include ALL of these selected items. Do not generate any outfit without these items. Here are the selected items with full details:\n${selectedItemsDesc}\n\nGenerate ${generationCount} different outfit combinations, each one MUST include all the selected items listed above. Create variety by pairing them with different complementary pieces from the wardrobe.${exclusionRules}`;
      console.log(`[LLM] Selected items context: ${selectedItems.length} items`);
    }

    // Add prompt context if provided
    let promptContext = '';
    if (prompt) {
      promptContext = `Additional context: ${prompt}. `;
      console.log(`[LLM] Generation prompt: ${prompt}`);
    }

    // Add feedback context if provided
    let feedbackContext = '';
    if (feedback && feedback.length > 0) {
      const likes = feedback.filter(f => f.type === 'like');
      const dislikes = feedback.filter(f => f.type === 'dislike');
      
      const feedbackParts: string[] = [];
      
      if (likes.length > 0) {
        const likedItems = likes.map(f => {
          let desc = f.itemTitles.join(', ');
          if (f.feedback) {
            desc += ` (user note: ${f.feedback})`;
          }
          return desc;
        }).join('; ');
        feedbackParts.push(`User liked these outfits: ${likedItems}`);
      }
      
      if (dislikes.length > 0) {
        const dislikedItems = dislikes.map(f => {
          let desc = f.itemTitles.join(', ');
          if (f.feedback) {
            desc += ` (user note: ${f.feedback})`;
          }
          return desc;
        }).join('; ');
        feedbackParts.push(`User disliked these outfits: ${dislikedItems}`);
      }
      
      if (feedbackParts.length > 0) {
        feedbackContext = `User feedback on previous outfits: ${feedbackParts.join('. ')}. Use this feedback to generate better outfits that align with user preferences. `;
        console.log(`[LLM] Including ${feedback.length} feedback entries (${likes.length} likes, ${dislikes.length} dislikes)`);
      }
    }

    if (dislikedCombinationSummaries.length > 0) {
      feedbackContext += ` The user previously disliked these outfit combinations or scenarios: ${dislikedCombinationSummaries.join(' | ')}. Use this feedback to adjust pairings, styling, or supporting pieces while keeping the referenced items available for fresh interpretations.`;
    }

    if (dislikeInstructions.length > 0) {
      feedbackContext += ` Additional dislike notes to consider: ${dislikeInstructions.map(text => `"${text}"`).join(' ')}. Address these concerns through styling choices or complementary items rather than removing the referenced pieces outright.`;
    }

    // Build a list of all exact item titles for reference
    const allExactTitles = Object.values(itemsByCategory).flat().map(item => item.title).join(', ');

    console.log('[LLM] Calling OpenAI API for outfit generation...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion stylist.${selectedList.length === 0 && anchorPlan.length > 0 ? ` These anchor pieces MUST appear in their respective outfits:
          ${anchorPlan.map((anchor, index) => {
            const anchorCategory = anchor.anchorItem.category || anchor.category;
            return `Outfit ${index + 1}: "${anchor.anchorItem.title}" (${anchorCategory}) is the hero and must be included verbatim.`;
          }).join(' ')}` : ''}

          Generate ${generationCount} outfit combinations using the available wardrobe items. 
          Each outfit can include up to 10 pieces. You can include multiple items from the same category (e.g., multiple jewelry pieces, multiple jacket layers). 
          Pay close attention to the user's style preferences and personal aesthetic when creating combinations.
          
          CRITICAL: You MUST use the EXACT item titles as provided in the wardrobe list. Do NOT modify, shorten, or paraphrase item titles. 
          For example, if the wardrobe has "Rick Owens Black Blazer", you must use exactly "Rick Owens Black Blazer" - NOT "Black Blazer" or "Rick Owens Blazer".
          The item titles in your "items" array must match EXACTLY (case-sensitive) with the titles provided in the wardrobe.
          
          VARIETY REQUIREMENT: Create VARIETY across the ${generationCount} outfits. Do NOT use the same item in every outfit unless:
          1. The user explicitly selected that item (then it MUST appear in all outfits)
          2. It's the only item available in that category (then it's acceptable to repeat)
          Otherwise, vary the items across outfits - use different tops, different bottoms, different shoes, etc. to create diverse outfit combinations.
          
          DUPLICATE CONTROL:
          - Limit outfits to a single bag and a single pair of shoes unless the user explicitly selected duplicates.
          - Layering bottoms (e.g., skirt over pants) or outerwear is allowed only when the styling is intentional—describe why the layering matters.
          - Multiple accessories are acceptable when they serve distinct purposes (e.g., hair clip plus earrings), but avoid redundant pieces that feel duplicative without justification.
          
          ${coreCategoryInstruction}
          
          FEEDBACK COMPLIANCE:
          - Interpret user dislike feedback in context. Avoid recreating the exact combinations, pairings, or styling choices they rejected, but feel free to reuse the individual items when you can address their concerns through new styling or supporting pieces.
          - If the user asked to avoid certain descriptors for a scenario (e.g., "no platform boots for a family lunch"), respect that scenario-specific restriction while keeping the items available for other contexts.
          
          For each outfit, provide:
          1. A list of item titles (up to 10 pieces) - MUST be exact matches from the wardrobe
          2. A justification explaining why you chose this specific combination
          3. Styling suggestions (e.g., "wear blazer half buttoned", "wear hair in bun", "light makeup", "tuck in shirt", "cuff the sleeves")
          Return the outfits as a JSON object with a key "outfits" containing an array of objects, where each object has:
          - "items": array of item titles (up to 10 pieces) - MUST be exact matches from the wardrobe list
          - "justification": string explaining why this combination works
          - "stylingSuggestions": array of styling tips (e.g., ["wear blazer half buttoned", "wear hair in bun", "light makeup"])
          Example format: {"outfits": [{"items": ["Blue Shirt", "Black Jeans", "White Sneakers"], "justification": "This combination creates a casual yet polished look...", "stylingSuggestions": ["tuck in shirt", "cuff the sleeves"]}, ...]}
          Only return the JSON object, no other text.`
        },
        {
          role: 'user',
          content: `${userContext}${selectedItemsContext}${anchorContext}${promptContext}${feedbackContext}${coreCategoryInstruction}${selectedList.length === 0 && anchorPlan.length > 0 ? `\n\nRemember: Outfit numbers ${anchorPlan.map((_, index) => index + 1).join(', ')} must include their anchor piece exactly as listed above.` : ''}\n\nGenerate outfit combinations from these items:\n${itemsDescription}\n\nCRITICAL REQUIREMENT - EXACT TITLE MATCHING: You MUST use the EXACT item titles as listed above. Do NOT modify, shorten, abbreviate, or paraphrase any item titles. Copy the titles EXACTLY as they appear in the wardrobe list above. For example, if the list shows "Rick Owens Black Blazer", you must use exactly "Rick Owens Black Blazer" in your items array - NOT "Black Blazer", "Rick Owens Blazer", or any variation.\n\nHere are all available item titles for reference (use these EXACT titles only):\n${allExactTitles}\n\nVARIETY REQUIREMENT: Create VARIETY across the ${generationCount} outfits. Do NOT use the same item in every outfit unless:
1. The user explicitly selected that item (then it MUST appear in all outfits)
2. It's the only item available in that category (then it's acceptable to repeat)

Otherwise, vary the items across outfits - use different tops, different bottoms, different shoes, different outerwear, etc. Each outfit should feel unique and different from the others. Only repeat items if they were explicitly selected by the user or if there's only one option in that category.\n\nConsider the user's body measurements, style preferences, and the detailed descriptions of each item when creating stylish and well-fitting outfit combinations that match their personal aesthetic. Each outfit can include up to 10 pieces and can include multiple items from the same category (e.g., multiple jewelry pieces, layered jackets). For each outfit, explain why you chose this combination and provide specific styling suggestions. ${selectedItems && selectedItems.length > 0 ? `MANDATORY: Every single one of the ${generationCount} generated outfits MUST include ALL of these selected items: ${selectedItems.map(i => i.title).join(', ')}. This is a requirement - do not generate any outfit that does not include all selected items.` : ''}${exclusionRules} ${prompt ? 'Pay special attention to the additional context provided above.' : ''} ${feedback && feedback.length > 0 ? 'Use the user feedback to avoid creating similar outfits to ones they disliked and to create more outfits similar to ones they liked.' : ''} ${anchorPlan.length > 0 ? 'For internal guidance only: keep the array order aligned with the anchor items listed above (Outfit 1 aligns with the first anchor, Outfit 2 with the second, etc.), include each anchor item, and highlight it as the hero piece without revealing that it was pre-selected.' : ''}Return a JSON object with an "outfits" key containing an array of outfit objects, each with "items", "justification", and "stylingSuggestions". Generate exactly ${generationCount} outfit combinations. Remember: Use EXACT item titles from the list above - no modifications, abbreviations, or variations. Create VARIETY - do not repeat the same items across all outfits unless they were selected or are the only option.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.45,
      response_format: { type: 'json_object' }
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('[LLM] No response content from API');
      throw new Error('No response from LLM');
    }

    console.log(`[LLM] Response length: ${content.length} characters`);
    
    // Try to parse the response
    let outfits: GeneratedOutfit[];
    try {
      const parsed = JSON.parse(content);
      // Handle both { "outfits": [...] } and direct array formats
      if (Array.isArray(parsed)) {
        // Convert old format to new format
        outfits = parsed.map((outfit: any) => {
          if (typeof outfit === 'object' && outfit.items) {
            // Already in new format
            return {
              items: outfit.items || [],
              justification: outfit.justification || 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: outfit.stylingSuggestions || []
            };
          } else if (Array.isArray(outfit)) {
            // Old format - array of strings
            return {
              items: outfit,
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          } else {
            return {
              items: [],
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          }
        });
        console.log('[LLM] Parsed as direct array');
      } else if (parsed.outfits && Array.isArray(parsed.outfits)) {
        outfits = parsed.outfits.map((outfit: any) => {
          if (typeof outfit === 'object' && outfit.items) {
            // New format
            return {
              items: outfit.items || [],
              justification: outfit.justification || 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: outfit.stylingSuggestions || []
            };
          } else if (Array.isArray(outfit)) {
            // Old format - array of strings
            return {
              items: outfit,
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          } else {
            return {
              items: [],
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          }
        });
        console.log('[LLM] Parsed as object with outfits key');
      } else {
        throw new Error('Unexpected response format');
      }
      console.log(`[LLM] Successfully parsed ${outfits.length} outfits`);
    } catch (parseError) {
      // Fallback: try to extract outfit combinations from text
      console.error('[LLM] Error parsing LLM response:', parseError);
      if (parseError instanceof Error) {
        console.error('[LLM] Parse error details:', parseError.message);
      }
      console.log('[LLM] Using fallback outfit generation');
      return fallbackRunner();
    }

    const allItemTitles = allItemsList.map(item => item.title);
    const beforeFilter = outfits.length;

    outfits = outfits.map(outfit => {
      const canonicalTitles: string[] = [];
      const seen = new Set<string>();
      for (const title of outfit.items || []) {
        const item = allItemsMap.get(normalizeTitleKey(title));
        if (!item) {
          console.log(`[LLM] Removing unknown item from outfit: ${title}`);
          continue;
        }
        const canonicalTitle = item.title;
        const key = normalizeTitleKey(canonicalTitle);
        if (seen.has(key)) {
          continue;
        }
        if (shouldAvoidTitle(canonicalTitle)) {
          console.log(`[LLM] Removing item due to dislike feedback: ${canonicalTitle}`);
          continue;
        }
        seen.add(key);
        canonicalTitles.push(canonicalTitle);
      }
      return {
        ...outfit,
        items: canonicalTitles,
      };
    });

    if (anchorPlan.length > 0) {
      outfits = outfits.map((outfit, index) => {
        const anchor = anchorPlan[index];
        if (!anchor) {
          return outfit;
        }
        const hasAnchor = outfit.items.includes(anchor.anchorItem.title);
        if (hasAnchor) {
          return outfit;
        }
        console.log(`[LLM] Injecting missing anchor item "${anchor.anchorItem.title}" into outfit ${index + 1}`);
        const deduped = [anchor.anchorItem.title, ...outfit.items.filter(item => item !== anchor.anchorItem.title)].slice(0, 10);
        return {
          ...outfit,
          items: deduped,
        };
      });
    }

    if (selectedList.length > 0) {
      const lowerBodyCoveringKeywords = ['overall', 'jumpsuit', 'romper', 'onesie', 'dress', 'dresses'];
      const hasLowerBodyCovering = selectedList.some(item => {
        const titleLower = item.title.toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const categoryLower = (item.category || '').toLowerCase();
        return lowerBodyCoveringKeywords.some(keyword =>
          titleLower.includes(keyword) || descLower.includes(keyword) || categoryLower.includes(keyword)
        );
      });

      if (hasLowerBodyCovering) {
        const redundantKeywords = ['pant', 'pants', 'trouser', 'trousers', 'short', 'shorts', 'skirt', 'skirts', 'dress'];
        outfits = outfits.map(outfit => ({
          ...outfit,
          items: outfit.items.filter(itemTitle => {
            const itemKey = normalizeTitleKey(itemTitle);
            if (selectedTitleKeys.has(itemKey)) {
              return true;
            }
            const isRedundant = redundantKeywords.some(keyword => itemTitle.toLowerCase().includes(keyword));
            if (isRedundant) {
              console.log(`[LLM] Filtering out redundant item: ${itemTitle} (conflicts with lower-body-covering selected item)`);
            }
            return !isRedundant;
          })
        }));
        console.log('[LLM] Post-processed outfits to remove redundant bottom-wear items');
      }
    }

    const categoryRotationIndex: Record<CoreCategory, number> = {
      tops: 0,
      bottoms: 0,
      shoes: 0,
      accessories: 0,
    };

    const pickItemForCategory = (category: CoreCategory, usedNormalized: Set<string>): WardrobeItem | null => {
      const pool = itemsByCoreCategory[category];
      if (!pool || pool.length === 0) {
        return null;
      }
      for (let offset = 0; offset < pool.length; offset++) {
        const index = (categoryRotationIndex[category] + offset) % pool.length;
        const candidate = pool[index];
        const key = normalizeTitleKey(candidate.title);
        if (usedNormalized.has(key)) {
          continue;
        }
        if (shouldAvoidTitle(candidate.title)) {
          continue;
        }
        categoryRotationIndex[category] = (index + 1) % pool.length;
        return candidate;
      }
      return null;
    };

    const enrichOutfitWithCoreCategories = (outfit: GeneratedOutfit): { outfit: GeneratedOutfit; valid: boolean } => {
      const usedNormalized = new Set<string>();
      const enrichedItems: string[] = [];

      selectedList.forEach(item => {
        const key = normalizeTitleKey(item.title);
        if (!usedNormalized.has(key)) {
          enrichedItems.push(item.title);
          usedNormalized.add(key);
        }
      });

      (outfit.items || []).forEach(title => {
        const item = allItemsMap.get(normalizeTitleKey(title));
        if (!item) {
          return;
        }
        const key = normalizeTitleKey(item.title);
        if (usedNormalized.has(key)) {
          return;
        }
        enrichedItems.push(item.title);
        usedNormalized.add(key);
      });

      const counts: Record<CoreCategory, number> = { tops: 0, bottoms: 0, shoes: 0, accessories: 0 };
      enrichedItems.forEach(title => {
        const item = allItemsMap.get(normalizeTitleKey(title));
        if (!item) {
          return;
        }
        const flags = getCoreCategoryFlags(item, item.title);
        if (flags.length === 0) {
          return;
        }
        flags.forEach(flag => {
          counts[flag] = (counts[flag] || 0) + 1;
        });
      });

      for (const category of coreCategoriesRequired) {
        if (counts[category] === 0) {
          const addedItem = pickItemForCategory(category, usedNormalized);
          if (!addedItem) {
            return { outfit: { ...outfit, items: enrichedItems }, valid: false };
          }
          const key = normalizeTitleKey(addedItem.title);
          if (!usedNormalized.has(key)) {
            enrichedItems.push(addedItem.title);
            usedNormalized.add(key);
            const flags = getCoreCategoryFlags(addedItem, addedItem.title);
            flags.forEach(flag => {
              counts[flag] = (counts[flag] || 0) + 1;
            });
          }
        }
      }

      const uniqueItems = Array.from(new Set(enrichedItems)).slice(0, 10);
      const finalCounts: Record<CoreCategory, number> = { tops: 0, bottoms: 0, shoes: 0, accessories: 0 };
      uniqueItems.forEach(title => {
        const item = allItemsMap.get(normalizeTitleKey(title));
        if (!item) {
          return;
        }
        const flags = getCoreCategoryFlags(item, item.title);
        flags.forEach(flag => {
          finalCounts[flag] = (finalCounts[flag] || 0) + 1;
        });
      });

      const valid = coreCategoriesRequired.every(category => finalCounts[category] > 0);
      return { outfit: { ...outfit, items: uniqueItems }, valid };
    };

    const processedOutfits: GeneratedOutfit[] = [];
    outfits.forEach((outfit, index) => {
      const result = enrichOutfitWithCoreCategories(outfit);
      if (result.valid) {
        processedOutfits.push(result.outfit);
      } else {
        console.warn(`[LLM] Outfit ${index + 1} failed core category requirements and will be discarded.`);
      }
    });

    outfits = processedOutfits;

    if (outfits.length < targetOutfitCount) {
      console.warn(`[LLM] Only ${outfits.length} valid outfits after enforcement. Supplementing with fallback outfits.`);
      const fallbackOutfits = fallbackRunner();
      for (const fallbackOutfit of fallbackOutfits) {
        if (outfits.length >= targetOutfitCount) {
          break;
        }
        const result = enrichOutfitWithCoreCategories(fallbackOutfit);
        if (result.valid) {
          outfits.push(result.outfit);
        }
      }
    }

    outfits = outfits
      .map(outfit => ({
        ...outfit,
        items: outfit.items
          .filter(title => allItemTitles.includes(title))
          .slice(0, 10)
      }))
      .filter(outfit => {
        const counts: Record<CoreCategory, number> = { tops: 0, bottoms: 0, shoes: 0, accessories: 0 };
        outfit.items.forEach(title => {
          const item = allItemsMap.get(normalizeTitleKey(title));
          if (!item) {
            return;
          }
          const flags = getCoreCategoryFlags(item, item.title);
          flags.forEach(flag => {
            counts[flag] = (counts[flag] || 0) + 1;
          });
        });
        return coreCategoriesRequired.every(category => counts[category] > 0);
      });
    
    if (beforeFilter !== outfits.length) {
      console.log(`[LLM] Filtered outfits: ${beforeFilter} -> ${outfits.length}`);
    }

    if (outfits.length > targetOutfitCount) {
      const computeSimilarityScore = (generatedIds: Set<string>): number => {
        if (generatedIds.size === 0 || savedOutfitIdSets.length === 0) {
          return 0;
        }
        let worstSimilarity = 0;
        savedOutfitIdSets.forEach(savedSet => {
          let intersection = 0;
          generatedIds.forEach(id => {
            if (savedSet.has(id)) {
              intersection += 1;
            }
          });
          if (intersection === 0) {
            return;
          }
          const union = generatedIds.size + savedSet.size - intersection;
          if (union === 0) {
            return;
          }
          const similarity = intersection / union;
          if (similarity > worstSimilarity) {
            worstSimilarity = similarity;
          }
        });
        return worstSimilarity;
      };

      const outfitsWithScores = outfits.map((outfit, index) => {
        const idSet = new Set<string>();
        let shoeCount = 0;
        let bottomCount = 0;
        outfit.items.forEach(title => {
          const item = allItemsMap.get(normalizeTitleKey(title));
          if (item?.id) {
            idSet.add(item.id);
          }
          if (item) {
            const flags = getCoreCategoryFlags(item, item.title);
            if (flags.includes('shoes')) {
              shoeCount += 1;
            }
            if (flags.includes('bottoms')) {
              bottomCount += 1;
            }
          }
        });
        const similarity = computeSimilarityScore(idSet);
        const duplicatePenalty =
          (shoeCount > 1 ? 1 : 0) +
          (bottomCount > 1 ? 1 : 0);
        return {
          outfit,
          similarity: similarity + duplicatePenalty,
          index,
        };
      });

      if (savedOutfitIdSets.length > 0) {
        outfitsWithScores.forEach(entry => {
          console.log(
            `[Similarity] Outfit ${entry.index + 1} similarity score: ${entry.similarity.toFixed(3)}`
          );
        });
      }

      outfitsWithScores.sort((a, b) => {
        if (a.similarity === b.similarity) {
          return a.index - b.index;
        }
        return a.similarity - b.similarity;
      });

      const pruned = outfitsWithScores
        .slice(0, targetOutfitCount)
        .map(entry => entry.outfit);

      if (pruned.length < targetOutfitCount) {
        console.warn(
          `[Similarity] Only ${pruned.length} outfits remained after similarity pruning (requested ${targetOutfitCount}).`
        );
      } else if (outfitsWithScores.length !== pruned.length) {
        console.log(
          `[Similarity] Pruned outfits from ${outfitsWithScores.length} to ${pruned.length} for lowest similarity to saved outfits.`
        );
      }

      outfits = pruned;
    }

    if (outfits.length === 0) {
      console.log('[LLM] No valid outfits generated, using fallback');
      return fallbackRunner();
    }
    
    console.log(`[LLM] Successfully generated ${outfits.length} outfit combinations`);
    outfits.forEach((outfit, index) => {
      console.log(`[LLM]   Outfit ${index + 1}: ${outfit.items.join(' + ')}`);
      console.log(`[LLM]     Justification: ${outfit.justification.substring(0, 100)}...`);
      console.log(`[LLM]     Styling suggestions: ${outfit.stylingSuggestions.length} tips`);
    });
    
    return outfits;
  } catch (error) {
    console.error('[LLM] Error generating outfits:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    console.log('[LLM] Using fallback outfit generation');
    return fallbackRunner();
  }
}

export interface ExploreSuggestion {
  title: string;
  category: string;
  description: string;
  brand?: string; // Brand or store name
  pairsWellWith: string[];
}

export async function generateExploreSuggestions(
  wardrobeItems: WardrobeItem[],
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string; brands?: string[]; hairColor?: string; hairTexture?: string; skinColor?: string },
  feedback?: OutfitFeedback[]
): Promise<ExploreSuggestion[]> {
  if (!openai) {
    console.warn('[LLM] OpenAI API key missing, skipping explore suggestions generation');
    return [];
  }
  try {
    console.log('[LLM] Starting explore suggestions generation...');
    
    // Group items by category
    const itemsByCategory = wardrobeItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);

    // Build wardrobe summary
    const categorySummary = Object.entries(itemsByCategory)
      .map(([category, items]) => `${category}: ${items.length} items (${items.map(i => i.title).join(', ')})`)
      .join('\n');

    const allItemTitles = wardrobeItems.map(item => item.title).join(', ');
    
    // Build user profile context
    let userContext = '';
    if (userProfile) {
      const contextParts: string[] = [];
      
      if (userProfile.height && userProfile.weight) {
        contextParts.push(`Height ${userProfile.height} ${userProfile.heightUnit || 'inches'}, Weight ${userProfile.weight} ${userProfile.weightUnit || 'lbs'}`);
      }
      
      if (userProfile.stylePreferences) {
        contextParts.push(`Style preferences: ${userProfile.stylePreferences}`);
      }
      
      if (userProfile.brands && userProfile.brands.length > 0) {
        contextParts.push(`Favorite brands: ${userProfile.brands.join(', ')}`);
      }
      
      // Appearance details
      const appearanceParts: string[] = [];
      if (userProfile.hairColor) {
        appearanceParts.push(`hair color: ${userProfile.hairColor}`);
      }
      if (userProfile.hairTexture) {
        appearanceParts.push(`hair texture: ${userProfile.hairTexture}`);
      }
      if (userProfile.skinColor) {
        appearanceParts.push(`skin color: ${userProfile.skinColor}`);
      }
      if (appearanceParts.length > 0) {
        contextParts.push(`Appearance: ${appearanceParts.join(', ')}`);
      }
      
      if (contextParts.length > 0) {
        userContext = `User profile: ${contextParts.join('. ')}. `;
      }
    }

    // Add feedback context if provided
    let feedbackContext = '';
    if (feedback && feedback.length > 0) {
      const likes = feedback.filter(f => f.type === 'like');
      const dislikes = feedback.filter(f => f.type === 'dislike');
      
      const feedbackParts: string[] = [];
      
      if (likes.length > 0) {
        const likedItems = likes.map(f => f.itemTitles.join(', ')).join('; ');
        feedbackParts.push(`User liked outfits with: ${likedItems}`);
      }
      
      if (dislikes.length > 0) {
        const dislikedItems = dislikes.map(f => f.itemTitles.join(', ')).join('; ');
        feedbackParts.push(`User disliked outfits with: ${dislikedItems}`);
      }
      
      if (feedbackParts.length > 0) {
        feedbackContext = `User feedback: ${feedbackParts.join('. ')}. `;
      }
    }

    console.log('[LLM] Calling OpenAI API for explore suggestions...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion stylist and wardrobe consultant. Analyze the user's wardrobe and identify gaps or missing pieces that would enhance their style. Suggest specific items that would complement their existing wardrobe and match their style preferences. When suggesting brands, consider the user's favorite brands and suggest items similar in style/aesthetic to those brands, but don't limit yourself to only those brands. Return suggestions as a JSON object with a key "suggestions" containing an array of objects, each with: "title" (specific item name, e.g., "Black Leather Ankle Boots", "Oversized White Button-Down Shirt"), "category" (from: ${CATEGORIES.join(', ')}), "description" (detailed description of the item including color, style, fit, etc.), "brand" (brand or store name where this item could be found - can be the exact brand if appropriate, or "similar to X brand" to indicate items with similar aesthetic to user's favorite brands, e.g., "Rick Owens", "similar to Rick Owens", "Zara", "Everlane", "Vintage"), and "pairsWellWith" (array of 2-4 existing wardrobe item titles it would pair well with). Do NOT include "link" or "imageUrl" fields - these will be generated automatically. Generate up to 9 suggestions.`
        },
        {
          role: 'user',
          content: `${userContext}${feedbackContext}Analyze this wardrobe and suggest items that would fill gaps or enhance the collection:\n\nCurrent wardrobe:\n${categorySummary}\n\nAll items: ${allItemTitles}\n\nBased on the user's style preferences, favorite brands, and existing wardrobe, suggest up to 9 specific items that would complement their collection. When suggesting brands, consider the user's favorite brands and suggest items with similar aesthetic/style to those brands (you can say "similar to [brand name]" if suggesting a different brand with similar aesthetic, or use the exact brand name if appropriate). For each suggestion, provide: a specific item name (e.g., "Black Leather Ankle Boots" not just "boots"), a detailed description including color, style, and fit, a brand/store name where this item could be found (be specific with designer names or stores that match the user's style, or use "similar to [brand]" format), and list 2-4 existing wardrobe items it would pair well with. Do NOT include links or image URLs - these will be generated automatically. Return a JSON object with a "suggestions" key containing an array of suggestion objects.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('[LLM] No response content from API');
      throw new Error('No response from LLM');
    }

    console.log(`[LLM] Response length: ${content.length} characters`);
    
    // Parse the response
    let suggestions: ExploreSuggestion[];
    try {
      const parsed = JSON.parse(content);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
        // Validate and limit to 9
        suggestions = suggestions
          .filter(s => s.title && s.category && s.description && Array.isArray(s.pairsWellWith))
          .slice(0, 9);
        
        // Validate pairsWellWith items exist in wardrobe
        suggestions = suggestions.map(s => ({
          ...s,
          pairsWellWith: s.pairsWellWith.filter(title => allItemTitles.includes(title)).slice(0, 4)
        })).filter(s => s.pairsWellWith.length > 0);
        
        console.log(`[LLM] Successfully parsed ${suggestions.length} suggestions`);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (parseError) {
      console.error('[LLM] Error parsing LLM response:', parseError);
      if (parseError instanceof Error) {
        console.error('[LLM] Parse error details:', parseError.message);
      }
      throw new Error('Failed to parse suggestions');
    }

    return suggestions;
  } catch (error) {
    console.error('[LLM] Error generating explore suggestions:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    throw error;
  }
}

function generateFallbackOutfits(
  itemsByCoreCategory: Record<CoreCategory, WardrobeItem[]>,
  coreCategoriesRequired: CoreCategory[],
  allItemsMap: Map<string, WardrobeItem>,
  options: {
    normalizeTitleKey: (title: string) => string;
    shouldAvoidTitle: (title: string) => boolean;
    selectedItems: WardrobeItem[];
    anchorItems?: WardrobeItem[];
  },
  maxOutfits = 5
): GeneratedOutfit[] {
  console.log('[LLM] Generating fallback outfits...');
  
  const outfits: GeneratedOutfit[] = [];
  if (coreCategoriesRequired.some(category => (itemsByCoreCategory[category] || []).length === 0)) {
    console.log('[LLM] Not enough category coverage for fallback outfits');
    return outfits;
  }

  const selectedNormalized = new Set<string>(
    options.selectedItems.map(item => options.normalizeTitleKey(item.title))
  );

  const categoryRotationIndex: Record<CoreCategory, number> = {
    tops: 0,
    bottoms: 0,
    shoes: 0,
    accessories: 0,
  };

  const pickFromCategory = (category: CoreCategory, usedNormalized: Set<string>): WardrobeItem | null => {
    const pool = itemsByCoreCategory[category];
    if (!pool || pool.length === 0) {
      return null;
    }

    for (let offset = 0; offset < pool.length; offset++) {
      const index = (categoryRotationIndex[category] + offset) % pool.length;
      const candidate = pool[index];
      const key = options.normalizeTitleKey(candidate.title);
      if (usedNormalized.has(key)) {
        continue;
      }
      if (selectedNormalized.has(key)) {
        continue;
      }
      if (options.shouldAvoidTitle(candidate.title)) {
        continue;
      }
      categoryRotationIndex[category] = (index + 1) % pool.length;
      return candidate;
    }

    return null;
  };

  for (let i = 0; i < maxOutfits; i++) {
    const usedNormalized = new Set<string>();
    const items: string[] = [];

    options.selectedItems.forEach(item => {
      const key = options.normalizeTitleKey(item.title);
      if (!usedNormalized.has(key)) {
        items.push(item.title);
        usedNormalized.add(key);
      }
    });

    const anchorItem = options.anchorItems?.[i];
    if (anchorItem) {
      const key = options.normalizeTitleKey(anchorItem.title);
      if (!usedNormalized.has(key)) {
        items.push(anchorItem.title);
        usedNormalized.add(key);
      }
    }

    const counts: Record<CoreCategory, number> = { tops: 0, bottoms: 0, shoes: 0, accessories: 0 };
    items.forEach(title => {
      const item = allItemsMap.get(options.normalizeTitleKey(title));
      if (!item) {
        return;
      }
      const flags = getCoreCategoryFlags(item, item.title);
      flags.forEach(flag => {
        counts[flag] = (counts[flag] || 0) + 1;
      });
    });

    let valid = true;
    for (const category of coreCategoriesRequired) {
      if (counts[category] === 0) {
        const candidate = pickFromCategory(category, usedNormalized);
        if (!candidate) {
          valid = false;
          break;
        }
        const key = options.normalizeTitleKey(candidate.title);
        items.push(candidate.title);
        usedNormalized.add(key);
        const flags = getCoreCategoryFlags(candidate, candidate.title);
        flags.forEach(flag => {
          counts[flag] = (counts[flag] || 0) + 1;
        });
      }
    }

    if (!valid) {
      continue;
    }

    const uniqueItems = Array.from(new Set(items)).slice(0, 10);
    const justification = `Essential look featuring ${coreCategoriesRequired
      .map(category => {
        const count = uniqueItems.filter(title => {
          const item = allItemsMap.get(options.normalizeTitleKey(title));
          if (!item) {
            return false;
          }
          const flags = getCoreCategoryFlags(item, item.title);
          return flags.includes(category);
        }).length;
        const label = category.charAt(0).toUpperCase() + category.slice(1);
        return `${count} ${label}${count === 1 ? '' : 's'}`;
      })
      .join(', ')}`;

    outfits.push({
      items: uniqueItems,
      justification,
      stylingSuggestions: ['Mix and match layers, adjust proportions, and coordinate accessories for balance.'],
    });
  }
  
  console.log(`[LLM] Generated ${outfits.length} fallback outfits`);
  return outfits;
}

export const __test__ = {
  selectAnchorItems,
  createSeededRandom,
  generateFallbackOutfits,
};
