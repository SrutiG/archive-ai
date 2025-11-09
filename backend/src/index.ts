import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import {
  generateOutfits,
  generateExploreSuggestions,
  generateWardrobeItemsFromText,
  formatQuickEntryTitle,
  getCoreCategoryFlags,
  extractContextFilters,
  filterItemsForContext,
  buildContextFilterSummary,
  type CoreCategory,
  type FilteredItemsResult,
} from './llmService';
import * as db from './database';
import * as supabaseStorage from './supabaseStorage';
import {
  WardrobeSubCategory,
  listAllSubCategories,
  resolveSubCategory,
} from './wardrobeSubcategories';

// Initialize PostgreSQL schema if using PostgreSQL
if (process.env.DATABASE_URL && typeof db.initializeSchema === 'function') {
  db.initializeSchema().catch(err => {
    console.error('Failed to initialize PostgreSQL schema:', err);
    if (err instanceof Error && err.message.includes('ENETUNREACH')) {
      console.error('\n⚠️  CONNECTION ERROR: This looks like an IPv6 connection issue.');
      console.error('Render does not support IPv6 connections to PostgreSQL.');
      console.error('Please use an IPv4 connection string from Supabase.');
      console.error('\nTo fix this:');
      console.error('1. Go to Supabase Dashboard → Settings → Database');
      console.error('2. Look for "Connection string" or "Connection pooling"');
      console.error('3. Use the IPv4 connection string (not IPv6)');
      console.error('4. It should look like: postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres');
      console.error('5. Make sure it uses a hostname (db.xxxxx.supabase.co) not an IPv6 address');
    }
  });
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Logging middleware (after body parsing)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
    console.log(`  Body:`, req.body);
  }
  res.on('finish', () => {
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${res.statusCode}`);
  });
  next();
});

const QUICK_ENTRY_CHAR_LIMIT = 800;

const stripLeadingMarkers = (value: string): string =>
  value.replace(/^[\s]*[-•*·+]+[\s]*/, '');

const normalizeWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const sanitizeOutfitTitle = (title: string): string =>
  normalizeWhitespace(stripLeadingMarkers(title || ''));

const normalizeOutfitTitleKey = (title: string): string =>
  sanitizeOutfitTitle(title).toLowerCase();

function resolveOutfitItemsFromRequest(
  userItems: WardrobeItem[],
  itemIdsInput: unknown,
  itemTitlesInput: unknown
): { items: WardrobeItem[]; missingIds: string[]; missingTitles: string[] } {
  const itemsById = new Map(userItems.map(item => [item.id, item]));
  const itemsByTitle = new Map(
    userItems.map(item => [normalizeOutfitTitleKey(item.title), item])
  );

  const items: WardrobeItem[] = [];
  const missingIds: string[] = [];
  const missingTitles: string[] = [];

  const requestedIds = parseStringArrayField(itemIdsInput).map(id => id.trim()).filter(id => id.length > 0);
  const requestedTitles = parseStringArrayField(itemTitlesInput).map(title => sanitizeOutfitTitle(title));

  if (requestedIds.length > 0) {
    requestedIds.forEach((id, index) => {
      let match = itemsById.get(id);
      if (!match && requestedTitles[index]) {
        const normalized = normalizeOutfitTitleKey(requestedTitles[index]);
        match = itemsByTitle.get(normalized);
      }
      if (match) {
        items.push(match);
      } else {
        missingIds.push(id);
      }
    });
    return { items, missingIds, missingTitles };
  }

  requestedTitles.forEach(title => {
    const normalized = normalizeOutfitTitleKey(title);
    let match = itemsByTitle.get(normalized);
    if (match) {
      items.push(match);
    } else {
      missingTitles.push(title);
    }
  });

  return { items, missingIds, missingTitles };
}

const fieldProvided = (body: Record<string, any>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(body, key);

const parseStringArrayField = (value: any): string[] => {
  let result: string[] = [];

  if (Array.isArray(value)) {
    result = value.map(entry => (entry ?? '').toString());
  } else if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        result = parsed.map(entry => (entry ?? '').toString());
      } else {
        result = trimmed.split(',').map(part => part.trim());
      }
    } catch {
      result = trimmed.split(',').map(part => part.trim());
    }
  }

  return Array.from(
    new Set(
      result
        .map(entry => entry.trim())
        .filter(entry => entry.length > 0)
    )
  );
};

const parseTextField = (value: any): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
} else {
  console.log('Uploads directory exists');
}

// Configure multer for file uploads
// Use memory storage when Supabase is configured, disk storage otherwise (fallback)
const storage = supabaseStorage.isSupabaseConfigured()
  ? multer.memoryStorage() // Store in memory, then upload to Supabase
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadsDir);
      },
      filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
      }
    });

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

export type WardrobeColorOption =
  | 'black'
  | 'white'
  | 'gray'
  | 'navy'
  | 'blue'
  | 'green'
  | 'olive'
  | 'red'
  | 'burgundy'
  | 'pink'
  | 'purple'
  | 'yellow'
  | 'orange'
  | 'brown'
  | 'tan'
  | 'beige'
  | 'cream'
  | 'metallic'
  | 'multicolor'
  | 'other';

export type WardrobeFabricOption =
  | 'cotton'
  | 'linen'
  | 'silk'
  | 'wool'
  | 'cashmere'
  | 'denim'
  | 'leather'
  | 'suede'
  | 'knit'
  | 'synthetic'
  | 'chiffon'
  | 'satin'
  | 'velvet'
  | 'lace'
  | 'other';

export type WardrobePatternOption =
  | 'solid'
  | 'striped'
  | 'plaid'
  | 'check'
  | 'floral'
  | 'animal'
  | 'polka-dot'
  | 'geometric'
  | 'graphic'
  | 'abstract'
  | 'textured'
  | 'other';

export type WardrobeSilhouetteOption =
  | 'a-line'
  | 'column'
  | 'fit-and-flare'
  | 'cocoon'
  | 'trapeze'
  | 'bodycon'
  | 'wide-leg'
  | 'straight-leg'
  | 'cropped'
  | 'long-sleeve'
  | 'short-sleeve'
  | 'sleeveless'
  | 'peplum'
  | 'asymmetrical-hem'
  | 'v-neck'
  | 'boat-neck'
  | 'mock-neck'
  | 'turtleneck'
  | 'crew-neck'
  | 'scoop-neck'
  | 'square-neck'
  | 'sweetheart'
  | 'off-the-shoulder'
  | 'halter-neck'
  | 'cowl-neck'
  | 'hooded'
  | 'collared'
  | 'collarless'
  | 'other';

export type WardrobeFitOption =
  | 'second-skin'
  | 'slim'
  | 'regular'
  | 'relaxed'
  | 'oversized'
  | 'tailored'
  | 'other';

export type WardrobeFormalityOption =
  | 'casual'
  | 'smart-casual'
  | 'business-casual'
  | 'business-formal'
  | 'evening'
  | 'formal'
  | 'athleisure'
  | 'other';

export type WardrobeStyleTagOption =
  | 'minimalist'
  | 'classic'
  | 'modern'
  | 'trendy'
  | 'edgy'
  | 'boho'
  | 'preppy'
  | 'athleisure'
  | 'streetwear'
  | 'romantic'
  | 'feminine'
  | 'androgynous'
  | 'workwear'
  | 'vintage'
  | 'sporty'
  | 'heritage'
  | 'other';

export type WardrobeSeasonOption = 'spring' | 'summer' | 'fall' | 'winter' | 'all-season';

export type WardrobeOccasionOption =
  | 'work'
  | 'weekend'
  | 'date'
  | 'family'
  | 'travel'
  | 'party'
  | 'formal-event'
  | 'outdoor'
  | 'athletic'
  | 'lounging'
  | 'wedding'
  | 'other';

export type WardrobeBrandOption =
  | 'Rick Owens'
  | 'Maison Margiela'
  | 'Ann Demeulemeester'
  | 'Yohji Yamamoto'
  | 'Comme des Garçons'
  | 'Issey Miyake'
  | 'Junya Watanabe'
  | 'Acne Studios'
  | 'Helmut Lang'
  | 'Raf Simons'
  | 'Dries Van Noten'
  | 'Balenciaga'
  | 'Vetements'
  | 'Dion Lee'
  | 'Peter Do'
  | 'The Row'
  | 'Celine'
  | 'Loewe'
  | 'Bottega Veneta'
  | 'Prada'
  | 'Miu Miu'
  | 'Saint Laurent'
  | 'Gucci'
  | 'Dior'
  | 'Chanel'
  | 'Versace'
  | 'Fendi'
  | 'Givenchy'
  | 'Jil Sander'
  | 'Marni'
  | 'Stella McCartney'
  | 'Vivienne Westwood'
  | 'Alexander McQueen'
  | 'Banana Republic'
  | 'Camper'
  | 'Professor E'
  | 'Zara'
  | 'H&M'
  | 'COS'
  | 'Arket'
  | 'Everlane'
  | 'Cuyana'
  | 'Reformation'
  | 'Aritzia'
  | 'Ganni'
  | 'Staud'
  | 'Nanushka'
  | 'Totême'
  | 'Vintage'
  | 'Thrift'
  | 'Jean Paul Gaultier'
  | 'Deadwood'
  | 'Stussy'
  | 'Moschino'
  | 'Other';

// Wardrobe item interface
export interface WardrobeItem {
  id: string;
  title: string;
  imageUrl?: string; // Optional - can use placeholder images if not provided
  category: string;
  subCategory?: WardrobeSubCategory;
  description?: string; // Extended description for outfit generation
  silhouettes?: WardrobeSilhouetteOption[];
  colors?: WardrobeColorOption[];
  fabrics?: WardrobeFabricOption[];
  pattern?: WardrobePatternOption;
  silhouette?: WardrobeSilhouetteOption; // legacy single value
  fit?: WardrobeFitOption;
  formalities?: WardrobeFormalityOption[];
  styleTags?: WardrobeStyleTagOption[];
  seasons?: WardrobeSeasonOption[];
  occasions?: WardrobeOccasionOption[];
  careNotes?: string;
  brand?: WardrobeBrandOption;
  measurements?: {
    // Category-specific measurements
    size?: string; // Generic size (S, M, L, XL, etc.)
    waist?: number; // Inches or cm
    inseam?: number; // Inches or cm
    chest?: number; // Inches or cm
    length?: number; // Inches or cm
    shoeSize?: string; // US, EU, UK sizes
    [key: string]: string | number | undefined; // Allow flexible measurements
  };
  createdAt: string;
}

// User profile interface
export interface UserProfile {
  height?: number; // in inches or cm
  weight?: number; // in lbs or kg
  heightUnit?: 'inches' | 'cm';
  weightUnit?: 'lbs' | 'kg';
  stylePreferences?: string; // Personal style preferences description
  brands?: string[]; // Array of favorite brands
  // Additional measurements
  waist?: number;
  chest?: number;
  hips?: number;
  inseam?: number;
  shoeSize?: string;
  measurementsUnit?: 'inches' | 'cm';
  // Appearance details (optional, helps with outfit generation)
  hairColor?: string;
  hairTexture?: string;
  skinColor?: string;
}

// Saved outfit interface
export interface SavedOutfit {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  createdAt: string;
  prompt?: string; // Context/prompt used to generate this outfit
  notes?: string; // User's notes about the outfit
}

// Outfit feedback interface
export interface OutfitFeedback {
  id: string;
  itemIds: string[];
  itemTitles: string[];
  type: 'like' | 'dislike';
  feedback?: string; // Optional user feedback text
  createdAt: string;
  prompt?: string; // The prompt used when this outfit was generated
}

// Explore suggestion interface
export interface ExploreSuggestion {
  id: string;
  title: string;
  category: string;
  description: string;
  brand?: string; // Brand or store name
  link?: string; // URL to find/buy the item
  pairsWellWith: string[]; // Array of existing wardrobe item titles
  imageUrl?: string; // URL to product image (from LLM or generated)
  createdAt: string;
}

// Multi-user data storage
const MAX_OUTFIT_CLICKS_PER_DAY = 10;

// Helper function to get user data (works with both SQLite and PostgreSQL)
async function getUserData(userId: string) {
  const userDataRecord = await db.getUserData(userId);
  const items = await db.getItemsByUser(userId);
  const profile = await db.getProfile(userId);
  const savedOutfits = await db.getSavedOutfits(userId);
  const outfitFeedback = await db.getFeedback(userId);
  const exploreSuggestions = await db.getExploreSuggestions(userId);
  const lastExploreUpdate = await db.getExploreUpdate(userId);
  
  return {
    items,
    outfitGenerationClicks: userDataRecord?.outfit_generation_clicks || 0,
    lastClickResetDate: userDataRecord?.last_click_reset_date || new Date().toDateString(),
    userProfile: profile || {},
    savedOutfits,
    outfitFeedback,
    exploreSuggestions,
    lastExploreUpdate: lastExploreUpdate || ''
  };
}

// Middleware to extract user ID from request
function getUserFromRequest(req: any): string {
  // Express normalizes headers to lowercase, but check both cases for compatibility
  const userId = req.headers['x-user-id'] || req.headers['x-user-id'] || req.query.userId || 'default-user';
  if (!userId || userId === 'default-user') {
    console.warn(`⚠️  No valid user ID in request. Headers:`, req.headers);
  }
  return userId as string;
}

console.log('Multi-user wardrobe app initialized');

// Reset click counter if it's a new day
async function resetClickCounterIfNeeded(userId: string) {
  const userData = await getUserData(userId);
  const today = new Date().toDateString();
  if (today !== userData.lastClickResetDate) {
    console.log(`Day changed for user ${userId}: Resetting outfit generation clicks from ${userData.outfitGenerationClicks} to 0`);
    await db.updateUserData(userId, 0, today);
  }
}

// Routes
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok' });
});

// User management endpoints
app.get('/api/users', async (req, res) => {
  try {
    const users = await db.getAllUsers();
    console.log(`Returning ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'User name is required' });
    }
    
    const id = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();
    const newUser = await db.createUser(id, name, createdAt);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Reload data from storage (useful after seeding)
