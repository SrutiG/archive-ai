import dotenv from 'dotenv';
import * as db from '../database';
import {
  WardrobeItem,
  WardrobeColorOption,
  WardrobeFabricOption,
  WardrobePatternOption,
  WardrobeSilhouetteOption,
  WardrobeFitOption,
  WardrobeFormalityOption,
  WardrobeStyleTagOption,
  WardrobeSeasonOption,
  WardrobeOccasionOption,
  WardrobeBrandOption,
} from '../index';
import { inferSubCategory } from '../wardrobeSubcategories';

dotenv.config();

const TEXT_FIELDS = ['title', 'description'] as const;

const BRAND_LIST: WardrobeBrandOption[] = [
  'Rick Owens',
  'Maison Margiela',
  'Ann Demeulemeester',
  'Yohji Yamamoto',
  'Comme des Garçons',
  'Issey Miyake',
  'Junya Watanabe',
  'Acne Studios',
  'Helmut Lang',
  'Raf Simons',
  'Dries Van Noten',
  'Balenciaga',
  'Vetements',
  'Dion Lee',
  'Peter Do',
  'The Row',
  'Celine',
  'Loewe',
  'Bottega Veneta',
  'Prada',
  'Miu Miu',
  'Saint Laurent',
  'Gucci',
  'Dior',
  'Chanel',
  'Versace',
  'Fendi',
  'Givenchy',
  'Jil Sander',
  'Marni',
  'Stella McCartney',
  'Vivienne Westwood',
  'Alexander McQueen',
  'Banana Republic',
  'Camper',
  'Professor E',
  'Zara',
  'H&M',
  'COS',
  'Arket',
  'Everlane',
  'Cuyana',
  'Reformation',
  'Aritzia',
  'Ganni',
  'Staud',
  'Nanushka',
  'Totême',
  'Vintage',
  'Thrift',
  'Jean Paul Gaultier',
  'Deadwood',
  'Stussy',
  'Moschino',
  'Other',
];

type KeywordMap<T extends string> = Record<T, string[]>;

const COLOR_KEYWORDS: KeywordMap<WardrobeColorOption> = {
  black: ['black', 'onyx', 'ink'],
  white: ['white', 'off-white'],
  gray: ['gray', 'grey', 'ash'],
  charcoal: ['charcoal'],
  slate: ['slate'],
  silver: ['silver'],
  navy: ['navy'],
  blue: ['blue', 'azure', 'cobalt'],
  teal: ['teal'],
  turquoise: ['turquoise'],
  cyan: ['cyan'],
  'sky-blue': ['sky blue', 'sky-blue', 'sky'],
  indigo: ['indigo'],
  green: ['green'],
  emerald: ['emerald'],
  mint: ['mint'],
  sage: ['sage'],
  forest: ['forest'],
  lime: ['lime'],
  olive: ['olive'],
  red: ['red', 'scarlet'],
  crimson: ['crimson'],
  maroon: ['maroon'],
  rust: ['rust'],
  terracotta: ['terracotta', 'terra cotta'],
  burgundy: ['burgundy', 'wine'],
  pink: ['pink', 'blush'],
  magenta: ['magenta'],
  fuchsia: ['fuchsia', 'fuschia'],
  rose: ['rose'],
  coral: ['coral'],
  salmon: ['salmon'],
  purple: ['purple'],
  violet: ['violet'],
  eggplant: ['eggplant', 'aubergine'],
  lilac: ['lilac'],
  lavender: ['lavender'],
  plum: ['plum'],
  yellow: ['yellow'],
  gold: ['gold', 'golden'],
  mustard: ['mustard'],
  amber: ['amber'],
  orange: ['orange'],
  peach: ['peach'],
  apricot: ['apricot'],
  brown: ['brown', 'espresso'],
  chocolate: ['chocolate'],
  caramel: ['caramel'],
  coffee: ['coffee'],
  taupe: ['taupe'],
  tan: ['tan'],
  beige: ['beige', 'sand'],
  cream: ['cream', 'eggshell'],
  ivory: ['ivory'],
  ecru: ['ecru'],
  camel: ['camel'],
  khaki: ['khaki'],
  metallic: ['metallic', 'bronze'],
  multicolor: ['multi', 'colorful', 'rainbow', 'print'],
  other: [],
};

