import { v4 as uuidv4 } from 'uuid';
import { AdminWardrobeItem } from './adminTypes';
import type { WardrobeItem, WardrobePatternOption } from './index';

const BRANDS = [
  'Rick Owens',
  'Maison Margiela',
  'Ann Demeulemeester',
  'Yohji Yamamoto',
  'Comme des Garçons',
  'Issey Miyake',
  'Acne Studios',
  'Helmut Lang',
  'Raf Simons',
  'Dries Van Noten',
  'Balenciaga',
  'Dion Lee',
  'The Row',
  'Celine',
  'Loewe',
  'Bottega Veneta',
  'Prada',
  'Saint Laurent',
  'Gucci',
  'Jil Sander',
  'Marni',
  'Stella McCartney',
  'Vivienne Westwood',
  'Alexander McQueen',
  'COS',
  'Arket',
  'Everlane',
  'Reformation',
  'Aritzia',
  'Ganni',
  'Staud',
  'Nanushka',
  'Totême',
  'Vintage',
  'Thrift',
];

const COLOR_OPTIONS = [
  'black',
  'white',
  'gray',
  'navy',
  'blue',
  'green',
  'olive',
  'red',
  'burgundy',
  'pink',
  'purple',
  'yellow',
  'orange',
  'brown',
  'tan',
  'beige',
  'cream',
  'metallic',
  'multicolor',
] as const;

const FABRIC_OPTIONS = [
  'cotton',
  'linen',
  'silk',
  'wool',
  'cashmere',
  'denim',
  'leather',
  'suede',
  'knit',
  'synthetic',
  'chiffon',
  'satin',
  'velvet',
  'lace',
] as const;

const FORMALITY_OPTIONS = [
  'casual',
  'smart-casual',
  'business-casual',
  'business-formal',
  'evening',
  'formal',
  'athleisure',
] as const;

const STYLE_TAG_OPTIONS = [
  'minimalist',
  'classic',
  'modern',
  'trendy',
  'edgy',
  'boho',
  'preppy',
  'athleisure',
  'streetwear',
  'romantic',
  'feminine',
  'androgynous',
  'workwear',
  'vintage',
  'sporty',
  'heritage',
] as const;

const SEASON_OPTIONS = ['spring', 'summer', 'fall', 'winter', 'all-season'] as const;

const OCCASION_OPTIONS = [
  'work',
  'weekend',
  'date',
  'family',
  'travel',
  'party',
  'formal-event',
  'outdoor',
  'athletic',
  'lounging',
  'wedding',
] as const;

const SILHOUETTE_OPTIONS_TOPS = [
  'a-line',
  'column',
  'fit-and-flare',
  'cocoon',
  'trapeze',
  'bodycon',
  'cropped',
  'long-sleeve',
  'short-sleeve',
  'sleeveless',
  'peplum',
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
] as const;

const SILHOUETTE_OPTIONS_BOTTOMS = [
  'a-line',
  'column',
  'fit-and-flare',
  'trapeze',
  'bodycon',
  'wide-leg',
  'straight-leg',
  'cropped',
  'asymmetrical-hem',
] as const;

const SILHOUETTE_OPTIONS_DRESSES = [
  'a-line',
  'column',
  'fit-and-flare',
  'trapeze',
  'bodycon',
  'cocoon',
  'sleeveless',
  'short-sleeve',
  'long-sleeve',
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
] as const;

const FIT_OPTIONS = ['second-skin', 'slim', 'regular', 'relaxed', 'oversized', 'tailored'] as const;

const CARE_NOTES = [
  'Dry clean only',
  'Hand wash cold and lay flat to dry',
  'Machine wash cold on gentle cycle',
  'Spot clean as needed',
  'Use a garment steamer to refresh between wears',
] as const;

const ADJECTIVES = [
  'Architectural',
  'Tailored',
  'Fluid',
  'Structured',
  'Sculptural',
  'Textured',
  'Minimalist',
  'Statement',
  'Refined',
  'Effortless',
  'Vintage-inspired',
  'Modernist',
  'Polished',
  'Relaxed',
  'Cropped',
] as const;

type CategoryConfig = {
  category: string;
  subCategories: string[];
  nouns: Record<string, string[]>;
  silhouettePool?: readonly string[];
  fitPool?: readonly string[];
};

