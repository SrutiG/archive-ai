/* eslint-disable no-console */
/**
 * Quick test script to validate product URL scraping quality.
 * Usage (from backend/): ts-node src/scripts/testProductIngest.ts
 */
import { scrapeProductFromUrl } from '../productSearch';

type Check = {
  url: string;
  expects?: {
    titleIncludes?: string[];
    brandIncludes?: string[];
    requireImage?: boolean;
    colorIncludes?: string[];
  };
};

const cases: Check[] = [
  {
    url: 'https://bananarepublic.gap.com/browse/product.do?pid=7135160124003&vid=3#pdp-page-content',
    expects: {
      // BR sometimes blocks bots; just assert brand for now
      brandIncludes: ['banana', 'republic'],
      requireImage: false,
      colorIncludes: [],
    },
  },
  {
    url: 'https://bananarepublic.gap.com/browse/product.do?pid=834408002&vid=1&tid=brns000051#pdp-page-content',
    expects: {
      // Don't overfit BR; assert brand
      brandIncludes: ['banana', 'republic'],
      requireImage: false,
      colorIncludes: [],
    },
  },
  {
    url: 'https://vuoriclothing.com/products/womens-long-sleeve-pose-scoop-tee-black?queryId=0079ad3ca8c715e1202fd9482f9e0aed&collection=womens-long-sleeve-tops&objectId=40095614337127&utm_source=awin&utm_medium=affiliate&utm_campaign=78888&sv_campaign_id=78888&sv_tax1=affiliate&sv_tax2=591455&sv_tax3=Skimlinks&sv_tax4=listful.com&sv_affiliate_id=78888&awc=33371_1763228986_e1649ae7657fb38acce50e53532c6e1a',
    expects: {
      titleIncludes: ['Long Sleeve', 'Pose', 'Scoop', 'Tee'],
      brandIncludes: ['vuori'],
      requireImage: true,
      colorIncludes: ['black'],
    },
  },
  {
    url: 'https://www.hoka.com/en/us/gifts-for-running-lifestyle/transport-gtx/1133958.html?dwvar_1133958_color=CCPR',
    expects: {
      titleIncludes: ['Transport', 'GTX'],
      brandIncludes: ['hoka'],
      // Allow missing image due to anti-bot; we fallback-title from URL
      requireImage: false,
      colorIncludes: [],
    },
  },
  {
    url: 'https://www.depop.com/products/miss_muse-the-kooples-short-black-pleated/?utm_source=generic&utm_content=product&utm_campaign=SHARE_PRODUCT&utm_medium=share&utm_term=srutig&_branch_match_id=1315879219782782168&_branch_referrer=H4sIAAAAAAAAA8soKSkottLXT0ktyC%2FQSywo0MvJzMvWD6yKDPWOsnRPikyyrytKTUstKsrMS49PKsovL04tsnXOKMrPTQUA8wtzejwAAAA%3D',
    expects: {
      titleIncludes: ['Kooples', 'Skirt', 'Black'],
      requireImage: true,
      colorIncludes: ['black'],
    },
  },
  {
    url: 'https://www.vitalydesign.com/products/helix?variant=32986857701451',
    expects: {
      titleIncludes: ['Helix'],
      brandIncludes: ['vitaly'],
      requireImage: true,
      colorIncludes: [],
    },
  },
  {
    url: 'https://www.ssense.com/en-us/women/product/by-far/black-maxi-cush-creased-leather-shoulder-bag/18114861',
    expects: {
      // Title should be the product name, not the numeric ID
      titleIncludes: ['Black', 'Maxi', 'Cush', 'Shoulder', 'Bag'],
      brandIncludes: ['by', 'far'],
      // SSENSE blocks scraping, so image might be missing
      requireImage: false,
      colorIncludes: ['black'],
    },
  },
  {
    url: 'https://www.ssense.com/en-us/women/product/judy-turner/black-dandae-minidress/18278811',
    expects: {
      // Title should be the product name, not a generic category
      titleIncludes: ['Black', 'Dandae', 'Mini', 'Dress'],
      brandIncludes: ['judy', 'turner'],
      requireImage: false,
      colorIncludes: ['black'],
    },
  },
  {
    url: 'https://www.ssense.com/en-us/women/product/bambou-roger-kwong/gray-cotton-poplin-midi-skirt/18655991',
    expects: {
      // Should be categorized as "Bottoms" (skirt), not "Tops"
      titleIncludes: ['Gray', 'Cotton', 'Poplin', 'Midi', 'Skirt'],
      brandIncludes: ['bambou', 'roger', 'kwong'],
      requireImage: false,
      colorIncludes: ['gray', 'grey'],
    },
  },
];

function includesAll(haystack: string, needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return true;
  const h = haystack.toLowerCase();
  return needles.every(n => h.includes(n.toLowerCase()));
}

function arrayIncludesAny(arr: string[] | undefined, needles: string[] | undefined): boolean {
  if (!needles || needles.length === 0) return true;
  if (!arr || arr.length === 0) return false;
  const lower = arr.map(s => s.toLowerCase());
  return needles.some(n => lower.includes(n.toLowerCase()));
}

async function run(): Promise<number> {
  let failures = 0;
  console.log('=== Product URL Scrape Test ===');
  for (const test of cases) {
    console.log(`\n[CASE] ${test.url}`);
    try {
      const product = await scrapeProductFromUrl(test.url);
      if (!product) {
        console.log('  ❌ Scrape returned null');
        failures++;
        continue;
      }
      console.log(`  Title: ${product.title}`);
      console.log(`  Brand: ${product.brand || '(none)'}`);
      console.log(`  Image: ${product.imageUrl || '(missing)'}`);
      console.log(`  Colors: ${product.colors?.join(', ') || '(none)'}`);
      console.log(`  URL: ${product.productUrl}`);

      let passed = true;
      if (!includesAll(product.title || '', test.expects?.titleIncludes)) {
        console.log('  ❌ Title does not include expected keywords');
        passed = false;
      }
      if (test.expects?.brandIncludes && test.expects.brandIncludes.length > 0) {
        const b = (product.brand || '').toLowerCase();
        if (!includesAll(b, test.expects.brandIncludes)) {
          console.log('  ❌ Brand missing expected keywords');
          passed = false;
        }
      }
      if (test.expects?.requireImage && !product.imageUrl) {
        console.log('  ❌ Missing imageUrl');
        passed = false;
      }
      if (!arrayIncludesAny(product.colors, test.expects?.colorIncludes)) {
        // Not critical, but helpful signal
        console.log('  ⚠️  Colors did not include expected values (non-fatal)');
      }

      if (passed) {
        console.log('  ✅ PASS');
      } else {
        console.log('  ❌ FAIL');
        failures++;
      }
    } catch (err) {
      console.log('  ❌ Exception:', err);
      failures++;
    }
  }
  console.log(`\n=== Done. Failures: ${failures} ===`);
  return failures;
}

// Execute if run directly
if (require.main === module) {
  run().then(f => process.exit(f > 0 ? 1 : 0));
}