app.post('/api/reload', async (req, res) => {
  try {
    console.log('Reloading data from database...');
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Reloaded data for user ${userId}: ${userData.items.length} items`);
    res.json({ 
      message: 'Data reloaded successfully',
      itemsCount: userData.items.length,
      clicksUsed: userData.outfitGenerationClicks
    });
  } catch (error) {
    console.error('Error reloading data:', error);
    res.status(500).json({ error: 'Failed to reload data' });
  }
});

// Get all wardrobe items
app.get('/api/items', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    console.log(`📥 GET /api/items - User ID: "${userId}", Headers:`, {
      'x-user-id': req.headers['x-user-id'],
      'X-User-Id': req.headers['x-user-id']
    });
    
    const userData = await getUserData(userId);
    console.log(`✅ Returning ${userData.items.length} wardrobe items for user ${userId}`);
    
    if (userData.items.length > 0) {
      userData.items.slice(0, 3).forEach((item: WardrobeItem, index: number) => {
        console.log(`  Item ${index + 1}: "${item.title}" (ID: ${item.id}, Category: ${item.category})`);
      });
      if (userData.items.length > 3) {
        console.log(`  ... and ${userData.items.length - 3} more items`);
      }
    } else {
      console.log(`  ⚠️  No items found for user ${userId}`);
      console.log(`  💡 This might mean the user doesn't exist in the database. Check if user ID is correct.`);
    }
    
    res.json(userData.items);
  } catch (error) {
    console.error('❌ Error fetching items:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Get items grouped by category
app.get('/api/items/by-category', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const grouped = userData.items.reduce((acc: Record<string, WardrobeItem[]>, item: WardrobeItem) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {} as Record<string, WardrobeItem[]>);
    
    const categoryCount = Object.keys(grouped).length;
    console.log(`Returning items grouped by ${categoryCount} categories for user ${userId}`);
    res.json(grouped);
  } catch (error) {
    console.error('Error fetching items by category:', error);
    res.status(500).json({ error: 'Failed to fetch items by category' });
  }
});

// Upload photo and create item
app.post('/api/items', upload.single('photo'), async (req, res) => {
  try {
    console.log('Creating new wardrobe item...');
    
    const { title, category, description, measurements, subCategory: providedSubCategory } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!category) {
      console.error('Category is missing');
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log(`Processing item: "${title}"`);
    console.log(`  Category: ${category}`);
    if (req.file) {
      console.log(`  File: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
    } else {
      console.log(`  No photo provided - item will use category placeholder`);
    }

    // Upload to Supabase if configured, otherwise use local storage
    let imageUrl: string | undefined = undefined;
    if (req.file) {
      if (supabaseStorage.isSupabaseConfigured()) {
        try {
          // Upload to Supabase Storage
          const fileName = `${uuidv4()}-${req.file.originalname}`;
          imageUrl = await supabaseStorage.uploadBuffer(
            req.file.buffer,
            fileName,
            req.file.mimetype
          );
          console.log(`  Uploaded to Supabase: ${imageUrl}`);
        } catch (error) {
          console.error('Failed to upload to Supabase:', error);
          // Fall back to local storage if Supabase upload fails
          const localPath = path.join(uploadsDir, `${uuidv4()}-${req.file.originalname}`);
          fs.writeFileSync(localPath, req.file.buffer);
          imageUrl = `/uploads/${path.basename(localPath)}`;
          console.log(`  Fallback to local storage: ${imageUrl}`);
        }
      } else {
        // Local storage (fallback when Supabase not configured)
        imageUrl = `/uploads/${req.file.filename}`;
      }
    }
    
    // Parse measurements if provided
    let parsedMeasurements: WardrobeItem['measurements'] = undefined;
    if (measurements) {
      try {
        parsedMeasurements = typeof measurements === 'string' 
          ? JSON.parse(measurements) 
          : measurements;
        console.log('  Measurements:', parsedMeasurements);
      } catch (e) {
        console.warn('Failed to parse measurements, continuing without them');
      }
    }

    const colorsProvided = fieldProvided(req.body, 'colors');
    const fabricsProvided = fieldProvided(req.body, 'fabrics');
    const formalitiesProvided = fieldProvided(req.body, 'formalities');
    const styleTagsProvided = fieldProvided(req.body, 'styleTags');
    const seasonsProvided = fieldProvided(req.body, 'seasons');
    const occasionsProvided = fieldProvided(req.body, 'occasions');
    const patternProvided = fieldProvided(req.body, 'pattern');
    const silhouettesProvided = fieldProvided(req.body, 'silhouettes');
    const silhouetteProvided = fieldProvided(req.body, 'silhouette');
    const fitProvided = fieldProvided(req.body, 'fit');
    const brandProvided = fieldProvided(req.body, 'brand');
    const careNotesProvided = fieldProvided(req.body, 'careNotes');

    const colors = colorsProvided ? parseStringArrayField(req.body.colors) : [];
    const fabrics = fabricsProvided ? parseStringArrayField(req.body.fabrics) : [];
    const formalities = formalitiesProvided ? parseStringArrayField(req.body.formalities) : [];
    const styleTags = styleTagsProvided ? parseStringArrayField(req.body.styleTags) : [];
    const seasons = seasonsProvided ? parseStringArrayField(req.body.seasons) : [];
    const occasions = occasionsProvided ? parseStringArrayField(req.body.occasions) : [];
    const patternValue = patternProvided ? parseTextField(req.body.pattern) : '';
    const silhouettesValue = silhouettesProvided
      ? Array.from(
          new Set(
            parseStringArrayField(req.body.silhouettes)
              .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
              .filter((value) => value.length > 0)
          )
        )
      : [];
    const silhouetteValue = silhouetteProvided
      ? parseTextField(req.body.silhouette)
      : silhouettesValue.length > 0
      ? silhouettesValue[0]
      : '';
    const fitValue = fitProvided ? parseTextField(req.body.fit) : '';
    const brandValue = brandProvided ? parseTextField(req.body.brand) : '';
    const careNotesValue = careNotesProvided ? parseTextField(req.body.careNotes) : '';

    const resolvedSubCategory = resolveSubCategory(category, providedSubCategory, title, description);

    const newItem: WardrobeItem = {
      id: uuidv4(),
      title,
      ...(imageUrl && { imageUrl }), // Only include imageUrl if it exists
      category,
      ...(resolvedSubCategory ? { subCategory: resolvedSubCategory } : {}),
      description: description || undefined,
      measurements: parsedMeasurements,
      createdAt: new Date().toISOString(),
      ...(colorsProvided && colors.length > 0 ? { colors: colors as WardrobeColorOption[] } : {}),
      ...(fabricsProvided && fabrics.length > 0 ? { fabrics: fabrics as WardrobeFabricOption[] } : {}),
      ...(formalitiesProvided && formalities.length > 0 ? { formalities: formalities as WardrobeFormalityOption[] } : {}),
      ...(styleTagsProvided && styleTags.length > 0 ? { styleTags: styleTags as WardrobeStyleTagOption[] } : {}),
      ...(seasonsProvided && seasons.length > 0 ? { seasons: seasons as WardrobeSeasonOption[] } : {}),
      ...(occasionsProvided && occasions.length > 0 ? { occasions: occasions as WardrobeOccasionOption[] } : {}),
      ...(patternValue ? { pattern: patternValue as WardrobePatternOption } : {}),
      ...(silhouettesValue.length > 0
        ? { silhouettes: silhouettesValue as WardrobeSilhouetteOption[] }
        : {}),
      ...(silhouetteValue ? { silhouette: silhouetteValue as WardrobeSilhouetteOption } : {}),
      ...(fitValue ? { fit: fitValue as WardrobeFitOption } : {}),
      ...(brandValue ? { brand: brandValue as WardrobeBrandOption } : {}),
      ...(careNotesValue ? { careNotes: careNotesValue } : {})
    };

    const userId = getUserFromRequest(req);
    
    // Save to database
    await db.insertItem(newItem, userId);
    
    console.log(`Item created successfully for user ${userId}`);
    console.log(`New item ID: ${newItem.id}, Title: "${newItem.title}"`);

    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating item:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.post('/api/items/batch', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';

    if (!text) {
      return res.status(400).json({ error: 'Describe at least one item to add.' });
    }

    if (text.length > QUICK_ENTRY_CHAR_LIMIT) {
      return res.status(400).json({ error: `Please keep quick entry submissions within ${QUICK_ENTRY_CHAR_LIMIT} characters.` });
    }

    console.log(`[QuickEntry] Parsing quick entry text (${text.length} characters) for user ${userId}`);

    const parsedItems = await generateWardrobeItemsFromText(text);

    if (!parsedItems || parsedItems.length === 0) {
      return res.status(422).json({ error: 'We could not identify any wardrobe items. Try listing each item separately.' });
    }

    const existingItems = await db.getItemsByUser(userId);
    const existingTitleKeys = new Set(existingItems.map((item: WardrobeItem) => normalizeOutfitTitleKey(item.title)));

    const createdItems: WardrobeItem[] = [];
    const skippedTitles: string[] = [];

    for (const draft of parsedItems) {
      const formattedTitle = formatQuickEntryTitle(draft.title);
      if (!formattedTitle) {
        skippedTitles.push(draft.title);
        continue;
      }

      const normalizedKey = normalizeOutfitTitleKey(formattedTitle);

      if (existingTitleKeys.has(normalizedKey) || createdItems.some(item => normalizeOutfitTitleKey(item.title) === normalizedKey)) {
        skippedTitles.push(formattedTitle);
        continue;
      }

      const resolvedSubCategory = resolveSubCategory(
        draft.category,
        draft.subCategory,
        formattedTitle,
        draft.description
      );

      const newItem: WardrobeItem = {
        id: uuidv4(),
        title: formattedTitle,
        category: draft.category,
        ...(resolvedSubCategory ? { subCategory: resolvedSubCategory } : {}),
        description: draft.description,
        createdAt: new Date().toISOString()
      };

      await db.insertItem(newItem, userId);
      createdItems.push(newItem);
      existingTitleKeys.add(normalizedKey);
    }

    if (createdItems.length === 0) {
      return res.status(422).json({
        error: 'All of those items already exist in your wardrobe.',
        skippedTitles
      });
    }

    console.log(`[QuickEntry] Created ${createdItems.length} items for user ${userId}. Skipped ${skippedTitles.length}.`);

    res.status(201).json({
      createdItems,
      skippedTitles: skippedTitles.length > 0 ? skippedTitles : undefined
    });
  } catch (error) {
    console.error('Error creating items from quick entry:', error);
    res.status(500).json({ error: 'Failed to create wardrobe items from text.' });
  }
});

// Generate outfit combinations
app.post('/api/outfits/generate', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    
    console.log(`Generating outfit combinations for user ${userId}...`);
    await resetClickCounterIfNeeded(userId);

    if (userData.outfitGenerationClicks >= MAX_OUTFIT_CLICKS_PER_DAY) {
      console.log(`Daily limit reached for user ${userId}: ${userData.outfitGenerationClicks}/${MAX_OUTFIT_CLICKS_PER_DAY} clicks used`);
      return res.status(429).json({ 
        error: 'Daily limit reached. Please try again tomorrow.',
        clicksUsed: userData.outfitGenerationClicks,
        maxClicks: MAX_OUTFIT_CLICKS_PER_DAY
      });
    }

    const groupItemsByCategory = (items: WardrobeItem[]): Record<string, WardrobeItem[]> => {
      return items.reduce((acc: Record<string, WardrobeItem[]>, item: WardrobeItem) => {
        if (!acc[item.category]) {
          acc[item.category] = [];
        }
        acc[item.category].push(item);
        return acc;
      }, {} as Record<string, WardrobeItem[]>);
    };

    const calculateCoreCategoryCounts = (items: WardrobeItem[]): Record<CoreCategory, number> => {
      const counts: Record<CoreCategory, number> = {
        tops: 0,
        bottoms: 0,
        shoes: 0,
        accessories: 0,
      };
      items.forEach(item => {
        const flags = getCoreCategoryFlags(item, item.title);
        flags.forEach(flag => {
          counts[flag] = (counts[flag] || 0) + 1;
        });
      });
      return counts;
    };

    const allItems = userData.items as WardrobeItem[];
    const originalItemsByCategory = groupItemsByCategory(allItems);
    const totalItemsCount = allItems.length;

    const categoryCount = Object.keys(originalItemsByCategory).length;
    console.log(`Items grouped into ${categoryCount} categories for user ${userId}`);
    
    Object.entries(originalItemsByCategory).forEach(([category, items]) => {
      const categoryItems = items as WardrobeItem[];
      console.log(`  ${category}: ${categoryItems.length} items`);
    });

    const originalCoreCategoryCounts = calculateCoreCategoryCounts(allItems);
    const requiredCoreCategories: CoreCategory[] = ['tops', 'bottoms', 'shoes'];
    const missingCoreCategories = requiredCoreCategories.filter(category => originalCoreCategoryCounts[category] === 0);

    if (missingCoreCategories.length > 0) {
      console.log(`Missing required core categories for user ${userId}: ${missingCoreCategories.join(', ')}`);
      return res.status(400).json({
        error: 'Need at least one top, bottom, and pair of shoes to generate outfits',
        missingCategories: missingCoreCategories,
      });
    }

    if (categoryCount < 2) {
      console.log(`Not enough categories for user ${userId}: ${categoryCount} (need at least 2)`);
      return res.status(400).json({ 
        error: 'Need at least 2 different categories to generate outfits',
        categories: categoryCount
      });
    }

    // Get optional prompt and selected item IDs from request body
    const { prompt, selectedItemIds } = req.body;
    if (prompt) {
      console.log(`Generation prompt: ${prompt}`);
    }
    
    // Get selected items if provided
    let selectedItems: WardrobeItem[] = [];
    if (selectedItemIds && Array.isArray(selectedItemIds) && selectedItemIds.length > 0) {
      selectedItems = userData.items.filter((item: WardrobeItem) => selectedItemIds.includes(item.id));
      console.log(`Selected items for outfit generation: ${selectedItems.length} items`);
      selectedItems.forEach(item => {
        console.log(`  - ${item.title} (${item.category})`);
      });
    }

    const REQUIRED_DISPLAY_CATEGORIES = ['Tops', 'Bottoms', 'Shoes', 'Jewelry'] as const;
    const categoryCountsMap = allItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});
    const hasMinimumPerCategory = REQUIRED_DISPLAY_CATEGORIES.every(categoryLabel => (categoryCountsMap[categoryLabel] || 0) >= 3);
    const shouldApplyContextFilters = totalItemsCount > 25 && hasMinimumPerCategory;

    if (!shouldApplyContextFilters) {
      console.log(`[ContextFilter] Skipping context-based filtering (total items: ${totalItemsCount}, category minimum met: ${hasMinimumPerCategory})`);
    }

    const contextFilters = extractContextFilters(prompt);
    let itemsForGeneration = allItems;
    let appliedFilters: FilteredItemsResult['appliedFilters'] | undefined;
    let filterSummary: string | null = null;

    if (shouldApplyContextFilters) {
      console.log(
        `[ContextFilter] Applying context-based filtering (total items: ${totalItemsCount}, ` +
        `tops: ${categoryCountsMap['Tops'] || 0}, bottoms: ${categoryCountsMap['Bottoms'] || 0}, ` +
        `shoes: ${categoryCountsMap['Shoes'] || 0}, jewelry: ${categoryCountsMap['Jewelry'] || 0})`
      );
      const filterResult = filterItemsForContext(allItems, contextFilters, selectedItems);
      itemsForGeneration = filterResult.filteredItems;
      appliedFilters = filterResult.appliedFilters;

      const filteredOutCount = totalItemsCount - itemsForGeneration.length;
      if (filteredOutCount > 0) {
        console.log(`[ContextFilter] Removed ${filteredOutCount} items that did not match the prompt context.`);
      }

      if (itemsForGeneration.length === 0) {
        const summary = buildContextFilterSummary(appliedFilters, contextFilters);
        console.warn('[ContextFilter] All items were filtered out by context. Aborting generation.');
        return res.status(400).json({
          error: 'No wardrobe items match the provided context filters. Try broadening your request or update your wardrobe attributes.',
          appliedFilters,
          filterSummary: summary || undefined,
        });
      }

      const filteredItemsByCategory = groupItemsByCategory(itemsForGeneration);
      const filteredCategoryCount = Object.keys(filteredItemsByCategory).length;
      console.log(`[ContextFilter] ${filteredCategoryCount} categories remain after filtering for context.`);

      if (filteredCategoryCount < 2) {
        const summary = buildContextFilterSummary(appliedFilters, contextFilters);
        console.warn('[ContextFilter] Not enough categories after filtering.');
        return res.status(400).json({
          error: 'Context filters left fewer than two categories to build outfits. Broaden the request or add more attributes to your wardrobe items.',
          appliedFilters,
          filterSummary: summary || undefined,
        });
      }

      const filteredCoreCategoryCounts = calculateCoreCategoryCounts(itemsForGeneration);
      const missingAfterFilter = requiredCoreCategories.filter(category => (filteredCoreCategoryCounts[category] || 0) === 0);

      if (missingAfterFilter.length > 0) {
        const summary = buildContextFilterSummary(appliedFilters, contextFilters);
        console.warn(`[ContextFilter] Missing required categories after filtering: ${missingAfterFilter.join(', ')}`);
        return res.status(400).json({
          error: 'Context filters removed required categories needed to generate complete outfits.',
          missingCategories: missingAfterFilter,
          appliedFilters,
          filterSummary: summary || undefined,
        });
      }

      filterSummary = buildContextFilterSummary(appliedFilters, contextFilters);
      if (filterSummary) {
        console.log(`[ContextFilter] Summary: ${filterSummary}`);
      }
      if (appliedFilters) {
        console.log('[ContextFilter] Applied filters:', appliedFilters);
      }
    }

    const itemsByCategory = groupItemsByCategory(itemsForGeneration);

    const promptSegments: string[] = [];
    if (prompt && prompt.trim().length > 0) {
      promptSegments.push(prompt.trim());
    }
    if (filterSummary) {
      promptSegments.push(`Context filter summary: ${filterSummary}. Prioritize items that satisfy these attributes.`);
    }
    const combinedPrompt = promptSegments.join(' ');

    // Generate outfits using LLM with user profile and item descriptions
    console.log('Calling LLM to generate outfit combinations...');
    const userProfile = userData.userProfile || {};
    console.log(`User profile: Height ${userProfile.height || 'N/A'} ${userProfile.heightUnit || ''}, Weight ${userProfile.weight || 'N/A'} ${userProfile.weightUnit || ''}`);
    if (userProfile.stylePreferences) {
      console.log(`Style preferences: ${userProfile.stylePreferences.substring(0, 100)}...`);
    }
    const outfits = await generateOutfits(
      itemsByCategory,
      userProfile,
      combinedPrompt,
      userData.outfitFeedback || [],
      selectedItems,
      userData.savedOutfits || []
    );
    console.log(`Generated ${outfits.length} outfit combinations`);
    
    const newClicks = userData.outfitGenerationClicks + 1;
    console.log(`Outfit generation clicks for user ${userId}: ${newClicks}/${MAX_OUTFIT_CLICKS_PER_DAY}`);
    
    // Save to database
    await db.updateUserData(userId, newClicks, userData.lastClickResetDate);

    const responsePayload: Record<string, unknown> = {
      outfits,
      clicksUsed: userData.outfitGenerationClicks,
      maxClicks: MAX_OUTFIT_CLICKS_PER_DAY,
    };

    if (appliedFilters) {
      responsePayload.appliedFilters = appliedFilters;
    }
    if (filterSummary) {
      responsePayload.filterSummary = filterSummary;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Error generating outfits:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to generate outfits' });
  }
});

// Get outfit generation status
app.get('/api/outfits/status', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    await resetClickCounterIfNeeded(userId);
    const userData = await getUserData(userId);
    const status = {
      clicksUsed: userData.outfitGenerationClicks,
      maxClicks: MAX_OUTFIT_CLICKS_PER_DAY,
      remaining: MAX_OUTFIT_CLICKS_PER_DAY - userData.outfitGenerationClicks
    };
    console.log(`Outfit generation status for user ${userId}: ${status.clicksUsed}/${status.maxClicks} clicks used, ${status.remaining} remaining`);
    res.json(status);
  } catch (error) {
    console.error('Error fetching outfit status:', error);
    res.status(500).json({ error: 'Failed to fetch outfit status' });
  }
});

// Update an item
app.put('/api/items/:id', upload.single('photo'), async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const { id } = req.params;
    console.log(`Updating item with ID: ${id} for user ${userId}`);
    
    const existingItem = await db.getItemById(id);
    
    if (!existingItem || existingItem.userId !== userId) {
      console.log(`Item not found: ${id} for user ${userId}`);
      return res.status(404).json({ error: 'Item not found' });
    }
    const { title, category, description, measurements, subCategory: providedSubCategory } = req.body;
    
    if (!title) {
      console.error('Title is missing');
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!category) {
      console.error('Category is missing');
      return res.status(400).json({ error: 'Category is required' });
    }

    console.log(`Updating item: "${existingItem.title}" -> "${title}"`);

    // Handle new photo upload if provided
    let imageUrl = existingItem.imageUrl;
    if (req.file) {
      // Delete old image file if it exists
      if (existingItem.imageUrl) {
        if (supabaseStorage.isSupabaseConfigured()) {
          // Delete from Supabase
          try {
            await supabaseStorage.deleteFile(existingItem.imageUrl);
          } catch (error) {
            console.warn('Failed to delete old file from Supabase:', error);
          }
        } else {
          // Delete from local storage
          const oldFilePath = path.join(__dirname, '../uploads', path.basename(existingItem.imageUrl));
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log(`Deleted old file: ${oldFilePath}`);
          }
        }
      }
      
      // Upload new image
      if (supabaseStorage.isSupabaseConfigured()) {
        try {
          // Upload to Supabase Storage
          const fileName = `${uuidv4()}-${req.file.originalname}`;
          imageUrl = await supabaseStorage.uploadBuffer(
            req.file.buffer,
            fileName,
            req.file.mimetype
          );
          console.log(`  Uploaded to Supabase: ${imageUrl}`);
        } catch (error) {
          console.error('Failed to upload to Supabase:', error);
          // Fall back to local storage if Supabase upload fails
          const localPath = path.join(uploadsDir, `${uuidv4()}-${req.file.originalname}`);
          fs.writeFileSync(localPath, req.file.buffer);
          imageUrl = `/uploads/${path.basename(localPath)}`;
          console.log(`  Fallback to local storage: ${imageUrl}`);
        }
      } else {
        // Local storage (fallback when Supabase not configured)
        imageUrl = `/uploads/${req.file.filename}`;
      }
      console.log(`  New file: ${req.file.originalname} (${(req.file.size / 1024).toFixed(2)} KB)`);
    }

    // Parse measurements if provided
    let parsedMeasurements: WardrobeItem['measurements'] = existingItem.measurements;
    if (measurements) {
      try {
        parsedMeasurements = typeof measurements === 'string' 
          ? JSON.parse(measurements) 
          : measurements;
        console.log('  Measurements:', parsedMeasurements);
      } catch (e) {
        console.warn('Failed to parse measurements, keeping existing');
      }
    }

    const colorsProvided = fieldProvided(req.body, 'colors');
    const fabricsProvided = fieldProvided(req.body, 'fabrics');
    const formalitiesProvided = fieldProvided(req.body, 'formalities');
    const styleTagsProvided = fieldProvided(req.body, 'styleTags');
    const seasonsProvided = fieldProvided(req.body, 'seasons');
    const occasionsProvided = fieldProvided(req.body, 'occasions');
    const patternProvided = fieldProvided(req.body, 'pattern');
    const silhouettesProvided = fieldProvided(req.body, 'silhouettes');
    const silhouetteProvided = fieldProvided(req.body, 'silhouette');
    const fitProvided = fieldProvided(req.body, 'fit');
    const brandProvided = fieldProvided(req.body, 'brand');
    const careNotesProvided = fieldProvided(req.body, 'careNotes');

    const colors = colorsProvided ? parseStringArrayField(req.body.colors) : [];
    const fabrics = fabricsProvided ? parseStringArrayField(req.body.fabrics) : [];
    const formalities = formalitiesProvided ? parseStringArrayField(req.body.formalities) : [];
    const styleTags = styleTagsProvided ? parseStringArrayField(req.body.styleTags) : [];
    const seasons = seasonsProvided ? parseStringArrayField(req.body.seasons) : [];
    const occasions = occasionsProvided ? parseStringArrayField(req.body.occasions) : [];
    const patternValue = patternProvided ? parseTextField(req.body.pattern) : '';
    const silhouettesValue = silhouettesProvided
      ? Array.from(
          new Set(
            parseStringArrayField(req.body.silhouettes)
              .map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
              .filter((value) => value.length > 0)
          )
        )
      : [];
    const silhouetteValue = silhouetteProvided
      ? parseTextField(req.body.silhouette)
      : silhouettesValue.length > 0
      ? silhouettesValue[0]
      : '';
    const fitValue = fitProvided ? parseTextField(req.body.fit) : '';
    const brandValue = brandProvided ? parseTextField(req.body.brand) : '';
    const careNotesValue = careNotesProvided ? parseTextField(req.body.careNotes) : '';

    const resolvedSubCategory = resolveSubCategory(category, providedSubCategory, title, description);

    const updates: Partial<WardrobeItem> = {
      title,
      category,
      description: description || undefined,
      measurements: parsedMeasurements,
      imageUrl
    };

    if (resolvedSubCategory) {
      updates.subCategory = resolvedSubCategory;
    }

    if (colorsProvided) {
      updates.colors = colors as WardrobeColorOption[];
    }
    if (fabricsProvided) {
      updates.fabrics = fabrics as WardrobeFabricOption[];
    }
    if (formalitiesProvided) {
      updates.formalities = formalities as WardrobeFormalityOption[];
    }
    if (styleTagsProvided) {
      updates.styleTags = styleTags as WardrobeStyleTagOption[];
    }
    if (seasonsProvided) {
      updates.seasons = seasons as WardrobeSeasonOption[];
    }
    if (occasionsProvided) {
      updates.occasions = occasions as WardrobeOccasionOption[];
    }
    if (patternProvided) {
      updates.pattern = patternValue
        ? (patternValue as WardrobePatternOption)
        : undefined;
    }
    if (silhouettesProvided) {
      updates.silhouettes =
        silhouettesValue.length > 0
          ? (silhouettesValue as WardrobeSilhouetteOption[])
          : [];
    }
    if (silhouetteProvided || (silhouettesProvided && silhouettesValue.length > 0)) {
      updates.silhouette = silhouetteValue
        ? (silhouetteValue as WardrobeSilhouetteOption)
        : undefined;
    }
    if (fitProvided) {
      updates.fit = fitValue ? (fitValue as WardrobeFitOption) : undefined;
    }
    if (brandProvided) {
      updates.brand = brandValue
        ? (brandValue as WardrobeBrandOption)
        : undefined;
    }
    if (careNotesProvided) {
      updates.careNotes = careNotesValue || undefined;
    }

    // Update the item in database
    await db.updateItem(id, updates);

    const updatedItem = await db.getItemById(id);
    console.log(`Item updated successfully for user ${userId}: "${updatedItem?.title}"`);

    res.json(updatedItem);
  } catch (error) {
    console.error('Error updating item:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete an item
app.delete('/api/items/:id', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const { id } = req.params;
    console.log(`Deleting item with ID: ${id} for user ${userId}`);
    
    // Get item from database to check ownership and get imageUrl
    const item = await db.getItemById(id);
    
    if (!item || item.userId !== userId) {
      console.log(`Item not found or not owned by user: ${id} for user ${userId}`);
      return res.status(404).json({ error: 'Item not found' });
    }

    console.log(`Deleting item for user ${userId}: "${item.title}" (${item.category})`);
    
    // Delete the file if it exists
    if (item.imageUrl) {
      if (supabaseStorage.isSupabaseConfigured()) {
        // Delete from Supabase
        try {
          await supabaseStorage.deleteFile(item.imageUrl);
        } catch (error) {
          console.warn('Failed to delete file from Supabase:', error);
        }
      } else {
        // Delete from local storage
        const filePath = path.join(__dirname, '../uploads', path.basename(item.imageUrl));
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${filePath}`);
        } else {
          console.log(`File not found: ${filePath}`);
        }
      }
    } else {
      console.log('No image file to delete (item has no imageUrl)');
    }

    // Delete from database
    await db.deleteItem(id);
    console.log(`Item deleted for user ${userId}`);
    
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Get user profile
app.get('/api/user/profile', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Fetching user profile for user ${userId}`);
    res.json(userData.userProfile || {});
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
app.post('/api/user/profile', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { 
      height, weight, heightUnit, weightUnit, stylePreferences, brands,
      waist, chest, hips, inseam, shoeSize, measurementsUnit,
      hairColor, hairTexture, skinColor
    } = req.body;
    
    // Get existing profile to preserve fields that aren't being updated
    const existingProfile = await db.getProfile(userId) || {};
    
    // Merge updates with existing profile (only update fields that are provided)
    const updatedProfile: UserProfile = {
      height: height !== undefined ? Number(height) : existingProfile.height,
      weight: weight !== undefined ? Number(weight) : existingProfile.weight,
      heightUnit: heightUnit !== undefined ? heightUnit : (existingProfile.heightUnit || 'inches'),
      weightUnit: weightUnit !== undefined ? weightUnit : (existingProfile.weightUnit || 'lbs'),
      stylePreferences: stylePreferences !== undefined ? stylePreferences : existingProfile.stylePreferences,
      brands: brands !== undefined ? (Array.isArray(brands) ? brands : undefined) : existingProfile.brands,
      waist: waist !== undefined ? Number(waist) : existingProfile.waist,
      chest: chest !== undefined ? Number(chest) : existingProfile.chest,
      hips: hips !== undefined ? Number(hips) : existingProfile.hips,
      inseam: inseam !== undefined ? Number(inseam) : existingProfile.inseam,
      shoeSize: shoeSize !== undefined ? shoeSize : existingProfile.shoeSize,
      measurementsUnit: measurementsUnit !== undefined ? measurementsUnit : (existingProfile.measurementsUnit || 'inches'),
      hairColor: hairColor !== undefined ? hairColor : existingProfile.hairColor,
      hairTexture: hairTexture !== undefined ? hairTexture : existingProfile.hairTexture,
      skinColor: skinColor !== undefined ? skinColor : existingProfile.skinColor
    };
    
    // Save to database
    await db.upsertProfile(userId, updatedProfile);
    console.log(`Updated user profile for user ${userId}:`, updatedProfile);
    if (stylePreferences) {
      console.log(`Style preferences: ${stylePreferences.substring(0, 100)}...`);
    }
    if (hairColor || hairTexture || skinColor) {
      console.log(`Appearance: hairColor=${hairColor || 'N/A'}, hairTexture=${hairTexture || 'N/A'}, skinColor=${skinColor || 'N/A'}`);
    }
    
    res.json(updatedProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: 'Failed to update user profile' });
  }
});

// Get available categories
app.get('/api/categories', (req, res) => {
  const categories = [
    'Tops',
    'Bottoms',
    'Dresses',
    'Outerwear',
    'Shoes',
    'Accessories',
    'Bags',
    'Jewelry',
    'Activewear',
    'Underwear & Sleepwear',
    'Swimwear',
  ];
  res.json(categories);
});

// Get subcategory options (optionally filtered by category)
app.get('/api/subcategories', (req, res) => {
  const allSubcategories = listAllSubCategories();
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;

  if (category && allSubcategories[category]) {
    return res.json(allSubcategories[category]);
  }

  res.json(allSubcategories);
});

// Get saved outfits
app.get('/api/outfits/saved', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Returning ${(userData.savedOutfits || []).length} saved outfits for user ${userId}`);

    const itemsById = new Map<string, WardrobeItem>();
    const titleLookup = new Map<string, string>();
    (userData.items || []).forEach((item: WardrobeItem) => {
      itemsById.set(item.id, item);
      const key = normalizeOutfitTitleKey(item.title);
      if (!titleLookup.has(key)) {
        titleLookup.set(key, item.title);
      }
    });

    const cleanedOutfits = (userData.savedOutfits || []).map((outfit: SavedOutfit) => ({
      ...outfit,
      itemIds: Array.isArray(outfit.itemIds)
        ? outfit.itemIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
        : [],
      itemTitles: (() => {
        const fallbackTitles = (outfit.itemTitles || []).map((title) => {
        const key = normalizeOutfitTitleKey(title);
        return titleLookup.get(key) || formatQuickEntryTitle(title);
        });

        if (Array.isArray(outfit.itemIds) && outfit.itemIds.length > 0) {
          return outfit.itemIds.map((id, index) => {
            const item = itemsById.get(id);
            if (item) {
              return item.title;
            }
            return (
              fallbackTitles[index] ||
              fallbackTitles.find(
                (fallbackTitle) =>
                  normalizeOutfitTitleKey(fallbackTitle) ===
                  normalizeOutfitTitleKey(outfit.itemTitles?.[index] ?? '')
              ) ||
              formatQuickEntryTitle(outfit.itemTitles?.[index] ?? `Item ${index + 1}`)
            );
          });
        }

        return fallbackTitles;
      })(),
    }));

    res.json(cleanedOutfits);
  } catch (error) {
    console.error('Error fetching saved outfits:', error);
    res.status(500).json({ error: 'Failed to fetch saved outfits' });
  }
});