const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    category: 'Tops',
    subCategories: ['Tees', 'Button-Ups', 'Sweaters', 'Tanks & Camis', 'T-Shirts', 'Bodysuits', 'Other'],
    silhouettePool: SILHOUETTE_OPTIONS_TOPS,
    fitPool: FIT_OPTIONS,
    nouns: {
      default: ['Top', 'Blouse', 'Layer'],
      'Tees': ['Tee', 'Crewneck Tee'],
      'T-Shirts': ['T-Shirt', 'Graphic Tee'],
      'Button-Ups': ['Button-Up Shirt', 'Poplin Shirt'],
      'Sweaters': ['Sweater', 'Pullover', 'Knit'],
      'Tanks & Camis': ['Tank', 'Camisole'],
      'Bodysuits': ['Bodysuit'],
      'Other': ['Top'],
    },
  },
  {
    category: 'Outerwear',
    subCategories: ['Blazer', 'Coat', 'Jacket', 'Trench', 'Cape', 'Other'],
    silhouettePool: SILHOUETTE_OPTIONS_TOPS,
    fitPool: FIT_OPTIONS,
    nouns: {
      default: ['Jacket', 'Layer'],
      'Blazer': ['Blazer', 'Suit Jacket'],
      'Coat': ['Coat', 'Overcoat'],
      'Jacket': ['Jacket'],
      'Trench': ['Trench Coat'],
      'Cape': ['Cape'],
      'Other': ['Outer Layer'],
    },
  },
  {
    category: 'Bottoms',
    subCategories: ['Pants', 'Jeans', 'Skirt', 'Shorts', 'Leggings', 'Joggers', 'Other'],
    silhouettePool: SILHOUETTE_OPTIONS_BOTTOMS,
    fitPool: FIT_OPTIONS,
    nouns: {
      default: ['Bottom'],
      'Pants': ['Trousers', 'Pants'],
      'Jeans': ['Jeans', 'Denim'],
      'Skirt': ['Skirt'],
      'Shorts': ['Shorts'],
      'Leggings': ['Leggings'],
      'Joggers': ['Joggers'],
      'Other': ['Bottom'],
    },
  },
  {
    category: 'Dresses & One-Pieces',
    subCategories: ['Dresses', 'Jumpsuits/Rompers', 'Overalls', 'Other'],
    silhouettePool: SILHOUETTE_OPTIONS_DRESSES,
    fitPool: FIT_OPTIONS,
    nouns: {
      default: ['One-Piece'],
      'Dresses': ['Dress'],
      'Jumpsuits/Rompers': ['Jumpsuit', 'Romper'],
      'Overalls': ['Overalls'],
      'Other': ['One-Piece'],
    },
  },
  {
    category: 'Shoes',
    subCategories: ['Boots', 'Heels', 'Flats', 'Sneakers', 'Sandals', 'Loafers', 'Other'],
    nouns: {
      default: ['Shoes'],
      'Boots': ['Boots'],
      'Heels': ['Heels'],
      'Flats': ['Flats'],
      'Sneakers': ['Sneakers'],
      'Sandals': ['Sandals'],
      'Loafers': ['Loafers'],
      'Other': ['Shoes'],
    },
  },
  {
    category: 'Bags',
    subCategories: ['Tote', 'Shoulder', 'Crossbody', 'Clutch', 'Backpack', 'Belt Bag', 'Other'],
    nouns: {
      default: ['Bag'],
      'Tote': ['Tote Bag'],
      'Shoulder': ['Shoulder Bag'],
      'Crossbody': ['Crossbody Bag'],
      'Clutch': ['Clutch'],
      'Backpack': ['Backpack'],
      'Belt Bag': ['Belt Bag'],
      'Other': ['Bag'],
    },
  },
  {
    category: 'Accessories',
    subCategories: ['Belt', 'Hat', 'Scarf', 'Gloves', 'Tights', 'Socks', 'Sunglasses', 'Hair Accessory', 'Other'],
    nouns: {
      default: ['Accessory'],
      'Belt': ['Belt'],
      'Hat': ['Hat'],
      'Scarf': ['Scarf'],
      'Gloves': ['Gloves'],
      'Tights': ['Tights'],
      'Socks': ['Socks'],
      'Sunglasses': ['Sunglasses'],
      'Hair Accessory': ['Hair Clip', 'Headband'],
      'Other': ['Accessory'],
    },
  },
  {
    category: 'Jewelry',
    subCategories: ['Necklace', 'Bracelet', 'Ring', 'Earrings', 'Other'],
    nouns: {
      default: ['Jewelry'],
      'Necklace': ['Necklace'],
      'Bracelet': ['Bracelet'],
      'Ring': ['Ring'],
      'Earrings': ['Earrings'],
      'Other': ['Jewelry Piece'],
    },
  },
  {
    category: 'Underwear & Sleepwear',
    subCategories: ['Sleep Set', 'Slip', 'Robe', 'Lounge', 'Other'],
    silhouettePool: SILHOUETTE_OPTIONS_TOPS,
    fitPool: FIT_OPTIONS,
    nouns: {
      default: ['Loungewear'],
      'Sleep Set': ['Sleep Set'],
      'Slip': ['Slip Dress'],
      'Robe': ['Robe'],
      'Lounge': ['Loungewear'],
      'Other': ['Sleepwear'],
    },
  },
  {
    category: 'Swimwear',
    subCategories: ['One-Piece', 'Bikini', 'Coverup', 'Other'],
    silhouettePool: SILHOUETTE_OPTIONS_DRESSES,
    fitPool: FIT_OPTIONS,
    nouns: {
      default: ['Swimwear'],
      'One-Piece': ['One-Piece Swimsuit'],
      'Bikini': ['Bikini'],
      'Coverup': ['Cover-Up'],
      'Other': ['Swimwear'],
    },
  },
];

