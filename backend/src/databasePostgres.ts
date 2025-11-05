import { Pool, QueryResult } from 'pg';
import dotenv from 'dotenv';
import { WardrobeItem, UserProfile, OutfitFeedback, ExploreSuggestion } from './index';

dotenv.config();

// Get PostgreSQL connection string from environment
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set. Database operations will fail.');
}

// Create connection pool with IPv4 preference
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for initial connection
  // Force IPv4 connection (Render doesn't support IPv6)
  // This will be handled by the connection string format
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Helper function to execute queries
async function query(text: string, params?: any[]): Promise<QueryResult> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`Slow query (${duration}ms): ${text.substring(0, 100)}`);
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
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
      description TEXT,
      image_url TEXT,
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
      item_titles TEXT NOT NULL,
      prompt TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS outfit_feedback (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
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

export async function getItemsByUser(userId: string): Promise<WardrobeItem[]> {
  const result = await query('SELECT * FROM wardrobe_items WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
  return result.rows.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
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
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
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
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
    measurements: row.measurements ? JSON.parse(row.measurements) : undefined,
    createdAt: row.created_at
  };
}

export async function insertItem(item: WardrobeItem, userId: string) {
  await query(
    'INSERT INTO wardrobe_items (id, user_id, title, category, description, image_url, measurements, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
    [
      item.id,
      userId,
      item.title,
      item.category,
      item.description || null,
      item.imageUrl || null,
      item.measurements ? JSON.stringify(item.measurements) : null,
      item.createdAt
    ]
  );
}

export async function updateItem(itemId: string, updates: Partial<WardrobeItem>) {
  const item = await getItemById(itemId);
  if (!item) throw new Error('Item not found');
  
  await query(
    'UPDATE wardrobe_items SET title = $1, category = $2, description = $3, image_url = $4, measurements = $5 WHERE id = $6',
    [
      updates.title ?? item.title,
      updates.category ?? item.category,
      updates.description ?? item.description ?? null,
      updates.imageUrl ?? item.imageUrl ?? null,
      updates.measurements ? JSON.stringify(updates.measurements) : (item.measurements ? JSON.stringify(item.measurements) : null),
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
    height: row.height ?? undefined,
    weight: row.weight ?? undefined,
    heightUnit: row.height_unit ?? undefined,
    weightUnit: row.weight_unit ?? undefined,
    stylePreferences: row.style_preferences ?? undefined,
    brands: row.favorite_brands ? JSON.parse(row.favorite_brands) : undefined,
    shoeSize: row.shoe_size ?? undefined,
    measurementsUnit: row.measurements_unit ?? undefined,
    hairColor: row.hair_color ?? undefined,
    hairTexture: row.hair_texture ?? undefined,
    skinColor: row.skin_color ?? undefined
  };
}

export async function upsertProfile(userId: string, profile: UserProfile) {
  await query(
    `INSERT INTO user_profiles (user_id, height, weight, height_unit, weight_unit, style_preferences, favorite_brands, shoe_size, measurements_unit, hair_color, hair_texture, skin_color)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT(user_id) DO UPDATE SET
       height = excluded.height,
       weight = excluded.weight,
       height_unit = excluded.height_unit,
       weight_unit = excluded.weight_unit,
       style_preferences = excluded.style_preferences,
       favorite_brands = excluded.favorite_brands,
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
    itemTitles: JSON.parse(row.item_titles),
    prompt: row.prompt || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at
  }));
}

export async function insertSavedOutfit(userId: string, outfit: any) {
  await query(
    'INSERT INTO saved_outfits (id, user_id, item_titles, prompt, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [
      outfit.id,
      userId,
      JSON.stringify(outfit.itemTitles),
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
    itemTitles: JSON.parse(row.item_titles),
    type: row.type,
    feedback: row.feedback || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at
  }));
}

export async function insertFeedback(userId: string, feedback: OutfitFeedback) {
  await query(
    'INSERT INTO outfit_feedback (id, user_id, item_titles, type, feedback, prompt, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
    [
      feedback.id,
      userId,
      JSON.stringify(feedback.itemTitles),
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

// Export pool for migrations
export { pool };

