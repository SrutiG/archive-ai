import type { ProductSearchResult, ProductSearchProvider } from './productSearch';
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer-core';

/**
 * Google Shopping Web Scraper (FREE - no API limits)
 * 
 * Scrapes Google Shopping directly to avoid API costs.
 * This is completely free but may be less reliable than APIs.
 */
export class GoogleShoppingScraperProvider implements ProductSearchProvider {
  private browser: any = null;
  
  async search(query: string): Promise<ProductSearchResult[]> {
    try {
      // Try original query first (for specific products like "jordan 4 bred")
      // Then try with enhancements if needed
      const queriesToTry = [
        query, // Original query first
        `${query} buy`, // Add buy keyword
        `womens ${query}`, // Add womens if not present
        `womens ${query} clothing`, // Full enhancement
      ];
      
      const lowerQuery = query.toLowerCase();
      // Remove duplicates
      const uniqueQueries = [...new Set(queriesToTry.filter(q => {
        const lower = q.toLowerCase();
        // Skip womens variants if query already has it
        if (lower.includes('women') && lower !== query.toLowerCase()) {
          return false;
        }
        return true;
      }))];
      
      for (const searchQuery of uniqueQueries) {
        const results = await this.tryScrape(searchQuery);
        if (results.length > 0) {
          console.log(`[GoogleShoppingScraper] Successfully found ${results.length} results with query: "${searchQuery}"`);
          return results;
        }
      }
      
      console.warn('[GoogleShoppingScraper] All query variations returned 0 results');
      return [];
    } catch (error) {
      console.error('[GoogleShoppingScraper] Error in search:', error);
      throw error;
    }
  }
  
  private async tryScrape(searchQuery: string): Promise<ProductSearchResult[]> {
    // Try Google Shopping first
    const shoppingUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&tbm=shop`;
    let results = await this.scrapeUrl(shoppingUrl, true);
    
    // If no results, try regular Google search (sometimes has shopping results)
    if (results.length === 0) {
      const regularUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' buy')}`;
      results = await this.scrapeUrl(regularUrl, false);
    }
    
