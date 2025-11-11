// SQLite database implementation (for local development)
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  WardrobeItem,
  UserProfile,
  ExploreSuggestion,
  SavedOutfit
} from './index';
import {
  AdminGeneratedOutfitRecord,
  AdminOutfitItemSummary,
  AdminWardrobeItem,
  OutfitTrainingRecord,
} from './adminTypes';
import {
  type OutfitFeedback,
  type FeedbackSignalSummary,
  normalizeFeedbackSummaryPayload,
  shouldPersistFeedbackSummary,
  summarizeFeedbackSignals,
  createItemTraitResolver,
} from './outfitFeedback';
import type { StyleMetrics } from './styleMetricsTypes';

const DB_DIR = path.join(__dirname, '../data');
const DB_FILE = path.join(DB_DIR, 'wardrobe.db');

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Create database connection
const db = new Database(DB_FILE);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
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

  CREATE TABLE IF NOT EXISTS admin_wardrobe_items (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    brand TEXT,
    category TEXT NOT NULL,
    sub_category TEXT,
    colors TEXT,
    fabrics TEXT,
    pattern TEXT,
    silhouettes TEXT,
    fit TEXT,
    formalities TEXT,
    style_tags TEXT,
    seasons TEXT,
    occasions TEXT,
    care_notes TEXT,
    image_url TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_generated_outfits (
    id TEXT PRIMARY KEY,
    item_ids TEXT NOT NULL,
    item_titles TEXT NOT NULL,
    items TEXT NOT NULL,
    prompt TEXT,
    context TEXT,
    justification TEXT,
    styling_suggestions TEXT,
    evaluation TEXT,
    status TEXT NOT NULL,
    style_metrics TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    height INTEGER,
    weight INTEGER,
    height_unit TEXT,
    weight_unit TEXT,
    style_preferences TEXT,
    favorite_brands TEXT,
    waist REAL,
    chest REAL,
    hips REAL,
    inseam REAL,
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
    style_metrics TEXT,
    saved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS outfit_feedback (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    outfit_id TEXT,
    item_ids TEXT,
    item_titles TEXT NOT NULL,
    type TEXT NOT NULL,
    feedback TEXT,
    prompt TEXT,
    style_metrics TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (outfit_id) REFERENCES saved_outfits(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS outfit_training_data (
    id TEXT PRIMARY KEY,
    item_ids TEXT NOT NULL,
    item_titles TEXT NOT NULL,
    prompt TEXT,
    context TEXT,
    styling_notes TEXT,
    feedback_type TEXT NOT NULL,
    feedback_comment TEXT,
    anchor_item_id TEXT,
    generation_metadata TEXT,
    created_at TEXT NOT NULL
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
  CREATE INDEX IF NOT EXISTS idx_admin_wardrobe_items_category ON admin_wardrobe_items(category);
  CREATE INDEX IF NOT EXISTS idx_admin_generated_outfits_status ON admin_generated_outfits(status);
  CREATE INDEX IF NOT EXISTS idx_admin_generated_outfits_created_at ON admin_generated_outfits(created_at);
  CREATE INDEX IF NOT EXISTS idx_outfit_training_data_created_at ON outfit_training_data(created_at);
`);

// Migration: Add measurement columns if they don't exist (for existing databases)
try {
  const tableInfo = db.prepare("PRAGMA table_info(user_profiles)").all() as any[];
  const columnNames = tableInfo.map(col => col.name);
  
  if (!columnNames.includes('waist')) {
    db.exec('ALTER TABLE user_profiles ADD COLUMN waist REAL');
  }
  if (!columnNames.includes('chest')) {
    db.exec('ALTER TABLE user_profiles ADD COLUMN chest REAL');
  }
  if (!columnNames.includes('hips')) {
    db.exec('ALTER TABLE user_profiles ADD COLUMN hips REAL');
  }
  if (!columnNames.includes('inseam')) {
    db.exec('ALTER TABLE user_profiles ADD COLUMN inseam REAL');
  }

  const wardrobeInfo = db.prepare("PRAGMA table_info(wardrobe_items)").all() as any[];
  const wardrobeColumns = wardrobeInfo.map(col => col.name);

  if (!wardrobeColumns.includes('color_palette')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN color_palette TEXT');
  }
  if (!wardrobeColumns.includes('fabric')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN fabric TEXT');
  }
  if (!wardrobeColumns.includes('pattern')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN pattern TEXT');
  }
  if (!wardrobeColumns.includes('silhouettes')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN silhouettes TEXT');
  }
  if (!wardrobeColumns.includes('silhouette')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN silhouette TEXT');
  }
  if (!wardrobeColumns.includes('fit')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN fit TEXT');
  }
  if (!wardrobeColumns.includes('formalities')) {
    if (wardrobeColumns.includes('formality')) {
      db.exec('ALTER TABLE wardrobe_items RENAME COLUMN formality TO formalities');
    } else {
      db.exec('ALTER TABLE wardrobe_items ADD COLUMN formalities TEXT');
    }
  }
  if (!wardrobeColumns.includes('style_tags')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN style_tags TEXT');
  }
  if (!wardrobeColumns.includes('seasons')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN seasons TEXT');
  }
  if (!wardrobeColumns.includes('occasion_tags')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN occasion_tags TEXT');
  }
  if (!wardrobeColumns.includes('care_notes')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN care_notes TEXT');
  }
  if (!wardrobeColumns.includes('sub_category')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN sub_category TEXT');
  }
  if (!wardrobeColumns.includes('brand')) {
    db.exec('ALTER TABLE wardrobe_items ADD COLUMN brand TEXT');
  }

  const savedOutfitsInfo = db.prepare("PRAGMA table_info(saved_outfits)").all() as any[];
  const savedOutfitsColumns = savedOutfitsInfo.map(col => col.name);
  if (!savedOutfitsColumns.includes('item_ids')) {
    db.exec('ALTER TABLE saved_outfits ADD COLUMN item_ids TEXT');
  }
  if (!savedOutfitsColumns.includes('style_metrics')) {
    db.exec('ALTER TABLE saved_outfits ADD COLUMN style_metrics TEXT');
  }
  if (!savedOutfitsColumns.includes('saved')) {
    db.exec('ALTER TABLE saved_outfits ADD COLUMN saved INTEGER NOT NULL DEFAULT 0');
  }

  const feedbackInfo = db.prepare("PRAGMA table_info(outfit_feedback)").all() as any[];
  const feedbackColumns = feedbackInfo.map(col => col.name);
  if (!feedbackColumns.includes('item_ids')) {
    db.exec('ALTER TABLE outfit_feedback ADD COLUMN item_ids TEXT');
  }
  if (!feedbackColumns.includes('style_metrics')) {
    db.exec('ALTER TABLE outfit_feedback ADD COLUMN style_metrics TEXT');
  }
  if (!feedbackColumns.includes('outfit_id')) {
    db.exec('ALTER TABLE outfit_feedback ADD COLUMN outfit_id TEXT');
  }

  const adminInfo = db.prepare("PRAGMA table_info(admin_wardrobe_items)").all() as any[];
  const adminColumns = adminInfo.map(col => col.name);
  if (!adminColumns.includes('pattern')) {
    db.exec('ALTER TABLE admin_wardrobe_items ADD COLUMN pattern TEXT');
  }
  if (!adminColumns.includes('style_metrics')) {
    db.exec('ALTER TABLE admin_generated_outfits ADD COLUMN style_metrics TEXT');
  }
} catch (error) {
  // Ignore errors if columns already exist or table doesn't exist
  console.log('Migration check for measurement columns:', error instanceof Error ? error.message : String(error));
}

// Prepared statements for better performance
const stmts = {
  // Users
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getAllUsers: db.prepare('SELECT * FROM users ORDER BY created_at'),
  createUser: db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  
  // User data
  getUserData: db.prepare('SELECT * FROM user_data WHERE user_id = ?'),
  createUserData: db.prepare('INSERT INTO user_data (user_id, outfit_generation_clicks, last_click_reset_date) VALUES (?, ?, ?)'),
  updateUserData: db.prepare('UPDATE user_data SET outfit_generation_clicks = ?, last_click_reset_date = ? WHERE user_id = ?'),
  resetAllUserClicks: db.prepare('UPDATE user_data SET outfit_generation_clicks = ?, last_click_reset_date = ?'),
  
  // Wardrobe items
  getItemsByUser: db.prepare('SELECT * FROM wardrobe_items WHERE user_id = ? ORDER BY created_at DESC'),
  getAllItems: db.prepare("SELECT * FROM wardrobe_items WHERE image_url IS NOT NULL AND image_url != ''"),
  getItemById: db.prepare('SELECT * FROM wardrobe_items WHERE id = ?'),
  insertItem: db.prepare('INSERT INTO wardrobe_items (id, user_id, title, category, sub_category, brand, description, image_url, color_palette, fabric, pattern, silhouettes, silhouette, fit, formalities, style_tags, seasons, occasion_tags, care_notes, measurements, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  updateItem: db.prepare('UPDATE wardrobe_items SET title = ?, category = ?, sub_category = ?, brand = ?, description = ?, image_url = ?, color_palette = ?, fabric = ?, pattern = ?, silhouettes = ?, silhouette = ?, fit = ?, formalities = ?, style_tags = ?, seasons = ?, occasion_tags = ?, care_notes = ?, measurements = ? WHERE id = ?'),
  deleteItem: db.prepare('DELETE FROM wardrobe_items WHERE id = ?'),
  
  // User profiles
  getProfile: db.prepare('SELECT * FROM user_profiles WHERE user_id = ?'),
  upsertProfile: db.prepare(`
    INSERT INTO user_profiles (user_id, height, weight, height_unit, weight_unit, style_preferences, favorite_brands, waist, chest, hips, inseam, shoe_size, measurements_unit, hair_color, hair_texture, skin_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      skin_color = excluded.skin_color
  `),
  
  // Saved outfits
  getSavedOutfits: db.prepare('SELECT * FROM saved_outfits WHERE user_id = ? AND saved = 1 ORDER BY created_at DESC'),
  insertSavedOutfit: db.prepare('INSERT INTO saved_outfits (id, user_id, item_ids, item_titles, prompt, notes, style_metrics, saved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  deleteSavedOutfit: db.prepare('DELETE FROM saved_outfits WHERE id = ?'),
  
  // Outfit feedback
  getFeedback: db.prepare(`
    SELECT f.*, 
           o.item_ids AS outfit_item_ids,
           o.item_titles AS outfit_item_titles,
           o.prompt AS outfit_prompt,
           o.notes AS outfit_notes,
           o.style_metrics AS outfit_style_metrics,
           o.created_at AS outfit_created_at,
           o.saved AS outfit_saved
    FROM outfit_feedback f
    LEFT JOIN saved_outfits o ON f.outfit_id = o.id
    WHERE f.user_id = ?
    ORDER BY f.created_at DESC
  `),
  insertFeedback: db.prepare('INSERT INTO outfit_feedback (id, user_id, outfit_id, item_ids, item_titles, type, feedback, prompt, style_metrics, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  deleteFeedback: db.prepare('DELETE FROM outfit_feedback WHERE id = ?'),
  
  // Admin wardrobe items
  getAdminWardrobeItems: db.prepare('SELECT * FROM admin_wardrobe_items ORDER BY created_at DESC'),
  insertAdminWardrobeItem: db.prepare(`
    INSERT INTO admin_wardrobe_items (
      id, title, description, brand, category, sub_category, colors, fabrics, pattern, silhouettes, fit,
      formalities, style_tags, seasons, occasions, care_notes, image_url, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  clearAdminWardrobeItems: db.prepare('DELETE FROM admin_wardrobe_items'),
  listAdminGeneratedOutfits: db.prepare('SELECT * FROM admin_generated_outfits ORDER BY created_at DESC'),
  insertAdminGeneratedOutfit: db.prepare(`
    INSERT INTO admin_generated_outfits (
      id,
      item_ids,
      item_titles,
      items,
      prompt,
      context,
      justification,
      styling_suggestions,
      evaluation,
      status,
      style_metrics,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      item_ids = excluded.item_ids,
      item_titles = excluded.item_titles,
      items = excluded.items,
      prompt = excluded.prompt,
      context = excluded.context,
      justification = excluded.justification,
      styling_suggestions = excluded.styling_suggestions,
      evaluation = excluded.evaluation,
      status = excluded.status,
      style_metrics = excluded.style_metrics,
      created_at = excluded.created_at
  `),
  deleteAdminGeneratedOutfit: db.prepare('DELETE FROM admin_generated_outfits WHERE id = ?'),
  clearAdminGeneratedOutfits: db.prepare('DELETE FROM admin_generated_outfits'),

  // Outfit training data
  listOutfitTrainingData: db.prepare('SELECT * FROM outfit_training_data ORDER BY created_at DESC LIMIT ? OFFSET ?'),
  insertOutfitTrainingData: db.prepare(`
    INSERT INTO outfit_training_data (
      id,
      item_ids,
      item_titles,
      prompt,
      context,
      styling_notes,
      feedback_type,
      feedback_comment,
      anchor_item_id,
      generation_metadata,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  clearOutfitTrainingData: db.prepare('DELETE FROM outfit_training_data'),
  deleteOutfitTrainingRecord: db.prepare('DELETE FROM outfit_training_data WHERE id = ?'),

  // Explore suggestions
  getExploreSuggestions: db.prepare('SELECT * FROM explore_suggestions WHERE user_id = ? ORDER BY created_at DESC'),
  insertExploreSuggestion: db.prepare('INSERT INTO explore_suggestions (id, user_id, title, category, description, brand, link, image_url, pairs_well_with, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  deleteExploreSuggestions: db.prepare('DELETE FROM explore_suggestions WHERE user_id = ?'),
  getExploreUpdate: db.prepare('SELECT * FROM explore_updates WHERE user_id = ?'),
  upsertExploreUpdate: db.prepare(`
    INSERT INTO explore_updates (user_id, last_update) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET last_update = excluded.last_update
  `),
};

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

function serializeStringArray(value?: string[] | null): string | null {
  if (!value || value.length === 0) {
    return null;
  }
  return JSON.stringify(value);
}

function serializeJson(value?: Record<string, unknown> | null): string | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseJsonArray<T = unknown>(value: unknown): T[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

type UserItemIndex = {
  byTitle: Map<string, { id: string; title: string }>;
  byId: Map<string, { id: string; title: string }>;
};

const userItemsCache = new Map<string, UserItemIndex>();

function ensureUserItemIndex(userId: string): UserItemIndex {
  if (userItemsCache.has(userId)) {
    return userItemsCache.get(userId)!;
  }

  const rows = db.prepare('SELECT id, title FROM wardrobe_items WHERE user_id = ?').all(userId) as any[];
  const byTitle = new Map<string, { id: string; title: string }>();
  const byId = new Map<string, { id: string; title: string }>();

  rows.forEach(row => {
    const normalized = normalizeTitleKey(row.title);
    if (!byTitle.has(normalized)) {
      byTitle.set(normalized, { id: row.id, title: row.title });
    }
    byId.set(row.id, { id: row.id, title: row.title });
  });

  const index: UserItemIndex = { byTitle, byId };
  userItemsCache.set(userId, index);
  return index;
}

function resolveItemIdsForUser(userId: string, titles: string[]): { ids: string[]; titles: string[] } | null {
  if (titles.length === 0) {
    return { ids: [], titles: [] };
  }

  const index = ensureUserItemIndex(userId);
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

    console.warn(`[Migration][SQLite] Unable to resolve outfit item title "${rawTitle}" for user ${userId}`);
    return null;
  }

  return { ids: resolvedIds, titles: resolvedTitles };
}

function mapAdminWardrobeRow(row: any): AdminWardrobeItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    brand: row.brand || undefined,
    category: row.category,
    subCategory: row.sub_category || undefined,
    colors: safeParseStringArray(row.colors),
    fabrics: safeParseStringArray(row.fabrics),
    pattern: row.pattern || undefined,
    silhouettes: safeParseStringArray(row.silhouettes),
    fit: row.fit || undefined,
    formalities: safeParseStringArray(row.formalities),
    styleTags: safeParseStringArray(row.style_tags),
    seasons: safeParseStringArray(row.seasons),
    occasions: safeParseStringArray(row.occasions),
    careNotes: row.care_notes || undefined,
    imageUrl: row.image_url || undefined,
    createdAt: row.created_at
  };
}

function mapOutfitTrainingRow(row: any): OutfitTrainingRecord {
  return {
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    prompt: row.prompt || undefined,
    context: row.context || undefined,
    stylingNotes: row.styling_notes || undefined,
    feedbackType: row.feedback_type,
    feedbackComment: row.feedback_comment || undefined,
    anchorItemId: row.anchor_item_id || null,
    generationMetadata: parseJsonObject(row.generation_metadata),
    createdAt: row.created_at
  };
}

function mapAdminGeneratedOutfitRow(row: any): AdminGeneratedOutfitRecord {
  return {
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    items: parseJsonArray<AdminOutfitItemSummary>(row.items),
    prompt: row.prompt || undefined,
    context: row.context || undefined,
    justification: row.justification || '',
    stylingSuggestions: parseJsonArray<string>(row.styling_suggestions),
    evaluation: parseJsonObject(row.evaluation) as AdminGeneratedOutfitRecord['evaluation'],
    status: (row.status || 'pending') as AdminGeneratedOutfitRecord['status'],
    styleMetrics: parseJsonObject(row.style_metrics) as StyleMetrics | null,
    createdAt: row.created_at,
  };
}

export function backfillOutfitItemIds(): void {
  const processRows = (rows: any[], tableName: 'saved_outfits' | 'outfit_feedback') => {
    const updateStmt = db.prepare(`UPDATE ${tableName} SET item_ids = ?, item_titles = ? WHERE id = ?`);

    rows.forEach(row => {
      const titles = safeParseStringArray(row.item_titles);
      if (titles.length === 0) {
        return;
      }

      const existingIds = safeParseStringArray(row.item_ids);
      if (existingIds.length === titles.length && titles.length > 0) {
        return;
      }

      const resolved = resolveItemIdsForUser(row.user_id, titles);
      if (!resolved || resolved.ids.length === 0) {
        return;
      }

      try {
        updateStmt.run(JSON.stringify(resolved.ids), JSON.stringify(resolved.titles), row.id);
        console.log(`[Migration][SQLite] Backfilled ${tableName} ${row.id} for user ${row.user_id}`);
      } catch (error) {
        console.error(
          `[Migration][SQLite] Failed to backfill ${tableName} ${row.id} for user ${row.user_id}:`,
          error
        );
      }
    });
  };

  try {
    const savedOutfits = db.prepare('SELECT id, user_id, item_titles, item_ids FROM saved_outfits').all() as any[];
    processRows(savedOutfits, 'saved_outfits');

    const feedback = db.prepare('SELECT id, user_id, item_titles, item_ids FROM outfit_feedback').all() as any[];
    processRows(feedback, 'outfit_feedback');
  } catch (error) {
    console.error('[Migration][SQLite] Error during outfit item ID backfill:', error);
  }
}

// Helper functions
export function getUserById(userId: string) {
  return stmts.getUserById.get(userId);
}

export function getAllUsers() {
  return stmts.getAllUsers.all();
}

export function createUser(id: string, name: string, createdAt: string) {
  const transaction = db.transaction(() => {
    stmts.createUser.run(id, name, createdAt);
    stmts.createUserData.run(id, 0, new Date().toDateString());
  });
  transaction();
  return { id, name, createdAt };
}

export function deleteUser(userId: string) {
  // CASCADE will automatically delete all related data (items, outfits, feedback, etc.)
  stmts.deleteUser.run(userId);
}

export function getUserData(userId: string) {
  const userData = stmts.getUserData.get(userId);
  if (!userData) {
    // Create default user data if it doesn't exist
    stmts.createUserData.run(userId, 0, new Date().toDateString());
    return stmts.getUserData.get(userId);
  }
  return userData;
}

export function updateUserData(userId: string, clicks: number, resetDate: string) {
  stmts.updateUserData.run(clicks, resetDate, userId);
}

export function resetAllUserClicks(resetDate: string) {
  stmts.resetAllUserClicks.run(0, resetDate);
}

export function getItemsByUser(userId: string): WardrobeItem[] {
  const rows = stmts.getItemsByUser.all(userId) as any[];
  return rows.map(row => ({
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

export function getAllItems(): WardrobeItem[] {
  const rows = stmts.getAllItems.all() as any[];
  return rows.map(row => ({
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

export function getItemById(itemId: string) {
  const row = stmts.getItemById.get(itemId) as any;
  if (!row) return null;
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

export function insertItem(item: WardrobeItem, userId: string) {
  stmts.insertItem.run(
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
  );
}

export function updateItem(itemId: string, updates: Partial<WardrobeItem>) {
  const item = getItemById(itemId);
  if (!item) throw new Error('Item not found');
  
  stmts.updateItem.run(
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
    updates.measurements ? JSON.stringify(updates.measurements) : (item.measurements ? JSON.stringify(item.measurements) : null),
    itemId
  );
}

export function deleteItem(itemId: string) {
  stmts.deleteItem.run(itemId);
}

export function getProfile(userId: string): UserProfile | null {
  const row = stmts.getProfile.get(userId) as any;
  if (!row) return null;
  
  return {
    height: row.height ?? undefined,
    weight: row.weight ?? undefined,
    heightUnit: row.height_unit ?? undefined,
    weightUnit: row.weight_unit ?? undefined,
    stylePreferences: row.style_preferences ?? undefined,
    brands: row.favorite_brands ? JSON.parse(row.favorite_brands) : undefined,
    waist: row.waist ?? undefined,
    chest: row.chest ?? undefined,
    hips: row.hips ?? undefined,
    inseam: row.inseam ?? undefined,
    shoeSize: row.shoe_size ?? undefined,
    measurementsUnit: row.measurements_unit ?? undefined,
    hairColor: row.hair_color ?? undefined,
    hairTexture: row.hair_texture ?? undefined,
    skinColor: row.skin_color ?? undefined
  };
}

export function upsertProfile(userId: string, profile: UserProfile) {
  stmts.upsertProfile.run(
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
  );
}

export function getSavedOutfits(userId: string) {
  const rows = stmts.getSavedOutfits.all(userId) as any[];
  return rows.map(row => ({
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    prompt: row.prompt || undefined,
    notes: row.notes || undefined,
    styleMetrics: parseJsonObject(row.style_metrics) as StyleMetrics | null,
    createdAt: row.created_at,
    saved: row.saved === 1 || row.saved === '1' || row.saved === true || row.saved === 't',
  }));
}

export function getAllUserOutfits(userId: string) {
  const rows = db
    .prepare('SELECT * FROM saved_outfits WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId) as any[];
  return rows.map(row => ({
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    prompt: row.prompt || undefined,
    notes: row.notes || undefined,
    styleMetrics: parseJsonObject(row.style_metrics) as StyleMetrics | null,
    createdAt: row.created_at,
    saved: row.saved === 1 || row.saved === '1' || row.saved === true || row.saved === 't',
  }));
}

export function insertSavedOutfit(userId: string, outfit: SavedOutfit) {
  stmts.insertSavedOutfit.run(
    outfit.id,
    userId,
    JSON.stringify(outfit.itemIds || []),
    JSON.stringify(outfit.itemTitles || []),
    outfit.prompt || null,
    outfit.notes || null,
    outfit.styleMetrics ? JSON.stringify(outfit.styleMetrics) : null,
    outfit.saved ? 1 : 0,
    outfit.createdAt
  );
}

export function deleteSavedOutfit(outfitId: string) {
  stmts.deleteSavedOutfit.run(outfitId);
}

export function getFeedback(userId: string) {
  const rows = stmts.getFeedback.all(userId) as any[];
  return rows.map(row => ({
    id: row.id,
    itemIds: safeParseStringArray(row.item_ids),
    itemTitles: safeParseStringArray(row.item_titles),
    type: row.type,
    feedback: row.feedback || undefined,
    prompt: row.prompt || undefined,
    styleMetrics: parseJsonObject(row.style_metrics) as StyleMetrics | null,
    createdAt: row.created_at,
    outfitId: row.outfit_id || undefined,
    outfit: row.outfit_id
      ? {
          id: row.outfit_id,
          itemIds: safeParseStringArray(row.outfit_item_ids),
          itemTitles: safeParseStringArray(row.outfit_item_titles),
          prompt: row.outfit_prompt || undefined,
          notes: row.outfit_notes || undefined,
          styleMetrics: parseJsonObject(row.outfit_style_metrics) as StyleMetrics | null,
          createdAt: row.outfit_created_at || row.created_at,
          saved: Boolean(row.outfit_saved),
        }
      : null,
  }));
}

export function insertFeedback(userId: string, feedback: OutfitFeedback) {
  stmts.insertFeedback.run(
    feedback.id,
    userId,
    feedback.outfitId || null,
    JSON.stringify(feedback.itemIds || []),
    JSON.stringify(feedback.itemTitles || []),
    feedback.type,
    feedback.feedback || null,
    feedback.prompt || null,
    feedback.styleMetrics ? JSON.stringify(feedback.styleMetrics) : null,
    feedback.createdAt
  );
}

export function deleteFeedback(feedbackId: string) {
  stmts.deleteFeedback.run(feedbackId);
}

export function updateFeedbackOutfitRefs(feedbackId: string, outfitId: string, styleMetrics: StyleMetrics | null): void {
  db.prepare('UPDATE outfit_feedback SET outfit_id = ?, style_metrics = ? WHERE id = ?').run(
    outfitId,
    styleMetrics ? JSON.stringify(styleMetrics) : null,
    feedbackId
  );
}

export function getAdminWardrobeItems(): AdminWardrobeItem[] {
  const rows = stmts.getAdminWardrobeItems.all() as any[];
  return rows.map(mapAdminWardrobeRow);
}

export function insertAdminWardrobeItems(items: AdminWardrobeItem[]): void {
  if (!items.length) {
    return;
  }
  const insert = stmts.insertAdminWardrobeItem;
  const runInsert = db.transaction((batch: AdminWardrobeItem[]) => {
    batch.forEach(item => {
      insert.run(
        item.id,
        item.title,
        item.description || null,
        item.brand || null,
        item.category,
        item.subCategory || null,
        serializeStringArray(item.colors),
        serializeStringArray(item.fabrics),
        item.pattern || null,
        serializeStringArray(item.silhouettes),
        item.fit || null,
        serializeStringArray(item.formalities),
        serializeStringArray(item.styleTags),
        serializeStringArray(item.seasons),
        serializeStringArray(item.occasions),
        item.careNotes || null,
        item.imageUrl || null,
        item.createdAt
      );
    });
  });
  runInsert(items);
}

export function clearAdminWardrobeItems(): void {
  stmts.clearAdminWardrobeItems.run();
}

export function listAdminGeneratedOutfits(): AdminGeneratedOutfitRecord[] {
  const rows = stmts.listAdminGeneratedOutfits.all() as any[];
  return rows.map(mapAdminGeneratedOutfitRow);
}

export function insertAdminGeneratedOutfits(records: AdminGeneratedOutfitRecord[]): void {
  if (!records.length) {
    return;
  }
  const insert = stmts.insertAdminGeneratedOutfit;
  const runInsert = db.transaction((batch: AdminGeneratedOutfitRecord[]) => {
    batch.forEach(record => {
      insert.run(
        record.id,
        JSON.stringify(record.itemIds),
        JSON.stringify(record.itemTitles),
        JSON.stringify(record.items),
        record.prompt || null,
        record.context || null,
        record.justification || '',
        JSON.stringify(record.stylingSuggestions ?? []),
        record.evaluation ? JSON.stringify(record.evaluation) : null,
        record.status,
        record.styleMetrics ? JSON.stringify(record.styleMetrics) : null,
        record.createdAt
      );
    });
  });
  runInsert(records);
}

export function deleteAdminGeneratedOutfit(id: string): void {
  stmts.deleteAdminGeneratedOutfit.run(id);
}

export function clearAdminGeneratedOutfits(): void {
  stmts.clearAdminGeneratedOutfits.run();
}

export function listOutfitTrainingData(limit = 50, offset = 0): OutfitTrainingRecord[] {
  const rows = stmts.listOutfitTrainingData.all(limit, offset) as any[];
  return rows.map(mapOutfitTrainingRow);
}

export function insertOutfitTrainingRecord(record: OutfitTrainingRecord): void {
  stmts.insertOutfitTrainingData.run(
    record.id,
    JSON.stringify(record.itemIds),
    JSON.stringify(record.itemTitles),
    record.prompt || null,
    record.context || null,
    record.stylingNotes || null,
    record.feedbackType,
    record.feedbackComment || null,
    record.anchorItemId || null,
    serializeJson(record.generationMetadata),
    record.createdAt
  );
}

export function bulkInsertOutfitTrainingRecords(records: OutfitTrainingRecord[]): void {
  if (!records.length) {
    return;
  }
  const insert = stmts.insertOutfitTrainingData;
  const runInsert = db.transaction((batch: OutfitTrainingRecord[]) => {
    batch.forEach(record => {
      insert.run(
        record.id,
        JSON.stringify(record.itemIds),
        JSON.stringify(record.itemTitles),
        record.prompt || null,
        record.context || null,
        record.stylingNotes || null,
        record.feedbackType,
        record.feedbackComment || null,
        record.anchorItemId || null,
        serializeJson(record.generationMetadata),
        record.createdAt
      );
    });
  });
  runInsert(records);
}

export function clearOutfitTrainingData(): void {
  stmts.clearOutfitTrainingData.run();
}

export function deleteOutfitTrainingRecord(id: string): void {
  stmts.deleteOutfitTrainingRecord.run(id);
}

export function getExploreSuggestions(userId: string) {
  const rows = stmts.getExploreSuggestions.all(userId) as any[];
  return rows.map(row => ({
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

export function insertExploreSuggestion(userId: string, suggestion: ExploreSuggestion) {
  stmts.insertExploreSuggestion.run(
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
  );
}

export function deleteExploreSuggestions(userId: string) {
  stmts.deleteExploreSuggestions.run(userId);
}

export function getExploreUpdate(userId: string): string | null {
  const row = stmts.getExploreUpdate.get(userId) as any;
  return row?.last_update || null;
}

export function upsertExploreUpdate(userId: string, lastUpdate: string) {
  stmts.upsertExploreUpdate.run(userId, lastUpdate);
}

export function updateSavedOutfitStyleMetrics(id: string, styleMetrics: StyleMetrics | null): void {
  const stmt = db.prepare(
    'UPDATE saved_outfits SET style_metrics = ? WHERE id = ?'
  );
  stmt.run(styleMetrics ? JSON.stringify(styleMetrics) : null, id);
}

export function updateSavedOutfitSavedFlag(id: string, saved: boolean): void {
  const stmt = db.prepare('UPDATE saved_outfits SET saved = ? WHERE id = ?');
  stmt.run(saved ? 1 : 0, id);
}

export function updateAdminGeneratedOutfitStyleMetrics(id: string, styleMetrics: StyleMetrics | null): void {
  db.prepare('UPDATE admin_generated_outfits SET style_metrics = ? WHERE id = ?').run(
    styleMetrics ? JSON.stringify(styleMetrics) : null,
    id
  );
}

// Close database connection (call on shutdown)
export function closeDatabase() {
  db.close();
}

// Export db for migrations
export { db };