const CATEGORY_FABRIC_OVERRIDES: Record<string, readonly string[]> = {
  Shoes: ['leather', 'suede', 'synthetic', 'knit'],
  Bags: ['leather', 'suede', 'synthetic', 'canvas', 'denim'],
  Jewelry: ['metallic', 'synthetic'],
  Accessories: ['leather', 'suede', 'synthetic', 'knit', 'cotton', 'linen', 'silk'],
};

const CATEGORY_STYLE_TAG_OVERRIDES: Record<string, readonly string[]> = {
  Jewelry: ['minimalist', 'classic', 'modern', 'trendy', 'edgy', 'romantic', 'heritage'],
};

const SUBCATEGORY_SILHOUETTE_OVERRIDES: Record<string, readonly string[]> = {
  Tees: ['column', 'cropped', 'short-sleeve', 'long-sleeve', 'v-neck', 'crew-neck', 'scoop-neck'],
  'T-Shirts': ['column', 'cropped', 'short-sleeve', 'long-sleeve', 'v-neck', 'crew-neck', 'scoop-neck'],
  'Button-Ups': ['column', 'collared', 'collarless', 'asymmetrical-hem'],
  Sweaters: ['column', 'oversized', 'cropped', 'turtleneck', 'mock-neck', 'crew-neck', 'v-neck', 'cowl-neck', 'hooded', 'asymmetrical-hem'],
  'Tanks & Camis': ['bodycon', 'cropped', 'column', 'sleeveless', 'peplum', 'v-neck', 'scoop-neck', 'square-neck', 'sweetheart', 'halter-neck', 'cowl-neck', 'mock-neck', 'turtleneck'],
  Bodysuits: ['bodycon', 'column', 'sleeveless', 'short-sleeve', 'long-sleeve', 'v-neck', 'crew-neck', 'scoop-neck', 'square-neck', 'sweetheart', 'halter-neck', 'cowl-neck', 'mock-neck', 'turtleneck'],
  Blazer: ['column', 'cropped', 'long-sleeve', 'asymmetrical-hem', 'cocoon'],
  Coat: ['column', 'cocoon', 'trapeze', 'long-sleeve', 'asymmetrical-hem', 'hooded'],
  Jacket: ['column', 'cropped', 'long-sleeve', 'short-sleeve', 'hooded', 'asymmetrical-hem'],
  Trench: ['column', 'cocoon', 'long-sleeve', 'asymmetrical-hem'],
  Cape: ['cocoon', 'trapeze', 'asymmetrical-hem'],
  Pants: ['wide-leg', 'straight-leg', 'cropped', 'column', 'bodycon', 'asymmetrical-hem'],
  Jeans: ['wide-leg', 'straight-leg', 'cropped', 'bodycon', 'asymmetrical-hem'],
  Skirt: ['a-line', 'fit-and-flare', 'trapeze', 'column', 'bodycon', 'asymmetrical-hem'],
  Shorts: ['a-line', 'wide-leg', 'straight-leg', 'cropped', 'column', 'bodycon', 'asymmetrical-hem'],
  Leggings: ['column', 'bodycon', 'cropped'],
  Joggers: ['column', 'cropped', 'asymmetrical-hem'],
  Dresses: ['a-line', 'fit-and-flare', 'column', 'trapeze', 'bodycon', 'cocoon', 'sleeveless', 'short-sleeve', 'long-sleeve', 'peplum', 'asymmetrical-hem', 'v-neck', 'boat-neck', 'mock-neck', 'turtleneck', 'crew-neck', 'scoop-neck', 'square-neck', 'sweetheart', 'off-the-shoulder', 'halter-neck', 'cowl-neck', 'hooded'],
  'Jumpsuits/Rompers': ['column', 'fit-and-flare', 'wide-leg', 'cropped', 'bodycon', 'sleeveless', 'short-sleeve', 'long-sleeve', 'asymmetrical-hem', 'v-neck', 'boat-neck', 'mock-neck', 'turtleneck', 'crew-neck', 'scoop-neck', 'halter-neck', 'hooded'],
  Overalls: ['column', 'cropped', 'wide-leg', 'straight-leg', 'bodycon', 'asymmetrical-hem'],
  'Sleep Set': ['column', 'cropped', 'sleeveless', 'short-sleeve', 'long-sleeve'],
  Slip: ['column', 'bodycon', 'sleeveless', 'v-neck', 'cowl-neck', 'sweetheart'],
  Robe: ['cocoon', 'trapeze', 'long-sleeve', 'hooded', 'asymmetrical-hem'],
  Lounge: ['column', 'cropped', 'sleeveless', 'short-sleeve', 'long-sleeve'],
  'One-Piece': ['column', 'a-line', 'bodycon', 'sleeveless', 'short-sleeve', 'long-sleeve', 'asymmetrical-hem', 'v-neck', 'halter-neck'],
  Bikini: ['sleeveless', 'halter-neck', 'v-neck', 'asymmetrical-hem'],
  Coverup: ['column', 'trapeze', 'sleeveless', 'short-sleeve', 'long-sleeve', 'asymmetrical-hem'],
};