    return results;
  }
  
  private async getBrowser() {
    if (!this.browser) {
      console.log('[GoogleShoppingScraper] Launching browser with system Chrome...');
      
      try {
        // Use system Chrome to avoid compatibility issues
        const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
        
        this.browser = await puppeteer.launch({
          executablePath: chromePath,
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled', // Hide automation
          ],
        });
        console.log('[GoogleShoppingScraper] Browser launched successfully');
      } catch (error) {
        console.error('[GoogleShoppingScraper] Failed to launch browser:', error);
        throw new Error('Puppeteer browser launch failed. Please ensure Google Chrome is installed.');
      }
    }
    return this.browser;
  }
  
  private async scrapeUrl(url: string, isShopping: boolean): Promise<ProductSearchResult[]> {
    console.log(`[GoogleShoppingScraper] Scraping URL with Puppeteer: ${url.substring(0, 100)}...`);
    
    let html = '';
    let page: any = null;
    
    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      
      // Set viewport and user agent to look like a real browser
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to the page
      await page.goto(url, {
        waitUntil: 'domcontentloaded', // Wait for DOM to load
        timeout: 30000,
      });
      
      // Wait for search results to appear (try multiple selectors)
      try {
        await Promise.race([
          page.waitForSelector('h3', { timeout: 5000 }).catch(() => null),
          page.waitForSelector('[data-docid]', { timeout: 5000 }).catch(() => null),
          page.waitForSelector('.sh-dgr__content', { timeout: 5000 }).catch(() => null),
          page.waitForSelector('.g', { timeout: 5000 }).catch(() => null),
        ]);
      } catch (e) {
        // Continue even if selectors don't appear
      }
      
      // Wait a bit more for JavaScript to fully render
      await page.waitForTimeout(1000);
      
      // Get the rendered HTML
      html = await page.content();
      
      await page.close();
    } catch (error) {
      if (page) {
        try {
          await page.close();
        } catch (e) {
          // Ignore close errors
        }
      }
      console.error(`[GoogleShoppingScraper] Puppeteer error for ${url}:`, error);
      return [];
    }
    
    // Debug: log response details
    console.log(`[GoogleShoppingScraper] HTML length: ${html.length} chars (rendered with Puppeteer)`);
    
    // Check what we actually got
    const htmlLower = html.toLowerCase();
    const hasCaptcha = htmlLower.includes('captcha') || htmlLower.includes('unusual traffic') || htmlLower.includes('automated queries');
    const hasRedirect = htmlLower.includes('location.replace') || htmlLower.includes('window.location');
    const hasShopping = htmlLower.includes('shopping') || htmlLower.includes('tbm=shop');
    const hasResults = htmlLower.includes('result') || htmlLower.includes('search');
    
    console.log(`[GoogleShoppingScraper] HTML analysis - CAPTCHA: ${hasCaptcha}, Redirect: ${hasRedirect}, Shopping: ${hasShopping}, Results: ${hasResults}`);
    
    // Log first 1000 chars of HTML for debugging
    const htmlPreview = html.substring(0, 1000).replace(/\s+/g, ' ');
    console.log(`[GoogleShoppingScraper] HTML preview (first 1000 chars): ${htmlPreview}...`);
    
    // Check if we got a CAPTCHA or error page
    if (hasCaptcha) {
      console.warn('[GoogleShoppingScraper] Google detected bot traffic (CAPTCHA or blocking)');
      // Log more details about what Google returned
      if (htmlLower.includes('our systems have detected')) {
        console.warn('[GoogleShoppingScraper] Google is blocking automated requests');
      }
      return [];
    }
    
    // Check if we got redirected
    if (hasRedirect) {
      console.warn('[GoogleShoppingScraper] Page contains redirect - might need JavaScript');
      // Try to extract redirect URL
      const redirectMatch = html.match(/window\.location\s*=\s*['"]([^'"]+)['"]/i) || 
                           html.match(/location\.replace\(['"]([^'"]+)['"]/i);
      if (redirectMatch) {
        console.warn(`[GoogleShoppingScraper] Redirect URL: ${redirectMatch[1]}`);
      }
    }
    
    // Check if we got redirected or got an error page
    if (html.length < 5000) {
      console.warn(`[GoogleShoppingScraper] Suspiciously short response (${html.length} chars)`);
      return [];
    }
    
    const $ = cheerio.load(html);
    const results: ProductSearchResult[] = [];
    
    // Debug: log HTML structure with more details
    const titleCount = $('h3').length;
    const h2Count = $('h2').length;
    const h1Count = $('h1').length;
    const linkCount = $('a[href*="shopping"]').length;
    const allLinks = $('a').length;
    const imgCount = $('img').length;
    const divCount = $('div').length;
    
    console.log(`[GoogleShoppingScraper] HTML stats - h1: ${h1Count}, h2: ${h2Count}, h3: ${titleCount}, divs: ${divCount}`);
    console.log(`[GoogleShoppingScraper] Links - total: ${allLinks}, shopping: ${linkCount}, images: ${imgCount}`);
    
    // Check for common Google Shopping selectors
    const shoppingSelectors = [
      '[data-docid]',
      '.sh-dgr__content',
      '.sh-dgr__grid-result',
      '.g',
      '.tF2Cxc',
    ];
    
    for (const selector of shoppingSelectors) {
      const count = $(selector).length;
      if (count > 0) {
        console.log(`[GoogleShoppingScraper] Found ${count} elements matching "${selector}"`);
      }
    }
    
    // Check page title
    const pageTitle = $('title').text();
    console.log(`[GoogleShoppingScraper] Page title: "${pageTitle}"`);
    
    // Try multiple parsing strategies
    const strategies = [
      () => this.parseShoppingGrid($),
      () => this.parseGenericResults($),
      () => this.parseJSONData(html),
    ];
    
    for (const strategy of strategies) {
      try {
        const parsed = strategy();
        if (parsed.length > 0) {
          console.log(`[GoogleShoppingScraper] Strategy found ${parsed.length} results`);
          results.push(...parsed);
          if (results.length >= 10) break;
        }
      } catch (e) {
        // Continue to next strategy
      }
    }
    
    // Remove duplicates and filter
    const uniqueResults = this.deduplicateResults(results);
    const filtered = this.filterResults(uniqueResults);
    
    console.log(`[GoogleShoppingScraper] Final results: ${filtered.length} after deduplication and filtering`);
    return filtered.slice(0, 10);
  }
  
  private parseShoppingGrid($: cheerio.CheerioAPI): ProductSearchResult[] {
    const results: ProductSearchResult[] = [];
    
    // Try multiple selector strategies for Google Shopping
    const selectors = [
      '[data-docid]',
      '.sh-dgr__content',
      '.sh-dgr__grid-result',
      '.sh-dgr__content-result',
      '.sh-dgr__grid-result-item',
      '.sh-dgr__content-result-item',
    ];
    
    for (const selector of selectors) {
      $(selector).each((index, element) => {
        if (results.length >= 10) return false;
        
        const $el = $(element);
        const result = this.extractProductFromElement($el, $);
        if (result) results.push(result);
      });
      
      if (results.length > 0) break; // Found results with this selector
    }
    
    return results;
  }
  
  private parseGenericResults($: cheerio.CheerioAPI): ProductSearchResult[] {
    const results: ProductSearchResult[] = [];
    
    // Try parsing regular Google results that might be products
    $('.g, .tF2Cxc, .yuRUbf').each((index, element) => {
      if (results.length >= 10) return false;
      
      const $el = $(element);
      const title = $el.find('h3').first().text().trim();
      const link = $el.find('a').first().attr('href') || '';
      
      // Only include if it looks like a product (has price, shopping link, or product keywords)
      const text = $el.text().toLowerCase();
      const hasPrice = /\$|£|€|\d+\.\d{2}/.test(text);
      const isShoppingLink = link.includes('shopping') || link.includes('product');
      const hasProductKeywords = /buy|price|shop|product|size|color/.test(text);
      
      if (title && (hasPrice || isShoppingLink || hasProductKeywords)) {
        const result = this.extractProductFromElement($el, $);
        if (result) results.push(result);
      }
    });
    
    return results;
  }
  
  private parseJSONData(html: string): ProductSearchResult[] {
    const results: ProductSearchResult[] = [];
    
    // Try to extract JSON-LD structured data
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const jsonStr = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonStr);
          if (data['@type'] === 'Product' || data['@type'] === 'ItemList') {
            // Extract product data from JSON-LD
            if (data.name && data.offers) {
              results.push({
                title: data.name,
                brand: data.brand?.name,
                description: data.description,
                imageUrl: data.image,
                productUrl: data.url || data.offers.url,
                price: data.offers.price ? `$${data.offers.price}` : undefined,
              });
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    return results;
  }
  
  private extractProductFromElement($el: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): ProductSearchResult | null {
    // Try multiple title selectors
    const title = $el.find('h3, h4, .sh-dgr__content-title, [data-docid] h3, .LC20lb, .DKV0Md').first().text().trim() ||
                 $el.attr('aria-label') ||
                 $el.find('a').first().attr('aria-label') ||
                 '';
    
    if (!title || title.length < 3) return null;
    
    // Extract price - try multiple selectors
    const priceText = $el.find('.a8Pemb, .aULzUe, .price, .HjpWhd, .a-price, .OSrXXb').first().text().trim() ||
                     $el.text().match(/\$[\d,]+\.?\d*/)?.[0];
    
    // Extract image - try multiple attributes
    const imageUrl = $el.find('img').first().attr('src') || 
                    $el.find('img').first().attr('data-src') ||
                    $el.find('img').first().attr('data-iml') ||
                    '';
    
    // Extract link
    let link = $el.find('a').first().attr('href') || '';
    if (link.startsWith('/url?q=')) {
      const match = link.match(/\/url\?q=([^&]+)/);
      link = match ? decodeURIComponent(match[1]) : link;
    } else if (link.startsWith('/')) {
      link = `https://www.google.com${link}`;
    }
    const productUrl = link.startsWith('http') ? link : '';
    
    // Extract brand/source
    const brand = $el.find('.E5ocAb, .sh-dgr__content-source, .VqFMTc, .VqFMTc.NnrWwf').first().text().trim() || undefined;
    
    // Extract description
    const description = $el.find('.sh-dgr__content-summary, .sh-dgr__content-text, .VwiC3b, .s').first().text().trim() || '';
    
    // Only include if it looks like a product
    if (!title || (!imageUrl && !priceText && !productUrl)) {
      return null;
    }
    
    return {
      title: title,
      brand: brand,
      description: description,
      imageUrl: imageUrl,
      productUrl: productUrl,
      price: priceText || undefined,
    };
  }
  
  private deduplicateResults(results: ProductSearchResult[]): ProductSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.title.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
  
  private filterResults(results: ProductSearchResult[]): ProductSearchResult[] {
    return results.filter(result => {
      const combinedText = `${result.title} ${result.description || ''} ${result.brand || ''}`.toLowerCase();
      
      // Exclude men's products (but allow if "women" is also mentioned)
      const menTerms = ['men', "men's", 'mens', 'male', 'guy', 'boys'];
      const hasMenTerm = menTerms.some(term => combinedText.includes(term));
      const hasWomenTerm = combinedText.includes('women') || combinedText.includes('womens');
      if (hasMenTerm && !hasWomenTerm) {
        return false;
      }
      
      // Exclude non-clothing
      const nonClothingTerms = ['electronics', 'phone', 'laptop', 'tablet', 'computer', 'furniture', 'home', 'kitchen', 'book', 'game'];
      if (nonClothingTerms.some(term => combinedText.includes(term))) {
        return false;
      }
      
      return true;
    });
  }
}

