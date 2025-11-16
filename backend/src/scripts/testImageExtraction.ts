/* eslint-disable no-console */
/**
 * Test image extraction across multiple retailers to measure success rate.
 * Usage (from backend/): ts-node src/scripts/testImageExtraction.ts
 */
// Load environment variables
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../.env') });

import { scrapeProductFromUrl } from '../productSearch';

type TestCase = {
  url: string;
  retailer: string;
  expectedTitle?: string;
};

const testCases: TestCase[] = [
  // Shopify stores (usually good)
  { url: 'https://vuoriclothing.com/products/womens-long-sleeve-pose-scoop-tee-black', retailer: 'Vuori' },
  { url: 'https://www.allbirds.com/products/womens-tree-runners', retailer: 'Allbirds' },
  { url: 'https://www.gymshark.com/products/gymshark-flex-2-0-leggings-black', retailer: 'Gymshark' },
  
  // Gap Inc. (Banana Republic, Old Navy, Gap)
  { url: 'https://bananarepublic.gap.com/browse/product.do?pid=834408002&vid=1&tid=brns000051', retailer: 'Banana Republic' },
  { url: 'https://www.gap.com/browse/product.do?pid=123456&vid=1', retailer: 'Gap' },
  
  // Athletic
  { url: 'https://www.hoka.com/en/us/gifts-for-running-lifestyle/transport-gtx/1133958.html?dwvar_1133958_color=CCPR', retailer: 'Hoka' },
  { url: 'https://www.lululemon.com/p/womens-pants/align-high-rise-pant-28/LW5CZQS.html', retailer: 'Lululemon' },
  
  // Everlane
  { url: 'https://www.everlane.com/products/womens-oversized-shirt-silk-organza-parchment', retailer: 'Everlane' },
  
  // Marketplaces
  { url: 'https://www.depop.com/products/miss_muse-the-kooples-short-black-pleated', retailer: 'Depop' },
  
  // Outdoor
  { url: 'https://www.patagonia.com/product/mens-better-sweater-jacket/25501.html', retailer: 'Patagonia' },
  { url: 'https://www.rei.com/product/123456', retailer: 'REI' },
  
  // Additional Shopify stores
  { url: 'https://www.glossier.com/products/cloud-paint', retailer: 'Glossier' },
  { url: 'https://www.outdoorvoices.com/products/doing-things-bra', retailer: 'Outdoor Voices' },
];

interface TestResult {
  retailer: string;
  url: string;
  success: boolean;
  hasImage: boolean;
  hasTitle: boolean;
  hasBrand: boolean;
  usedGoogleFallback?: boolean;
  error?: string;
}

async function testImageExtraction(): Promise<void> {
  console.log('=== Image Extraction Test Suite ===\n');
  console.log(`Testing ${testCases.length} product URLs from various retailers...\n`);
  
  const results: TestResult[] = [];
  
  for (let i = 0; i < testCases.length; i++) {
    const testCase = testCases[i];
    console.log(`[${i + 1}/${testCases.length}] Testing ${testCase.retailer}...`);
    
    try {
      const product = await scrapeProductFromUrl(testCase.url);
      
      if (!product) {
        results.push({
          retailer: testCase.retailer,
          url: testCase.url,
          success: false,
          hasImage: false,
          hasTitle: false,
          hasBrand: false,
          error: 'Scrape returned null',
        });
        console.log(`  ❌ Failed: returned null\n`);
        continue;
      }
      
      const hasImage = Boolean(product.imageUrl && !product.imageUrl.includes('pixel') && !product.imageUrl.includes('akam'));
      const hasTitle = Boolean(product.title && product.title.length > 5 && product.title !== product.productUrl);
      const hasBrand = Boolean(product.brand);
      const usedGoogleFallback = Boolean((product.rawMetadata as any)?.googleFallback);
      
      const success = hasImage && hasTitle;
      
      results.push({
        retailer: testCase.retailer,
        url: testCase.url,
        success,
        hasImage,
        hasTitle,
        hasBrand,
        usedGoogleFallback,
      });
      
      console.log(`  Title: ${product.title || '(missing)'}`);
      console.log(`  Brand: ${product.brand || '(missing)'}`);
      console.log(`  Image: ${hasImage ? '✅' : '❌'} ${product.imageUrl || '(missing)'}`);
      if (usedGoogleFallback) {
        console.log(`  🔍 Used Google Custom Search fallback`);
      }
      console.log(`  ${success ? '✅ PASS' : '❌ FAIL'}\n`);
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      results.push({
        retailer: testCase.retailer,
        url: testCase.url,
        success: false,
        hasImage: false,
        hasTitle: false,
        hasBrand: false,
        error: errorMsg,
      });
      console.log(`  ❌ Exception: ${errorMsg}\n`);
    }
  }
  
  // Summary
  console.log('\n=== SUMMARY ===\n');
  const total = results.length;
  const successful = results.filter(r => r.success).length;
  const withImage = results.filter(r => r.hasImage).length;
  const withTitle = results.filter(r => r.hasTitle).length;
  const withBrand = results.filter(r => r.hasBrand).length;
  const usedGoogleFallback = results.filter(r => r.usedGoogleFallback).length;
  
  console.log(`Total tested: ${total}`);
  console.log(`✅ Fully successful (image + title): ${successful} (${Math.round(successful / total * 100)}%)`);
  console.log(`🖼️  Has image: ${withImage} (${Math.round(withImage / total * 100)}%)`);
  console.log(`📝 Has title: ${withTitle} (${Math.round(withTitle / total * 100)}%)`);
  console.log(`🏷️  Has brand: ${withBrand} (${Math.round(withBrand / total * 100)}%)`);
  console.log(`🔍 Used Google Custom Search fallback: ${usedGoogleFallback} (${Math.round(usedGoogleFallback / total * 100)}%)\n`);
  
  // Breakdown by retailer
  console.log('=== BY RETAILER ===\n');
  const byRetailer = new Map<string, TestResult[]>();
  for (const result of results) {
    const existing = byRetailer.get(result.retailer) || [];
    existing.push(result);
    byRetailer.set(result.retailer, existing);
  }
  
  for (const [retailer, retailerResults] of byRetailer.entries()) {
    const retailerSuccess = retailerResults.filter(r => r.success).length;
    const retailerImage = retailerResults.filter(r => r.hasImage).length;
    console.log(`${retailer}: ${retailerSuccess}/${retailerResults.length} successful, ${retailerImage}/${retailerResults.length} with images`);
  }
  
  // Failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    console.log('\n=== FAILURES ===\n');
    for (const failure of failures) {
      console.log(`${failure.retailer}:`);
      console.log(`  URL: ${failure.url}`);
      console.log(`  Image: ${failure.hasImage ? '✅' : '❌'}`);
      console.log(`  Title: ${failure.hasTitle ? '✅' : '❌'}`);
      if (failure.usedGoogleFallback) {
        console.log(`  🔍 Used Google Custom Search fallback`);
      }
      if (failure.error) {
        console.log(`  Error: ${failure.error}`);
      }
      console.log('');
    }
  }
}

// Execute if run directly
if (require.main === module) {
  testImageExtraction()
    .then(() => {
      console.log('\n✅ Test suite complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test suite failed:', error);
      process.exit(1);
    });
}