const PATTERN_OPTIONS = [
  'solid',
  'striped',
  'plaid',
  'check',
  'floral',
  'animal',
  'polka-dot',
  'geometric',
  'graphic',
  'abstract',
  'textured',
] as const;

const APPAREL_PATTERN_CATEGORIES = new Set([
  'Tops',
  'Outerwear',
  'Bottoms',
  'Dresses & One-Pieces',
  'Underwear & Sleepwear',
  'Swimwear',
]);

const MAX_TITLE_LENGTH = 100;

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(array: readonly T[]): T {
  return array[randomInt(0, array.length - 1)];
}

function randomSubset<T>(array: readonly T[], min = 1, max = 2): T[] {
  const upper = Math.max(min, Math.min(max, array.length));
  const count = randomInt(min, upper);
  const pool = [...array];
  const selection: T[] = [];
  for (let i = 0; i < count; i++) {
    if (!pool.length) break;
    const index = randomInt(0, pool.length - 1);
    selection.push(pool[index]);
    pool.splice(index, 1);
  }
  return selection;
}

function pickTitleNoun(config: CategoryConfig, subCategory: string): string {
  const nouns = config.nouns[subCategory] ?? config.nouns.default;
  return randomChoice(nouns);
}

function buildTitle(brand: string, adjective: string, color: string, noun: string): string {
  const baseParts = [brand, adjective, capitalize(color), noun].filter(Boolean);
  let title = baseParts.join(' ').replace(/\s+/g, ' ').trim();

  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }

  // Try removing adjective
  title = [brand, capitalize(color), noun].filter(Boolean).join(' ').trim();
  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }

  // Try removing brand
  title = [adjective, capitalize(color), noun].filter(Boolean).join(' ').trim();
  if (title.length <= MAX_TITLE_LENGTH) {
    return title;
  }

  // Final fallback: truncate
  return title.slice(0, MAX_TITLE_LENGTH).trim();
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildDescription(params: {
  brand: string;
  adjective: string;
  subCategory: string;
  colorPalette: string[];
  fabrics: string[];
  formality: string;
  occasion: string;
}): string {
  const colorPhrase = params.colorPalette.length > 1
    ? params.colorPalette.map(color => color === 'multicolor' ? 'multicolor' : `${color}`).join(', ')
    : params.colorPalette[0];

  const fabricPhrase = params.fabrics.join(' & ');
  const sentenceOne = `${params.brand} ${params.subCategory.toLowerCase()} in ${colorPhrase} ${fabricPhrase} with a ${params.adjective.toLowerCase()} attitude.`;
  const sentenceTwo = `Refined enough for ${params.formality.replace('-', ' ')} moments and perfect when ${params.occasion.replace('-', ' ')} is on the agenda.`;
  return `${sentenceOne} ${sentenceTwo}`;
}