/**
 * Google Custom Search API Provider (configured for Google Shopping)
 * 
 * To use this:
 * 1. Get a Google Custom Search API key from https://developers.google.com/custom-search/v1/overview
 * 2. Create a Custom Search Engine at https://programmablesearchengine.google.com/
 * 3. IMPORTANT: Configure the search engine to search Google Shopping:
 *    - In "Sites to search", add: shopping.google.com
 *    - OR set "Search the entire web" and we'll filter for shopping results
 * 4. Set environment variables:
 *    - GOOGLE_SEARCH_API_KEY=your_api_key
 *    - GOOGLE_SEARCH_ENGINE_ID=your_engine_id
 * 
 * FREE tier: 100 searches per day
 */
export class GoogleShoppingProvider implements ProductSearchProvider {
  private apiKey: string;
  private searchEngineId: string;

  constructor() {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const searchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !searchEngineId) {
      throw new Error(
        'Google Shopping API requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID environment variables'
      );
    }

    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  async search(query: string): Promise<ProductSearchResult[]> {
    try {
      // Enhance query for women's clothing and Google Shopping
      const lowerQuery = query.toLowerCase();
      let enhancedQuery = query;
      
      // Add gender filter if not present
      if (!lowerQuery.includes('women') && !lowerQuery.includes('womens') && !lowerQuery.includes("women's")) {
        enhancedQuery = `womens ${query}`;
      }
      
      // Try to focus on Google Shopping - add site:shopping.google.com if not already in query
      // Note: This works best if your Custom Search Engine is configured to search the entire web
      // If your engine is already limited to shopping.google.com, this is redundant but harmless
      if (!enhancedQuery.includes('site:shopping.google.com')) {
        enhancedQuery = `site:shopping.google.com ${enhancedQuery}`;
      }
      
      // Add shopping-related terms to improve results
      enhancedQuery = `${enhancedQuery} buy product price`;
      
      const url = new URL('https://www.googleapis.com/customsearch/v1');
      url.searchParams.set('key', this.apiKey);
      url.searchParams.set('cx', this.searchEngineId);
      url.searchParams.set('q', enhancedQuery);
      url.searchParams.set('num', '20'); // Get more results for filtering
      // Exclude common non-product pages
      url.searchParams.set('excludeTerms', 'blog review article guide how-to men mens');
      
      console.log(`[GoogleShoppingProvider] Original query: "${query}" -> Enhanced: "${enhancedQuery}"`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Google Search API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { items?: any[] };
      const items = data.items || [];

      // Score and filter results to prioritize actual product pages
      const scoredItems = items.map((item: any) => {
        const title = (item.title || '').toLowerCase();
        const snippet = (item.snippet || '').toLowerCase();
        const link = (item.link || '').toLowerCase();
        let score = 0;
        
        // Exclude domains that are never product pages
        const excludedDomains = [
          'reddit.com', 'redd.it',
          'twitter.com', 'x.com',
          'facebook.com',
          'instagram.com',
          'pinterest.com',
          'tumblr.com',
          'medium.com',
          'wordpress.com',
          'blogger.com',
          'blogspot.com',
          'wikipedia.org',
          'youtube.com',
          'tiktok.com',
        ];
        
        let domain = '';
        try {
          domain = new URL(link).hostname.replace('www.', '');
        } catch (e) {
          // Invalid URL, skip domain checks
        }
        
        if (domain && excludedDomains.some(excluded => domain.includes(excluded))) {
          return { item, score: -100 }; // Hard exclude
        }
        
        // Strong exclusion patterns
        const strongExcludePatterns = [
          /reddit|redd\.it/i,
          /\/r\//, // Reddit subreddit
          /blog|article|post|review|guide|how.?to|story|news|opinion|editorial/i,
          /\/blog\/|\/article\/|\/post\/|\/review\/|\/news\//i,
          /category|collection|shop|store$|all.*products/i, // Category/collection pages
          /discussion|thread|comment|reply/i,
          /forum|community|discuss/i,
        ];
        
        // Exclude men's products (but allow if "women" is also mentioned)
        const combinedText = `${title} ${snippet} ${link}`.toLowerCase();
        const menTerms = ['men', "men's", 'mens', 'male', 'guy', 'boys'];
        const hasMenTerm = menTerms.some(term => combinedText.includes(term));
        const hasWomenTerm = combinedText.includes('women') || combinedText.includes('womens');
        if (hasMenTerm && !hasWomenTerm) {
          return { item, score: -100 }; // Hard exclude men's products
        }
        
        if (strongExcludePatterns.some(pattern => pattern.test(title) || pattern.test(snippet) || pattern.test(link))) {
          score -= 50; // Strong penalty
        }
        
        // Strong inclusion patterns (product indicators)
        const strongIncludePatterns = [
          /\/product\/|\/item\/|\/p\/|\/dp\//i, // Product URL patterns
          /\$|\£|\€|\¥/, // Currency symbols
          /add to cart|buy now|add to bag|purchase/i,
          /size|color|quantity|in stock/i,
        ];
        
        if (strongIncludePatterns.some(pattern => pattern.test(title) || pattern.test(snippet) || pattern.test(link))) {
          score += 30; // Strong bonus
        }
        
        // Moderate inclusion patterns
        const moderateIncludePatterns = [
          /product|item|price|cost|shop|buy/i,
          /shipping|delivery|returns/i,
        ];
        
        if (moderateIncludePatterns.some(pattern => pattern.test(title) || pattern.test(snippet))) {
          score += 10; // Moderate bonus
        }
        
        // Clothing-specific bonus
        const clothingTerms = [
          /clothing|apparel|fashion|wear/i,
          /top|shirt|blouse|sweater|jacket|coat|dress|skirt|pants|trousers|jeans/i,
          /shoes|boots|heels|sneakers|sandals/i,
          /bag|handbag|purse|accessories|jewelry/i,
        ];
        
        if (clothingTerms.some(pattern => pattern.test(title) || pattern.test(snippet))) {
          score += 20; // Clothing bonus
        }
        
        // Exclude non-clothing categories
        const nonClothingTerms = [
          /electronics|phone|laptop|tablet|computer/i,
          /furniture|home|kitchen|appliance/i,
          /book|game|toy|tool|hardware/i,
          /food|beverage|supplement|vitamin/i,
          /car|vehicle|automotive/i,
        ];
        
        if (nonClothingTerms.some(pattern => pattern.test(title) || pattern.test(snippet) || pattern.test(link))) {
          score -= 50; // Strong penalty for non-clothing
        }
        
        // Bonus for known shopping domains
        if (domain) {
          const shoppingDomains = [
            'amazon.com', 'amazon.co.uk',
            'etsy.com',
            'ebay.com',
            'shopify.com',
            'bigcommerce.com',
            'woocommerce.com',
          ];
          
          if (shoppingDomains.some(shopping => domain.includes(shopping))) {
            score += 20;
          }
        }
        
        return { item, score };
      });

      // Filter to only include items with positive scores, then sort by score
      const productItems = scoredItems
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10) // Take top 10
        .map(({ item }) => item);

      return productItems.map((item: any) => {
        // Extract brand from title or snippet
        const title = item.title || '';
        const snippet = item.snippet || '';
        const brandMatch = title.match(/^([A-Z][a-zA-Z\s&]+?)\s/);
        const brand = brandMatch ? brandMatch[1].trim() : undefined;

        // Try to extract product name from title (remove brand, remove common suffixes)
        let productTitle = title.replace(/^[A-Z][a-zA-Z\s&]+?\s/, '').trim();
        productTitle = productTitle.replace(/\s*-\s*(Shop|Store|Buy|Online).*$/i, '').trim();
        productTitle = productTitle || title;

        return {
          title: productTitle,
          brand,
          description: snippet,
          imageUrl: item.pagemap?.cse_image?.[0]?.src || item.pagemap?.metatags?.[0]?.['og:image'] || item.link,
          productUrl: item.link,
          rawMetadata: item,
        };
      });
    } catch (error) {
      console.error('[GoogleShoppingProvider] Error searching:', error);
      throw error;
    }
  }
}

