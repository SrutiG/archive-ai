import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { WardrobeItem } from './index';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

const CATEGORIES = [
  'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 
  'Accessories', 'Bags', 'Jewelry', 'Activewear', 'Underwear'
];

const QUICK_ENTRY_MAX_TITLE_LENGTH = 60;

const QUICK_ENTRY_FILLER_PATTERNS = [
  /^i\s+(have|own|got)\s+/i,
  /^there\s+(is|are)\s+/i,
  /^these\s+/i,
  /^here\s+/i,
  /^my\s+/i,
];

const QUICK_ENTRY_ARTICLE_SPLIT_REGEX = /\band\s+(?=(?:a|an|the)\s)/gi;

const QUICK_ENTRY_DIRECT_CATEGORY_MAP: Record<string, string> = {
  dress: 'Dresses',
  dresses: 'Dresses',
};

function normalizeCategory(rawCategory: string | undefined, fallbackText: string): string {
  if (rawCategory) {
    const trimmed = rawCategory.trim();
    if (trimmed) {
      const lower = trimmed.toLowerCase();
      const exact = CATEGORIES.find(cat => cat.toLowerCase() === lower);
      if (exact) return exact;
      const partial = CATEGORIES.find(cat => cat.toLowerCase().includes(lower) || lower.includes(cat.toLowerCase()));
      if (partial) return partial;
    }
  }

  const lowerFallback = fallbackText.toLowerCase();
  if (/\b(shoe|shoes|sneaker|sneakers|boot|boots|heel|heels|loafer|loafers|flat|flats|sandal|sandals|mule|mules)\b/.test(lowerFallback)) {
    return 'Shoes';
  }
  if (/\b(pant|pants|trouser|trousers|jean|jeans|short|shorts|skirt|skirts|bottom|bottoms|legging|leggings|jogger|joggers)\b/.test(lowerFallback)) {
    return 'Bottoms';
  }
  if (/\b(dress|gown)\b/.test(lowerFallback)) {
    return 'Dresses';
  }
  if (/\b(coat|jacket|blazer|outerwear|cardigan|sweater|sweatshirt|hoodie|top|tops|shirt|tee|t-shirt|tank)\b/.test(lowerFallback)) {
    return 'Tops';
  }
  if (/\b(bag|purse|belt|hat|scarf|glove|watch|ring|bracelet|necklace|jewelry|earring|earrings|cuff|pendant)\b/.test(lowerFallback)) {
    return 'Accessories';
  }
  return 'Accessories';
}

function sanitizeDescription(description: string | undefined, fallbackText: string): string | undefined {
  const value = (description || fallbackText || '').trim();
  if (!value) return undefined;
  return value.length > 200 ? `${value.slice(0, 197)}...` : value;
}

function dedupeItems(items: GeneratedWardrobeDraftItem[]): GeneratedWardrobeDraftItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase();
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export interface GeneratedWardrobeDraftItem {
  title: string;
  category: string;
  description?: string;
}

