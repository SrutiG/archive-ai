import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ProductSearchResult {
  title: string;
  brand?: string;
  description?: string;
  imageUrl?: string;
  productUrl?: string;
  price?: string;
  category?: string;
  colors?: string[];
  materials?: string[];
  measurements?: {
    size?: string;
    [key: string]: string | number | undefined;
  };
  rawMetadata?: Record<string, unknown>;
}

export interface ProductSearchProvider {
  search(query: string): Promise<ProductSearchResult[]>;
}

// Placeholder provider - replace with actual API integration
class PlaceholderProductSearchProvider implements ProductSearchProvider {
  async search(query: string): Promise<ProductSearchResult[]> {
    // This is a placeholder - implement actual API call here
    console.warn('[ProductSearch] Placeholder provider - no actual search performed');
    return [];
  }
}

// LLM-based metadata extraction
export async function extractItemMetadata(
  title: string,
  description?: string,
  imageUrl?: string
): Promise<{
  category?: string;
  subCategory?: string;
  colors?: string[];
  fabrics?: string[];
  pattern?: string;
  silhouettes?: string[];
  fit?: string;
  formalities?: string[];
  styleTags?: string[];
  seasons?: string[];
  occasions?: string[];
  measurements?: {
    size?: string;
    [key: string]: string | number | undefined;
  };
}> {
  if (!openai) {
    console.warn('[ProductSearch] OpenAI API key missing, skipping metadata extraction');
    return {};
  }

  try {
    const prompt = `Analyze this fashion item and extract structured metadata. Return ONLY valid JSON.

Item: ${title}
${description ? `Description: ${description}` : ''}
${imageUrl ? `Image available: Yes` : ''}

Extract and return a JSON object with these fields (only include fields you can confidently determine):
- category: One of: Tops, Bottoms, Dresses & One-Pieces, Outerwear, Shoes, Accessories, Underwear & Sleepwear, Swimwear
- subCategory: Specific subcategory (e.g., "T-Shirts", "Jeans", "Ankle Boots")
- colors: Array of color names (e.g., ["black", "navy", "white"])
- fabrics: Array of fabric/material names (e.g., ["cotton", "silk", "wool"])
- pattern: One of: solid, striped, plaid, floral, polka_dot, geometric, abstract, animal_print, or null if solid
- silhouettes: Array of silhouette descriptors (e.g., ["a-line", "fitted", "oversized"])
- fit: One of: fitted, relaxed, oversized, cropped, wide, slim, or null
- formalities: Array of formality levels (e.g., ["casual", "smart_casual", "formal"])
- styleTags: Array of style descriptors (e.g., ["minimalist", "vintage", "edgy"])
- seasons: Array of seasons (e.g., ["spring", "summer", "fall", "winter"])
- occasions: Array of occasion types (e.g., ["work", "casual", "formal"])
- measurements: Object with size info if available (e.g., {"size": "M", "waist": 32})

Return ONLY the JSON object, no other text.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a fashion metadata extraction assistant. Return only valid JSON objects with no additional text.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.2,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return {};
    }

    try {
      const parsed = JSON.parse(content);
      return {
        category: parsed.category,
        subCategory: parsed.subCategory,
        colors: Array.isArray(parsed.colors) ? parsed.colors : undefined,
        fabrics: Array.isArray(parsed.fabrics) ? parsed.fabrics : undefined,
        pattern: parsed.pattern || undefined,
        silhouettes: Array.isArray(parsed.silhouettes) ? parsed.silhouettes : undefined,
        fit: parsed.fit || undefined,
        formalities: Array.isArray(parsed.formalities) ? parsed.formalities : undefined,
        styleTags: Array.isArray(parsed.styleTags) ? parsed.styleTags : undefined,
        seasons: Array.isArray(parsed.seasons) ? parsed.seasons : undefined,
        occasions: Array.isArray(parsed.occasions) ? parsed.occasions : undefined,
        measurements: parsed.measurements || undefined,
      };
    } catch (parseError) {
      console.error('[ProductSearch] Failed to parse metadata extraction response:', parseError);
      return {};
    }
  } catch (error) {
    console.error('[ProductSearch] Error extracting metadata:', error);
    return {};
  }
}

// Main search function - uses Google Custom Search API (primary, FREE 100/day), SerpAPI (optional premium), or Etsy (fallback)
let searchProvider: ProductSearchProvider | null = null;
let rakutenProvider: any = null;

function initializeSearchProvider(): ProductSearchProvider {
  // Prioritize Google Custom Search API (FREE - 100 searches/day) - most reliable
  console.log('[ProductSearch] Initializing search provider...');
  console.log(`[ProductSearch] GOOGLE_SEARCH_API_KEY present: ${!!process.env.GOOGLE_SEARCH_API_KEY}`);
  console.log(`[ProductSearch] GOOGLE_SEARCH_ENGINE_ID present: ${!!process.env.GOOGLE_SEARCH_ENGINE_ID}`);
  console.log(`[ProductSearch] SERPAPI_KEY present: ${!!process.env.SERPAPI_KEY} (optional - premium)`);
  console.log(`[ProductSearch] ETSY_API_KEY present: ${!!process.env.ETSY_API_KEY}`);
  
  // Use Google Custom Search API as primary (FREE tier: 100 searches/day)
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      const { GoogleShoppingProvider } = require('./productSearchProviders');
      console.log('[ProductSearch] Using Google Custom Search API (PRIMARY - FREE, 100 searches/day)');
      return new GoogleShoppingProvider();
    } catch (error) {
      console.warn('[ProductSearch] Failed to initialize Google Custom Search provider:', error);
    }
  }
  
  // Fallback to SerpAPI if Google is not configured (paid, better results but limited quota)
  if (process.env.SERPAPI_KEY) {
    try {
      const { SerpAPIProvider } = require('./productSearchProviders');
      console.log('[ProductSearch] Using SerpAPI provider (fallback - paid, limited quota)');
      return new SerpAPIProvider();
    } catch (error) {
      console.warn('[ProductSearch] Failed to initialize SerpAPI provider:', error);
      if (error instanceof Error) {
        console.warn('[ProductSearch] Error details:', error.message);
        console.warn('[ProductSearch] Stack:', error.stack);
      }
    }
  }

  // Fallback to Etsy API (good for unique/vintage items)
  if (process.env.ETSY_API_KEY) {
    try {
      const { EtsyProvider } = require('./productSearchProviders');
      console.log('[ProductSearch] Using Etsy API provider (fallback)');
      return new EtsyProvider();
    } catch (error) {
      console.warn('[ProductSearch] Failed to initialize Etsy provider:', error);
    }
  }

  // Fallback to Google Search API (free tier: 100 searches/day, but poor results)
  if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
    try {
      const { GoogleShoppingProvider } = require('./productSearchProviders');
      console.log('[ProductSearch] Using Google Search API (fallback - limited quality)');
      return new GoogleShoppingProvider();
    } catch (error) {
      console.warn('[ProductSearch] Failed to initialize Google Search provider:', error);
    }
  }

  // Fallback to placeholder
  console.warn('[ProductSearch] No product search API configured. Using placeholder provider.');
  console.warn('[ProductSearch] To enable product search, set:');
  console.warn('  - GOOGLE_SEARCH_API_KEY + GOOGLE_SEARCH_ENGINE_ID (recommended - FREE, 100 searches/day)');
  console.warn('  - SERPAPI_KEY (optional premium - better results but limited quota, 200 searches/month)');
  console.warn('  - ETSY_API_KEY (alternative - good for unique items)');
  return new PlaceholderProductSearchProvider();
}

function initializeRakutenProvider(): any | null {
  if (process.env.RAKUTEN_APPLICATION_ID) {
    try {
      const { RakutenProvider } = require('./productSearchProviders');
      console.log('[ProductSearch] Rakuten API configured for product enrichment');
      return new RakutenProvider();
    } catch (error) {
      console.warn('[ProductSearch] Failed to initialize Rakuten provider:', error);
    }
  } else {
    console.log('[ProductSearch] Rakuten API not configured (optional for enrichment)');
  }
  return null;
}

export function setProductSearchProvider(provider: ProductSearchProvider): void {
  searchProvider = provider;
}

export function setRakutenProvider(provider: any): void {
  rakutenProvider = provider;
}

/**
 * Search for products using Google Custom Search API (primary, FREE 100/day), SerpAPI (optional premium), or Etsy (fallback)
 */
export async function searchProducts(query: string, enrichWithRakuten: boolean = false): Promise<ProductSearchResult[]> {
  // Initialize providers if needed
  if (!searchProvider) {
    searchProvider = initializeSearchProvider();
  }
  
  // Re-initialize if we're using the scraper but Google Custom Search is available
  if (searchProvider && searchProvider.constructor.name === 'GoogleShoppingScraperProvider') {
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      console.log('[ProductSearch] Re-initializing: switching from scraper to Google Custom Search API');
      searchProvider = initializeSearchProvider();
    }
  }

  // Determine which provider is being used
  // Check the actual provider instance type
  let providerName = 'Unknown';
  if (searchProvider) {
    const providerType = searchProvider.constructor.name;
    if (providerType === 'GoogleShoppingScraperProvider') {
      providerName = 'Google Shopping Scraper (FREE)';
    } else if (providerType === 'GoogleShoppingProvider') {
      providerName = 'Google Custom Search API';
    } else if (providerType === 'SerpAPIProvider') {
      providerName = 'SerpAPI';
    } else if (providerType === 'EtsyProvider') {
      providerName = 'Etsy';
    }
  }
  
  console.log(`[ProductSearch] Searching for: "${query}" using ${providerName}`);
  let initialResults: ProductSearchResult[] = [];
  
  try {
    initialResults = await searchProvider.search(query);
    console.log(`[ProductSearch] ${providerName} returned ${initialResults.length} results`);
    
    // Only fallback on actual errors, not 0 results (focus on improving scraper)
    // Fallback code kept but only triggers on exceptions
  } catch (error) {
    console.warn('[ProductSearch] Primary provider failed with error, trying fallback:', error);
    
    // Try fallback providers in order: Google Custom Search API, then SerpAPI
    if (providerName.includes('Scraper') && process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      try {
        const { GoogleShoppingProvider } = require('./productSearchProviders');
        const fallbackProvider = new GoogleShoppingProvider();
        console.log('[ProductSearch] Using Google Custom Search API as fallback (FREE)');
        initialResults = await fallbackProvider.search(query);
      } catch (fallbackError) {
        console.warn('[ProductSearch] Google Custom Search API fallback also failed, trying SerpAPI:', fallbackError);
      }
    }
    
    if (initialResults.length === 0 && process.env.SERPAPI_KEY) {
      try {
        const { SerpAPIProvider } = require('./productSearchProviders');
        const fallbackProvider = new SerpAPIProvider();
        console.log('[ProductSearch] Using SerpAPI as fallback (premium option)');
        initialResults = await fallbackProvider.search(query);
      } catch (fallbackError) {
        console.warn('[ProductSearch] All providers failed:', fallbackError);
      }
    }
    
    if (initialResults.length === 0) {
      console.error('[ProductSearch] No fallback provider available or all failed');
      return [];
    }
  }

  if (initialResults.length === 0) {
    console.log('[ProductSearch] No results found from any provider');
    return [];
  }

  console.log(`[ProductSearch] Found ${initialResults.length} results`);
  
  // Log image URLs for debugging
  initialResults.forEach((result, index) => {
    console.log(`[ProductSearch] Result ${index + 1}: "${result.title}" - Image: ${result.imageUrl || 'MISSING'}`);
  });

  // Optionally enrich with Rakuten if configured
  if (enrichWithRakuten) {
    if (!rakutenProvider) {
      rakutenProvider = initializeRakutenProvider();
    }
    
    if (rakutenProvider) {
      console.log('[ProductSearch] Enriching results with Rakuten API...');
      const enrichedResults = await Promise.all(
        initialResults.map(async (product, index) => {
          try {
            // Add a small delay to avoid rate limiting
            if (index > 0) {
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            const enriched = await rakutenProvider.enrichProduct(product);
            console.log(`[ProductSearch] Enriched: "${product.title}"`);
            return enriched;
          } catch (error) {
            console.warn(`[ProductSearch] Failed to enrich "${product.title}", using original:`, error);
            return product;
          }
        })
      );
      return enrichedResults;
    }
  }

  return initialResults;
}

