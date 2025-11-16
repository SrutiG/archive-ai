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

// Smart title truncation - keeps most important parts under 150 chars
function smartTruncateTitle(title: string, maxLength: number = 150): string {
  if (title.length <= maxLength) return title;
  
  // Remove common suffixes that can be dropped
  const suffixes = [
    / - [^-]+$/, // " - Brand Name"
    / \| [^|]+$/, // " | Brand Name"
    / \/ [^/]+$/, // " / Brand Name"
    /\s*-\s*[A-Z][a-z]+\s*$/, // " - Brand"
  ];
  
  let cleaned = title;
  for (const suffix of suffixes) {
    cleaned = cleaned.replace(suffix, '');
    if (cleaned.length <= maxLength) return cleaned.trim();
  }
  
  // If still too long, try to keep the first part (usually product name)
  // and drop the end (usually brand/descriptors)
  const parts = cleaned.split(/[|—–-]/).map(p => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    // Keep first part (product name) and truncate if needed
    let result = parts[0];
    if (result.length > maxLength) {
      // Truncate at word boundary
      result = result.slice(0, maxLength - 3);
      const lastSpace = result.lastIndexOf(' ');
      if (lastSpace > maxLength * 0.7) {
        result = result.slice(0, lastSpace);
      }
      result += '...';
    }
    return result;
  }
  
  // Last resort: truncate at word boundary
  let truncated = cleaned.slice(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.7) {
    truncated = truncated.slice(0, lastSpace);
  }
  return truncated + '...';
}