const FABRIC_KEYWORDS: KeywordMap<WardrobeFabricOption> = {
  cotton: ['cotton'],
  linen: ['linen'],
  silk: ['silk', 'satin', 'charmeuse'],
  wool: ['wool'],
  cashmere: ['cashmere'],
  denim: ['denim', 'jean'],
  leather: ['leather'],
  suede: ['suede'],
  knit: ['knit', 'ribbed'],
  synthetic: ['spandex'],
  chiffon: ['chiffon'],
  satin: ['satin'],
  velvet: ['velvet'],
  lace: ['lace', 'crochet'],
  modal: ['modal'],
  rayon: ['rayon', 'viscose'],
  tencel: ['tencel', 'lyocell'],
  nylon: ['nylon'],
  polyester: ['polyester'],
  cupro: ['cupro', 'cupra'],
  acetate: ['acetate'],
  acrylic: ['acrylic'],
  other: [],
};

const PATTERN_KEYWORDS: KeywordMap<Exclude<WardrobePatternOption, 'other'>> = {
  solid: ['solid'],
  striped: ['striped', 'stripe'],
  plaid: ['plaid', 'tartan'],
  check: ['check', 'checkered', 'checked', 'gingham'],
  floral: ['floral', 'flower'],
  animal: ['animal print', 'leopard', 'cheetah', 'zebra', 'snakeskin', 'tiger'],
  'polka-dot': ['polka dot', 'polka-dot', 'spotted', 'dots'],
  geometric: ['geometric', 'chevron', 'abstract'],
  graphic: ['graphic', 'logo', 'graphic print'],
  abstract: ['abstract'],
  textured: ['textured', 'ribbed', 'boucle'],
};

const SILHOUETTE_KEYWORDS: KeywordMap<Exclude<WardrobeSilhouetteOption, 'other'>> = {
  'a-line': ['a-line', 'a line'],
  column: ['column', 'sheath', 'straight dress'],
  'fit-and-flare': ['fit-and-flare', 'fit and flare', 'skater', 'flared dress'],
  cocoon: ['cocoon', 'boxy', 'cocoon coat'],
  trapeze: ['trapeze', 'swing', 'tent'],
  bodycon: ['bodycon', 'body-con', 'bandage'],
  'wide-leg': ['wide-leg', 'wide leg', 'palazzo'],
  'straight-leg': ['straight-leg', 'straight leg', 'tapered', 'straight'],
  cropped: ['cropped', 'crop'],
  'hip-length': ['hip length', 'hip-length', 'hip', 'hip line', 'hipline'],
  'mid-thigh': ['mid thigh', 'mid-thigh', 'mid thigh length', 'thigh length'],
  'waist-length': ['waist length', 'waist-length', 'waist', 'tunic length', 'tunic-length', 'tunic', 'tunic top'],
  'knee-length': ['knee length', 'knee-length', 'knee', 'knee line'],
  long: ['long', 'long length', 'long top', 'long jacket', 'long coat', 'long outerwear'],
  'ankle-length': ['ankle length', 'ankle-length', 'ankle', 'ankle pants'],
  'full-length': ['full length', 'full-length', 'full', 'long pants', 'long trousers'],
  capri: ['capri', 'capris', 'cropped pants'],
  '7/8-length': ['7/8 length', '7/8-length', 'seven eighths', '7/8'],
  '3/4-length': ['3/4 length', '3/4-length', 'three quarters', '3/4'],
  mini: ['mini', 'short', 'short skirt', 'short dress'],
  midi: ['midi', 'mid length', 'mid-length', 'midi skirt', 'midi dress'],
  maxi: ['maxi', 'long skirt', 'long dress', 'maxi skirt', 'maxi dress'],
  'tea-length': ['tea length', 'tea-length', 'tea dress'],
  'floor-length': ['floor length', 'floor-length', 'floor', 'full length dress'],
  'long-sleeve': ['long sleeve', 'long-sleeve', 'long-sleeved'],
  'short-sleeve': ['short sleeve', 'short-sleeve', 'short-sleeved'],
  sleeveless: ['sleeveless', 'tank', 'camisole', 'camis'],
  peplum: ['peplum'],
  'asymmetrical-hem': ['asymmetrical hem', 'asymmetric hem', 'high-low', 'hi-low'],
  'v-neck': ['v neck', 'v-neck', 'deep v'],
  'boat-neck': ['boat neck', 'boat-neck', 'bateau'],
  'mock-neck': ['mock neck', 'mock-neck'],
  turtleneck: ['turtleneck', 'roll neck'],
  'crew-neck': ['crew neck', 'crew-neck', 'crewneck'],
  'scoop-neck': ['scoop neck', 'scoop-neck', 'scoopneck'],
  'square-neck': ['square neck', 'square-neck'],
  sweetheart: ['sweetheart'],
  'off-the-shoulder': ['off the shoulder', 'off-the-shoulder'],
  'halter-neck': ['halter neck', 'halter-neck', 'halter'],
  'cowl-neck': ['cowl neck', 'cowl-neck'],
  hooded: ['hooded', 'hoodie'],
  collared: ['collared', 'with collar', 'collar'],
  collarless: ['collarless', 'no collar'],
};

