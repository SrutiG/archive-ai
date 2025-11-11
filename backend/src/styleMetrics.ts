import type { AdminOutfitItemSummary } from './adminTypes';
import type { StyleMetrics } from './styleMetricsTypes';

export interface StyleMetricsSourceItem {
  id?: string;
  category?: string;
  subCategory?: string;
  colors?: string[] | null;
  pattern?: string | null;
  silhouettes?: string[] | null;
  fit?: string | null;
  styleTags?: string[] | null;
  description?: string | null;
}

export type BasicWardrobeItem = StyleMetricsSourceItem;

const TOP_CATEGORY_CANDIDATES = new Set([
  'tops',
  'outerwear',
  'jackets',
  'coats',
  'knits',
  'sweaters',
  'blazers',
  'dresses',
]);

const BOTTOM_CATEGORY_CANDIDATES = new Set([
  'bottoms',
  'pants',
  'jeans',
  'skirts',
  'shorts',
  'leggings',
  'joggers',
  'dresses',
]);

const FIT_KEYWORDS = [
  { token: 'oversized', label: 'oversized' },
  { token: 'boxy', label: 'boxy' },
  { token: 'cropped', label: 'cropped' },
  { token: 'relaxed', label: 'relaxed' },
  { token: 'loose', label: 'relaxed' },
  { token: 'slim', label: 'fitted' },
  { token: 'fitted', label: 'fitted' },
  { token: 'tailored', label: 'tailored' },
  { token: 'wide', label: 'wide' },
  { token: 'flare', label: 'wide' },
  { token: 'skinny', label: 'fitted' },
];

const LINE_KEYWORDS: Array<{ tokens: string[]; line: string }> = [
  { tokens: ['shoulder', 'structured'], line: 'structured_shoulders' },
  { tokens: ['cropped'], line: 'cropped_top' },
  { tokens: ['wide', 'flare', 'flared'], line: 'wide_leg_volume' },
  { tokens: ['pleat', 'pleated'], line: 'pleated_detail' },
  { tokens: ['drape', 'draped'], line: 'draped_lines' },
  { tokens: ['column'], line: 'column_silhouette' },
  { tokens: ['funnel'], line: 'funnel_shape' },
];

const PATTERN_KEYWORDS = ['print', 'pattern', 'plaid', 'stripe', 'striped', 'polka', 'check', 'floral'];

