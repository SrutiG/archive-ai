import dotenv from 'dotenv';
import * as db from '../database';
import { WardrobeItem } from '../index';

dotenv.config();

type CategoryRule = {
  category: string;
  keywords: string[];
  priority: number;
};

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Dresses',
    keywords: [
      'dress',
      'gown',
      'jumpsuit',
      'romper',
      'overall',
      'wrap dress',
      'shirt dress',
      'slip dress',
      'maxi dress',
      'midi dress',
      'mini dress'
    ],
    priority: 100
  },
  {
    category: 'Outerwear',
    keywords: [
      'coat',
      'jacket',
      'blazer',
      'trench',
      'parka',
      'anorak',
      'overcoat',
      'puffer',
      'bomber',
      'windbreaker',
      'cape'
    ],
    priority: 96
  },
  {
    category: 'Shoes',
    keywords: [
      'shoe',
      'boot',
      'boots',
      'sandal',
      'sandals',
      'heel',
      'heels',
      'pump',
      'pumps',
      'flat',
      'flats',
      'loafer',
      'loafers',
      'oxford',
      'sneaker',
      'sneakers',
      'trainer',
      'trainers',
      'mule',
      'mules',
      'clog',
      'clogs',
      'slipper',
      'slippers',
      'slides',
      'wedge',
      'wedges'
    ],
    priority: 80
  },
  {
    category: 'Bags',
    keywords: [
      'bag',
      'handbag',
      'tote',
      'purse',
      'clutch',
      'crossbody',
      'backpack',
      'satchel',
      'belt bag',
      'fanny pack',
      'duffle',
      'weekender'
    ],
    priority: 88
  },
  {
    category: 'Jewelry',
    keywords: [
      'jewelry',
      'ring',
      'rings',
      'necklace',
      'necklaces',
      'bracelet',
      'bracelets',
      'cuff',
      'earring',
      'earrings',
      'ear cuff',
      'pendant',
      'anklet',
      'brooch'
    ],
    priority: 65
  },
  {
    category: 'Accessories',
    keywords: [
      'scarf',
      'scarves',
      'hat',
      'cap',
      'beanie',
      'beret',
      'visor',
      'belt',
      'belts',
      'glove',
      'gloves',
      'mitten',
      'mittens',
      'watch',
      'watches',
      'hair clip',
      'hairpin',
      'headband',
      'headband',
      'sunglass',
      'sunglasses',
      'eyewear',
      'wallet',
      'pocket square',
      'tie',
      'bow tie',
      'neckwear'
    ],
    priority: 58
  },
  {
    category: 'Activewear',
    keywords: [
      'sports bra',
      'running',
      'track',
      'athletic',
      'workout',
      'training',
      'gym',
      'yoga',
      'performance',
      'compression',
      'sweat-wicking',
      'dri-fit'
    ],
    priority: 55
  },
  {
    category: 'Underwear',
    keywords: [
      'lingerie',
      'bra',
      'bralette',
      'underwear',
      'panty',
      'panties',
      'brief',
      'briefs',
      'boxer',
      'boxers',
      'thong',
      'garter',
      'stockings',
      'hosiery'
    ],
    priority: 50
  },
  {
    category: 'Sleepwear',
    keywords: [
      'sleep',
      'pajama',
      'pyjama',
      'nightgown',
      'nightwear',
      'robe',
      'loungewear'
    ],
    priority: 45
  },
  {
    category: 'Swimwear',
    keywords: [
      'swim',
      'bikini',
      'swimsuit',
      'one-piece',
      'rashguard',
      'boardshort',
      'board short'
    ],
    priority: 40
  },
  {
    category: 'Sets',
    keywords: [
      'matching set',
      'co-ord',
      'co-ords',
      'coordinating set',
      'twinset'
    ],
    priority: 35
  },
  {
    category: 'Bottoms',
    keywords: [
      'bottom',
      'pants',
      'pant',
      'trouser',
      'trousers',
      'jean',
      'jeans',
      'denim',
      'short',
      'shorts',
      'skirt',
      'culotte',
      'culottes',
      'jogger',
      'joggers',
      'legging',
      'leggings',
      'chino',
      'cargo',
      'wide-leg',
      'flare',
      'flared',
      'slacks'
    ],
    priority: 85
  },
  {
    category: 'Tops',
    keywords: [
      'top',
      'shirt',
      't-shirt',
      'tee',
      'polo',
      'henley',
      'blouse',
      'tank',
      'camisole',
      'cami',
      'sweater',
      'sweatshirt',
      'hoodie',
      'cardigan',
      'pullover',
      'crewneck',
      'turtleneck',
      'mock neck',
      'mock-neck',
      'bodysuit',
      'button up',
      'button-down',
      'buttondown',
      'button-up',
      'long sleeve',
      'short sleeve',
      'corset',
      'crop top',
      'cropped top'
    ],
    priority: 92
  }
];
function normalizeText(item: WardrobeItem): string {
  const base = `${item.title || ''} ${item.description || ''}`.toLowerCase();
  return base.replace(/[^a-z0-9\s\-]/g, ' ');
}

