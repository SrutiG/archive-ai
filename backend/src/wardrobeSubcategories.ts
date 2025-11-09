export type WardrobeSubCategory =
  | 'Tees'
  | 'Button-Ups'
  | 'Sweaters'
  | 'Tanks & Camis'
  | 'T-Shirts'
  | 'Bodysuits'
  | 'Pants'
  | 'Jeans'
  | 'Skirt'
  | 'Shorts'
  | 'Leggings'
  | 'Joggers'
  | 'Boots'
  | 'Heels'
  | 'Flats'
  | 'Sneakers'
  | 'Sandals'
  | 'Loafers'
  | 'Tote'
  | 'Shoulder'
  | 'Crossbody'
  | 'Clutch'
  | 'Backpack'
  | 'Belt Bag'
  | 'Necklace'
  | 'Bracelet'
  | 'Ring'
  | 'Earrings'
  | 'Belt'
  | 'Hat'
  | 'Scarf'
  | 'Gloves'
  | 'Tights'
  | 'Socks'
  | 'Sunglasses'
  | 'Hair Accessory'
  | 'Dresses'
  | 'Jumpsuits & Rompers'
  | 'Overalls'
  | 'Underwear & Sleepwear'
  | 'Swimwear'
  | 'Other';

type SubcategoryDefinition = {
  name: WardrobeSubCategory;
  keywords: string[];
};

const DEFAULT_OTHER: SubcategoryDefinition = { name: 'Other', keywords: [] };

const CATEGORY_SUBCATEGORY_DEFINITIONS: Record<string, SubcategoryDefinition[]> = {
  Tops: [
    { name: 'Button-Ups', keywords: ['button-up', 'button up', 'button-down', 'button down', 'dress shirt', 'oxford', 'collar', 'buttonfront'] },
    { name: 'Sweaters', keywords: ['sweater', 'knit', 'cardigan', 'pullover', 'crewneck', 'turtleneck', 'jumper', 'cashmere', 'sweatshirt'] },
    { name: 'Tanks & Camis', keywords: ['tank', 'camisole', 'cami', 'sleeveless', 'halter'] },
    { name: 'Bodysuits', keywords: ['bodysuit', 'bodice'] },
    { name: 'Tees', keywords: ['tee', 'graphic tee'] },
    { name: 'T-Shirts', keywords: ['t-shirt', 't shirt', 'tshirt'] },
    DEFAULT_OTHER,
  ],
  Bottoms: [
    { name: 'Jeans', keywords: ['jean', 'denim'] },
    { name: 'Pants', keywords: ['pant', 'trouser', 'slack', 'chino'] },
    { name: 'Skirt', keywords: ['skirt'] },
    { name: 'Shorts', keywords: ['short', 'shorts'] },
    { name: 'Leggings', keywords: ['legging'] },
    { name: 'Joggers', keywords: ['jogger', 'sweatpant'] },
    DEFAULT_OTHER,
  ],
  Shoes: [
    { name: 'Boots', keywords: ['boot'] },
    { name: 'Heels', keywords: ['heel', 'stiletto', 'pump'] },
    { name: 'Flats', keywords: ['flat', 'ballet'] },
    { name: 'Sneakers', keywords: ['sneaker', 'trainer', 'running shoe', 'tennis shoe', 'jordan'] },
    { name: 'Sandals', keywords: ['sandal', 'slide', 'flip flop', 'flip-flop'] },
    { name: 'Loafers', keywords: ['loafer', 'oxford', 'derby', 'moccasin'] },
    DEFAULT_OTHER,
  ],
  Bags: [
    { name: 'Tote', keywords: ['tote'] },
    { name: 'Shoulder', keywords: ['shoulder bag', 'hobo'] },
    { name: 'Crossbody', keywords: ['crossbody', 'cross-body', 'sling bag'] },
    { name: 'Clutch', keywords: ['clutch', 'wristlet'] },
    { name: 'Backpack', keywords: ['backpack', 'rucksack'] },
    { name: 'Belt Bag', keywords: ['belt bag', 'fanny pack', 'waist bag', 'bum bag'] },
    DEFAULT_OTHER,
  ],
  Jewelry: [
    { name: 'Necklace', keywords: ['necklace', 'pendant', 'choker'] },
    { name: 'Bracelet', keywords: ['bracelet', 'bangle', 'cuff'] },
    { name: 'Ring', keywords: ['ring'] },
    { name: 'Earrings', keywords: ['earring', 'earrings', 'stud', 'hoop'] },
    DEFAULT_OTHER,
  ],
  Accessories: [
    { name: 'Belt', keywords: ['belt'] },
    { name: 'Hat', keywords: ['hat', 'beanie', 'fedora', 'cap', 'bucket'] },
    { name: 'Scarf', keywords: ['scarf', 'shawl', 'wrap'] },
    { name: 'Gloves', keywords: ['glove', 'mittens', 'mitten'] },
    { name: 'Tights', keywords: ['tight', 'hosiery'] },
    { name: 'Socks', keywords: ['sock', 'socks'] },
    { name: 'Sunglasses', keywords: ['sunglass', 'sunglasses', 'shades', 'sunnies'] },
    { name: 'Hair Accessory', keywords: ['hair accessory', 'hair clip', 'barrette', 'headband', 'scrunchie'] },
    DEFAULT_OTHER,
  ],
  Dresses: [
    { name: 'Dresses', keywords: ['dress', 'gown'] },
    { name: 'Jumpsuits & Rompers', keywords: ['jumpsuit', 'romper', 'playsuit'] },
    { name: 'Overalls', keywords: ['overall', 'dungaree'] },
    DEFAULT_OTHER,
  ],
  'Dresses & One-Pieces': [
    { name: 'Dresses', keywords: ['dress', 'gown'] },
    { name: 'Jumpsuits & Rompers', keywords: ['jumpsuit', 'romper', 'playsuit'] },
    { name: 'Overalls', keywords: ['overall', 'dungaree'] },
    DEFAULT_OTHER,
  ],
  'Underwear & Sleepwear': [
    { name: 'Underwear & Sleepwear', keywords: ['sleep', 'pajama', 'pyjama', 'nightgown', 'nightdress', 'robe', 'underwear', 'panty', 'panties', 'brief', 'boxer', 'bralette', 'lingerie', 'nightshirt'] },
    DEFAULT_OTHER,
  ],
  Swimwear: [
    { name: 'Swimwear', keywords: ['swim', 'bikini', 'swimsuit', 'one-piece', 'one piece', 'tankini', 'rashguard', 'rash guard', 'boardshort', 'board short', 'trunks'] },
    DEFAULT_OTHER,
  ],
};