/**
 * SerpAPI Provider (Alternative - requires paid API)
 * 
 * To use this:
 * 1. Sign up at https://serpapi.com/
 * 2. Get your API key
 * 3. Set environment variable: SERPAPI_KEY=your_api_key
 */
export class SerpAPIProvider implements ProductSearchProvider {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      throw new Error('SerpAPI requires SERPAPI_KEY environment variable');
    }
    this.apiKey = apiKey;
  }

  async search(query: string): Promise<ProductSearchResult[]> {
    try {
      // Enhance query to focus on women's clothing/fashion
      // Add "womens" or "women's" if not already present, and clothing terms
      const lowerQuery = query.toLowerCase();
      let enhancedQuery = query;
      
      // Add gender filter if not present
      if (!lowerQuery.includes('women') && !lowerQuery.includes('womens') && !lowerQuery.includes("women's")) {
        enhancedQuery = `womens ${query}`;
      }
      
      // Add clothing/fashion terms if not present
      const clothingTerms = ['clothing', 'fashion', 'apparel', 'wear'];
      const hasClothingTerm = clothingTerms.some(term => lowerQuery.includes(term));
      if (!hasClothingTerm) {
        enhancedQuery = `${enhancedQuery} clothing`;
      }
      
      // Use Google Shopping engine for product-specific results
      const url = new URL('https://serpapi.com/search.json');
      url.searchParams.set('api_key', this.apiKey);
      url.searchParams.set('q', enhancedQuery);
      url.searchParams.set('engine', 'google_shopping');
      url.searchParams.set('num', '20'); // Get more results so we can filter
      url.searchParams.set('tbs', 'vw:g'); // View grid layout (product-focused)
      
      console.log(`[SerpAPIProvider] Original query: "${query}" -> Enhanced: "${enhancedQuery}"`);

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SerpAPIProvider] API error response:', errorText);
        throw new Error(`SerpAPI error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { 
        shopping_results?: any[];
        error?: string;
        organic_results?: any[];
      };

      if (data.error) {
        console.error('[SerpAPIProvider] API returned error:', data.error);
        throw new Error(`SerpAPI error: ${data.error}`);
      }

      // Only use shopping_results - these are actual product listings
      // Don't use organic_results as they're general web search results
      const shoppingResults = data.shopping_results || [];
      
      console.log(`[SerpAPIProvider] Found ${shoppingResults.length} raw shopping results`);
      
      // Filter for women's clothing only
      const clothingCategories = [
        'clothing', 'apparel', 'fashion', 'wear',
        'top', 'shirt', 'blouse', 'sweater', 'jacket', 'coat',
        'dress', 'skirt', 'pants', 'trousers', 'jeans',
        'shoes', 'boots', 'heels', 'sneakers', 'sandals',
        'bag', 'handbag', 'purse', 'accessories', 'jewelry',
        'underwear', 'lingerie', 'swimwear'
      ];
      
      const menTerms = ['men', "men's", 'mens', 'male', 'guy', 'boys'];
      
      const filteredResults = shoppingResults.filter((result: any) => {
        const title = (result.title || result.product_title || '').toLowerCase();
        const description = (result.description || result.product_description || '').toLowerCase();
        const combined = `${title} ${description}`;
        
        // Exclude men's products
        if (menTerms.some(term => combined.includes(term) && !combined.includes('women'))) {
          console.log(`[SerpAPIProvider] Excluding men's product: "${result.title || result.product_title}"`);
          return false;
        }
        
        // Include if it has clothing-related terms
        const hasClothingTerm = clothingCategories.some(term => combined.includes(term));
        if (hasClothingTerm) {
          return true;
        }
        
        // Exclude common non-clothing categories
        const nonClothingTerms = [
          'electronics', 'phone', 'laptop', 'tablet', 'computer',
          'furniture', 'home', 'kitchen', 'appliance',
          'book', 'game', 'toy', 'tool', 'hardware',
          'food', 'beverage', 'supplement', 'vitamin',
          'car', 'vehicle', 'automotive'
        ];
        
        if (nonClothingTerms.some(term => combined.includes(term))) {
          console.log(`[SerpAPIProvider] Excluding non-clothing product: "${result.title || result.product_title}"`);
          return false;
        }
        
        // If we can't determine, include it (better to show than hide)
        return true;
      }).slice(0, 10); // Limit to top 10 after filtering
      
      console.log(`[SerpAPIProvider] Filtered to ${filteredResults.length} women's clothing results`);
      
      if (filteredResults.length === 0) {
        console.warn('[SerpAPIProvider] No women\'s clothing results found after filtering');
      }

      return filteredResults.map((result: any) => {
        // Try multiple image fields - SerpAPI can return images in different formats
        const imageUrl = result.thumbnail || 
                        result.image || 
                        result.product_image || 
                        result.original_image ||
                        result.images?.[0]?.original ||
                        result.images?.[0]?.thumbnail ||
                        '';
        
        console.log(`[SerpAPIProvider] Product: "${result.title || result.product_title}" - Image: ${imageUrl || 'MISSING'}`);
        
        return {
          title: result.title || result.product_title || '',
          brand: result.source || result.brand || result.seller || undefined,
          description: result.description || result.product_description || '',
          imageUrl: imageUrl,
          productUrl: result.link || result.product_link || '',
          price: result.price || result.product_price || undefined,
          rawMetadata: result,
        };
      });
    } catch (error) {
      console.error('[SerpAPIProvider] Error searching:', error);
      throw error;
    }
  }
}