function keywordScore(normalized: string, keyword: string): number {
  const trimmed = keyword.trim();
  if (!trimmed) return 0;

  if (trimmed.includes(' ')) {
    return normalized.includes(trimmed) ? 1 : 0;
  }

  const regex = new RegExp(`\\b${trimmed.replace(/[-/]/g, '\\$&')}\\b`, 'g');
  const matches = normalized.match(regex);
  return matches ? matches.length : 0;
}

function determineCategory(item: WardrobeItem): string | null {
  const normalized = normalizeText(item);
  if (!normalized.trim()) {
    return null;
  }

  let bestCategory: string | null = null;
  let bestScore = 0;
  let bestPriority = -Infinity;
  const scoreMap = new Map<string, number>();

  for (const rule of CATEGORY_RULES) {
    let score = 0;
    for (const keyword of rule.keywords) {
      score += keywordScore(normalized, keyword);
    }

    if (score === 0) {
      continue;
    }

    scoreMap.set(rule.category, score);

    if (score > bestScore || (score === bestScore && rule.priority > bestPriority)) {
      bestCategory = rule.category;
      bestScore = score;
      bestPriority = rule.priority;
    }
  }

  if (!bestCategory || bestScore === 0) {
    return null;
  }

  const existingRule = CATEGORY_RULES.find(
    (rule) => rule.category.toLowerCase() === (item.category || '').toLowerCase()
  );

  if (existingRule) {
    const existingScore = scoreMap.get(existingRule.category) ?? 0;
    if (existingScore > bestScore) {
      return null;
    }
    if (existingScore === bestScore && existingRule.priority >= bestPriority) {
      return null;
    }
  }

  return bestCategory;
}

async function backfillCategories() {
  const users = await db.getAllUsers();
  let inspectedItems = 0;
  let updatedItems = 0;

  for (const user of users) {
    const items: WardrobeItem[] = await db.getItemsByUser(user.id);

    for (const item of items) {
      inspectedItems += 1;
      const inferredCategory = determineCategory(item);

      if (!inferredCategory) {
        continue;
      }

      if (item.category === inferredCategory) {
        continue;
      }

      await db.updateItem(item.id, { category: inferredCategory });
      updatedItems += 1;
      console.log(
        `Updated item "${item.title}" (user: ${user.id}) from category "${item.category}" to "${inferredCategory}"`
      );
    }
  }

  console.log(`\nProcessed ${inspectedItems} items. Updated ${updatedItems} categories.`);
}

backfillCategories()
  .then(async () => {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
    console.log('Category backfill completed.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Error during category backfill:', error);
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
    process.exit(1);
  });

