import OpenAI from 'openai';
import type { Page } from 'puppeteer';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

type PuppeteerModule = typeof import('puppeteer');
type PuppeteerBrowser = Awaited<ReturnType<PuppeteerModule['launch']>>;

const browserCache = new Map<string, Promise<PuppeteerBrowser>>();
const browserCacheCleanups = new Map<string, () => void>();

async function getSharedBrowser(
  launchOptions: import('puppeteer').LaunchOptions & { args: string[] },
  cacheLabel: string,
): Promise<PuppeteerBrowser> {
  const key = JSON.stringify({
    headless: launchOptions.headless ?? true,
    executablePath: launchOptions.executablePath || 'default',
    args: launchOptions.args,
  });

  if (!browserCache.has(key)) {
    const browserPromise = (async () => {
      const puppeteer = await import('puppeteer');
      console.log(`[ProductScrape] Launching shared browser (${cacheLabel})`);
      const browser = await puppeteer.launch(launchOptions);

      const cleanup = () => {
        browser
          .close()
          .catch((err) => console.warn('[ProductScrape] Error closing shared browser:', err?.message || err));
      };

      browserCacheCleanups.set(key, cleanup);
      process.once('exit', cleanup);
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);

      return browser;
    })();

    browserCache.set(key, browserPromise);
  }

  return browserCache.get(key)!;
}

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
  const normalizedUrl = productUrl.includes('#')
    ? productUrl.slice(0, productUrl.indexOf('#'))
    : productUrl;
  // Helper to detect tracking pixels/common placeholders
  const looksLikePixel = (u: string) => {
    if (!u || u.length < 12) return true;
    const lower = u.toLowerCase();
    return /pixel|akam|spacer|transparent|1x1|data:image\/gif|tracking|beacon|analytics|\.gif(\?|$)/i.test(lower) ||
      /\/akam\/\d+\/pixel/i.test(lower) || // Gap Inc. pixel pattern
      lower.includes('pixel_') && lower.includes('akam'); // Gap Inc. specific
  };
  
  const host = new URL(normalizedUrl).hostname.toLowerCase();
  
  // Helper function to check if HTML looks like it needs JavaScript rendering
  const needsBrowserRendering = async (htmlContent: string): Promise<boolean> => {
    if (!htmlContent || htmlContent.length < 500) return true; // Too small, likely incomplete
    
    try {
      const cheerio = await import('cheerio');
      const $ = cheerio.load(htmlContent);
      
      // Check for h1 elements
      const h1s = $('h1').map((_, el) => $(el).text().trim()).get().filter(t => t.length > 0);
      
      // If no h1s at all, check if there's meaningful content anyway
      // Some sites use inline labels "Color: value" instead of separate elements
      if (h1s.length === 0) {
        const bodyText = $('body').text().trim();
        const title = $('title').first().text().trim();
        const ogTitle = $('meta[property="og:title"]').attr('content') || '';
        const docTitle = title || ogTitle;
        
        // Check if title is just brand name (strong signal that Puppeteer is needed)
        const hostBase = host.replace('www.', '').split('.')[0].toLowerCase();
        const hostFull = host.replace('www.', '').toLowerCase();
        const titleLower = docTitle.toLowerCase().trim();
        
        // Normalize both for comparison (remove spaces, special chars)
        const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
        const titleNormalized = normalize(titleLower);
        const hostBaseNormalized = normalize(hostBase);
        const hostFullNormalized = normalize(hostFull);
        
        const isJustBrandName = titleNormalized === hostBaseNormalized || 
                                titleNormalized === hostFullNormalized ||
                                (titleLower.length < 20 && (titleLower.includes(hostBase) || titleLower.includes(hostFull.split('.')[0])));
        
        if (isJustBrandName) {
          console.log(`[ProductScrape] No h1 and title is just brand name ("${docTitle}"), likely JS-rendered`);
          return true; // Needs browser rendering
        }
        
        // Check if body has substantial MEANINGFUL content (not just JS code)
        // If HTML is large but text content is minimal, it's likely JS-rendered
        const htmlLength = htmlContent.length;
        const textLength = bodyText.length;
        const textRatio = textLength / htmlLength;
        
        // If HTML is large (>100k) but text ratio is very low (<0.1), it's likely JS code, not rendered content
        if (htmlLength > 100000 && textRatio < 0.1) {
          console.log(`[ProductScrape] No h1, large HTML (${htmlLength} chars) but low text ratio (${textRatio.toFixed(3)}), likely JS-rendered`);
          return true; // Needs browser rendering
        }
        
        // Check if body has substantial text content (might be using inline labels)
        if (bodyText.length > 500) {
          // Has content, might just use inline labels - don't assume JS rendering needed
          console.log(`[ProductScrape] No h1 but has content (${bodyText.length} chars), checking for inline labels`);
          return false; // Try regular scraping first
        }
        console.log(`[ProductScrape] No h1 elements and minimal content, likely needs browser rendering`);
        return true;
      }
      
      // Check if title is meaningful (not just brand name or generic)
      const title = $('title').first().text().trim();
      const ogTitle = $('meta[property="og:title"]').attr('content') || '';
      const h1Title = h1s[0] || '';
      
      // If title is very short or just brand name, might need browser
      const isGenericTitle = title.length < 10 || 
                            /^(home|store|shop|welcome|brand|product)$/i.test(title) ||
                            title.toLowerCase() === host.split('.')[0].toLowerCase();
      
      // If h1 is just brand name, likely needs browser
      const h1IsJustBrand = h1s.length > 0 && h1s.every(h1 => {
        const lower = h1.toLowerCase();
        const brandFromHost = host.split('.')[0].toLowerCase();
        return lower === brandFromHost || lower.length < 10;
      });
      
      if (isGenericTitle && h1IsJustBrand) {
        console.log(`[ProductScrape] Generic title and brand-only h1s, likely needs browser rendering`);
        return true;
      }
      
      // Check if there's a lot of script tags but minimal visible content
      const scriptCount = $('script').length;
      const bodyText = $('body').text().trim();
      const bodyTextLength = bodyText.length;
      
      // If many scripts but very little text content, likely JS-rendered
      if (scriptCount > 10 && bodyTextLength < 500) {
        console.log(`[ProductScrape] Many scripts (${scriptCount}) but little content (${bodyTextLength} chars), likely needs browser rendering`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn(`[ProductScrape] Error checking if browser needed:`, error);
      return false; // If we can't check, assume regular fetch is fine
    }
  };
  
  // Helper function to use Puppeteer for browser automation
  const usePuppeteer = async (): Promise<string | null> => {
    try {
      console.log(`[ProductScrape] Using browser automation for ${host}`);
      const puppeteer = await import('puppeteer');
      const fs = await import('fs');
      
      // Configure cache directory for Render (persistent storage)
      // Render's persistent disk is at /opt/render/project/.render
      // IMPORTANT: Set PUPPETEER_CACHE_DIR as an environment variable in Render dashboard
      // so it's used during both build and runtime. If not set, use default location.
      const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_ID !== undefined;
      if (isRender && !process.env.PUPPETEER_CACHE_DIR) {
        const renderCacheDir = '/opt/render/project/.render/puppeteer-cache';
        try {
          // Ensure cache directory exists
          if (!fs.existsSync(renderCacheDir)) {
            fs.mkdirSync(renderCacheDir, { recursive: true });
          }
          // Set Puppeteer cache directory via environment variable
          process.env.PUPPETEER_CACHE_DIR = renderCacheDir;
          console.log(`[ProductScrape] Using Render cache directory: ${renderCacheDir}`);
        } catch (error) {
          console.warn(`[ProductScrape] Could not create cache directory, using default:`, error);
        }
      } else if (process.env.PUPPETEER_CACHE_DIR) {
        console.log(`[ProductScrape] Using configured cache directory: ${process.env.PUPPETEER_CACHE_DIR}`);
      }
      
      // On macOS, bundled Chromium may fail due to missing system frameworks
      // Try to use system Chrome/Chromium first if available, fallback to bundled
      let executablePath: string | undefined;
      const isMac = process.platform === 'darwin';
      
      if (isMac) {
        const possiblePaths = [
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          process.env.CHROME_PATH,
        ].filter(Boolean) as string[];
        
        for (const path of possiblePaths) {
          try {
            if (path && fs.existsSync(path)) {
              executablePath = path;
              console.log(`[ProductScrape] Using system Chrome at: ${executablePath}`);
              break;
            }
          } catch {
            // Continue searching
          }
        }
      }
      
      // Base browser args
      const browserArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-blink-features=AutomationControlled',
        '--window-size=1920,1080',
      ];
      
      // Some Gap Inc. sites misbehave over HTTP/2; disable only for those hosts
      const gapHosts = [
        'bananarepublic.gap.com',
        'www.bananarepublic.gap.com',
        'oldnavy.gap.com',
        'www.oldnavy.gap.com',
        'gapfactory.com',
        'www.gapfactory.com',
        'gap.com',
        'www.gap.com',
      ];
      if (gapHosts.some(domain => host.includes(domain))) {
        browserArgs.push('--disable-http2', '--disable-quic');
      }
      
      // Use bundled Chromium if no system browser found (or on Linux/Render)
      const launchOptions: import('puppeteer').LaunchOptions & { args: string[] } = {
        headless: true,
        args: browserArgs,
      };
      
      // Only set executablePath if we found a system browser (macOS fallback)
      if (executablePath) {
        launchOptions.executablePath = executablePath;
      } else {
        console.log(`[ProductScrape] Using Puppeteer's bundled Chromium (no system Chrome needed)`);
      }
      
      const browser = await getSharedBrowser(launchOptions, executablePath ? 'system-chrome' : 'bundled-chromium');
      
      let page: Page | null = null;
      const requestHandler = (req: any) => {
          const type = req.resourceType();
          if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
            req.abort();
          } else {
            req.continue();
          }
        };
      
      try {
        page = await browser.newPage();
        
        // Block non-essential resources to speed up navigation and reduce load
        await page.setRequestInterception(true);
        page.on('request', requestHandler);
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Remove webdriver property to avoid detection
        await page.evaluateOnNewDocument(() => {
          // @ts-ignore - navigator exists in browser context
          Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
          });
        });
        
        // Set additional headers to look more like a real browser
        await page.setExtraHTTPHeaders({
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'no-cache',
        });
        
        console.log(`[ProductScrape] Navigating to ${normalizedUrl}...`);
        try {
          await page.goto(normalizedUrl, { waitUntil: 'domcontentloaded' });
        } catch (error) {
          console.error(`[ProductScrape] Navigation failed for ${normalizedUrl}:`, error instanceof Error ? error.message : error);
          throw error;
        }
        
        // Ensure the DOM is available even if navigation events didn't fire as expected
        await page.waitForSelector('body').catch(() => {
          console.warn('[ProductScrape] body selector not found after navigation, continuing anyway');
        });
        
        // Wait longer for JavaScript-heavy sites to render content
        // Banana Republic and similar sites need more time
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to wait for h1, but don't fail if it doesn't appear
        try {
          await page.waitForSelector('h1', { timeout: 5000 });
          console.log(`[ProductScrape] h1 found`);
        } catch {
          console.log(`[ProductScrape] h1 not found immediately, but continuing...`);
        }
        
        // Get the rendered HTML
        html = await page.content();
        console.log(`[ProductScrape] Got HTML via browser (${html.length} chars)`);
        
        // Log what h1s we found for debugging (code runs in browser context)
        const h1s = await page.evaluate(() => {
          // @ts-ignore - this code runs in browser where document exists
          const elements = Array.from(document.querySelectorAll('h1'));
          // @ts-ignore
          return elements.map((h) => (h.textContent || '').trim()).filter((t) => t.length > 0);
        });
        console.log(`[ProductScrape] Found h1 elements:`, h1s);
      } finally {
        // Attempt to clean up page resources, but don't close shared browser
        if (page) {
          try {
            page.off('request', requestHandler);
          } catch {
            // ignore
          }

          try {
            if (!page.isClosed()) {
              await page.setRequestInterception(false).catch(() => {});
              await page.close().catch(() => {});
            }
          } catch {
            // ignore cleanup errors
          } finally {
            page = null;
          }
        }
      }
      
      return html;
    } catch (error) {
      console.warn(`[ProductScrape] Browser automation failed:`, error instanceof Error ? error.message : error);
      return null;
    }
  };
  
  // Step 1: Try regular fetch first
  let html: string | null = null;
  
  const doFetch = async (ua: string, retry: boolean = false): Promise<string | null> => {
    try {
      // Create AbortController for 10-second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 10000); // 10 seconds
      
      try {
        const res = await fetch(normalizedUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': ua,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Cache-Control': retry ? 'no-cache' : 'max-age=0',
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Referer': new URL(normalizedUrl).origin + '/',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
          },
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
          console.warn(`[ProductScrape] HTTP ${res.status} for ${normalizedUrl}`);
          return null;
        }
        return await res.text();
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Check if it was a timeout
        if (fetchError?.name === 'AbortError' || controller.signal.aborted) {
          console.warn(`[ProductScrape] Fetch timeout (10s) for ${normalizedUrl}`);
          return null;
        }
        throw fetchError;
      }
    } catch (error: any) {
      // Handle headers overflow (common with anti-bot) - this means we should use Puppeteer
      if (error?.code === 'UND_ERR_HEADERS_OVERFLOW' || error?.message?.includes('Headers Overflow')) {
        console.warn(`[ProductScrape] Headers overflow for ${normalizedUrl} - will use Puppeteer`);
        return null; // Signal to use Puppeteer
      }
      throw error;
    }
  };
  
  // Try fetching with different user agents
  let headersOverflow = false;
  try {
    html =
      (await doFetch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')) ||
      (await doFetch('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36')) ||
      (await doFetch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', true));
  } catch (error: any) {
    // Check both the error itself and its cause property for headers overflow
    const isHeadersOverflow = 
      error?.code === 'UND_ERR_HEADERS_OVERFLOW' || 
      error?.message?.includes('Headers Overflow') ||
      error?.cause?.code === 'UND_ERR_HEADERS_OVERFLOW' ||
      error?.cause?.name === 'HeadersOverflowError' ||
      error?.cause?.message?.includes('Headers Overflow');
    
    if (isHeadersOverflow) {
      console.warn(`[ProductScrape] Headers overflow detected, trying with minimal headers`);
      headersOverflow = true;
      // Try again with minimal headers (already tried in doFetch, but try one more time explicitly)
      try {
        html = await doFetch('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', true);
      } catch {
        // If minimal headers also fails, continue without HTML - will check if Puppeteer needed
        html = null;
      }
    } else {
      throw error;
    }
  }
  
  // Step 2: Check if the fetched HTML needs browser rendering
  // ONLY use Puppeteer if the HTML actually needs JS rendering - NOT for headers overflow
  if (html && await needsBrowserRendering(html)) {
    console.log(`[ProductScrape] Detected JavaScript-heavy page, falling back to Puppeteer`);
    html = await usePuppeteer();
  }
  
  // Step 3: If we still don't have HTML, try Puppeteer as last resort
  // But NOT if headers overflow happened - headers overflow doesn't mean we need Puppeteer
  if (!html && !headersOverflow) {
    console.log(`[ProductScrape] Regular fetch failed, trying Puppeteer as fallback`);
    html = await usePuppeteer();
    if (!html) {
      // If Puppeteer also failed, throw error
      throw new Error('Failed to fetch HTML via both regular fetch and Puppeteer');
    }
  }
  
  // If headers overflow happened but we have no HTML, continue anyway - we'll extract from URL
  if (headersOverflow && !html) {
    console.log(`[ProductScrape] Headers overflow but no HTML - will extract from URL`);
  }
  
  // Step 4: Validate response - check for error/maintenance/404 pages (AFTER Puppeteer if used)
  if (html) {
    const cheerio = await import('cheerio');
    const $check = cheerio.load(html);
    const bodyText = $check('body').text().trim();
    const titleText = $check('title').text().trim().toLowerCase();
    
    // Check for error/maintenance pages
    const errorIndicators = [
      '404', 'not found', 'page not found',
      'oh no, something went wrong',
      'site is under maintenance',
      'access denied',
      'verify you are a human',
      'blocked',
      'access to this page has been denied',
    ];
    
    const hasErrorIndicator = errorIndicators.some(indicator => 
      titleText.includes(indicator) || bodyText.toLowerCase().includes(indicator)
    );
    
    // If title itself is an error indicator, it's definitely an error page
    const titleIsError = errorIndicators.some(indicator => 
      titleText === indicator || titleText === `access denied` || titleText.includes('access denied')
    );
    
    if (titleIsError) {
      console.log(`[ProductScrape] Detected error page - title is error message: "${titleText}"`);
      throw new Error('non_product_page');
    }
    
    // Check if page has product-like content (heading or prices)
    const hasH1 = $check('h1').length > 0;
    const hasPrice = /\$\d/.test(bodyText);
    const h1Text = hasH1 ? $check('h1').first().text().trim().toLowerCase() : '';
    // H1 must be meaningful product content, not an error message
    const hasProductHeading = hasH1 && h1Text.length > 5 && !errorIndicators.some(ind => h1Text.includes(ind));
    
    // If it's an error page and has no product content, return error
    if (hasErrorIndicator && !hasProductHeading && !hasPrice) {
      console.log(`[ProductScrape] Detected error page (${html.length} chars, title: "${titleText}")`);
      throw new Error('non_product_page');
    }
  }
  
  try {
    // If we have no HTML (e.g., headers overflow), extract from URL directly
    if (!html) {
      console.log(`[ProductScrape] No HTML available, extracting from URL only`);
      // Extract from URL - this will be handled in the catch block
      throw new Error('No HTML available - extracting from URL');
    }
    
    // Lazy import to avoid top-level dependency if unused
    const cheerio = await import('cheerio');
    const $ = cheerio.load(html);

    // STEP 2: Extract from Open Graph / meta tags (second priority after JSON-LD)
    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const ogImage =
      $('meta[property="og:image:secure_url"]').attr('content')
      || $('meta[property="og:image"]').attr('content')
      || '';
    const ogDesc = $('meta[property="og:description"]').attr('content') || '';
    const ogPrice = $('meta[property="product:price:amount"]').attr('content') || '';
    const twitterImage = $('meta[name="twitter:image"]').attr('content') || '';
    const linkImage = $('link[rel="image_src"]').attr('href') || '';
    const docTitle = $('title').first().text().trim();

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
    
    // Helper function to extract inline labels (e.g., "Color: Cosmic Pearl" from Hoka pages)
    // This works for any site that uses "Label: value" format in plain text
    const extractInlineLabel = (label: string): string | null => {
      try {
        // Get all text nodes from the DOM - check both element text and direct text nodes
        const allTextNodes: string[] = [];
        $('body *').each((_, el) => {
          const text = $(el).text()?.trim() || '';
          if (text && text.length > 0) {
            allTextNodes.push(text);
          }
        });
        
        // Also check direct text content of body for inline patterns
        const bodyText = $('body').text();
        if (bodyText) {
          // Split by newlines and check each line
          const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
          allTextNodes.push(...lines);
        }
        
        // Find node/line that starts with the label (case-insensitive)
        const labelLower = label.toLowerCase();
        const matchingNode = allTextNodes.find(text => {
          const textLower = text.toLowerCase().trim();
          return textLower.startsWith(labelLower + ':');
        });
        
        if (matchingNode) {
          // Extract value after the colon
          const parts = matchingNode.split(':');
          if (parts.length > 1) {
            const value = parts.slice(1).join(':').trim();
            // Filter out CSS values (e.g., "white;", "var(--color-text-inverse);")
            if (value.endsWith(';') || value.startsWith('var(') || value.startsWith('rgb(') || value.startsWith('#')) {
              return null;
            }
            // Clean up common separators (e.g., "Cosmic Pearl / Cosmic Pearl" -> "Cosmic Pearl")
            return value.split('/').map(v => v.trim()).filter(Boolean)[0] || value;
          }
        }
        return null;
      } catch (error) {
        return null;
      }
    };
    
    // Helper to extract product name from headings/text (for sites without structured data)
    const extractProductNameFromText = (): string | null => {
      try {
        // Try h1 first
        const h1Text = $('h1').first().text()?.trim();
        if (h1Text && h1Text.length > 5 && !h1Text.toLowerCase().includes(host.split('.')[0])) {
          // Filter out promotional text
          if (!h1Text.toLowerCase().includes('reward') && !h1Text.toLowerCase().includes('$10') && !h1Text.startsWith('$')) {
            return h1Text;
          }
        }
        
        // Try other headings
        const headings = $('h1, h2, h3').map((_, el) => $(el).text().trim()).get();
        for (const heading of headings) {
          if (heading && heading.length > 5 && !heading.toLowerCase().includes(host.split('.')[0])) {
            // Filter out promotional text
            if (heading.toLowerCase().includes('reward') || heading.toLowerCase().includes('$10') || heading.startsWith('$')) {
              continue;
            }
            // Check if it looks like a product name (not just brand, has descriptive words)
            const lower = heading.toLowerCase();
            const productKeywords = ['transport', 'gtx', 'shoe', 'boot', 'sneaker', 'pant', 'shirt', 'dress', 'skirt', 'jacket', 'sweater', 'trouser', 'top', 'vest', 'tunic'];
            if (productKeywords.some(kw => lower.includes(kw))) {
              return heading;
            }
          }
        }
        
        // For LOFT and Aerie specifically, try URL extraction first (more reliable than DOM)
        if (host.includes('loft.com')) {
          const urlObj = new URL(productUrl);
          const pathSegments = urlObj.pathname.split('/').filter(Boolean);
          // Look for segments that look like product names (not numeric, not category codes)
          const productSegments = pathSegments.filter(s => 
            !/^\d+$/.test(s) && 
            !/^catl\d+$/.test(s.toLowerCase()) &&
            !['clothing', 'sweaters', 'html'].includes(s.toLowerCase()) &&
            s.length > 5
          );
          if (productSegments.length > 0) {
            const productName = productSegments[productSegments.length - 1];
            const humanize = (s: string) =>
              s.replace(/[-_]+/g, ' ')
                .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
                .trim();
            return humanize(productName);
          }
        }
        
        // For Aerie specifically, try to find the product name in the URL path
        if (host.includes('ae.com') || host.includes('aerie')) {
          const urlObj = new URL(productUrl);
          const pathSegments = urlObj.pathname.split('/').filter(Boolean);
          // Look for segments that look like product names (not numeric IDs)
          const productSegments = pathSegments.filter(s => 
            !/^\d+$/.test(s) && 
            !/^\d{4}_\d{4}_\d{3}$/.test(s) &&
            !['en', 'us', 'p', 'aerie', 'bottoms', 'pants', 'html'].includes(s.toLowerCase()) &&
            s.length > 5
          );
          if (productSegments.length > 0) {
            const productName = productSegments[productSegments.length - 1];
            const humanize = (s: string) =>
              s.replace(/[-_]+/g, ' ')
                .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
                .trim();
            return humanize(productName);
          }
        }
        
        return null;
      } catch (error) {
        return null;
      }
    };
    
    // STEP 3: Extract from DOM text (third priority, after JSON-LD and Open Graph)
    // Domain-agnostic extraction following priority: JSON-LD → Open Graph → DOM text
    let title = '';
    
    // Priority 1: JSON-LD name
    if (ldName && ldName.length > 5) {
      title = ldName;
    }
    // Priority 2: Open Graph title
    else if (ogTitle && ogTitle.length > 5) {
      title = ogTitle;
    }
    // Priority 3: First h1 in main content area
    else {
      const h1Title = ($('h1').first().text() || '').trim();
      if (h1Title && h1Title.length > 5) {
        title = h1Title;
      }
      // Priority 4: Document title
      else if (docTitle && docTitle.length > 5) {
        title = docTitle;
      }
    }
    
    // If title is generic (just brand name or domain), try to extract from DOM
    const hostBase = host.replace('www.', '').split('.')[0];
    const titleLower = title.toLowerCase();
    const isGenericTitle = !title || 
                          title.length < 5 || 
                          titleLower === host || 
                          titleLower === host.replace('www.', '') || 
                          titleLower.includes(hostBase) ||
                          titleLower === 'features' ||
                          titleLower === 'description';
    
    if (isGenericTitle) {
      // Try to find product name in DOM using generic selectors
      const productNameSelectors = [
        '[data-product-name]',
        '.product-name',
        '.product-title',
        'h1.product-name',
        '[class*="product"][class*="name"]',
        '[class*="title"]',
        'main h1',
        '[role="main"] h1',
      ];
      
      for (const selector of productNameSelectors) {
        const found = $(selector).first().text()?.trim();
        if (found && found.length > 5) {
          const firstLine = found.split('\n')[0].trim();
          const lowerLine = firstLine.toLowerCase();
          // Filter out generic words, promotional text, and product IDs
          if (!lowerLine.includes('reward') && 
              !lowerLine.includes('$10') && 
              !firstLine.startsWith('$') &&
              !lowerLine.includes('features') &&
              !lowerLine.includes('description') &&
              !/^\d{4}_\d{4}_\d{3}$/.test(firstLine) &&
              !/^\d+$/.test(firstLine) &&
              firstLine.length > 5) {
            title = firstLine;
            console.log(`[ProductScrape] Found title via selector "${selector}": "${title}"`);
            break;
          }
        }
      }
      
      // If still generic, try to extract from URL path (domain-agnostic)
      if (isGenericTitle || title.length < 5) {
        const urlObj = new URL(productUrl);
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        // Find descriptive segments (not numeric, not generic, not file extensions)
        const productSegments = pathSegments.filter(s => 
          !/^\d+$/.test(s) && // Not purely numeric
          !/\.html?$/i.test(s) && // Not .html files
          !/^\d{4}_\d{4}_\d{3}$/.test(s) && // Not product IDs
          !['en', 'us', 'html', 'shop', 'product', 'products', 'clothing', 'bottoms', 'pants', 'sweaters', 'gifts-for-running-lifestyle'].includes(s.toLowerCase()) &&
          s.length > 3
        );
        if (productSegments.length > 0) {
          const productName = productSegments[productSegments.length - 1];
          const humanize = (s: string) =>
            s.replace(/[-_]+/g, ' ')
              .replace(/\b([a-z])/g, (_, c) => c.toUpperCase())
              .trim();
          title = humanize(productName);
          console.log(`[ProductScrape] Extracted title from URL: "${title}"`);
        }
      }
    }
    
    // Title extraction is now complete - domain-agnostic extraction above handles all cases
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
    // Normalize common retailer brands - Gap Inc. brands
    if (host.includes('bananarepublic.gap.com') || host === 'bananarepublic.com') {
      brand = 'Banana Republic';
    } else if (host.includes('oldnavy.gap.com') || host === 'oldnavy.com') {
      brand = 'Old Navy';
    } else if (host.includes('gapfactory.com') || host.includes('gapfactory.gap.com')) {
      brand = 'Gap Factory';
    } else if (host.includes('gap.com') && !host.includes('oldnavy') && !host.includes('bananarepublic')) {
      brand = 'Gap';
    } else if (host.includes('hoka.com')) {
      brand = 'Hoka';
    }

    // Attempt lightweight heuristic color extraction from title
    // Note: extractInlineLabel is defined earlier in the function for use with Hoka title extraction
    const lowerTitle = title.toLowerCase() + ' ' + (description.toLowerCase() || '');
    const colorCandidates = [
      'black','white','ivory','cream','cream white','parchment','beige','tan','brown',
      'navy','blue','light blue','dark blue','green','olive','khaki','red','burgundy',
      'pink','blush','purple','lavender','yellow','mustard','orange','grey','gray','silver','gold',
      'cream-white','off white','off-white', 'cosmic pearl', 'pearl'
    ];
    let colors = colorCandidates.filter(c => lowerTitle.includes(c));
    
    // Try inline label extraction for sites like Hoka (e.g., "Color: Cosmic Pearl")
    // This works for any site that uses "Color: value" format in plain HTML text
    if (!colors.length) {
      // Try "Color:" first, then "Sale:" (some sites use "Sale: color name")
      const inlineColor = extractInlineLabel('Color') || extractInlineLabel('Sale');
      if (inlineColor) {
        console.log(`[ProductScrape] Found color via inline label: "${inlineColor}"`);
        // Normalize the color value
        const normalizedColor = inlineColor.toLowerCase().trim();
        // Extract first color if multiple (e.g., "Cosmic Pearl / Cosmic Pearl" -> "cosmic pearl")
        const firstColor = normalizedColor.split('/').map(c => c.trim()).filter(Boolean)[0] || normalizedColor;
        // If it matches a known color candidate, use that; otherwise use the extracted value
        const matchedCandidate = colorCandidates.find(c => firstColor.includes(c) || c.includes(firstColor));
        colors = matchedCandidate ? [matchedCandidate] : [firstColor];
      }
    }
    
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
          // If title is just the brand name, don't duplicate it
          let searchQuery = safeTitle || '';
          // For Banana Republic, if title is just brand name, try to extract product name from URL or use a generic search
          if ((host.includes('gap.com') || host.includes('bananarepublic')) && /^banana\s*republic$/i.test(searchQuery)) {
            // Try to extract category from URL parameters (e.g., nav=meganav%3AWOMEN%3AWOMEN%27S+CLOTHING%3APants)
            const urlObj = new URL(productUrl);
            const navParam = urlObj.searchParams.get('nav');
            let categoryFromUrl = '';
            if (navParam) {
              // Decode and extract category (e.g., "Pants" from "WOMEN'S CLOTHING:Pants")
              const decoded = decodeURIComponent(navParam);
              const parts = decoded.split(':');
              if (parts.length > 1) {
                categoryFromUrl = parts[parts.length - 1].toLowerCase();
              }
            }
            
            // Try to extract product name from URL path
            const urlPath = new URL(productUrl).pathname;
            const pathParts = urlPath.split('/').filter(p => p && !p.includes('.'));
            // Look for descriptive words in the path
            const descriptiveParts = pathParts.filter(p => 
              p.length > 3 && 
              !['browse', 'product', 'do', 'pid', 'vid', 'pcid', 'cid'].includes(p.toLowerCase())
            );
            
            if (categoryFromUrl) {
              // Use category from URL (e.g., "pants", "shirts", etc.)
              searchQuery = `${brand} ${categoryFromUrl}`;
            } else if (descriptiveParts.length > 0) {
              searchQuery = [brand, ...descriptiveParts].join(' ').trim();
            } else {
              // Use brand + "pants" or "clothing" as fallback
              searchQuery = `${brand} pants`;
            }
            console.log(`[ProductScrape] Banana Republic: Title was brand name, using search query: "${searchQuery}"`);
          } else if (searchQuery && searchQuery.toLowerCase() !== brand?.toLowerCase()) {
            searchQuery = [brand, safeTitle].filter(Boolean).join(' ').trim();
          } else if (brand) {
            searchQuery = brand;
          }
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
        // Gap Inc. brands - check specific subdomains first
        if (host.includes('bananarepublic.gap.com') || host === 'bananarepublic.com') {
          brand = 'Banana Republic';
        } else if (host.includes('oldnavy.gap.com') || host === 'oldnavy.com') {
          brand = 'Old Navy';
        } else if (host.includes('gapfactory.com') || host.includes('gapfactory.gap.com')) {
          brand = 'Gap Factory';
        } else if (host.includes('gap.com') && !host.includes('oldnavy') && !host.includes('bananarepublic')) {
          brand = 'Gap';
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
        
        // For Gap Inc. sites, extract category from URL nav parameter
        let searchQuery = '';
        const isGapIncSite = host.includes('gap.com') || host.includes('bananarepublic') || host.includes('oldnavy') || host.includes('gapfactory');
        if (isGapIncSite) {
          const navParam = urlObj.searchParams.get('nav');
          let categoryFromUrl = '';
          if (navParam) {
            try {
              const decoded = decodeURIComponent(navParam);
              const parts = decoded.split(':');
              if (parts.length > 1) {
                categoryFromUrl = parts[parts.length - 1]; // "Pants"
              }
            } catch {
              // Ignore decode errors
            }
          }
          if (categoryFromUrl) {
            searchQuery = `${brand} ${categoryFromUrl}`;
          } else {
            searchQuery = [brand, humanize(slug)].filter(Boolean).join(' ').trim();
          }
        } else {
          searchQuery = [brand, humanize(slug)].filter(Boolean).join(' ').trim();
        }
        
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
          const isGapIncSite = host.includes('gap.com') || host.includes('bananarepublic') || host.includes('oldnavy') || host.includes('gapfactory');
          
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
                
                // For Gap Inc. sites, prioritize Google title since we can't scrape the page
                if (isGapIncSite) {
                  // Use Google title if it's not just the brand name and contains product keywords
                  const productKeywords = ['pant', 'shirt', 'dress', 'skirt', 'jacket', 'sweater', 'shoe', 'boot', 'jean', 'short', 'top'];
                  const hasProductKeyword = productKeywords.some(kw => firstTitleLower.includes(kw));
                  if (!isGeneric && hasProductKeyword && firstTitle.length > brand.length && !/^banana\s*republic$/i.test(firstTitle)) {
                    bestTitle = firstTitle.split(' - ')[0].split(' | ')[0].trim();
                    bestTitle = smartTruncateTitle(bestTitle, 150);
                    console.log(`[ProductScrape] Banana Republic: Using Google search title: "${bestTitle}"`);
                  }
                } else if (isSSENSE) {
                  // For SSENSE, only use Google title if it contains the brand name and product-specific terms
                  // Otherwise prefer our URL-based extraction
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
        // Extract product name from URL path
        // URL format: /en/us/gifts-for-running-lifestyle/transport-gtx/1133958.html
        // Product name is usually the second-to-last segment before the ID
        let productName = slug;
        const pathSegments = urlObj.pathname.split('/').filter(Boolean);
        if (pathSegments.length >= 2) {
          // Find the segment that looks like a product name (not numeric, not a language code, not .html)
          const productSegments = pathSegments.filter(s => 
            !/^\d+$/.test(s) && // Not purely numeric
            !/\.html?$/i.test(s) && // Not .html or .htm files
            !['en', 'us', 'gifts-for-running-lifestyle'].includes(s.toLowerCase()) &&
            s.length > 2
          );
          if (productSegments.length > 0) {
            // Use the last product-like segment (usually the product name)
            productName = productSegments[productSegments.length - 1];
          }
        }
        const fallbackTitle = humanize(productName || 'Hoka Product');
        console.log(`[ProductScrape] Hoka: Extracted title from URL: "${fallbackTitle}"`);
        const base: ProductSearchResult = {
          title: fallbackTitle,
          brand: 'Hoka',
          productUrl,
          rawMetadata: { source: 'fallback-from-url' },
        };
        return base;
      } else if (host.includes('loft.com')) {
        // LOFT URL format: /clothing/sweaters/catl000012/relaxed-everyday-sweater/778238.html
        // Product name is usually the second-to-last segment
        let productName = slug;
        if (segments.length >= 2) {
          // Find product-like segments (not numeric IDs, not category codes)
          const productSegments = segments.filter(s => 
            !/^\d+$/.test(s) && 
            !/^catl\d+$/.test(s.toLowerCase()) &&
            !['clothing', 'sweaters', 'html'].includes(s.toLowerCase()) &&
            s.length > 2
          );
          if (productSegments.length > 0) {
            productName = productSegments[productSegments.length - 1];
          }
        }
        const fallbackTitle = humanize(productName || 'LOFT Product');
        console.log(`[ProductScrape] LOFT: Extracted title from URL: "${fallbackTitle}"`);
        return {
          title: fallbackTitle,
          brand: 'LOFT',
          productUrl,
          rawMetadata: { source: 'fallback-from-url-blocked' },
        };
      } else if (host.includes('hm.com') || host.includes('h&m')) {
        // H&M URL format: /en_us/productpage.0983240057.html
        // Product name is in the URL slug or we need to use Google search
        const fallbackTitle = humanize(slug || 'H&M Product');
        console.log(`[ProductScrape] H&M: Extracted title from URL: "${fallbackTitle}"`);
        return {
          title: fallbackTitle,
          brand: 'H&M',
          productUrl,
          rawMetadata: { source: 'fallback-from-url-blocked' },
        };
      } else if (host.includes('urbanoutfitters.com')) {
        // Urban Outfitters URL format: /shop/out-from-under-diana-layering-lace-trim-henley-top
        // Product name is in the URL path
        let productName = slug;
        if (segments.length >= 2 && segments[0] === 'shop') {
          // Product name is after /shop/
          productName = segments.slice(1).join('-');
        }
        const fallbackTitle = humanize(productName || 'Urban Outfitters Product');
        console.log(`[ProductScrape] Urban Outfitters: Extracted title from URL: "${fallbackTitle}"`);
        return {
          title: fallbackTitle,
          brand: 'Urban Outfitters',
          productUrl,
          rawMetadata: { source: 'fallback-from-url-blocked' },
        };
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
// Keyword-based category detection as fallback
export function detectCategoryFromKeywords(title: string, description?: string): string | null {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // Strong indicators for each category
  const categoryKeywords: Record<string, RegExp[]> = {
    'Bottoms': [
      /\b(pant|pants|trouser|trousers|jean|jeans|short|shorts|skirt|skirts|legging|leggings|jogger|joggers|sweatpant|sweatpants|culotte|culottes)\b/i
    ],
    'Shoes': [
      /\b(shoe|shoes|boot|boots|sneaker|sneakers|heel|heels|pump|pumps|loafer|loafers|flat|flats|sandal|sandals|mule|mules|clog|clogs|oxford|trainer|trainers|wedge|wedges|slipper|slippers|hoka|transport)\b/i
    ],
    'Tops': [
      /\b(top|tops|shirt|shirts|blouse|blouses|tee|tees|t-shirt|t-shirts|tank|tanks|camisole|camisoles|sweater|sweaters|cardigan|cardigans|hoodie|hoodies|pullover|sweatshirt|sweatshirts|bodysuit|bodysuits)\b/i
    ],
    'Outerwear': [
      /\b(jacket|jackets|coat|coats|blazer|blazers|vest|vests|parka|parkas|bomber|trench|windbreaker|windbreakers)\b/i
    ],
    'Dresses & One-Pieces': [
      /\b(dress|dresses|gown|gowns|jumpsuit|jumpsuits|romper|rompers|overall|overalls)\b/i
    ],
    'Accessories': [
      /\b(ring|rings|necklace|necklaces|bracelet|bracelets|earring|earrings|pendant|pendants|chain|chains|jewelry|jewellery|bag|bags|handbag|handbags|purse|purses|clutch|backpack|backpacks|belt|belts|hat|hats|beanie|beanies|scarf|scarves|watch|watches|sunglasses|glove|gloves|brooch|brooches|pin|pins|headband|headbands|shawl|shawls)\b/i
    ],
    'Swimwear': [
      /\b(swimsuit|swimsuits|bikini|bikinis|swimwear|bathing suit|bathing suits)\b/i
    ],
    'Underwear & Sleepwear': [
      /\b(underwear|bra|bras|panties|panty|lingerie|sleepwear|pajama|pajamas|nightgown|nightgowns|robe|robes)\b/i
    ],
    'Activewear': [
      /\b(activewear|athletic|sportswear|gym wear|workout|yoga pants|yoga top)\b/i
    ],
  };
  
  // Check each category, return first match
  for (const [category, patterns] of Object.entries(categoryKeywords)) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        return category;
      }
    }
  }
  
  return null;
}

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
  // First, try keyword-based detection as a strong signal
  const keywordCategory = detectCategoryFromKeywords(title, description);
  if (keywordCategory) {
    console.log(`[ProductSearch] Keyword-based category detection: "${keywordCategory}" for "${title}"`);
  }
  
  if (!openai) {
    console.warn('[ProductSearch] OpenAI API key missing, skipping metadata extraction');
    // Return keyword-based category if available
    return keywordCategory ? { category: keywordCategory } : {};
  }

  try {
    const prompt = `Analyze this fashion item and extract structured metadata. Return ONLY valid JSON.

Item: ${title}
${description ? `Description: ${description}` : ''}
${imageUrl ? `Image available: Yes - analyze the image for visual details like neckline, crop, sleeve length, etc.` : ''}

CRITICAL CATEGORIZATION RULES (follow these in order):
1. SHOES: If the title/description contains ANY of these words, it MUST be "Shoes": shoe, shoes, boot, boots, sneaker, sneakers, heel, heels, pump, pumps, loafer, loafers, flat, flats, sandal, sandals, mule, mules, clog, clogs, oxford, trainer, trainers, wedge, wedges, slipper, slippers, hoka, transport, running shoe, walking shoe
2. BOTTOMS: If the title/description contains ANY of these words, it MUST be "Bottoms": pant, pants, trouser, trousers, jean, jeans, short, shorts, skirt, skirts, legging, leggings, jogger, joggers, sweatpant, sweatpants, culotte, culottes, painter pant, pull-on pant, wide leg, straight leg
3. ACCESSORIES: Only if the title/description contains: ring, necklace, bracelet, earring, pendant, chain, jewelry, accessory, bag, belt, hat, scarf, watch, sunglasses, glove, brooch, pin, headband, shawl
4. TOPS: Only if it's clearly a shirt, blouse, sweater, t-shirt, tank, camisole, hoodie, etc. - NOT pants, skirts, or shoes
5. OUTERWEAR: Only if it's clearly a jacket, coat, blazer, vest, parka, bomber, trench, windbreaker
6. DRESSES: Only if it's clearly a dress, gown, jumpsuit, romper, overall

${keywordCategory ? `STRONG HINT: Based on keywords, this item is likely "${keywordCategory}". Verify this is correct, but if the title/description clearly matches "${keywordCategory}" keywords, use that category.` : ''}

Extract and return a JSON object with these fields (only include fields you can confidently determine):
- category: One of: Tops, Bottoms, Dresses & One-Pieces, Outerwear, Shoes, Accessories, Underwear & Sleepwear, Swimwear, Activewear
  * CRITICAL: If the title contains "pant", "pants", "jean", "jeans", "short", "shorts", "skirt", "skirt", "legging", "leggings", "jogger", "joggers", it MUST be "Bottoms"
  * CRITICAL: If the title contains "shoe", "shoes", "boot", "boots", "sneaker", "sneakers", "heel", "heels", "pump", "pumps", "loafer", "loafers", "flat", "flats", "sandal", "sandals", "mule", "mules", "clog", "clogs", "oxford", "trainer", "trainers", "wedge", "wedges", "hoka", "transport", it MUST be "Shoes"
  * "Bottoms" includes: pants, jeans, trousers, shorts, skirts (mini, midi, maxi), leggings, joggers, sweatpants, culottes, painter pants, pull-on pants, wide leg pants, straight leg pants, etc.
  * "Shoes" includes: all footwear - boots, sneakers, heels, pumps, loafers, flats, sandals, mules, clogs, oxfords, trainers, wedges, slippers, running shoes, walking shoes, etc.
  * "Accessories" includes: jewelry (rings, necklaces, bracelets, earrings, pendants), bags, belts, hats, scarves, watches, sunglasses, gloves, etc.
  * "Tops" includes: shirts, t-shirts, blouses, sweaters, hoodies, tanks, camisoles, etc. - NOT skirts, pants, or shoes
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
      // Override category with keyword-based detection if available (more reliable)
      const finalCategory = keywordCategory || parsed.category;
      if (keywordCategory && parsed.category !== keywordCategory) {
        console.warn(`[ProductSearch] LLM returned category "${parsed.category}" but keyword detection suggests "${keywordCategory}". Using keyword-based category.`);
      }
      return {
        category: finalCategory,
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
      // Return keyword-based category if available, even if LLM parsing failed
      return keywordCategory ? { category: keywordCategory } : {};
    }
  } catch (error) {
    console.error('[ProductSearch] Error extracting metadata:', error);
    // Return keyword-based category if available, even if LLM extraction failed
    return keywordCategory ? { category: keywordCategory } : {};
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