/**
 * Etsy API Provider for Product Search
 * 
 * To use this:
 * 1. Register at https://www.etsy.com/developers/
 * 2. Create an app and get your API key
 * 3. Set environment variable: ETSY_API_KEY=your_api_key
 * 
 * Note: Good for unique, handmade, and vintage items
 */
export class EtsyProvider implements ProductSearchProvider {
  private apiKey: string;

  constructor() {
    const apiKey = process.env.ETSY_API_KEY;
    if (!apiKey) {
      throw new Error('Etsy API requires ETSY_API_KEY environment variable');
    }
    this.apiKey = apiKey;
  }

  async search(query: string): Promise<ProductSearchResult[]> {
    try {
      const url = new URL('https://openapi.etsy.com/v3/application/listings/active');
      url.searchParams.set('keywords', query);
      url.searchParams.set('limit', '10');
      url.searchParams.set('includes', 'Images,Shop');

      const response = await fetch(url.toString(), {
        headers: {
          'x-api-key': this.apiKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[EtsyProvider] API error response:', errorText);
        throw new Error(`Etsy API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        results?: any[];
        error?: string;
      };

      if (data.error) {
        console.error('[EtsyProvider] API returned error:', data.error);
        throw new Error(`Etsy API error: ${data.error}`);
      }

      const listings = data.results || [];
      console.log(`[EtsyProvider] Found ${listings.length} listings`);

      return listings.map((listing: any) => {
        // Get the first image URL
        const imageUrl = listing.Images?.[0]?.url_fullxfull || 
                        listing.Images?.[0]?.url_570xN || 
                        listing.Images?.[0]?.url_75x75 || 
                        '';

        return {
          title: listing.title || '',
          brand: listing.Shop?.shop_name || undefined,
          description: listing.description || '',
          imageUrl: imageUrl,
          productUrl: listing.url || `https://www.etsy.com/listing/${listing.listing_id}`,
          price: listing.price ? `$${listing.price}` : undefined,
          category: listing.taxonomy_path?.[0] || undefined,
          rawMetadata: listing,
        };
      });
    } catch (error) {
      console.error('[EtsyProvider] Error searching:', error);
      throw error;
    }
  }
}

/**
 * Rakuten API Provider for Product Search
 * 
 * To use this:
 * 1. Register at https://webservice.rakuten.co.jp/
 * 2. Get your Application ID (affiliate ID)
 * 3. Set environment variable: RAKUTEN_APPLICATION_ID=your_application_id
 * 
 * Note: Rakuten API is primarily for Japanese products, but provides high-quality product data.
 */
export class RakutenProvider implements ProductSearchProvider {
  private applicationId: string;