// Simple product page scraper (OpenGraph + fallbacks)
export async function scrapeProductFromUrl(productUrl: string): Promise<ProductSearchResult | null> {
  // Helper to detect tracking pixels/common placeholders
  const looksLikePixel = (u: string) => {
    if (!u || u.length < 12) return true;
    const lower = u.toLowerCase();
    return /pixel|akam|spacer|transparent|1x1|data:image\/gif|tracking|beacon|analytics|\.gif(\?|$)/i.test(lower) ||
      /\/akam\/\d+\/pixel/i.test(lower) || // Gap Inc. pixel pattern
      lower.includes('pixel_') && lower.includes('akam'); // Gap Inc. specific
  };
  
  try {
    const doFetch = async (ua: string, retry: boolean = false): Promise<string | null> => {
      try {
        const res = await fetch(productUrl, {
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': retry ? 'no-cache' : 'max-age=0',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Referer': new URL(productUrl).origin + '/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
          },
        });
        if (!res.ok) {
          console.warn(`[ProductScrape] HTTP ${res.status} for ${productUrl}`);
          return null;
        }
        return await res.text();
      } catch (error: any) {
        // Handle headers overflow (common with anti-bot)
        if (error?.code === 'UND_ERR_HEADERS_OVERFLOW' || error?.message?.includes('Headers Overflow')) {
          console.warn(`[ProductScrape] Headers overflow for ${productUrl} - likely anti-bot`);
          return null;
        }
        throw error;
      }
    };
    let html =
      (await doFetch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')) ||
      (await doFetch('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36')) ||
      (await doFetch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', true));
    if (!html) {
      // If fetch failed (403/410), try Google fallback before giving up
      // This will be handled in the catch block, so we throw to trigger it
      throw new Error('Fetch returned null (likely 403/410 anti-bot)');
    }
    // Lazy import to avoid top-level dependency if unused
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    // Prefer OpenGraph/Twitter/JSON-LD, with robust fallbacks (many retailers are sparse/JS-driven)
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage =
      $('meta[property="og:image:secure_url"]').attr('content')
      || $('meta[property="og:image"]').attr('content')
      || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const twitterImage = $('meta[name="twitter:image"]').attr('content') || '';
    const linkImage = $('link[rel="image_src"]').attr('href') || '';
    const docTitle = $('title').first().text().trim();
    const host = new URL(productUrl).hostname.toLowerCase();

    // Helper to resolve relative URLs to absolute
    const resolveUrl = (url: string, base: string): string => {
      if (!url || typeof url !== 'string') return url;
      // Already absolute URL
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      try {
        // Protocol-relative URL (//example.com/path)
        if (url.startsWith('//')) {
          const baseUrl = new URL(base);
          return `${baseUrl.protocol}${url}`;
        }
        // Absolute path (/path)
        if (url.startsWith('/')) {
          const baseUrl = new URL(base);
          return `${baseUrl.protocol}//${baseUrl.host}${url}`;
        }
        // Relative path (path or ./path)
        return new URL(url, base).toString();
      } catch (err) {
        // If URL resolution fails, try to construct manually for common cases
        try {
          const baseUrl = new URL(base);
          // If it looks like a malformed URL (e.g., "https:files/..."), try to fix it
          if (url.includes(':') && !url.startsWith('http')) {
            // Might be a corrupted protocol-relative URL
            const fixed = url.replace(/^https?:/, '//').replace(/^\/\//, '//');
            if (fixed.startsWith('//')) {
              return `${baseUrl.protocol}${fixed}`;
            }
          }
          // Last resort: try to construct from base
          if (url.startsWith('/')) {
            return `${baseUrl.protocol}//${baseUrl.host}${url}`;
          }
        } catch {
          // Ignore
        }
        return url; // Return original if all resolution fails
      }
    };

    // Parse JSON-LD product blocks if present
    let ldName = '';
    let ldImage = '';
    let ldBrand = '';
    let ldColor: string | undefined;
    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        const raw = $(el).contents().text();
        if (!raw) return;
        const json = JSON.parse(raw);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          if (item && (item['@type'] === 'Product' || (Array.isArray(item['@type']) && item['@type'].includes('Product')))) {
            if (!ldName && item.name && typeof item.name === 'string') ldName = item.name;
            // Handle various image formats in JSON-LD
            let img: string | undefined;
            if (Array.isArray(item.image)) {
              img = item.image[0];
            } else if (typeof item.image === 'string') {
              img = item.image;
            } else if (item.image && typeof item.image === 'object') {
              // Handle image object with url property
              img = item.image.url || item.image['@id'] || item.image.src;
            }
            if (!ldImage && img && typeof img === 'string') {
              // Resolve relative URLs from JSON-LD
              ldImage = resolveUrl(img, productUrl);
            }
            if (!ldBrand) {
              if (typeof item.brand === 'string') ldBrand = item.brand;
              else if (item.brand && typeof item.brand.name === 'string') ldBrand = item.brand.name;
            }
            if (!ldColor && typeof item.color === 'string') ldColor = item.color;
          }
        }
      });
      // Shopify product data (often in meta tags or script tags)
      if (host.includes('shopify') || host.includes('myshopify.com') || html.includes('Shopify.theme')) {
        // Try to find Shopify product JSON
        const shopifyMatch = html.match(/Shopify\.theme\s*=\s*(\{[\s\S]*?\});/i) ||
                             html.match(/var\s+meta\s*=\s*(\{[\s\S]*?\});/i);
        if (shopifyMatch && shopifyMatch[1]) {
          try {
            const shopifyData = JSON.parse(shopifyMatch[1]);
            if (shopifyData.product && shopifyData.product.featured_image) {
              const shopifyImg = shopifyData.product.featured_image;
              if (!ldImage && typeof shopifyImg === 'string') {
                ldImage = resolveUrl(shopifyImg, productUrl);
              }
            }
          } catch {
            // Ignore parse errors
          }
        }
        // Also check for product JSON in script tags
        $('script').each((_, el) => {
          const content = $(el).html() || '';
          if (content.includes('"product"') && content.includes('"featured_image"')) {
            try {
              const match = content.match(/"featured_image"\s*:\s*"([^"]+)"/i);
              if (match && match[1] && !ldImage) {
                ldImage = resolveUrl(match[1], productUrl);
              }
            } catch {
              // Ignore
            }
          }
        });
      }
      
      // Retailer state blobs (best-effort)
      const stateMatch =
        html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/i) ||
        html.match(/window\.__STATE__\s*=\s*(\{[\s\S]*?\});/i) ||
        html.match(/window\.__NEXT_DATA__\s*=\s*(\{[\s\S]*?\});/i);
      if (stateMatch && stateMatch[1]) {
        try {
          const data = JSON.parse(stateMatch[1]);
          // Collect image-like URLs
          const imageCandidates: string[] = [];
          const walk = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            for (const k of Object.keys(obj)) {
              const v = obj[k];
              if (typeof v === 'string' && v.match(/\.(png|jpe?g|webp)(\?|$)/i)) {
                imageCandidates.push(v);
              } else if (typeof v === 'object') {
                walk(v);
              }
            }
          };
          walk(data);
          const likely = imageCandidates.find(u => u.toLowerCase().includes('product') || u.toLowerCase().includes('pdp')) || imageCandidates[0];
          if (!ldImage && likely) {
            ldImage = resolveUrl(likely, productUrl);
          }
          if (!ldName && typeof (data?.name) === 'string') ldName = data.name;
        } catch {
          // ignore
        }
      }
    } catch {
      // Best-effort; ignore JSON parse errors
    }

    // Robust title fallback: use page h1 if OG/LD are generic
    const h1Title = ($('h1').first().text() || '').trim();
    let title = (ldName || ogTitle || h1Title || docTitle || '').trim();
    // Retailer-specific fixes: Banana Republic/GAP often set doc/og to brand name
    if ((host.includes('gap.com') || host.includes('bananarepublic')) && /^banana\s*republic$/i.test(title)) {
      // Prefer on-page h1 for PDP names
      title = (h1Title || ldName || docTitle || title).trim();
    }
    const safeTitle = smartTruncateTitle(title, 150);
    
    // DOM image fallbacks (srcset/picture/noscript/data-* attributes)
    const getLargestFromSrcset = (srcset?: string): string => {
      if (!srcset) return '';
      const parts = srcset.split(',').map(s => s.trim());
      let best = '';
      let bestW = 0;
      for (const p of parts) {
        const [u, w] = p.split(/\s+/);
        const width = parseInt((w || '').replace('w', ''), 10);
        if (u && (!Number.isNaN(width) ? width : 0) >= bestW) {
          best = u;
          bestW = Number.isNaN(width) ? bestW : width;
        } else if (u && best === '') {
          best = u;
        }
      }
      return best;
    };
    const pictureSrcset = $('picture source[srcset]').first().attr('srcset');
    const imgSrcset = $('img[srcset]').first().attr('srcset');
    const noscriptHtml = $('noscript').first().html() || '';
    let noscriptImg = '';
    if (noscriptHtml) {
      try {
        const $n = cheerio.load(noscriptHtml);
        noscriptImg = $n('img').attr('src') || getLargestFromSrcset($n('img').attr('srcset')) || '';
      } catch {
        // ignore
      }
    }
    const dataAttrImg =
      $('img[data-zoom-image]').attr('data-zoom-image') ||
      $('img[data-src]').attr('data-src') ||
      $('img[data-original]').attr('data-original') ||
      $('img[data-testid]').attr('src') ||
      '';
    const basicImg = $('img').first().attr('src') || '';
    const domImage =
      getLargestFromSrcset(pictureSrcset) ||
      getLargestFromSrcset(imgSrcset) ||
      noscriptImg ||
      dataAttrImg ||
      basicImg ||
      '';

    // Prioritize OpenGraph images (usually most reliable for Shopify)
    let imageUrl = (ogImage || twitterImage || linkImage || ldImage || domImage || '').trim();
    // Resolve relative URLs to absolute URLs
    if (imageUrl) {
      imageUrl = resolveUrl(imageUrl, productUrl);
      // Fix common Shopify CDN path issues
      // If URL looks like it's missing /cdn/shop/ in the path, try to fix it
      if (host.includes('shopify') || host.includes('myshopify.com') || imageUrl.includes('/products/')) {
        // If the image path looks wrong (e.g., /products/files/ instead of /cdn/shop/files/)
        if (imageUrl.includes('/products/files/')) {
          imageUrl = imageUrl.replace(/\/products\/files\//i, '/cdn/shop/files/');
        }
        // If it's /products/.../files/... try to fix to /cdn/shop/files/...
        if (imageUrl.match(/\/products\/[^\/]+\/files\//i)) {
          imageUrl = imageUrl.replace(/\/products\/[^\/]+\/files\//i, '/cdn/shop/files/');
        }
      }
      // Validate the resolved URL - reject obviously malformed URLs
      if (imageUrl && !imageUrl.match(/^https?:\/\/.+\..+/i) && !imageUrl.match(/^\/\/.+\..+/i)) {
        // URL is malformed (e.g., "https:files/..." without proper domain)
        console.log(`[ProductScrape] Rejecting malformed image URL: ${imageUrl}`);
        imageUrl = '';
      }
    }
    
    // Filter out tracking pixels/common placeholders
    if (looksLikePixel(imageUrl)) {
      // Try to select the largest plausible product image from all <img> tags
      const candidates: string[] = [];
      $('img').each((_, el) => {
        const src = $(el).attr('src') || '';
        const ds = $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-zoom-image') || $(el).attr('data-lazy-src') || '';
        const ss = $(el).attr('srcset') || '';
        const bestFromSet = getLargestFromSrcset(ss);
        if (src) candidates.push(src);
        if (ds) candidates.push(ds);
        if (bestFromSet) candidates.push(bestFromSet);
      });
      // Also check picture tags
      $('picture source').each((_, el) => {
        const ss = $(el).attr('srcset') || '';
        const best = getLargestFromSrcset(ss);
        if (best) candidates.push(best);
      });
      const filtered = candidates
        .map(u => resolveUrl(u.trim(), productUrl))
        .filter(u => u && !looksLikePixel(u) && /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u));
      // Heuristic: prefer URLs hinting product/gallery over sprites
      const scored = filtered
        .map(u => ({
          u,
          score:
            (u.toLowerCase().includes('product') ? 5 : 0) +
            (u.toLowerCase().includes('pdp') ? 4 : 0) +
            (u.toLowerCase().includes('gallery') ? 3 : 0) +
            (u.toLowerCase().includes('media') ? 2 : 0) +
            (u.toLowerCase().includes('cdn') ? 1 : 0) +
            (u.length / 100), // tie-break on length
        }))
        .sort((a, b) => b.score - a.score);
      if (scored[0]) {
        imageUrl = scored[0].u;
      } else {
        // If still no good image, set to undefined (not empty string)
        imageUrl = '';
      }
    }
    // Final check: if still looks like pixel, reject it
    if (looksLikePixel(imageUrl)) {
      imageUrl = '';
    }
    const description = (ogDesc || '').trim();

    // Try to infer brand from meta tags or domain
    let brand =
      $('meta[name="brand"]').attr('content') ||
      $('meta[property="product:brand"]').attr('content') ||
      ldBrand ||
      new URL(productUrl).hostname.replace('www.', '').split('.')[0];
    // Normalize common retailer brands
    if (host.includes('bananarepublic') || host.includes('gap.com')) {
      brand = 'Banana Republic';
    } else if (host.includes('hoka.com')) {
      brand = 'Hoka';
    }

    // Attempt lightweight heuristic color extraction from title
    const lowerTitle = title.toLowerCase() + ' ' + (description.toLowerCase() || '');
    const colorCandidates = [
      'black','white','ivory','cream','cream white','parchment','beige','tan','brown',
      'navy','blue','light blue','dark blue','green','olive','khaki','red','burgundy',
      'pink','blush','purple','lavender','yellow','mustard','orange','grey','gray','silver','gold',
      'cream-white','off white','off-white'
    ];
    let colors = colorCandidates.filter(c => lowerTitle.includes(c));
    if (!colors.length && ldColor) colors = [ldColor.toLowerCase()];

    // Heuristic category detection (fallback before LLM)
    let heuristicCategory: string | undefined;
    const urlPath = new URL(productUrl).pathname.toLowerCase();
    const combined = `${lowerTitle} ${description.toLowerCase()} ${urlPath}`;
    
    // Check for jewelry/accessories keywords
    const jewelryKeywords = ['ring', 'necklace', 'bracelet', 'earring', 'pendant', 'chain', 'jewelry', 'accessory', 'bag', 'belt', 'hat', 'scarf', 'watch', 'sunglasses'];
    if (jewelryKeywords.some(kw => combined.includes(kw))) {
      heuristicCategory = 'Accessories';
    }
    
    // Check for bottoms keywords (skirt, pants, jeans, etc.) - these should NEVER be categorized as tops
    const bottomsKeywords = ['skirt', 'pants', 'jeans', 'trousers', 'shorts', 'leggings', 'joggers', 'sweatpants', 'culottes', 'palazzo'];
    if (!heuristicCategory && bottomsKeywords.some(kw => combined.includes(kw))) {
      heuristicCategory = 'Bottoms';
    }
    
    // Build initial result
    const base: ProductSearchResult = {
      title: safeTitle || productUrl,
      brand,
      description,
      imageUrl: imageUrl || undefined,
      productUrl,
      category: heuristicCategory,
      rawMetadata: { source: 'scrape', og: Boolean(ogTitle || ogImage) },
      colors: colors.length ? colors : undefined,
    };

    // If image is missing or looks like a pixel, try Google Custom Search API as fallback
    if (!imageUrl || looksLikePixel(imageUrl)) {
      if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
        try {
          console.log(`[ProductScrape] Image missing/invalid, trying Google Custom Search fallback for: ${safeTitle || brand}`);
          
          // Build search query from title and brand (simple, no site restrictions)
          const searchQuery = [brand, safeTitle].filter(Boolean).join(' ').trim();
          if (searchQuery && searchQuery.length > 3) {
            // Use Google Custom Search API directly (simpler than GoogleShoppingProvider)
            const url = new URL('https://www.googleapis.com/customsearch/v1');
            url.searchParams.set('key', process.env.GOOGLE_SEARCH_API_KEY);
            url.searchParams.set('cx', process.env.GOOGLE_SEARCH_ENGINE_ID);
            url.searchParams.set('q', searchQuery);
            url.searchParams.set('num', '10');
            url.searchParams.set('searchType', 'image'); // Search for images
            
            const response = await fetch(url.toString());
            if (response.ok) {
              const data = (await response.json()) as { items?: Array<{ link?: string; image?: { contextLink?: string } }> };
              const items = data.items || [];
              
              // Try to find an image from the same domain
              for (const item of items) {
                if (item.link && item.image?.contextLink) {
                  try {
                    const imageDomain = new URL(item.image.contextLink).hostname;
                    const originalDomain = new URL(productUrl).hostname;
                    if (imageDomain === originalDomain || imageDomain.replace('www.', '') === originalDomain.replace('www.', '')) {
                      if (item.link && !looksLikePixel(item.link)) {
                        console.log(`[ProductScrape] ✅ Found image via Google Custom Search fallback`);
                        base.imageUrl = item.link;
                        base.rawMetadata = {
                          ...base.rawMetadata,
                          source: 'scrape+google_fallback',
                          googleFallback: true,
                        };
                        break;
                      }
                    }
                  } catch {
                    // Continue to next item
                  }
                }
              }
              
              // If no domain match, use first valid image
              if (!base.imageUrl && items.length > 0) {
                const firstImage = items.find(item => item.link && !looksLikePixel(item.link));
                if (firstImage?.link) {
                  console.log(`[ProductScrape] ✅ Found image via Google Custom Search fallback (first result)`);
                  base.imageUrl = firstImage.link;
                  base.rawMetadata = {
                    ...base.rawMetadata,
                    source: 'scrape+google_fallback',
                    googleFallback: true,
                  };
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[ProductScrape] Google Custom Search fallback failed:`, error instanceof Error ? error.message : error);
        }
      }
    }

    // Optionally enrich with LLM for richer metadata (best-effort)
    try {
      const enriched = await extractItemMetadata(base.title, base.description, base.imageUrl);
      
      // If heuristic detected "Bottoms" but LLM returned "Tops", prefer heuristic (LLM made a mistake)
      let finalCategory = enriched.category || base.category;
      if (base.category === 'Bottoms' && enriched.category === 'Tops') {
        console.warn(`[ProductScrape] LLM incorrectly categorized "${base.title}" as "Tops" when it should be "Bottoms" (heuristic detected skirt/pants keywords). Using heuristic.`);
        finalCategory = 'Bottoms';
      }
      
      return {
        ...base,
        // Use LLM category if available, but prefer heuristic if it detected bottoms and LLM said tops
        category: finalCategory,
        materials: enriched.fabrics,
        colors: enriched.colors || base.colors,
        rawMetadata: {
          ...base.rawMetadata,
          llm: enriched,
        },
      };
    } catch {
      // Return base with heuristic category if LLM fails
      return base;
    }
  } catch (error) {
    console.error('[ProductScrape] Failed to scrape URL:', error);
    // Try Google Custom Search API as fallback when scraping completely fails
    if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      try {
        console.log(`[ProductScrape] Scrape failed, trying Google Custom Search fallback for URL: ${productUrl}`);
        
        // Extract brand and product name from URL
        const urlObj = new URL(productUrl);
        const host = urlObj.hostname.toLowerCase();
        const segments = urlObj.pathname.split('/').filter(Boolean);
        let slug = segments[segments.length - 1] || '';
        
        // SSENSE-specific: URL structure is /en-us/women/product/brand/product-name-slug/product-id
        // The product name is the second-to-last segment, not the last (which is the ID)
        if (host.includes('ssense.com')) {
          if (segments.length >= 2) {
            // Check if last segment is numeric (product ID)
            const lastSegment = segments[segments.length - 1];
            if (/^\d+$/.test(lastSegment)) {
              // Use the segment before the ID as the product slug
              slug = segments[segments.length - 2] || '';
            } else {
              slug = lastSegment;
            }
          }
        } else if (/\.html?$/i.test(slug) && segments.length >= 2) {
          slug = segments[segments.length - 2];
        }
        
        const humanize = (s: string) =>
          s.replace(/[-_]+/g, ' ')
            .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
            .trim();
        
        // Infer brand from domain or URL path
        let brand = host.replace('www.', '').split('.')[0];
        if (host.includes('bananarepublic') || host.includes('gap.com')) {
          brand = 'Banana Republic';
        } else if (host.includes('hoka.com')) {
          brand = 'Hoka';
        } else if (host.includes('gymshark.com')) {
          brand = 'Gymshark';
        } else if (host.includes('patagonia.com')) {
          brand = 'Patagonia';
        } else if (host.includes('rei.com')) {
          brand = 'REI';
        } else if (host.includes('depop.com')) {
          brand = 'Depop';
        } else if (host.includes('ssense.com')) {
          // SSENSE: brand is typically in the URL path before the product name
          // e.g., /en-us/women/product/by-far/product-name/id
          const productIndex = segments.findIndex(s => s === 'product');
          if (productIndex >= 0 && segments[productIndex + 1]) {
            brand = humanize(segments[productIndex + 1]);
          }
        }
        
        const searchQuery = [brand, humanize(slug)].filter(Boolean).join(' ').trim();
        if (searchQuery && searchQuery.length > 3) {
          // First try regular web search to get better title
          const webUrl = new URL('https://www.googleapis.com/customsearch/v1');
          webUrl.searchParams.set('key', process.env.GOOGLE_SEARCH_API_KEY);
          webUrl.searchParams.set('cx', process.env.GOOGLE_SEARCH_ENGINE_ID);
          webUrl.searchParams.set('q', `${searchQuery} site:${host}`);
          webUrl.searchParams.set('num', '5');
          
          let bestTitle = humanize(slug) || brand;
          
          // For SSENSE, prefer URL-based extraction since we can reliably parse the product name
          // Only use Google results if they're clearly better (contain brand + product-specific terms)
          const isSSENSE = host.includes('ssense.com');
          
          try {
            const webResponse = await fetch(webUrl.toString());
            if (webResponse.ok) {
              const webData = (await webResponse.json()) as { items?: Array<{ title?: string; snippet?: string }> };
              const webItems = webData.items || [];
              if (webItems.length > 0) {
                // Use first result's title if it's better than our fallback
                const firstTitle = webItems[0].title || '';
                const firstTitleLower = firstTitle.toLowerCase();
                
                // Filter out generic/category titles
                const genericPatterns = [
                  'designer dresses for women',
                  'designer clothing for women',
                  'designer for women',
                  'dresses for women',
                  'clothing for women',
                  'shop', 'browse', 'collection', 'category',
                  'for women', 'for men', 'for kids',
                  'home', 'about', 'contact'
                ];
                const isGeneric = genericPatterns.some(pattern => firstTitleLower.includes(pattern)) ||
                  // Also check if title is too generic (just category words)
                  (firstTitleLower.split(' ').length <= 4 && 
                   (firstTitleLower.includes('designer') || firstTitleLower.includes('dresses') || firstTitleLower.includes('clothing')) &&
                   !firstTitleLower.includes(brand.toLowerCase()));
                
                // For SSENSE, only use Google title if it contains the brand name and product-specific terms
                // Otherwise prefer our URL-based extraction
                if (isSSENSE) {
                  const brandLower = brand.toLowerCase();
                  const slugLower = slug.toLowerCase();
                  const hasBrand = firstTitleLower.includes(brandLower);
                  const hasProductTerms = slugLower.split('-').some(term => 
                    term.length > 3 && firstTitleLower.includes(term)
                  );
                  
                  if (!isGeneric && hasBrand && hasProductTerms && firstTitle.length > brand.length) {
                    bestTitle = firstTitle.split(' - ')[0].split(' | ')[0].trim();
                    bestTitle = smartTruncateTitle(bestTitle, 150);
                  }
                  // Otherwise keep bestTitle as URL-based extraction
                } else {
                  // For other sites, use Google title if it's not generic
                  if (!isGeneric && firstTitle.length > brand.length) {
                    bestTitle = firstTitle.split(' - ')[0].split(' | ')[0].trim();
                    bestTitle = smartTruncateTitle(bestTitle, 150);
                  }
                }
              }
            }
          } catch {
            // Continue with image search
          }
          
          // Then try image search
          const imgUrl = new URL('https://www.googleapis.com/customsearch/v1');
          imgUrl.searchParams.set('key', process.env.GOOGLE_SEARCH_API_KEY);
          imgUrl.searchParams.set('cx', process.env.GOOGLE_SEARCH_ENGINE_ID);
          imgUrl.searchParams.set('q', searchQuery);
          imgUrl.searchParams.set('num', '10');
          imgUrl.searchParams.set('searchType', 'image');
          
          const response = await fetch(imgUrl.toString());
          if (response.ok) {
            const data = (await response.json()) as { items?: Array<{ link?: string; image?: { contextLink?: string } }> };
            const items = data.items || [];
            
            // Try to find an image from the same domain
            for (const item of items) {
              if (item.link && item.image?.contextLink) {
                try {
                  const imageDomain = new URL(item.image.contextLink).hostname;
                  const originalDomain = new URL(productUrl).hostname;
                  if (imageDomain === originalDomain || imageDomain.replace('www.', '') === originalDomain.replace('www.', '')) {
                    if (item.link && !looksLikePixel(item.link)) {
                      console.log(`[ProductScrape] ✅ Found image via Google Custom Search fallback (after scrape failure)`);
                      return {
                        title: bestTitle,
                        brand,
                        imageUrl: item.link,
                        productUrl,
                        rawMetadata: {
                          source: 'google_fallback_after_scrape_failure',
                          googleFallback: true,
                        },
                      };
                    }
                  }
                } catch {
                  // Continue to next item
                }
              }
            }
            
            // If no domain match, use first valid image
            if (items.length > 0) {
              const firstImage = items.find(item => item.link && !looksLikePixel(item.link));
              if (firstImage?.link) {
                console.log(`[ProductScrape] ✅ Found image via Google Custom Search fallback (first result after scrape failure)`);
                return {
                  title: bestTitle,
                  brand,
                  imageUrl: firstImage.link,
                  productUrl,
                  rawMetadata: {
                    source: 'google_fallback_after_scrape_failure',
                    googleFallback: true,
                  },
                };
              }
            }
          }
        }
      } catch (fallbackError) {
        console.warn(`[ProductScrape] Google Custom Search fallback also failed:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
      }
    }
    
    // Last-resort heuristic for well-known domains to avoid total failure
    try {
      const urlObj = new URL(productUrl);
      const host = urlObj.hostname.toLowerCase();
      const segments = urlObj.pathname.split('/').filter(Boolean);
      let slug = segments[segments.length - 1] || '';
      
      // SSENSE-specific: extract product name from URL (not the numeric ID)
      if (host.includes('ssense.com')) {
        if (segments.length >= 2) {
          const lastSegment = segments[segments.length - 1];
          if (/^\d+$/.test(lastSegment)) {
            // Last segment is numeric ID, use the one before it
            slug = segments[segments.length - 2] || '';
          } else {
            slug = lastSegment;
          }
        }
      } else if (/\.html?$/i.test(slug) && segments.length >= 2) {
        slug = segments[segments.length - 2];
      }
      
      const humanize = (s: string) =>
        s.replace(/[-_]+/g, ' ')
          .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
          .trim();
      
      if (host.includes('hoka.com')) {
        const fallbackTitle = humanize(slug || 'Hoka Product');
        const base: ProductSearchResult = {
          title: fallbackTitle,
          brand: 'Hoka',
          productUrl,
          rawMetadata: { source: 'fallback-from-url' },
        };
        return base;
      } else if (host.includes('ssense.com')) {
        // Extract brand from URL path: /en-us/women/product/brand/product-name/id
        let brand = 'SSENSE';
        const productIndex = segments.findIndex(s => s === 'product');
        if (productIndex >= 0 && segments[productIndex + 1]) {
          brand = humanize(segments[productIndex + 1]);
        }
        const fallbackTitle = humanize(slug || `${brand} Product`);
        
        // Extract color from product slug (e.g., "black-maxi-cush..." -> "black")
        const colorCandidates = [
          'black','white','ivory','cream','beige','tan','brown',
          'navy','blue','green','olive','khaki','red','burgundy',
          'pink','purple','lavender','yellow','mustard','orange','grey','gray','silver','gold'
        ];
        const slugLower = slug.toLowerCase();
        const colors = colorCandidates.filter(c => slugLower.includes(c));
        
        // Heuristic category detection for SSENSE fallback
        let heuristicCategory: string | undefined;
        const combined = `${fallbackTitle.toLowerCase()} ${slugLower}`;
        const bottomsKeywords = ['skirt', 'pants', 'jeans', 'trousers', 'shorts', 'leggings', 'joggers', 'sweatpants', 'culottes', 'palazzo'];
        if (bottomsKeywords.some(kw => combined.includes(kw))) {
          heuristicCategory = 'Bottoms';
        }
        
        const base: ProductSearchResult = {
          title: fallbackTitle,
          brand,
          productUrl,
          category: heuristicCategory,
          colors: colors.length > 0 ? colors : undefined,
          rawMetadata: { source: 'fallback-from-url' },
        };
        
        // Try to enrich with LLM if available
        try {
          const enriched = await extractItemMetadata(base.title, undefined, undefined);
          let finalCategory = enriched.category || base.category;
          // If heuristic detected "Bottoms" but LLM returned "Tops", prefer heuristic
          if (base.category === 'Bottoms' && enriched.category === 'Tops') {
            console.warn(`[ProductScrape] LLM incorrectly categorized "${base.title}" as "Tops" when it should be "Bottoms" (heuristic detected skirt/pants keywords). Using heuristic.`);
            finalCategory = 'Bottoms';
          }
          return {
            ...base,
            category: finalCategory,
            materials: enriched.fabrics,
            colors: enriched.colors || base.colors,
            rawMetadata: {
              ...base.rawMetadata,
              llm: enriched,
            },
          };
        } catch {
          return base;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }
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
${imageUrl ? `Image available: Yes - analyze the image for visual details like neckline, crop, sleeve length, etc.` : ''}

IMPORTANT: Before categorizing, check if the item is jewelry or an accessory:
- Look for keywords in the title/description: ring, necklace, bracelet, earring, pendant, chain, jewelry, accessory, bag, belt, hat, scarf, watch, sunglasses
- If the item is clearly jewelry or an accessory, categorize as "Accessories" with appropriate subCategory (e.g., "Rings", "Necklaces", "Bracelets")

Extract and return a JSON object with these fields (only include fields you can confidently determine):
- category: One of: Tops, Bottoms, Dresses & One-Pieces, Outerwear, Shoes, Accessories, Underwear & Sleepwear, Swimwear
  * IMPORTANT: "Accessories" includes jewelry (rings, necklaces, bracelets, earrings, pendants), bags, belts, hats, scarves, watches, sunglasses, etc.
  * If the item is clearly jewelry or an accessory, use "Accessories" category, NOT "Tops" or other clothing categories
  * "Bottoms" includes: pants, jeans, trousers, shorts, skirts (mini, midi, maxi), leggings, joggers, sweatpants, etc.
  * "Tops" includes: shirts, t-shirts, blouses, sweaters, hoodies, tanks, camisoles, etc. - NOT skirts or pants
  * If the title/description contains "skirt", "pants", "jeans", "shorts", "trousers", "leggings", etc., it MUST be categorized as "Bottoms"
- subCategory: Specific subcategory (e.g., "T-Shirts", "Jeans", "Skirts", "Midi Skirts", "Ankle Boots", "Rings", "Necklaces", "Bracelets", "Earrings", "Bags", "Belts")
- colors: Array of color names (e.g., ["black", "navy", "white"])
- fabrics: Array of fabric/material names (e.g., ["cotton", "silk", "wool"])
- pattern: One of: solid, striped, plaid, floral, polka_dot, geometric, abstract, animal_print, or null if solid
- silhouettes: Array of silhouette descriptors including:
  * For tops/dresses: neckline (crew, v-neck, scoop, turtleneck, halter, off-shoulder, boat, square, etc.), 
    sleeve length (sleeveless, short, 3/4, long), crop (cropped, regular, tunic), 
    length (short, regular, long), shape (fitted, relaxed, oversized, boxy, a-line)
  * For bottoms: rise (low, mid, high), length (short, cropped, ankle, full), 
    shape (straight, skinny, wide, flare, bootcut, tapered), fit (fitted, relaxed, loose)
  * For dresses: neckline, sleeve length, length (mini, midi, maxi), shape (fitted, a-line, shift, bodycon)
  * For outerwear: length (cropped, regular, long), closure (button, zip, open), style (blazer, coat, jacket, cardigan)
  * For shoes: height (flat, low, mid, high), toe (round, pointed, square), style (sneaker, boot, sandal, etc.)
- fit: One of: fitted, relaxed, oversized, cropped, wide, slim, or null
- formalities: Array of formality levels (e.g., ["casual", "smart_casual", "formal"])
- styleTags: Array of style descriptors (e.g., ["minimalist", "vintage", "edgy"])
- seasons: Array of seasons (e.g., ["spring", "summer", "fall", "winter"])
- occasions: Array of occasion types (e.g., ["work", "casual", "formal"])
- measurements: Object with size info if available (e.g., {"size": "M", "waist": 32})

IMPORTANT: If an image is available, analyze it carefully for visual details like:
- Neckline type and style
- Whether it's cropped or full length
- Sleeve length and style
- Overall fit and silhouette
- Any distinctive design elements

Return ONLY the JSON object, no other text.`;

    // Use vision model if image is available for better silhouette analysis
    const model = imageUrl ? 'gpt-4o' : 'gpt-4o-mini';
    const messages: any[] = [
      {
        role: 'system',
        content: 'You are a fashion metadata extraction assistant. Return only valid JSON objects with no additional text.',
      },
    ];

    if (imageUrl) {
      // Use vision API to analyze the image
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } },
        ],
      });
    } else {
      messages.push({
        role: 'user',
        content: prompt,
      });
    }

    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 800, // Increased for more detailed silhouette info
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

