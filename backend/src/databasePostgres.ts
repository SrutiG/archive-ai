import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { WardrobeItem, UserProfile, OutfitFeedback, ExploreSuggestion, SavedOutfit } from './index';

dotenv.config();

// Get PostgreSQL connection string from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set. Database operations will fail.');
} else {
  // Log connection info (without password)
  const safeUrl = DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('📊 Database URL (masked):', safeUrl);
  
  // Check connection type
  if (DATABASE_URL.includes('.pooler.supabase.com')) {
    if (DATABASE_URL.includes(':6543/')) {
      console.log('✅ Using connection pooler (Transaction mode, port 6543) - recommended for Render');
    } else if (DATABASE_URL.includes(':5432/')) {
      console.log('✅ Using connection pooler (Session mode, port 5432)');
      console.warn('⚠️  Session mode pooler may have connection limits. If you see ECONNREFUSED, try Transaction mode (port 6543)');
    }
  } else if (DATABASE_URL.includes(':5432/')) {
    console.warn('⚠️  Using direct connection port 5432. This may be blocked by Supabase firewall.');
    console.warn('⚠️  Consider using connection pooler (port 6543 or 5432 with pooler hostname)');
  } else if (DATABASE_URL.includes(':6543/')) {
    console.log('✅ Using connection pooler (port 6543) - recommended for Render');
  }
}

// Create connection pool with IPv4 preference
// For shared pooler with limited pool size, reduce max connections to avoid exhausting the pool
const poolSize = DATABASE_URL?.includes('shared') ? 5 : 10; // Reduce for shared pooler

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  max: poolSize, // Reduced for shared pooler to avoid exhausting the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // Increased timeout for initial connection (pooler may need more time)
  // Allow the pool to remove idle clients that have been closed by the server
  allowExitOnIdle: false,
  // Force IPv4 connection (Render doesn't support IPv6)
  // This will be handled by the connection string format
});

if (DATABASE_URL?.includes('shared')) {
  console.log(`📊 Using shared pooler with reduced connection pool (max: ${poolSize}) to avoid exhausting Supabase pooler`);
}

// Handle pool errors gracefully
// Don't exit on connection termination - Supabase pooler may close idle connections
pool.on('error', (err: any) => {
  // Log the error but don't crash the app
  // Connection termination (XX000) is normal for Supabase poolers
  if (err?.code === 'XX000' || err?.message?.includes('shutdown') || err?.message?.includes('termination')) {
    console.warn('⚠️  Database connection terminated (this is normal for Supabase poolers):', err.message);
    // The pool will automatically reconnect on the next query
  } else {
    console.error('❌ Database pool error:', err);
    // Only exit on critical errors, not connection issues
    if (err?.code === 'ENOSPC' || err?.severity === 'FATAL') {
      console.error('💥 Critical database error - exiting');
      process.exit(-1);
    }
  }
});

// Helper function to execute queries with automatic retry on connection termination
async function query(text: string, params?: any[], retryCount = 0): Promise<QueryResult> {
  const start = Date.now();
  const maxRetries = 2;
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return res;
  } catch (error: any) {
    // Retry on connection termination errors (Supabase pooler closes idle connections)
    if ((error?.code === 'XX000' || 
         error?.message?.includes('shutdown') || 
         error?.message?.includes('termination')) && 
        retryCount < maxRetries) {
      console.warn(`⚠️  Connection terminated, retrying query (attempt ${retryCount + 1}/${maxRetries})...`);
      // Wait a bit before retrying to allow connection to be re-established
      await new Promise(resolve => setTimeout(resolve, 100 * (retryCount + 1)));
      return query(text, params, retryCount + 1);
    }
    console.error('Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    
    // Provide helpful error messages for common connection issues
    if (error?.code === 'ECONNREFUSED') {
      console.error('\n❌ CONNECTION REFUSED ERROR');
      console.error('The database server is refusing connections. This could mean:');
      console.error('1. The connection string is incorrect');
      console.error('2. The database host/port is wrong');
      console.error('3. Network restrictions are blocking the connection');
      console.error('4. Supabase pooler is exhausted (all connections in use)');
      console.error('5. Password contains special characters that need URL encoding');
      console.error('\nCurrent connection (masked):', DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
      
      if (DATABASE_URL?.includes('shared')) {
        console.error('\n⚠️  You are using a SHARED pooler with limited pool size.');
        console.error('The pool might be exhausted. Try:');
        console.error('- Reduce max connections in the app (already set to 5 for shared pooler)');
        console.error('- Upgrade to a dedicated pooler in Supabase');
        console.error('- Use Transaction mode (port 6543) instead of Session mode (port 5432)');
        console.error('- Check Supabase dashboard for pooler usage and limits');
      }
      
      console.error('\nFor Render, use Supabase Connection Pooling:');
      console.error('- Go to Supabase Dashboard → Settings → Database → Connection Pooling');
      console.error('- Try Transaction mode (port 6543) instead of Session mode (port 5432)');
      console.error('- Consider upgrading to dedicated pooler if using shared pooler');
      console.error('- Make sure password is URL-encoded if it contains special characters');
    } else if (error?.code === 'ENETUNREACH') {
      console.error('\n❌ NETWORK UNREACHABLE ERROR');
      console.error('This is likely an IPv6 connection issue. Render does not support IPv6.');
      console.error('Make sure your DATABASE_URL uses a hostname (not IPv6 address).');
    }
    
    throw error;
  }
}

function safeParseStringArray(value: unknown): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item : item != null ? String(item) : ''))
      .filter(item => item.length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return [];
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(item => (typeof item === 'string' ? item : item != null ? String(item) : ''))
          .filter(item => item.length > 0);
      }
    } catch (error) {
      // If parsing fails, fall back to treating as a single string value
    }
    return [trimmed];
  }
  return [];
}