  constructor() {
    const applicationId = process.env.RAKUTEN_APPLICATION_ID;
    if (!applicationId) {
      throw new Error('Rakuten API requires RAKUTEN_APPLICATION_ID environment variable');
    }
    this.applicationId = applicationId;
  }

  /**
   * Search for products on Rakuten
   */
  async search(query: string): Promise<ProductSearchResult[]> {
    try {
      const url = new URL('https://app.rakuten.co.jp/services/api/IchibaItem/Search/20170706');
      url.searchParams.set('applicationId', this.applicationId);
      url.searchParams.set('format', 'json');
      url.searchParams.set('keyword', query);
      url.searchParams.set('hits', '10'); // Limit to 10 results
      url.searchParams.set('sort', '-itemPrice'); // Sort by price descending

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Rakuten API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        Items?: Array<{ Item: any }>;
        error?: string;
      };

      if (data.error) {
        throw new Error(`Rakuten API error: ${data.error}`);
      }

      const items = data.Items || [];

      return items.map((itemWrapper: { Item: any }) => {
        const item = itemWrapper.Item;
        return {
          title: item.itemName || '',
          brand: item.brandName || item.shopName,
          description: item.itemCaption || '',
          imageUrl: item.mediumImageUrls?.[0] || item.smallImageUrls?.[0] || '',
          productUrl: item.itemUrl || '',
          price: item.itemPrice ? `¥${item.itemPrice}` : undefined,
          category: item.genreName || undefined,
          colors: this.extractColors(item),
          materials: this.extractMaterials(item),
          measurements: {
            size: item.size,
            ...(item.itemCode && { itemCode: item.itemCode }),
          },
          rawMetadata: item,
        };
      });
    } catch (error) {
      console.error('[RakutenProvider] Error searching:', error);
      throw error;
    }
  }