// Save an outfit
app.post('/api/outfits/save', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { itemIds: rawItemIds, itemTitles: rawItemTitles, prompt, notes } = req.body;

    const { items: resolvedItems, missingIds, missingTitles } = resolveOutfitItemsFromRequest(
      userData.items || [],
      rawItemIds,
      rawItemTitles
    );

    if (resolvedItems.length === 0) {
      return res.status(400).json({ error: 'At least one valid wardrobe item is required to save an outfit' });
    }

    if (missingIds.length > 0) {
      return res.status(400).json({
        error: 'Some provided item IDs were not found in your wardrobe',
        missingItemIds: missingIds,
      });
    }

    if (missingTitles.length > 0) {
      return res.status(400).json({
        error: 'Some items not found in wardrobe',
        invalidItems: missingTitles,
      });
    }

    const now = new Date().toISOString();
    const newOutfit: SavedOutfit = {
      id: uuidv4(),
      itemIds: resolvedItems.map(item => item.id),
      itemTitles: resolvedItems.map(item => item.title),
      createdAt: now,
      prompt: prompt || undefined,
      notes: notes || undefined,
    };

    await db.insertSavedOutfit(userId, newOutfit);

    console.log(`Saved outfit with ${newOutfit.itemIds.length} items for user ${userId}`);
    res.status(201).json(newOutfit);
  } catch (error) {
    console.error('Error saving outfit:', error);
    res.status(500).json({ error: 'Failed to save outfit' });
  }
});