function getDefinitions(category: string): SubcategoryDefinition[] {
  return CATEGORY_SUBCATEGORY_DEFINITIONS[category] ?? [DEFAULT_OTHER];
}

function sanitizeText(...values: Array<string | undefined>): string {
  return values
    .filter(Boolean)
    .map(value => value!.toLowerCase())
    .join(' ');
}

export function listAllSubCategories(): Record<string, WardrobeSubCategory[]> {
  return Object.entries(CATEGORY_SUBCATEGORY_DEFINITIONS).reduce<Record<string, WardrobeSubCategory[]>>(
    (acc, [category, defs]) => {
      acc[category] = defs.map(def => def.name);
      return acc;
    },
    {}
  );
}

export function listSubCategoriesForCategory(category: string): WardrobeSubCategory[] {
  return getDefinitions(category).map(def => def.name);
}

export function normalizeSubCategoryInput(category: string, raw?: string | null): WardrobeSubCategory | undefined {
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  const match = getDefinitions(category).find(def => def.name.toLowerCase() === trimmed.toLowerCase());
  if (match) {
    return match.name;
  }
  if (trimmed.toLowerCase() === 'other') {
    return 'Other';
  }
  return undefined;
}

export function inferSubCategory(
  category: string,
  title?: string,
  description?: string
): WardrobeSubCategory | undefined {
  const defs = getDefinitions(category);
  const text = sanitizeText(title, description);
  if (!text.trim()) {
    return undefined;
  }

  for (const def of defs) {
    if (def.name === 'Other') {
      continue;
    }
    if (def.keywords.some(keyword => text.includes(keyword))) {
      return def.name;
    }
  }

  return defs.some(def => def.name !== 'Other') ? 'Other' : undefined;
}

export function resolveSubCategory(
  category: string,
  provided?: string | null,
  title?: string,
  description?: string
): WardrobeSubCategory | undefined {
  const normalized = normalizeSubCategoryInput(category, provided);
  if (normalized) {
    return normalized;
  }
  return inferSubCategory(category, title, description);
}