export function computeStyleMetrics(items: Array<StyleMetricsSourceItem>): StyleMetrics {
  if (!items || items.length === 0) {
    return {
      overallShape: 'balanced',
      fitProfile: 'balanced_balanced',
      volumeDistribution: { top: 0.5, bottom: 0.5 },
      dominantLines: [],
      colorExperimentationIndex: 0,
      numberOfColors: 0,
      numberOfPatterns: 0,
    };
  }

  const topItems: StyleMetricsSourceItem[] = [];
  const bottomItems: StyleMetricsSourceItem[] = [];

  items.forEach(item => {
    const category = (item.category || '').toLowerCase();
    if (TOP_CATEGORY_CANDIDATES.has(category)) {
      topItems.push(item);
    }
    if (BOTTOM_CATEGORY_CANDIDATES.has(category)) {
      bottomItems.push(item);
    }
  });

  const allColorSet = new Set<string>();
  let patternCount = 0;

  const addColors = (colors?: string[] | null) => {
    if (!Array.isArray(colors)) {
      return;
    }
    colors.forEach(color => {
      if (typeof color === 'string' && color.trim().length > 0) {
        allColorSet.add(color.trim().toLowerCase());
      }
    });
  };

  const getFitScore = (item: StyleMetricsSourceItem): number => {
    const fit = (item.fit || '').toLowerCase();
    const tags = (item.styleTags || []).map(tag => tag.toLowerCase());
    const silhouettes = (item.silhouettes || []).map(s => s.toLowerCase());
    let score = 1;
    if (FIT_KEYWORDS.some(({ token }) => fit.includes(token))) {
      score += 0.4;
    }
    if (tags.some(tag => tag.includes('oversized') || tag.includes('relaxed'))) {
      score += 0.3;
    }
    if (silhouettes.some(sil => sil.includes('wide') || sil.includes('a-line'))) {
      score += 0.3;
    }
    if (fit.includes('slim') || fit.includes('skinny')) {
      score -= 0.2;
    }
    if (fit.includes('cropped')) {
      score -= 0.1;
    }
    return Math.max(0.4, score);
  };

  const aggregateFitDescriptor = (relevant: StyleMetricsSourceItem[], fallback: string): string => {
    if (relevant.length === 0) {
      return fallback;
    }
    const counts = new Map<string, number>();
    relevant.forEach(item => {
      const source = `${item.fit || ''} ${(item.styleTags || []).join(' ')} ${(item.silhouettes || []).join(' ')}`.toLowerCase();
      FIT_KEYWORDS.forEach(({ token, label }) => {
        if (source.includes(token)) {
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
      });
    });
    if (counts.size === 0) {
      return fallback;
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
  };

  let topVolume = 0;
  let bottomVolume = 0;

  topItems.forEach(item => {
    topVolume += getFitScore(item);
  });
  bottomItems.forEach(item => {
    bottomVolume += getFitScore(item);
  });

  if (topVolume === 0 && bottomVolume === 0) {
    topVolume = bottomVolume = items.length / 2;
  }

  const totalVolume = topVolume + bottomVolume || 1;
  const topShare = topVolume / totalVolume;
  const bottomShare = bottomVolume / totalVolume;

  let overallShape: string;
  if (topShare >= bottomShare + 0.15) {
    overallShape = 'inverted_triangle';
  } else if (bottomShare >= topShare + 0.15) {
    overallShape = 'triangle';
  } else {
    overallShape = 'balanced';
  }

  const topFit = aggregateFitDescriptor(topItems, 'balanced');
  const bottomFit = aggregateFitDescriptor(bottomItems, 'balanced');
  const fitProfile = `${topFit}_${bottomFit}`;

  const dominantLines = new Set<string>();
  items.forEach(item => {
    const combined = `${item.fit || ''} ${(item.styleTags || []).join(' ')} ${(item.silhouettes || []).join(' ')} ${(item.description || '')}`.toLowerCase();
    LINE_KEYWORDS.forEach(({ tokens, line }) => {
      if (tokens.some(token => combined.includes(token))) {
        dominantLines.add(line);
      }
    });
    if (combined.includes('tailored') || combined.includes('structured')) {
      dominantLines.add('tailored_structure');
    }
    if (combined.includes('drape') || combined.includes('fluid')) {
      dominantLines.add('fluid_drape');
    }
  });

  items.forEach(item => {
    addColors(item.colors || []);
    const patternValue = (item.pattern || '').toLowerCase();
    if (patternValue && patternValue !== 'solid') {
      patternCount += 1;
    } else if ((item.styleTags || []).some(tag => PATTERN_KEYWORDS.some(keyword => tag.toLowerCase().includes(keyword)))) {
      patternCount += 1;
    }
  });

  const numberOfColors = allColorSet.size;
  const numberOfPatterns = patternCount;

  const colorComponent = Math.min(numberOfColors / 6, 1);
  const patternComponent = items.length > 0 ? Math.min(numberOfPatterns / items.length, 1) : 0;
  const colorExperimentationIndex = parseFloat((0.7 * colorComponent + 0.3 * patternComponent).toFixed(2));

  return {
    overallShape,
    fitProfile,
    volumeDistribution: {
      top: parseFloat(topShare.toFixed(2)),
      bottom: parseFloat(bottomShare.toFixed(2)),
    },
    dominantLines: Array.from(dominantLines),
    colorExperimentationIndex,
    numberOfColors,
    numberOfPatterns,
  };
}

export function computeMetricsFromWardrobeItems(items: BasicWardrobeItem[]): StyleMetrics {
  return computeStyleMetrics(items.map(mapGenericItemToSource));
}

export function computeMetricsFromAdminItems(items: AdminOutfitItemSummary[]): StyleMetrics {
  return computeStyleMetrics(items.map(mapAdminItemToSource));
}

function mapGenericItemToSource(item: BasicWardrobeItem): StyleMetricsSourceItem {
  return {
    id: item.id,
    category: item.category,
    subCategory: item.subCategory,
    colors: item.colors ?? null,
    pattern: item.pattern ?? null,
    silhouettes: item.silhouettes ?? null,
    fit: item.fit ?? null,
    styleTags: item.styleTags ?? null,
    description: item.description ?? null,
  };
}

function mapAdminItemToSource(item: AdminOutfitItemSummary): StyleMetricsSourceItem {
  return {
    category: item.category,
    subCategory: item.subCategory,
    colors: item.colors,
    pattern: item.pattern,
    silhouettes: item.silhouettes,
    fit: item.fit,
    styleTags: item.styleTags,
  };}