function stripLeadingMarkers(value: string): string {
  return value.replace(/^[\s]*[-•*·+]+[\s]*/, '');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function removeTrailingPunctuation(value: string): string {
  return value.replace(/[,\.;:\-]+$/g, '').trim();
}

function enforceTitleLength(value: string): string {
  if (value.length <= QUICK_ENTRY_MAX_TITLE_LENGTH) {
    return value;
  }
  return `${value.slice(0, QUICK_ENTRY_MAX_TITLE_LENGTH - 3).trimEnd()}...`;
}

export function formatQuickEntryTitle(raw: string): string {
  const cleaned = enforceTitleLength(
    normalizeWhitespace(removeTrailingPunctuation(stripLeadingMarkers(raw || '')))
  );
  const titleCased = cleaned
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return titleCased;
}

function splitQuickEntrySegments(input: string): string[] {
  const preprocessed = input
    .replace(/\n+/g, ', ')
    .replace(/\s+[-•–—]+\s+/g, ', ');

  let segments = preprocessed
    .split(/[,;]+/)
    .map(segment => normalizeWhitespace(segment))
    .filter(Boolean);

  segments = segments.flatMap(segment => {
    if (/^(?:a|an|the)\s/i.test(segment) && QUICK_ENTRY_ARTICLE_SPLIT_REGEX.test(segment)) {
      return segment
        .split(QUICK_ENTRY_ARTICLE_SPLIT_REGEX)
        .map(part => normalizeWhitespace(part))
        .filter(Boolean);
    }
    return segment;
  });

  segments = segments
    .map(segment => {
      let result = segment;
      QUICK_ENTRY_FILLER_PATTERNS.forEach(pattern => {
        if (pattern.test(result)) {
          result = result.replace(pattern, '').trim();
        }
      });
      return normalizeWhitespace(result);
    })
    .filter(segment => segment && segment.length > 1);

  return segments;
}

function fallbackGenerateWardrobeItems(input: string): GeneratedWardrobeDraftItem[] {
  console.log('[LLM] Using fallback parsing for quick entry items');
  const segments = splitQuickEntrySegments(input);

  if (segments.length === 0) {
    const cleaned = normalizeWhitespace(removeTrailingPunctuation(stripLeadingMarkers(input)));
    if (!cleaned) {
      return [];
    }
    segments.push(cleaned);
  }

  const drafts: GeneratedWardrobeDraftItem[] = [];
  for (const segment of segments) {
    const title = formatQuickEntryTitle(segment);
    if (!title) {
      continue;
    }

    const directCategory = Object.entries(QUICK_ENTRY_DIRECT_CATEGORY_MAP).find(
      ([keyword]) => title.toLowerCase().includes(keyword)
    )?.[1];

    const category = directCategory ?? normalizeCategory(undefined, segment);
    const description = sanitizeDescription(
      `Quick entry draft item described as: ${segment}`,
      `Quick entry draft item described as: ${segment}`
    );

    drafts.push({
      title,
      category,
      ...(description ? { description } : {})
    });
  }

  return dedupeItems(drafts);
}

export async function generateWardrobeItemsFromText(input: string): Promise<GeneratedWardrobeDraftItem[]> {
  const trimmed = input.trim();
  if (!trimmed) {
    return [];
  }

  if (!OPENAI_API_KEY || !openai) {
    return fallbackGenerateWardrobeItems(trimmed);
  }

  try {
    console.log(`[LLM] Parsing quick entry wardrobe text (${trimmed.length} characters)`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a wardrobe assistant. The user will share a free-form stream of consciousness describing clothing or accessory items they own. Extract each distinct item and return a JSON object with a single key "items" that maps to an array. Each array element must include:
- "title": human-friendly title in Title Case, ideally 3-8 words.
- "category": one of the following exactly: ${CATEGORIES.join(', ')}.
- "description": short sentence (max 160 characters) summarizing the item's color, fabric, fit, or style.
Use only the listed categories. Respond with valid JSON only. If no items are found, return {"items": []}.`
        },
        {
          role: 'user',
          content: trimmed
        }
      ],
      max_tokens: 600,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.warn('[LLM] Empty response when parsing wardrobe items, using fallback');
      return fallbackGenerateWardrobeItems(trimmed);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('[LLM] Failed to parse JSON response, using fallback', parseError);
      return fallbackGenerateWardrobeItems(trimmed);
    }

    if (!parsed || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      console.warn('[LLM] Parsed response missing items, using fallback parser');
      return fallbackGenerateWardrobeItems(trimmed);
    }

    const sanitized = parsed.items
      .map((item: any) => {
        const rawTitle = (item?.title || '').toString();
        const title = formatQuickEntryTitle(rawTitle);
        if (!title) {
          return null;
        }
        const category = normalizeCategory((item?.category || '').toString(), title);
        const description = sanitizeDescription(item?.description ? item.description.toString() : '', title);
        return {
          title,
          category,
          ...(description ? { description } : {})
        } as GeneratedWardrobeDraftItem;
      })
      .filter((item: GeneratedWardrobeDraftItem | null): item is GeneratedWardrobeDraftItem => item !== null);

    if (sanitized.length === 0) {
      console.warn('[LLM] Sanitized response produced no items, using fallback parser');
      return fallbackGenerateWardrobeItems(trimmed);
    }

    return dedupeItems(sanitized);
  } catch (error) {
    console.error('[LLM] Error parsing wardrobe items:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
    }
    return fallbackGenerateWardrobeItems(trimmed);
  }
}
export async function categorizeItem(title: string, imagePath: string): Promise<string> {
  if (!openai) {
    console.warn('[LLM] OpenAI API key missing, falling back to heuristic categorization');
    return normalizeCategory(undefined, title);
  }
  try {
    console.log(`[LLM] Starting categorization for: "${title}"`);
    console.log(`[LLM] Image path: ${imagePath}`);
    
    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const imageSizeKB = (imageBuffer.length / 1024).toFixed(2);
    console.log(`[LLM] Image size: ${imageSizeKB} KB`);
    
    // Determine the image MIME type
    const ext = path.extname(imagePath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.webp') mimeType = 'image/webp';
    
    console.log('[LLM] Calling OpenAI API for categorization...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion categorization assistant. Based on the image and title, categorize the item into one of these categories: ${CATEGORIES.join(', ')}. Return only the category name, nothing else.`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Categorize this item: "${title}". Return only the category name from this list: ${CATEGORIES.join(', ')}`
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 10,
      temperature: 0.3
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const category = response.choices[0]?.message?.content?.trim();
    if (!category) {
      console.error('[LLM] No category returned from API');
      throw new Error('No category returned from LLM');
    }

    // Validate category
    const normalizedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
    if (CATEGORIES.includes(normalizedCategory)) {
      console.log(`[LLM] Categorized "${title}" as: ${normalizedCategory}`);
      return normalizedCategory;
    }

    // Fallback: try to find closest match
    const closestCategory = CATEGORIES.find(cat => 
      cat.toLowerCase().includes(category.toLowerCase()) || 
      category.toLowerCase().includes(cat.toLowerCase())
    );
    
    if (closestCategory) {
      console.log(`[LLM] Categorized "${title}" as: ${closestCategory} (normalized from "${category}")`);
      return closestCategory;
    }

    console.log(`[LLM] Could not match category "${category}", using fallback`);
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  } catch (error) {
    console.error('[LLM] Error categorizing item:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    console.log('[LLM] Using fallback category: Accessories');
    return 'Accessories';
  }
}

export interface OutfitFeedback {
  id: string;
  itemTitles: string[];
  type: 'like' | 'dislike';
  feedback?: string;
  createdAt: string;
  prompt?: string;
}

export interface GeneratedOutfit {
  items: string[];
  justification: string;
  stylingSuggestions: string[];
}

export async function generateOutfits(
  itemsByCategory: Record<string, WardrobeItem[]>,
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string; brands?: string[]; hairColor?: string; hairTexture?: string; skinColor?: string },
  prompt?: string,
  feedback?: OutfitFeedback[],
  selectedItems?: WardrobeItem[]
): Promise<GeneratedOutfit[]> {
  if (!openai) {
    console.warn('[LLM] OpenAI API key missing, using fallback outfit generator');
    return generateFallbackOutfits(itemsByCategory);
  }
  try {
    console.log('[LLM] Starting outfit generation...');
    
    // Build a detailed description of available items with descriptions
    const itemsDescription = Object.entries(itemsByCategory)
      .map(([category, items]) => {
        const itemsList = items.map(item => {
          let itemDesc = item.title;
          if (item.description) {
            itemDesc += ` (${item.description})`;
          }
          if (item.measurements) {
            const measurementsStr = Object.entries(item.measurements)
              .filter(([_, v]) => v !== undefined && v !== null)
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ');
            if (measurementsStr) {
              itemDesc += ` [${measurementsStr}]`;
            }
          }
          return itemDesc;
        }).join(', ');
        return `${category}: ${itemsList}`;
      })
      .join('\n');
    
    const totalItems = Object.values(itemsByCategory).flat().length;
    console.log(`[LLM] Generating outfits from ${totalItems} items across ${Object.keys(itemsByCategory).length} categories`);
    console.log(`[LLM] Items description length: ${itemsDescription.length} characters`);
    
    // Build user profile context
    let userContext = '';
    if (userProfile) {
      const contextParts: string[] = [];
      
      if (userProfile.height && userProfile.weight) {
        contextParts.push(`Height ${userProfile.height} ${userProfile.heightUnit || 'inches'}, Weight ${userProfile.weight} ${userProfile.weightUnit || 'lbs'}`);
      }
      
      if (userProfile.stylePreferences) {
        contextParts.push(`Style preferences: ${userProfile.stylePreferences}`);
      }
      
      // Appearance details
      const appearanceParts: string[] = [];
      if (userProfile.hairColor) {
        appearanceParts.push(`hair color: ${userProfile.hairColor}`);
      }
      if (userProfile.hairTexture) {
        appearanceParts.push(`hair texture: ${userProfile.hairTexture}`);
      }
      if (userProfile.skinColor) {
        appearanceParts.push(`skin color: ${userProfile.skinColor}`);
      }
      if (appearanceParts.length > 0) {
        contextParts.push(`Appearance: ${appearanceParts.join(', ')}`);
      }
      
      if (contextParts.length > 0) {
        userContext = `User profile: ${contextParts.join('. ')}. `;
      }
    }

    // Add selected items context if provided
    let selectedItemsContext = '';
    let exclusionRules = '';
    if (selectedItems && selectedItems.length > 0) {
      const selectedItemsDesc = selectedItems.map(item => {
        let desc = item.title;
        if (item.category) {
          desc += ` (Category: ${item.category})`;
        }
        if (item.description) {
          desc += ` - Description: ${item.description}`;
        }
        if (item.measurements) {
          const measurementsStr = Object.entries(item.measurements)
            .filter(([_, v]) => v !== undefined && v !== null)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          if (measurementsStr) {
            desc += ` - Measurements: ${measurementsStr}`;
          }
        }
        return desc;
      }).join('\n');
      const selectedItemTitles = selectedItems.map(item => item.title).join(', ');
      
      // Detect items that cover the lower body to prevent redundant items
      const lowerBodyCoveringKeywords = ['overall', 'jumpsuit', 'romper', 'dress', 'onesie'];
      const hasLowerBodyCovering = selectedItems.some(item => {
        const titleLower = item.title.toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const categoryLower = (item.category || '').toLowerCase();
        return lowerBodyCoveringKeywords.some(keyword => 
          titleLower.includes(keyword) || descLower.includes(keyword) || categoryLower.includes(keyword)
        );
      });
      
      if (hasLowerBodyCovering) {
        exclusionRules = `\n\nCRITICAL EXCLUSION RULE: The selected items include a lower-body-covering garment (overalls, jumpsuit, romper, dress, etc.). DO NOT include any of the following items in the generated outfits: pants, trousers, shorts, skirts, or any other bottom-wear items. The selected lower-body-covering item already serves as the bottom piece. Only suggest tops, outerwear, shoes, accessories, and other items that complement the selected lower-body-covering item. `;
        console.log(`[LLM] Detected lower-body-covering item in selected items - excluding pants/shorts/skirts`);
      }
      
      selectedItemsContext = `CRITICAL REQUIREMENT: The user has selected these specific items that MUST be included in EVERY single generated outfit: ${selectedItemTitles}. \n\nEach of the 5 generated outfits MUST include ALL of these selected items. Do not generate any outfit without these items. Here are the selected items with full details:\n${selectedItemsDesc}\n\nGenerate 5 different outfit combinations, each one MUST include all the selected items listed above. Create variety by pairing them with different complementary pieces from the wardrobe.${exclusionRules}`;
      console.log(`[LLM] Selected items context: ${selectedItems.length} items`);
    }

    // Add prompt context if provided
    let promptContext = '';
    if (prompt) {
      promptContext = `Additional context: ${prompt}. `;
      console.log(`[LLM] Generation prompt: ${prompt}`);
    }

    // Add feedback context if provided
    let feedbackContext = '';
    if (feedback && feedback.length > 0) {
      const likes = feedback.filter(f => f.type === 'like');
      const dislikes = feedback.filter(f => f.type === 'dislike');
      
      const feedbackParts: string[] = [];
      
      if (likes.length > 0) {
        const likedItems = likes.map(f => {
          let desc = f.itemTitles.join(', ');
          if (f.feedback) {
            desc += ` (user note: ${f.feedback})`;
          }
          return desc;
        }).join('; ');
        feedbackParts.push(`User liked these outfits: ${likedItems}`);
      }
      
      if (dislikes.length > 0) {
        const dislikedItems = dislikes.map(f => {
          let desc = f.itemTitles.join(', ');
          if (f.feedback) {
            desc += ` (user note: ${f.feedback})`;
          }
          return desc;
        }).join('; ');
        feedbackParts.push(`User disliked these outfits: ${dislikedItems}`);
      }
      
      if (feedbackParts.length > 0) {
        feedbackContext = `User feedback on previous outfits: ${feedbackParts.join('. ')}. Use this feedback to generate better outfits that align with user preferences. `;
        console.log(`[LLM] Including ${feedback.length} feedback entries (${likes.length} likes, ${dislikes.length} dislikes)`);
      }
    }

    // Build a list of all exact item titles for reference
    const allExactTitles = Object.values(itemsByCategory).flat().map(item => item.title).join(', ');
    
    console.log('[LLM] Calling OpenAI API for outfit generation...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion stylist. Generate 5-7 outfit combinations using the available wardrobe items. 
          Each outfit can include up to 10 pieces. You can include multiple items from the same category (e.g., multiple jewelry pieces, multiple jacket layers). 
          Pay close attention to the user's style preferences and personal aesthetic when creating combinations.
          
          CRITICAL: You MUST use the EXACT item titles as provided in the wardrobe list. Do NOT modify, shorten, or paraphrase item titles. 
          For example, if the wardrobe has "Rick Owens Black Blazer", you must use exactly "Rick Owens Black Blazer" - NOT "Black Blazer" or "Rick Owens Blazer".
          The item titles in your "items" array must match EXACTLY (case-sensitive) with the titles provided in the wardrobe.
          
          VARIETY REQUIREMENT: Create VARIETY across the 5 outfits. Do NOT use the same item in all 5 outfits unless:
          1. The user explicitly selected that item (then it MUST appear in all outfits)
          2. It's the only item available in that category (then it's acceptable to repeat)
          Otherwise, vary the items across outfits - use different tops, different bottoms, different shoes, etc. to create diverse outfit combinations.
          
          For each outfit, provide:
          1. A list of item titles (up to 10 pieces) - MUST be exact matches from the wardrobe
          2. A justification explaining why you chose this specific combination
          3. Styling suggestions (e.g., "wear blazer half buttoned", "wear hair in bun", "light makeup", "tuck in shirt", "cuff the sleeves")
          Return the outfits as a JSON object with a key "outfits" containing an array of objects, where each object has:
          - "items": array of item titles (up to 10 pieces) - MUST be exact matches from the wardrobe list
          - "justification": string explaining why this combination works
          - "stylingSuggestions": array of styling tips (e.g., ["wear blazer half buttoned", "wear hair in bun", "light makeup"])
          Example format: {"outfits": [{"items": ["Blue Shirt", "Black Jeans", "White Sneakers"], "justification": "This combination creates a casual yet polished look...", "stylingSuggestions": ["tuck in shirt", "cuff the sleeves"]}, ...]}
          Only return the JSON object, no other text.`
        },
        {
          role: 'user',
          content: `${userContext}${selectedItemsContext}${promptContext}${feedbackContext}Generate outfit combinations from these items:\n${itemsDescription}\n\nCRITICAL REQUIREMENT - EXACT TITLE MATCHING: You MUST use the EXACT item titles as listed above. Do NOT modify, shorten, abbreviate, or paraphrase any item titles. Copy the titles EXACTLY as they appear in the wardrobe list above. For example, if the list shows "Rick Owens Black Blazer", you must use exactly "Rick Owens Black Blazer" in your items array - NOT "Black Blazer", "Rick Owens Blazer", or any variation.\n\nHere are all available item titles for reference (use these EXACT titles only):\n${allExactTitles}\n\nVARIETY REQUIREMENT: Create VARIETY across the 5 outfits. Do NOT use the same item in all 5 outfits unless:
1. The user explicitly selected that item (then it MUST appear in all outfits)
2. It's the only item available in that category (then it's acceptable to repeat)

Otherwise, vary the items across outfits - use different tops, different bottoms, different shoes, different outerwear, etc. Each outfit should feel unique and different from the others. Only repeat items if they were explicitly selected by the user or if there's only one option in that category.\n\nConsider the user's body measurements, style preferences, and the detailed descriptions of each item when creating stylish and well-fitting outfit combinations that match their personal aesthetic. Each outfit can include up to 10 pieces and can include multiple items from the same category (e.g., multiple jewelry pieces, layered jackets). For each outfit, explain why you chose this combination and provide specific styling suggestions. ${selectedItems && selectedItems.length > 0 ? `MANDATORY: Every single one of the 5 generated outfits MUST include ALL of these selected items: ${selectedItems.map(i => i.title).join(', ')}. This is a requirement - do not generate any outfit that does not include all selected items.` : ''}${exclusionRules} ${prompt ? 'Pay special attention to the additional context provided above.' : ''} ${feedback && feedback.length > 0 ? 'Use the user feedback to avoid creating similar outfits to ones they disliked and to create more outfits similar to ones they liked.' : ''} Return a JSON object with an "outfits" key containing an array of outfit objects, each with "items", "justification", and "stylingSuggestions". Generate exactly 5 outfit combinations. Remember: Use EXACT item titles from the list above - no modifications, abbreviations, or variations. Create VARIETY - do not repeat the same items across all outfits unless they were selected or are the only option.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('[LLM] No response content from API');
      throw new Error('No response from LLM');
    }

    console.log(`[LLM] Response length: ${content.length} characters`);
    
    // Try to parse the response
    let outfits: GeneratedOutfit[];
    try {
      const parsed = JSON.parse(content);
      // Handle both { "outfits": [...] } and direct array formats
      if (Array.isArray(parsed)) {
        // Convert old format to new format
        outfits = parsed.map((outfit: any) => {
          if (typeof outfit === 'object' && outfit.items) {
            // Already in new format
            return {
              items: outfit.items || [],
              justification: outfit.justification || 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: outfit.stylingSuggestions || []
            };
          } else if (Array.isArray(outfit)) {
            // Old format - array of strings
            return {
              items: outfit,
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          } else {
            return {
              items: [],
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          }
        });
        console.log('[LLM] Parsed as direct array');
      } else if (parsed.outfits && Array.isArray(parsed.outfits)) {
        outfits = parsed.outfits.map((outfit: any) => {
          if (typeof outfit === 'object' && outfit.items) {
            // New format
            return {
              items: outfit.items || [],
              justification: outfit.justification || 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: outfit.stylingSuggestions || []
            };
          } else if (Array.isArray(outfit)) {
            // Old format - array of strings
            return {
              items: outfit,
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          } else {
            return {
              items: [],
              justification: 'This combination creates a stylish and cohesive look.',
              stylingSuggestions: []
            };
          }
        });
        console.log('[LLM] Parsed as object with outfits key');
      } else {
        throw new Error('Unexpected response format');
      }
      console.log(`[LLM] Successfully parsed ${outfits.length} outfits`);
    } catch (parseError) {
      // Fallback: try to extract outfit combinations from text
      console.error('[LLM] Error parsing LLM response:', parseError);
      if (parseError instanceof Error) {
        console.error('[LLM] Parse error details:', parseError.message);
      }
      console.log('[LLM] Using fallback outfit generation');
      outfits = generateFallbackOutfits(itemsByCategory);
    }

    // Validate and filter outfits
    const allItemTitles = Object.values(itemsByCategory).flat().map(item => item.title);
    const beforeFilter = outfits.length;
    
    // Post-process to remove redundant items if selected items include lower-body-covering garments
    if (selectedItems && selectedItems.length > 0) {
      const lowerBodyCoveringKeywords = ['overall', 'jumpsuit', 'romper', 'onesie'];
      const hasLowerBodyCovering = selectedItems.some(item => {
        const titleLower = item.title.toLowerCase();
        const descLower = (item.description || '').toLowerCase();
        const categoryLower = (item.category || '').toLowerCase();
        return lowerBodyCoveringKeywords.some(keyword => 
          titleLower.includes(keyword) || descLower.includes(keyword) || categoryLower.includes(keyword)
        );
      });
      
      if (hasLowerBodyCovering) {
        const redundantKeywords = ['pant', 'trouser', 'short', 'skirt', 'dress'];
        outfits = outfits.map(outfit => ({
          ...outfit,
          items: outfit.items.filter(itemTitle => {
            // Keep selected items
            if (selectedItems.some(selected => selected.title === itemTitle)) {
              return true;
            }
            // Remove redundant bottom-wear items
            const titleLower = itemTitle.toLowerCase();
            const isRedundant = redundantKeywords.some(keyword => titleLower.includes(keyword));
            if (isRedundant) {
              console.log(`[LLM] Filtering out redundant item: ${itemTitle} (conflicts with lower-body-covering selected item)`);
            }
            return !isRedundant;
          })
        }));
        console.log(`[LLM] Post-processed outfits to remove redundant bottom-wear items`);
      }
    }
    
    // Validate and filter outfits
    outfits = outfits
      .map(outfit => ({
        ...outfit,
        items: outfit.items.filter(title => allItemTitles.includes(title)).slice(0, 10) // Limit to 10 items
      }))
      .filter(outfit => outfit.items.length > 0)
      .slice(0, 7); // Limit to 7 outfits
    
    if (beforeFilter !== outfits.length) {
      console.log(`[LLM] Filtered outfits: ${beforeFilter} -> ${outfits.length}`);
    }

    if (outfits.length === 0) {
      console.log('[LLM] No valid outfits generated, using fallback');
      return generateFallbackOutfits(itemsByCategory);
    }
    
    console.log(`[LLM] Successfully generated ${outfits.length} outfit combinations`);
    outfits.forEach((outfit, index) => {
      console.log(`[LLM]   Outfit ${index + 1}: ${outfit.items.join(' + ')}`);
      console.log(`[LLM]     Justification: ${outfit.justification.substring(0, 100)}...`);
      console.log(`[LLM]     Styling suggestions: ${outfit.stylingSuggestions.length} tips`);
    });
    
    return outfits;
  } catch (error) {
    console.error('[LLM] Error generating outfits:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    console.log('[LLM] Using fallback outfit generation');
    return generateFallbackOutfits(itemsByCategory);
  }
}

export interface ExploreSuggestion {
  title: string;
  category: string;
  description: string;
  brand?: string; // Brand or store name
  pairsWellWith: string[];
}

export async function generateExploreSuggestions(
  wardrobeItems: WardrobeItem[],
  userProfile?: { height?: number; weight?: number; heightUnit?: string; weightUnit?: string; stylePreferences?: string; brands?: string[]; hairColor?: string; hairTexture?: string; skinColor?: string },
  feedback?: OutfitFeedback[]
): Promise<ExploreSuggestion[]> {
  if (!openai) {
    console.warn('[LLM] OpenAI API key missing, skipping explore suggestions generation');
    return [];
  }
  try {
    console.log('[LLM] Starting explore suggestions generation...');
    
    // Group items by category
    const itemsByCategory = wardrobeItems.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);

    // Build wardrobe summary
    const categorySummary = Object.entries(itemsByCategory)
      .map(([category, items]) => `${category}: ${items.length} items (${items.map(i => i.title).join(', ')})`)
      .join('\n');

    const allItemTitles = wardrobeItems.map(item => item.title).join(', ');
    
    // Build user profile context
    let userContext = '';
    if (userProfile) {
      const contextParts: string[] = [];
      
      if (userProfile.height && userProfile.weight) {
        contextParts.push(`Height ${userProfile.height} ${userProfile.heightUnit || 'inches'}, Weight ${userProfile.weight} ${userProfile.weightUnit || 'lbs'}`);
      }
      
      if (userProfile.stylePreferences) {
        contextParts.push(`Style preferences: ${userProfile.stylePreferences}`);
      }
      
      if (userProfile.brands && userProfile.brands.length > 0) {
        contextParts.push(`Favorite brands: ${userProfile.brands.join(', ')}`);
      }
      
      // Appearance details
      const appearanceParts: string[] = [];
      if (userProfile.hairColor) {
        appearanceParts.push(`hair color: ${userProfile.hairColor}`);
      }
      if (userProfile.hairTexture) {
        appearanceParts.push(`hair texture: ${userProfile.hairTexture}`);
      }
      if (userProfile.skinColor) {
        appearanceParts.push(`skin color: ${userProfile.skinColor}`);
      }
      if (appearanceParts.length > 0) {
        contextParts.push(`Appearance: ${appearanceParts.join(', ')}`);
      }
      
      if (contextParts.length > 0) {
        userContext = `User profile: ${contextParts.join('. ')}. `;
      }
    }

    // Add feedback context if provided
    let feedbackContext = '';
    if (feedback && feedback.length > 0) {
      const likes = feedback.filter(f => f.type === 'like');
      const dislikes = feedback.filter(f => f.type === 'dislike');
      
      const feedbackParts: string[] = [];
      
      if (likes.length > 0) {
        const likedItems = likes.map(f => f.itemTitles.join(', ')).join('; ');
        feedbackParts.push(`User liked outfits with: ${likedItems}`);
      }
      
      if (dislikes.length > 0) {
        const dislikedItems = dislikes.map(f => f.itemTitles.join(', ')).join('; ');
        feedbackParts.push(`User disliked outfits with: ${dislikedItems}`);
      }
      
      if (feedbackParts.length > 0) {
        feedbackContext = `User feedback: ${feedbackParts.join('. ')}. `;
      }
    }

    console.log('[LLM] Calling OpenAI API for explore suggestions...');
    const startTime = Date.now();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a fashion stylist and wardrobe consultant. Analyze the user's wardrobe and identify gaps or missing pieces that would enhance their style. Suggest specific items that would complement their existing wardrobe and match their style preferences. When suggesting brands, consider the user's favorite brands and suggest items similar in style/aesthetic to those brands, but don't limit yourself to only those brands. Return suggestions as a JSON object with a key "suggestions" containing an array of objects, each with: "title" (specific item name, e.g., "Black Leather Ankle Boots", "Oversized White Button-Down Shirt"), "category" (from: ${CATEGORIES.join(', ')}), "description" (detailed description of the item including color, style, fit, etc.), "brand" (brand or store name where this item could be found - can be the exact brand if appropriate, or "similar to X brand" to indicate items with similar aesthetic to user's favorite brands, e.g., "Rick Owens", "similar to Rick Owens", "Zara", "Everlane", "Vintage"), and "pairsWellWith" (array of 2-4 existing wardrobe item titles it would pair well with). Do NOT include "link" or "imageUrl" fields - these will be generated automatically. Generate up to 9 suggestions.`
        },
        {
          role: 'user',
          content: `${userContext}${feedbackContext}Analyze this wardrobe and suggest items that would fill gaps or enhance the collection:\n\nCurrent wardrobe:\n${categorySummary}\n\nAll items: ${allItemTitles}\n\nBased on the user's style preferences, favorite brands, and existing wardrobe, suggest up to 9 specific items that would complement their collection. When suggesting brands, consider the user's favorite brands and suggest items with similar aesthetic/style to those brands (you can say "similar to [brand name]" if suggesting a different brand with similar aesthetic, or use the exact brand name if appropriate). For each suggestion, provide: a specific item name (e.g., "Black Leather Ankle Boots" not just "boots"), a detailed description including color, style, and fit, a brand/store name where this item could be found (be specific with designer names or stores that match the user's style, or use "similar to [brand]" format), and list 2-4 existing wardrobe items it would pair well with. Do NOT include links or image URLs - these will be generated automatically. Return a JSON object with a "suggestions" key containing an array of suggestion objects.`
        }
      ],
      max_tokens: 1500,
      temperature: 0.8,
      response_format: { type: 'json_object' }
    });
    const duration = Date.now() - startTime;
    
    if (response.usage) {
      console.log(`[LLM] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`);
    }
    console.log(`[LLM] API call took ${duration}ms`);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error('[LLM] No response content from API');
      throw new Error('No response from LLM');
    }

    console.log(`[LLM] Response length: ${content.length} characters`);
    
    // Parse the response
    let suggestions: ExploreSuggestion[];
    try {
      const parsed = JSON.parse(content);
      if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
        // Validate and limit to 9
        suggestions = suggestions
          .filter(s => s.title && s.category && s.description && Array.isArray(s.pairsWellWith))
          .slice(0, 9);
        
        // Validate pairsWellWith items exist in wardrobe
        suggestions = suggestions.map(s => ({
          ...s,
          pairsWellWith: s.pairsWellWith.filter(title => allItemTitles.includes(title)).slice(0, 4)
        })).filter(s => s.pairsWellWith.length > 0);
        
        console.log(`[LLM] Successfully parsed ${suggestions.length} suggestions`);
      } else {
        throw new Error('Unexpected response format');
      }
    } catch (parseError) {
      console.error('[LLM] Error parsing LLM response:', parseError);
      if (parseError instanceof Error) {
        console.error('[LLM] Parse error details:', parseError.message);
      }
      throw new Error('Failed to parse suggestions');
    }

    return suggestions;
  } catch (error) {
    console.error('[LLM] Error generating explore suggestions:', error);
    if (error instanceof Error) {
      console.error('[LLM] Error details:', error.message);
      console.error('[LLM] Stack:', error.stack);
    }
    throw error;
  }
}

function generateFallbackOutfits(
  itemsByCategory: Record<string, WardrobeItem[]>
): GeneratedOutfit[] {
  console.log('[LLM] Generating fallback outfits...');
  const outfits: GeneratedOutfit[] = [];
  const categories = Object.keys(itemsByCategory);
  
  if (categories.length < 2) {
    console.log('[LLM] Not enough categories for fallback outfits');
    return outfits;
  }

  // Generate simple combinations
  for (let i = 0; i < Math.min(5, categories.length); i++) {
    const category1 = categories[i % categories.length];
    const category2 = categories[(i + 1) % categories.length];
    
    const items1 = itemsByCategory[category1];
    const items2 = itemsByCategory[category2];
    
    if (items1.length > 0 && items2.length > 0) {
      outfits.push({
        items: [
          items1[0].title,
          items2[0].title
        ],
        justification: `A simple combination of ${category1} and ${category2}`,
        stylingSuggestions: ['Pair these items together for a casual look.']
      });
    }
  }
  
  console.log(`[LLM] Generated ${outfits.length} fallback outfits`);
  return outfits;
}