  /**
   * Enrich a product result with Rakuten details by searching for similar items
   */
  async enrichProduct(product: ProductSearchResult): Promise<ProductSearchResult> {
    try {
      // Try to find the product on Rakuten using the title/brand
      const searchQuery = product.brand
        ? `${product.brand} ${product.title}`
        : product.title;

      const rakutenResults = await this.search(searchQuery);
      
      if (rakutenResults.length > 0) {
        const bestMatch = rakutenResults[0];
        
        // Merge data, prioritizing Rakuten's detailed information
        return {
          ...product,
          // Use Rakuten's image if available and better quality
          imageUrl: bestMatch.imageUrl || product.imageUrl,
          // Merge descriptions
          description: bestMatch.description || product.description,
          // Add Rakuten's detailed metadata
          price: bestMatch.price || product.price,
          colors: bestMatch.colors || product.colors,
          materials: bestMatch.materials || product.materials,
          measurements: bestMatch.measurements || product.measurements,
          // Keep original product URL but add Rakuten URL if available
          productUrl: product.productUrl, // Keep original
          rawMetadata: {
            ...product.rawMetadata,
            rakuten: bestMatch.rawMetadata,
          },
        };
      }

      return product;
    } catch (error) {
      console.warn('[RakutenProvider] Failed to enrich product, returning original:', error);
      return product;
    }
  }