const FIT_KEYWORDS: KeywordMap<Exclude<WardrobeFitOption, 'other'>> = {
  'second-skin': ['second skin', 'skin-tight', 'skin tight', 'skinny', 'body-hugging', 'bodycon'],
  slim: ['slim', 'fitted', 'trim'],
  regular: ['regular', 'true to size'],
  relaxed: ['relaxed', 'easy', 'loose'],
  oversized: ['oversized', 'baggy', 'boxy'],
  tailored: ['tailored', 'structured'],
};

const FORMALITY_KEYWORDS: KeywordMap<WardrobeFormalityOption> = {
  casual: ['casual', 'everyday', 'weekend'],
  'smart-casual': ['smart casual', 'dressy casual'],
  'business-casual': ['business casual', 'office casual'],
  'business-formal': ['business formal', 'corporate', 'boardroom'],
  evening: ['evening'],
  formal: ['formal', 'black tie'],
  athleisure: ['athleisure', 'athletic', 'gym', 'sport'],
  other: [],
};

const STYLE_TAG_KEYWORDS: KeywordMap<WardrobeStyleTagOption> = {
  minimalist: ['minimal', 'minimalist', 'clean'],
  classic: ['classic', 'timeless'],
  modern: ['modern', 'contemporary'],
  trendy: ['trendy', 'on-trend', 'fashion-forward'],
  edgy: ['edgy', 'bold'],
  boho: ['boho', 'bohemian'],
  preppy: ['preppy'],
  athleisure: ['athleisure', 'sporty'],
  streetwear: ['streetwear', 'urban'],
  romantic: ['romantic', 'feminine'],
  feminine: ['feminine'],
  androgynous: ['androgynous', 'gender neutral'],
  workwear: ['workwear'],
  vintage: ['vintage', 'retro'],
  sporty: ['sporty', 'athletic'],
  heritage: ['heritage', 'traditional'],
  other: [],
};

const SEASON_KEYWORDS: KeywordMap<WardrobeSeasonOption> = {
  spring: ['spring'],
  summer: ['summer'],
  fall: ['fall', 'autumn'],
  winter: ['winter'],
  'all-season': ['all season', 'all-season', 'year-round', 'year round'],
};

const OCCASION_KEYWORDS: KeywordMap<WardrobeOccasionOption> = {
  work: ['work', 'office', 'business'],
  weekend: ['weekend', 'casual', 'everyday'],
  date: ['date', 'date night'],
  family: ['family'],
  travel: ['travel', 'vacation', 'holiday'],
  party: ['party', 'cocktail'],
  'formal-event': ['formal event', 'formal', 'black tie'],
  outdoor: ['outdoor', 'hiking', 'camping'],
  athletic: ['athletic', 'sport', 'gym'],
  lounging: ['lounge', 'loungewear', 'at home'],
  wedding: ['wedding', 'bridal'],
  other: [],
};

function normalizeText(item: WardrobeItem): string {
  const parts: string[] = [];
  for (const field of TEXT_FIELDS) {
    const value = item[field];
    if (typeof value === 'string') {
      parts.push(value.toLowerCase());
    }
  }
  return parts.join(' ');
}