// Delete a saved outfit
app.delete('/api/outfits/saved/:id', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { id } = req.params;
    
    if (!userData.savedOutfits) {
      return res.status(404).json({ error: 'Outfit not found' });
    }
    
    const outfitIndex = userData.savedOutfits.findIndex((outfit: SavedOutfit) => outfit.id === id);
    
    if (outfitIndex === -1) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    // Delete from database
    await db.deleteSavedOutfit(id);
    
    console.log(`Deleted saved outfit: ${id} for user ${userId}`);
    res.json({ message: 'Outfit deleted successfully' });
  } catch (error) {
    console.error('Error deleting outfit:', error);
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
});

// Save outfit feedback
app.post('/api/outfits/feedback', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { itemIds: rawItemIds, itemTitles: rawItemTitles, type, feedback, prompt } = req.body;

    if (!type || (type !== 'like' && type !== 'dislike')) {
      return res.status(400).json({ error: 'Feedback type must be "like" or "dislike"' });
    }

    const { items: resolvedItems, missingIds, missingTitles } = resolveOutfitItemsFromRequest(
      userData.items || [],
      rawItemIds,
      rawItemTitles
    );

    if (resolvedItems.length === 0) {
      return res.status(400).json({ error: 'At least one valid wardrobe item is required to save feedback' });
    }

    if (missingIds.length > 0) {
      return res.status(400).json({
        error: 'Some provided item IDs were not found in your wardrobe',
        missingItemIds: missingIds,
      });
    }

    if (missingTitles.length > 0) {
      return res.status(400).json({
        error: 'Some items not found in wardrobe',
        invalidItems: missingTitles,
      });
    }

    const newFeedback: OutfitFeedback = {
      id: uuidv4(),
      itemIds: resolvedItems.map(item => item.id),
      itemTitles: resolvedItems.map(item => item.title),
      type,
      feedback: feedback || undefined,
      createdAt: new Date().toISOString(),
      prompt: prompt || undefined,
    };

    await db.insertFeedback(userId, newFeedback);

    console.log(`Saved ${type} feedback for outfit with ${newFeedback.itemIds.length} items for user ${userId}`);
    res.status(201).json(newFeedback);
  } catch (error) {
    console.error('Error saving feedback:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Get all feedback
app.get('/api/outfits/feedback', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    console.log(`Returning ${(userData.outfitFeedback || []).length} feedback entries for user ${userId}`);

    const itemsById = new Map<string, WardrobeItem>();
    const titleLookup = new Map<string, string>();
    (userData.items || []).forEach((item: WardrobeItem) => {
      itemsById.set(item.id, item);
      const key = normalizeOutfitTitleKey(item.title);
      if (!titleLookup.has(key)) {
        titleLookup.set(key, item.title);
      }
    });

    const cleanedFeedback = (userData.outfitFeedback || []).map((entry: OutfitFeedback) => {
      const fallbackTitles = (entry.itemTitles || []).map(title => {
        const key = normalizeOutfitTitleKey(title);
        return titleLookup.get(key) || formatQuickEntryTitle(title);
      });

      const itemIds = Array.isArray(entry.itemIds)
        ? entry.itemIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
        : [];

      const itemTitles =
        itemIds.length > 0
          ? itemIds.map((id, index) => {
              const item = itemsById.get(id);
              if (item) {
                return item.title;
              }
              return (
                fallbackTitles[index] ||
                fallbackTitles.find(
                  (fallbackTitle) =>
                    normalizeOutfitTitleKey(fallbackTitle) ===
                    normalizeOutfitTitleKey(entry.itemTitles?.[index] ?? '')
                ) ||
                formatQuickEntryTitle(entry.itemTitles?.[index] ?? `Item ${index + 1}`)
              );
            })
          : fallbackTitles;

      return {
        ...entry,
        itemIds,
        itemTitles,
      };
    });

    res.json(cleanedFeedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Delete feedback
app.delete('/api/outfits/feedback/:id', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const { id } = req.params;
    
    if (!userData.outfitFeedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    
    const feedbackIndex = userData.outfitFeedback.findIndex((f: OutfitFeedback) => f.id === id);
    
    if (feedbackIndex === -1) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    // Delete from database
    await db.deleteFeedback(id);
    
    console.log(`Deleted feedback: ${id} for user ${userId}`);
    res.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

// Get explore suggestions
app.get('/api/explore/suggestions', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const today = new Date().toDateString();
    const lastUpdate = userData.lastExploreUpdate || '';
    const shouldUpdate = !lastUpdate || lastUpdate !== today;
    
    console.log(`Explore suggestions requested for user ${userId}. Last update: ${lastUpdate || 'never'}, Today: ${today}`);
    console.log(`Should update: ${shouldUpdate}`);
    
    res.json({
      suggestions: userData.exploreSuggestions || [],
      lastUpdate: lastUpdate,
      shouldUpdate
    });
  } catch (error) {
    console.error('Error fetching explore suggestions:', error);
    res.status(500).json({ error: 'Failed to fetch explore suggestions' });
  }
});

// Generate explore suggestions
app.post('/api/explore/generate', async (req, res) => {
  try {
    const userId = getUserFromRequest(req);
    const userData = await getUserData(userId);
    const forceRefresh = req.query.force === 'true';
    console.log(`Generating explore suggestions for user ${userId}... (force: ${forceRefresh})`);
    
    // Check if already updated today (unless force refresh)
    const today = new Date().toDateString();
    const lastUpdate = userData.lastExploreUpdate || '';
    const suggestions = userData.exploreSuggestions || [];
    
    if (!forceRefresh && lastUpdate === today && suggestions.length > 0) {
      console.log(`Suggestions already generated today for user ${userId}`);
      return res.json({
        suggestions: suggestions,
        lastUpdate: lastUpdate,
        message: 'Suggestions already generated today'
      });
    }

    // Generate suggestions using LLM
    const generatedSuggestions = await generateExploreSuggestions(
      userData.items,
      userData.userProfile || {},
      userData.outfitFeedback || []
    );

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('Created uploads directory');
    }

    // Create ExploreSuggestion objects with IDs, images, and product links
    const exploreSuggestionsWithIds: ExploreSuggestion[] = await Promise.all(
      generatedSuggestions.map(async (suggestion: any) => {
        let imageUrl: string | undefined = suggestion.imageUrl;
        let productLink: string | undefined = suggestion.link;
        
        // Build search query for product search
        const searchQuery = suggestion.brand 
          ? `${suggestion.brand} ${suggestion.title}`
          : `${suggestion.title} ${suggestion.category}`;
        
        // If LLM provided an imageUrl, use it directly
        if (imageUrl && imageUrl.startsWith('http')) {
          console.log(`Using LLM-provided image URL for "${suggestion.title}": ${imageUrl}`);
        } else {
          // Use Pexels API for high-quality fashion images
          const pexelsApiKey = process.env.PEXELS_API_KEY;
          if (pexelsApiKey) {
            try {
              const pexelsResponse = await fetch(
                `https://api.pexels.com/v1/search?query=${encodeURIComponent(searchQuery + ' fashion')}&per_page=1&orientation=square`,
                {
                  headers: {
                    'Authorization': pexelsApiKey
                  }
                }
              );
              
              if (pexelsResponse.ok) {
                const pexelsData: any = await pexelsResponse.json();
                if (pexelsData.photos && pexelsData.photos.length > 0) {
                  imageUrl = pexelsData.photos[0].src.medium || pexelsData.photos[0].src.large;
                  console.log(`✅ Found Pexels image for "${suggestion.title}"`);
                } else {
                  console.log(`⚠️  No Pexels photos found for "${suggestion.title}"`);
                }
              } else {
                const errorText = await pexelsResponse.text();
                console.warn(`⚠️  Pexels API error for "${suggestion.title}": ${pexelsResponse.status} ${errorText}`);
              }
            } catch (pexelsError) {
              console.warn(`⚠️  Pexels API exception for "${suggestion.title}":`, pexelsError instanceof Error ? pexelsError.message : pexelsError);
            }
          } else {
            console.log(`⚠️  PEXELS_API_KEY not set, skipping Pexels API for "${suggestion.title}"`);
          }
          
          // Fallback to Unsplash if Pexels fails or no key
          if (!imageUrl) {
            imageUrl = `https://source.unsplash.com/400x400/?${encodeURIComponent(searchQuery + ' fashion')}`;
            console.log(`↩️  Using Unsplash fallback for "${suggestion.title}"`);
          }
        }
        
        // Generate Google Shopping link if no link provided
        if (!productLink || !productLink.startsWith('http')) {
          productLink = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(searchQuery)}`;
          console.log(`Generated Google Shopping link for "${suggestion.title}"`);
        }

        return {
          id: uuidv4(),
          title: suggestion.title,
          category: suggestion.category,
          description: suggestion.description,
          brand: suggestion.brand,
          link: productLink,
          pairsWellWith: suggestion.pairsWellWith,
          imageUrl: imageUrl,
          createdAt: new Date().toISOString()
        };
      })
    );

    // Save to database - delete old suggestions first, then insert new ones
    await db.deleteExploreSuggestions(userId);
    for (const suggestion of exploreSuggestionsWithIds) {
      await db.insertExploreSuggestion(userId, suggestion);
    }
    await db.upsertExploreUpdate(userId, today);
    
    console.log(`Generated ${exploreSuggestionsWithIds.length} explore suggestions for user ${userId}`);
    res.json({
      suggestions: exploreSuggestionsWithIds,
      lastUpdate: today
    });
  } catch (error) {
    console.error('Error generating explore suggestions:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack:', error.stack);
    }
    res.status(500).json({ error: 'Failed to generate explore suggestions' });
  }
});

// Only start server if not in test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Uploads directory: ${uploadsDir}`);
    console.log(`🎯 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`📸 Pexels API Key: ${process.env.PEXELS_API_KEY ? '✅ Set' : '⚠️  Not set (will use Unsplash fallback)'}`);
    console.log('='.repeat(50));
  });
}

// Export app for testing
export { app };