  private extractColors(item: any): string[] | undefined {
    // Try to extract colors from item name, caption, or tags
    const text = `${item.itemName} ${item.itemCaption || ''}`.toLowerCase();
    const colorKeywords = [
      'black', 'white', 'navy', 'blue', 'red', 'green', 'yellow', 'pink',
      'purple', 'orange', 'brown', 'gray', 'grey', 'beige', 'cream', 'ivory',
      'tan', 'khaki', 'olive', 'burgundy', 'maroon', 'coral', 'teal', 'turquoise',
    ];
    
    const foundColors = colorKeywords.filter(color => text.includes(color));
    return foundColors.length > 0 ? foundColors : undefined;
  }

  private extractMaterials(item: any): string[] | undefined {
    // Try to extract materials from item caption
    const text = (item.itemCaption || '').toLowerCase();
    const materialKeywords = [
      'cotton', 'wool', 'silk', 'polyester', 'nylon', 'linen', 'cashmere',
      'leather', 'denim', 'suede', 'canvas', 'synthetic', 'spandex', 'elastane',
      'viscose', 'rayon', 'modal', 'bamboo', 'organic',
    ];
    
    const foundMaterials = materialKeywords.filter(material => text.includes(material));
    return foundMaterials.length > 0 ? foundMaterials : undefined;
  }
}

/**
 * Mock Provider for Testing
 * Returns sample data without making API calls
 */
export class MockProductSearchProvider implements ProductSearchProvider {
  async search(query: string): Promise<ProductSearchResult[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return [
      {
        title: `${query} - Example Product`,
        brand: 'Example Brand',
        description: `A stylish ${query} with modern design and premium materials.`,
        imageUrl: 'https://via.placeholder.com/300x400',
        productUrl: 'https://example.com/product',
        price: '$99.99',
        category: 'Tops',
        colors: ['black', 'white'],
        materials: ['cotton', 'polyester'],
      },
    ];
  }
}