function chooseFabrics(category: string): string[] {
  const overrides = CATEGORY_FABRIC_OVERRIDES[category];
  if (overrides) {
    return randomSubset(overrides, 1, 2);
  }
  return randomSubset(FABRIC_OPTIONS, 1, 2);
}

function chooseStyleTags(category: string): string[] {
  const overrides = CATEGORY_STYLE_TAG_OVERRIDES[category];
  const basePool = overrides ?? STYLE_TAG_OPTIONS;
  return randomSubset(basePool, 1, 3);
}

function chooseSilhouettes(config: CategoryConfig, subCategory: string): string[] {
  const override = SUBCATEGORY_SILHOUETTE_OVERRIDES[subCategory];
  const pool = override && override.length > 0 ? override : config.silhouettePool;
  if (!pool || pool.length === 0) {
    return [];
  }
  return randomSubset(pool, 1, Math.min(2, pool.length));
}

function chooseFit(config: CategoryConfig): string | undefined {
  if (!config.fitPool || config.fitPool.length === 0) {
    return undefined;
  }
  return randomChoice(config.fitPool);
}

function choosePattern(category: string): string | undefined {
  if (!APPAREL_PATTERN_CATEGORIES.has(category)) {
    return undefined;
  }
  const weightedPool = [...PATTERN_OPTIONS, 'solid', 'solid'];
  return randomChoice(weightedPool);
}

export function generateRandomAdminWardrobeItems(count: number): AdminWardrobeItem[] {
  const now = new Date().toISOString();
  const items: AdminWardrobeItem[] = [];

  for (let i = 0; i < count; i++) {
    const config = randomChoice(CATEGORY_CONFIG);
    const subCategory = randomChoice(config.subCategories);
    const brand = randomChoice(BRANDS);
    const adjective = randomChoice(ADJECTIVES);
    const colors = randomSubset(COLOR_OPTIONS, 1, 2);
    const fabrics = chooseFabrics(config.category);
    const silhouettes = chooseSilhouettes(config, subCategory);
    const fit = chooseFit(config);
    const formalities = randomSubset(FORMALITY_OPTIONS, 1, 2);
    const styleTags = chooseStyleTags(config.category);
    const seasons = randomSubset(SEASON_OPTIONS, 1, 2);
    const occasions = randomSubset(OCCASION_OPTIONS, 1, 2);
    const careNotes = randomChoice(CARE_NOTES);
    const noun = pickTitleNoun(config, subCategory);
    const title = buildTitle(brand, adjective, colors[0], noun);
    const description = buildDescription({
      brand,
      adjective,
      subCategory: noun,
      colorPalette: colors,
      fabrics,
      formality: formalities[0],
      occasion: occasions[0],
    });
    const pattern = choosePattern(config.category);

    items.push({
      id: uuidv4(),
      title,
      description,
      brand,
      category: config.category,
      subCategory,
      colors,
      fabrics,
      pattern,
      silhouettes,
      fit,
      formalities,
      styleTags,
      seasons,
      occasions,
      careNotes,
      imageUrl: undefined,
      createdAt: now,
    });
  }

  return items;
}

export function convertAdminItemToWardrobeItem(item: AdminWardrobeItem): WardrobeItem {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    subCategory: item.subCategory as WardrobeItem['subCategory'],
    description: item.description,
    pattern: item.pattern as WardrobePatternOption | undefined,
    silhouettes: (item.silhouettes ?? []) as WardrobeItem['silhouettes'],
    colors: (item.colors ?? []) as WardrobeItem['colors'],
    fabrics: (item.fabrics ?? []) as WardrobeItem['fabrics'],
    fit: item.fit as WardrobeItem['fit'],
    formalities: (item.formalities ?? []) as WardrobeItem['formalities'],
    styleTags: (item.styleTags ?? []) as WardrobeItem['styleTags'],
    seasons: (item.seasons ?? []) as WardrobeItem['seasons'],
    occasions: (item.occasions ?? []) as WardrobeItem['occasions'],
    careNotes: item.careNotes,
    brand: item.brand as WardrobeItem['brand'],
    imageUrl: item.imageUrl,
    createdAt: item.createdAt,
  };
}

export function normalizeAdminTitle(title: string): string {
  return title.replace(/^[\s]*[-•*·+]+[\s]*/, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