function stripLeadingMarkers(value: string): string {
  return value.replace(/^[\s]*[-•*·+]+[\s]*/, '');
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTitleKey(value: string): string {
  return normalizeWhitespace(stripLeadingMarkers(value || '')).toLowerCase();
}

type UserItemIndex = {
  byTitle: Map<string, { id: string; title: string }>;
  byId: Map<string, { id: string; title: string }>;
};

async function ensureUserItemIndex(
  userId: string,
  cache: Map<string, UserItemIndex>
): Promise<UserItemIndex> {
  if (cache.has(userId)) {
    return cache.get(userId)!;
  }
  const itemsResult = await query('SELECT id, title FROM wardrobe_items WHERE user_id = $1', [userId]);
  const byTitle = new Map<string, { id: string; title: string }>();
  const byId = new Map<string, { id: string; title: string }>();
  itemsResult.rows.forEach(item => {
    const normalized = normalizeTitleKey(item.title);
    if (!byTitle.has(normalized)) {
      byTitle.set(normalized, { id: item.id, title: item.title });
    }
    byId.set(item.id, { id: item.id, title: item.title });
  });
  const index: UserItemIndex = { byTitle, byId };
  cache.set(userId, index);
  return index;
}

async function resolveItemIdsForUser(
  userId: string,
  titles: string[],
  cache: Map<string, UserItemIndex>
): Promise<{ ids: string[]; titles: string[] } | null> {
  if (titles.length === 0) {
    return { ids: [], titles: [] };
  }

  const index = await ensureUserItemIndex(userId, cache);
  const resolvedIds: string[] = [];
  const resolvedTitles: string[] = [];

  for (const rawTitle of titles) {
    const normalized = normalizeTitleKey(rawTitle);
    const match = index.byTitle.get(normalized);
    if (match) {
      resolvedIds.push(match.id);
      resolvedTitles.push(match.title);
      continue;
    }

    console.warn(
      `[Migration] Unable to resolve outfit item title "${rawTitle}" for user ${userId}`
    );
    return null;
  }

  return { ids: resolvedIds, titles: resolvedTitles };
}

export async function backfillOutfitItemIds(): Promise<void> {
  const userItemsCache = new Map<string, UserItemIndex>();

  const processRows = async (rows: any[], tableName: 'saved_outfits' | 'outfit_feedback') => {
    for (const row of rows) {
      const titles = safeParseStringArray(row.item_titles);
      if (titles.length === 0) {
        continue;
      }

      const existingIds = safeParseStringArray(row.item_ids);
      if (existingIds.length === titles.length && titles.length > 0) {
        continue; // Already populated
      }

      const resolved = await resolveItemIdsForUser(row.user_id, titles, userItemsCache);
      if (!resolved || resolved.ids.length === 0) {
        continue;
      }

      try {
        await query(
          `UPDATE ${tableName} SET item_ids = $1, item_titles = $2 WHERE id = $3`,
          [JSON.stringify(resolved.ids), JSON.stringify(resolved.titles), row.id]
        );
        console.log(
          `[Migration] Backfilled ${tableName} ${row.id} for user ${row.user_id} with ${resolved.ids.length} item IDs`
        );
      } catch (error) {
        console.error(
          `[Migration] Failed to backfill ${tableName} ${row.id} for user ${row.user_id}:`,
          error
        );
      }
    }
  };

  try {
    const savedOutfits = await query(
      'SELECT id, user_id, item_titles, item_ids FROM saved_outfits'
    );
    await processRows(savedOutfits.rows, 'saved_outfits');

    const feedback = await query(
      'SELECT id, user_id, item_titles, item_ids FROM outfit_feedback'
    );
    await processRows(feedback.rows, 'outfit_feedback');
  } catch (error) {
    console.error('[Migration] Error during outfit item ID backfill:', error);
  }
}

// Initialize database schema
export async function initializeSchema(): Promise<void> {
  const createTablesQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_data (
      user_id TEXT PRIMARY KEY,
      outfit_generation_clicks INTEGER DEFAULT 0,
      last_click_reset_date TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wardrobe_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      sub_category TEXT,
      brand TEXT,
      description TEXT,
      image_url TEXT,
      color_palette TEXT,
      fabric TEXT,
      pattern TEXT,
      silhouettes TEXT,
      silhouette TEXT,
      fit TEXT,
      formalities TEXT,
      style_tags TEXT,
      seasons TEXT,
      occasion_tags TEXT,
      care_notes TEXT,
      measurements TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      height INTEGER,
      weight INTEGER,
      height_unit TEXT,
      weight_unit TEXT,
      style_preferences TEXT,
      favorite_brands TEXT,
      waist NUMERIC,
      chest NUMERIC,
      hips NUMERIC,
      inseam NUMERIC,
      shoe_size TEXT,
      measurements_unit TEXT,
      hair_color TEXT,
      hair_texture TEXT,
      skin_color TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS saved_outfits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_ids TEXT,
      item_titles TEXT NOT NULL,
      prompt TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outfit_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      item_ids TEXT,
      item_titles TEXT NOT NULL,
      type TEXT NOT NULL,
      feedback TEXT,
      prompt TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS explore_suggestions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      brand TEXT,
      link TEXT,
      image_url TEXT,
      pairs_well_with TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS explore_updates (
      user_id TEXT PRIMARY KEY,
      last_update TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_wardrobe_items_user ON wardrobe_items(user_id);
    CREATE INDEX IF NOT EXISTS idx_saved_outfits_user ON saved_outfits(user_id);
    CREATE INDEX IF NOT EXISTS idx_outfit_feedback_user ON outfit_feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_explore_suggestions_user ON explore_suggestions(user_id);
  `;

  await query(createTablesQuery);
  
  // Add measurement columns if they don't exist (migration for existing databases)
  try {
    await query(`
      DO $$ 
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'waist') THEN
          ALTER TABLE user_profiles ADD COLUMN waist NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'chest') THEN
          ALTER TABLE user_profiles ADD COLUMN chest NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'hips') THEN
          ALTER TABLE user_profiles ADD COLUMN hips NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_profiles' AND column_name = 'inseam') THEN
          ALTER TABLE user_profiles ADD COLUMN inseam NUMERIC;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'color_palette') THEN
          ALTER TABLE wardrobe_items ADD COLUMN color_palette TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'fabric') THEN
          ALTER TABLE wardrobe_items ADD COLUMN fabric TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'pattern') THEN
          ALTER TABLE wardrobe_items ADD COLUMN pattern TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'silhouettes') THEN
          ALTER TABLE wardrobe_items ADD COLUMN silhouettes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'silhouette') THEN
          ALTER TABLE wardrobe_items ADD COLUMN silhouette TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'fit') THEN
          ALTER TABLE wardrobe_items ADD COLUMN fit TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'formalities') THEN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'formality') THEN
            ALTER TABLE wardrobe_items RENAME COLUMN formality TO formalities;
          ELSE
            ALTER TABLE wardrobe_items ADD COLUMN formalities TEXT;
          END IF;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'style_tags') THEN
          ALTER TABLE wardrobe_items ADD COLUMN style_tags TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'seasons') THEN
          ALTER TABLE wardrobe_items ADD COLUMN seasons TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'occasion_tags') THEN
          ALTER TABLE wardrobe_items ADD COLUMN occasion_tags TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'care_notes') THEN
          ALTER TABLE wardrobe_items ADD COLUMN care_notes TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'sub_category') THEN
          ALTER TABLE wardrobe_items ADD COLUMN sub_category TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'wardrobe_items' AND column_name = 'brand') THEN
          ALTER TABLE wardrobe_items ADD COLUMN brand TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'saved_outfits' AND column_name = 'item_ids') THEN
          ALTER TABLE saved_outfits ADD COLUMN item_ids TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'outfit_feedback' AND column_name = 'item_ids') THEN
          ALTER TABLE outfit_feedback ADD COLUMN item_ids TEXT;
        END IF;
      END $$;
    `);
  } catch (error) {
    // Ignore errors if columns already exist
    console.log('Migration check for measurement columns:', error instanceof Error ? error.message : String(error));
  }

}

// Helper functions
export async function getUserById(userId: string) {
  const result = await query('SELECT * FROM users WHERE id = $1', [userId]);
  return result.rows[0] || null;
}

export async function getAllUsers() {
  const result = await query('SELECT * FROM users ORDER BY created_at');
  return result.rows;
}

export async function createUser(id: string, name: string, createdAt: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('INSERT INTO users (id, name, created_at) VALUES ($1, $2, $3)', [id, name, createdAt]);
    await client.query('INSERT INTO user_data (user_id, outfit_generation_clicks, last_click_reset_date) VALUES ($1, $2, $3)', 
      [id, 0, new Date().toDateString()]);
    
    await client.query('COMMIT');
    return { id, name, createdAt };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUser(userId: string) {
  // CASCADE will automatically delete all related data (items, outfits, feedback, etc.)
  await query('DELETE FROM users WHERE id = $1', [userId]);
}

export async function getUserData(userId: string) {
  const result = await query('SELECT * FROM user_data WHERE user_id = $1', [userId]);
  if (!result.rows[0]) {
    // Create default user data if it doesn't exist
    await query('INSERT INTO user_data (user_id, outfit_generation_clicks, last_click_reset_date) VALUES ($1, $2, $3)',
      [userId, 0, new Date().toDateString()]);
    const newResult = await query('SELECT * FROM user_data WHERE user_id = $1', [userId]);
    return newResult.rows[0];
  }
  return result.rows[0];
}

export async function updateUserData(userId: string, clicks: number, resetDate: string) {
  await query('UPDATE user_data SET outfit_generation_clicks = $1, last_click_reset_date = $2 WHERE user_id = $3',
    [clicks, resetDate, userId]);
}

export async function resetAllUserClicks(resetDate: string) {
  await query('UPDATE user_data SET outfit_generation_clicks = 0, last_click_reset_date = $1', [resetDate]);
}

export async function getItemsByUser(userId: string): Promise<WardrobeItem[]> {
  const result = await query('SELECT * FROM wardrobe_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    subCategory: row.sub_category || undefined,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
    colors: row.color_palette ? JSON.parse(row.color_palette) : undefined,
    fabrics: row.fabric ? JSON.parse(row.fabric) : undefined,
    pattern: row.pattern || undefined,
    silhouettes: row.silhouettes ? JSON.parse(row.silhouettes) : undefined,
    silhouette: row.silhouette || undefined,
    fit: row.fit || undefined,
    formalities: row.formalities ? JSON.parse(row.formalities) : undefined,
    styleTags: row.style_tags ? JSON.parse(row.style_tags) : undefined,
    seasons: row.seasons ? JSON.parse(row.seasons) : undefined,
    occasions: row.occasion_tags ? JSON.parse(row.occasion_tags) : undefined,
    careNotes: row.care_notes || undefined,
    brand: row.brand || undefined,
    measurements: row.measurements ? JSON.parse(row.measurements) : undefined,
    createdAt: row.created_at
  }));
}

export async function getAllItems(): Promise<WardrobeItem[]> {
  const result = await query("SELECT * FROM wardrobe_items WHERE image_url IS NOT NULL AND image_url != ''");
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    subCategory: row.sub_category || undefined,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
    colors: row.color_palette ? JSON.parse(row.color_palette) : undefined,
    fabrics: row.fabric ? JSON.parse(row.fabric) : undefined,
    pattern: row.pattern || undefined,
    silhouettes: row.silhouettes ? JSON.parse(row.silhouettes) : undefined,
    silhouette: row.silhouette || undefined,
    fit: row.fit || undefined,
    formalities: row.formalities ? JSON.parse(row.formalities) : undefined,
    styleTags: row.style_tags ? JSON.parse(row.style_tags) : undefined,
    seasons: row.seasons ? JSON.parse(row.seasons) : undefined,
    occasions: row.occasion_tags ? JSON.parse(row.occasion_tags) : undefined,
    careNotes: row.care_notes || undefined,
    brand: row.brand || undefined,
    measurements: row.measurements ? JSON.parse(row.measurements) : undefined,
    createdAt: row.created_at
  }));
}

export async function getItemById(itemId: string) {
  const result = await query('SELECT * FROM wardrobe_items WHERE id = $1', [itemId]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    subCategory: row.sub_category || undefined,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
    colors: row.color_palette ? JSON.parse(row.color_palette) : undefined,
    fabrics: row.fabric ? JSON.parse(row.fabric) : undefined,
    pattern: row.pattern || undefined,
    silhouettes: row.silhouettes ? JSON.parse(row.silhouettes) : undefined,
    silhouette: row.silhouette || undefined,
    fit: row.fit || undefined,
    formalities: row.formalities ? JSON.parse(row.formalities) : undefined,
    styleTags: row.style_tags ? JSON.parse(row.style_tags) : undefined,
    seasons: row.seasons ? JSON.parse(row.seasons) : undefined,
    occasions: row.occasion_tags ? JSON.parse(row.occasion_tags) : undefined,
    careNotes: row.care_notes || undefined,
    brand: row.brand || undefined,
    measurements: row.measurements ? JSON.parse(row.measurements) : undefined,
    createdAt: row.created_at
  };
}

export async function insertItem(item: WardrobeItem, userId: string) {
  await query(
    'INSERT INTO wardrobe_items (id, user_id, title, category, sub_category, brand, description, image_url, color_palette, fabric, pattern, silhouettes, silhouette, fit, formalities, style_tags, seasons, occasion_tags, care_notes, measurements, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)',
    [
      item.id,
      userId,
      item.title,
      item.category,
      item.subCategory || null,
      item.brand || null,
      item.description || null,
      item.imageUrl || null,
      item.colors ? JSON.stringify(item.colors) : null,
      item.fabrics ? JSON.stringify(item.fabrics) : null,
      item.pattern || null,
      item.silhouettes ? JSON.stringify(item.silhouettes) : null,
      item.silhouette || (item.silhouettes && item.silhouettes.length > 0 ? item.silhouettes[0] : null),
      item.fit || null,
      item.formalities ? JSON.stringify(item.formalities) : null,
      item.styleTags ? JSON.stringify(item.styleTags) : null,
      item.seasons ? JSON.stringify(item.seasons) : null,
      item.occasions ? JSON.stringify(item.occasions) : null,
      item.careNotes || null,
      item.measurements ? JSON.stringify(item.measurements) : null,
      item.createdAt
    ]
  );
}

export async function updateItem(itemId: string, updates: Partial<WardrobeItem>) {
  const item = await getItemById(itemId);
  if (!item) throw new Error('Item not found');
  
  await query(
    'UPDATE wardrobe_items SET title = $1, category = $2, sub_category = $3, brand = $4, description = $5, image_url = $6, color_palette = $7, fabric = $8, pattern = $9, silhouettes = $10, silhouette = $11, fit = $12, formalities = $13, style_tags = $14, seasons = $15, occasion_tags = $16, care_notes = $17, measurements = $18 WHERE id = $19',
    [
      updates.title ?? item.title,
      updates.category ?? item.category,
      updates.subCategory ?? item.subCategory ?? null,
      updates.brand ?? item.brand ?? null,
      updates.description ?? item.description ?? null,
      updates.imageUrl ?? item.imageUrl ?? null,
      updates.colors
        ? JSON.stringify(updates.colors)
        : item.colors
        ? JSON.stringify(item.colors)
        : null,
      updates.fabrics
        ? JSON.stringify(updates.fabrics)
        : item.fabrics
        ? JSON.stringify(item.fabrics)
        : null,
      updates.pattern ?? item.pattern ?? null,
      updates.silhouettes
        ? JSON.stringify(updates.silhouettes)
        : item.silhouettes
        ? JSON.stringify(item.silhouettes)
        : null,
      updates.silhouette ??
        (updates.silhouettes && updates.silhouettes.length > 0
          ? updates.silhouettes[0]
          : item.silhouette ??
            (item.silhouettes && item.silhouettes.length > 0 ? item.silhouettes[0] : null)),
      updates.fit ?? item.fit ?? null,
      updates.formalities
        ? JSON.stringify(updates.formalities)
        : item.formalities
        ? JSON.stringify(item.formalities)
        : null,
      updates.styleTags
        ? JSON.stringify(updates.styleTags)
        : item.styleTags
        ? JSON.stringify(item.styleTags)
        : null,
      updates.seasons
        ? JSON.stringify(updates.seasons)
        : item.seasons
        ? JSON.stringify(item.seasons)
        : null,
      updates.occasions
        ? JSON.stringify(updates.occasions)
        : item.occasions
        ? JSON.stringify(item.occasions)
        : null,
      updates.careNotes ?? item.careNotes ?? null,
      updates.measurements
        ? JSON.stringify(updates.measurements)
        : item.measurements
        ? JSON.stringify(item.measurements)
        : null,
      itemId
    ]
  );
}

export async function deleteItem(itemId: string) {
  await query('DELETE FROM wardrobe_items WHERE id = $1', [itemId]);
}

export async function getProfile(userId: string): Promise<UserProfile | null> {
  const result = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  
  return {
    height: row.height != null ? Number(row.height) : undefined,
    weight: row.weight != null ? Number(row.weight) : undefined,
    heightUnit: row.height_unit ?? undefined,
    weightUnit: row.weight_unit ?? undefined,
    stylePreferences: row.style_preferences ?? undefined,
    brands: row.favorite_brands ? JSON.parse(row.favorite_brands) : undefined,
    waist: row.waist != null ? Number(row.waist) : undefined,
    chest: row.chest != null ? Number(row.chest) : undefined,
    hips: row.hips != null ? Number(row.hips) : undefined,
    inseam: row.inseam != null ? Number(row.inseam) : undefined,
    shoeSize: row.shoe_size ?? undefined,
    measurementsUnit: row.measurements_unit ?? undefined,
    hairColor: row.hair_color ?? undefined,
    hairTexture: row.hair_texture ?? undefined,
    skinColor: row.skin_color ?? undefined
  };
}

export async function upsertProfile(userId: string, profile: UserProfile) {
  await query(
    `INSERT INTO user_profiles (user_id, height, weight, height_unit, weight_unit, style_preferences, favorite_brands, waist, chest, hips, inseam, shoe_size, measurements_unit, hair_color, hair_texture, skin_color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT(user_id) DO UPDATE SET
       height = excluded.height,
       weight = excluded.weight,
       height_unit = excluded.height_unit,
       weight_unit = excluded.weight_unit,
       style_preferences = excluded.style_preferences,
       favorite_brands = excluded.favorite_brands,
       waist = excluded.waist,
       chest = excluded.chest,
       hips = excluded.hips,
       inseam = excluded.inseam,
       shoe_size = excluded.shoe_size,
       measurements_unit = excluded.measurements_unit,
       hair_color = excluded.hair_color,
       hair_texture = excluded.hair_texture,
       skin_color = excluded.skin_color`,
    [
      userId,
      profile.height ?? null,
      profile.weight ?? null,
      profile.heightUnit ?? null,
      profile.weightUnit ?? null,
      profile.stylePreferences ?? null,
      profile.brands ? JSON.stringify(profile.brands) : null,
      profile.waist ?? null,
      profile.chest ?? null,
      profile.hips ?? null,
      profile.inseam ?? null,
      profile.shoeSize ?? null,
      profile.measurementsUnit ?? null,
      profile.hairColor ?? null,
      profile.hairTexture ?? null,
      profile.skinColor ?? null
    ]
  );
}

export async function getSavedOutfits(userId: string) {
  const result = await query('SELECT * FROM saved_outfits WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(row => ({
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    prompt: row.prompt || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at
  }));
}

export async function insertSavedOutfit(userId: string, outfit: SavedOutfit) {
  await query(
    'INSERT INTO saved_outfits (id, user_id, item_ids, item_titles, prompt, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      outfit.id,
      userId,
      JSON.stringify(outfit.itemIds || []),
      JSON.stringify(outfit.itemTitles || []),
      outfit.prompt || null,
      outfit.notes || null,
      outfit.createdAt
    ]
  );
}

export async function deleteSavedOutfit(outfitId: string) {
  await query('DELETE FROM saved_outfits WHERE id = $1', [outfitId]);
}

export async function getFeedback(userId: string) {
  const result = await query('SELECT * FROM outfit_feedback WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(row => ({
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    type: row.type,
    feedback: row.feedback || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at
  }));
}

export async function insertFeedback(userId: string, feedback: OutfitFeedback) {
  await query(
    'INSERT INTO outfit_feedback (id, user_id, item_ids, item_titles, type, feedback, prompt, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      feedback.id,
      userId,
      JSON.stringify(feedback.itemIds || []),
      JSON.stringify(feedback.itemTitles || []),
      feedback.type,
      feedback.feedback || null,
      feedback.prompt || null,
      feedback.createdAt
    ]
  );
}

export async function deleteFeedback(feedbackId: string) {
  await query('DELETE FROM outfit_feedback WHERE id = $1', [feedbackId]);
}

export async function getExploreSuggestions(userId: string) {
  const result = await query('SELECT * FROM explore_suggestions WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description || undefined,
    brand: row.brand || undefined,
    link: row.link || undefined,
    imageUrl: row.image_url || undefined,
    pairsWellWith: row.pairs_well_with ? JSON.parse(row.pairs_well_with) : undefined,
    createdAt: row.created_at
  }));
}

export async function insertExploreSuggestion(userId: string, suggestion: ExploreSuggestion) {
  await query(
    'INSERT INTO explore_suggestions (id, user_id, title, category, description, brand, link, image_url, pairs_well_with, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
    [
      suggestion.id,
      userId,
      suggestion.title,
      suggestion.category,
      suggestion.description || null,
      suggestion.brand || null,
      suggestion.link || null,
      suggestion.imageUrl || null,
      suggestion.pairsWellWith ? JSON.stringify(suggestion.pairsWellWith) : null,
      suggestion.createdAt
    ]
  );
}

export async function deleteExploreSuggestions(userId: string) {
  await query('DELETE FROM explore_suggestions WHERE user_id = $1', [userId]);
}

export async function getExploreUpdate(userId: string): Promise<string | null> {
  const result = await query('SELECT * FROM explore_updates WHERE user_id = $1', [userId]);
  return result.rows[0]?.last_update || null;
}

export async function upsertExploreUpdate(userId: string, lastUpdate: string) {
  await query(
    'INSERT INTO explore_updates (user_id, last_update) VALUES ($1, $2) ON CONFLICT(user_id) DO UPDATE SET last_update = excluded.last_update',
    [userId, lastUpdate]
  );
}

// Close database connection pool (call on shutdown)
export async function closeDatabase() {
  await pool.end();
}

// Log connection info (called after module loads to ensure logs appear in Render)
export function logConnectionInfo() {
  if (!DATABASE_URL) {
    console.warn('⚠️  DATABASE_URL not set. Database operations will fail.');
    return;
  }
  
  // Log connection info (without password)
  const safeUrl = DATABASE_URL.replace(/:[^:@]+@/, ':****@');
  console.log('📊 Database URL (masked):', safeUrl);
  
  // Check connection type
  if (DATABASE_URL.includes('.pooler.supabase.com')) {
    if (DATABASE_URL.includes(':6543/')) {
      console.log('✅ Using connection pooler (Transaction mode, port 6543) - recommended for Render');
    } else if (DATABASE_URL.includes(':5432/')) {
      console.log('✅ Using connection pooler (Session mode, port 5432)');
      console.warn('⚠️  Session mode pooler may have connection limits. If you see ECONNREFUSED, try Transaction mode (port 6543)');
    }
  } else if (DATABASE_URL.includes(':5432/')) {
    console.warn('⚠️  Using direct connection port 5432. This may be blocked by Supabase firewall.');
    console.warn('⚠️  Consider using connection pooler (port 6543 or 5432 with pooler hostname)');
  } else if (DATABASE_URL.includes(':6543/')) {
    console.log('✅ Using connection pooler (port 6543) - recommended for Render');
  }
  
  if (DATABASE_URL.includes('shared')) {
    console.log(`📊 Using shared pooler with reduced connection pool (max: ${poolSize}) to avoid exhausting Supabase pooler`);
  }
}

// Export pool for migrations
export { pool };