function matchKeywords<T extends string>(text: string, map: KeywordMap<T>): T[] {
  const matches = new Set<T>();
  for (const [key, keywords] of Object.entries<string[]>(map)) {
    for (const keyword of keywords) {
      if (!keyword) continue;
      if (keyword.includes(' ')) {
        if (text.includes(keyword)) {
          matches.add(key as T);
          break;
        }
      } else {
        const regex = new RegExp(`\\b${keyword.replace(/[-/]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text)) {
          matches.add(key as T);
          break;
        }
      }
    }
  }
  return Array.from(matches);
}

function pickSingle<T extends string>(text: string, map: KeywordMap<T>): T | undefined {
  const matches = matchKeywords(text, map);
  return matches.length > 0 ? matches[0] : undefined;
}

function extractColors(text: string): WardrobeColorOption[] {
  const matches = matchKeywords(text, COLOR_KEYWORDS);
  return matches.filter((color) => color !== 'other');
}

function extractFabrics(text: string): WardrobeFabricOption[] {
  const matches = matchKeywords(text, FABRIC_KEYWORDS);
  return matches.filter((fabric) => fabric !== 'other');
}

function extractPattern(text: string): WardrobePatternOption | undefined {
  const match = pickSingle(text, PATTERN_KEYWORDS);
  return match ?? undefined;
}

function extractSilhouettes(
  text: string,
  category?: string
): WardrobeSilhouetteOption[] {
  const matches = matchKeywords(text, SILHOUETTE_KEYWORDS);
  const filtered = matches.filter((value) => {
    if (
      value === 'long-sleeve' ||
      value === 'short-sleeve' ||
      value === 'sleeveless'
    ) {
      return category === 'Tops';
    }
    return value !== 'other';
  });
  return Array.from(new Set(filtered));
}

function extractFit(text: string): WardrobeFitOption | undefined {
  const match = pickSingle(text, FIT_KEYWORDS);
  return match ?? undefined;
}

function extractFormalities(text: string): WardrobeFormalityOption[] {
  const matches = matchKeywords(text, FORMALITY_KEYWORDS);
  return matches.filter((formality) => formality !== 'other');
}

function extractStyleTags(text: string): WardrobeStyleTagOption[] {
  const matches = matchKeywords(text, STYLE_TAG_KEYWORDS);
  return matches.filter((style) => style !== 'other');
}

function extractSeasons(text: string): WardrobeSeasonOption[] {
  const matches = matchKeywords(text, SEASON_KEYWORDS);
  return matches;
}

function extractOccasions(text: string): WardrobeOccasionOption[] {
  const matches = matchKeywords(text, OCCASION_KEYWORDS);
  return matches.filter((occasion) => occasion !== 'other');
}

function inferBrand(text: string): WardrobeBrandOption | undefined {
  for (const brand of BRAND_LIST) {
    if (brand === 'Other') continue;
    const normalizedBrand = brand.toLowerCase();
    if (text.includes(normalizedBrand)) {
      return brand;
    }
  }
  return undefined;
}

async function backfillAttributes() {
  const users = await db.getAllUsers();
  let processed = 0;
  let updated = 0;

  for (const user of users) {
    const items: WardrobeItem[] = await db.getItemsByUser(user.id);

    for (const item of items) {
      processed += 1;
      const text = normalizeText(item);
      if (!text) {
        continue;
      }

      const updates: Partial<WardrobeItem> = {};

      if (!item.colors || item.colors.length === 0) {
        const colors = extractColors(text);
        if (colors.length > 0) {
          updates.colors = colors;
        }
      }

      if (!item.fabrics || item.fabrics.length === 0) {
        const fabrics = extractFabrics(text);
        if (fabrics.length > 0) {
          updates.fabrics = fabrics;
        }
      }

      if (!item.pattern) {
        const pattern = extractPattern(text);
        if (pattern) {
          updates.pattern = pattern;
        }
      }

      if (!item.silhouettes || item.silhouettes.length === 0) {
        const silhouettes = extractSilhouettes(text, item.category);
        if (silhouettes.length > 0) {
          updates.silhouettes = silhouettes;
          if (!item.silhouette) {
            updates.silhouette = silhouettes[0];
          }
        }
      } else if (item.silhouettes && item.silhouettes.length > 0 && item.silhouette !== item.silhouettes[0]) {
        updates.silhouette = item.silhouettes[0];
      }

      if (!item.fit) {
        const fit = extractFit(text);
        if (fit) {
          updates.fit = fit;
        }
      }

      if (!item.formalities || item.formalities.length === 0) {
        const formalities = extractFormalities(text);
        if (formalities.length > 0) {
          updates.formalities = formalities;
        }
      }

      if (!item.styleTags || item.styleTags.length === 0) {
        const styleTags = extractStyleTags(text);
        if (styleTags.length > 0) {
          updates.styleTags = styleTags;
        }
      }

      if (!item.seasons || item.seasons.length === 0) {
        const seasons = extractSeasons(text);
        if (seasons.length > 0) {
          updates.seasons = seasons;
        }
      }

      if (!item.occasions || item.occasions.length === 0) {
        const occasions = extractOccasions(text);
        if (occasions.length > 0) {
          updates.occasions = occasions;
        }
      }

      if (!item.brand) {
        const inferredBrand = inferBrand(text);
        if (inferredBrand) {
          updates.brand = inferredBrand;
        }
      }

      if (
        (!item.subCategory || item.subCategory.toLowerCase() === 'other') &&
        item.category
      ) {
        const inferredSubCategory = inferSubCategory(item.category, item.title, item.description);
        if (inferredSubCategory && inferredSubCategory.toLowerCase() !== 'other') {
          updates.subCategory = inferredSubCategory;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.updateItem(item.id, updates);
        updated += 1;
        console.log(
          `Updated "${item.title}" for user ${user.id}: ${Object.keys(updates).join(', ')}`
        );
      }
    }
  }

  console.log(`\nProcessed ${processed} items. Updated ${updated} items with new attributes.`);
}

backfillAttributes()
  .then(async () => {
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
    console.log('Attribute backfill completed.');
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Error during attribute backfill:', error);
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
    process.exit(1);
  });

