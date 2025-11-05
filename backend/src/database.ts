import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { WardrobeItem, UserProfile, OutfitFeedback, ExploreSuggestion } from './index';

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
`);

// Prepared statements for better performance
const stmts = {
  // Users
  getUserById: db.prepare('SELECT * FROM users WHERE id = ?'),
  getAllUsers: db.prepare('SELECT * FROM users ORDER BY created_at'),
  createUser: db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)'),
  
  // User data
  getUserData: db.prepare('SELECT * FROM user_data WHERE user_id = ?'),
  createUserData: db.prepare('INSERT INTO user_data (user_id, outfit_generation_clicks, last_click_reset_date) VALUES (?, ?, ?)'),
  updateUserData: db.prepare('UPDATE user_data SET outfit_generation_clicks = ?, last_click_reset_date = ? WHERE user_id = ?'),
  
  // Wardrobe items
  getItemsByUser: db.prepare('SELECT * FROM wardrobe_items WHERE user_id = ? ORDER BY created_at DESC'),
  getItemById: db.prepare('SELECT * FROM wardrobe_items WHERE id = ?'),
  insertItem: db.prepare('INSERT INTO wardrobe_items (id, user_id, title, category, description, image_url, measurements, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
  updateItem: db.prepare('UPDATE wardrobe_items SET title = ?, category = ?, description = ?, image_url = ?, measurements = ? WHERE id = ?'),
  deleteItem: db.prepare('DELETE FROM wardrobe_items WHERE id = ?'),
  
  // User profiles
  getProfile: db.prepare('SELECT * FROM user_profiles WHERE user_id = ?'),
  upsertProfile: db.prepare(`
    INSERT INTO user_profiles (user_id, height, weight, height_unit, weight_unit, style_preferences, favorite_brands, shoe_size, measurements_unit, hair_color, hair_texture, skin_color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      skin_color = excluded.skin_color
  `),
  
  // Saved outfits
  getSavedOutfits: db.prepare('SELECT * FROM saved_outfits WHERE user_id = ? ORDER BY created_at DESC'),
  insertSavedOutfit: db.prepare('INSERT INTO saved_outfits (id, user_id, item_titles, prompt, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
  deleteSavedOutfit: db.prepare('DELETE FROM saved_outfits WHERE id = ?'),
  
  // Outfit feedback
  getFeedback: db.prepare('SELECT * FROM outfit_feedback WHERE user_id = ? ORDER BY created_at DESC'),
  insertFeedback: db.prepare('INSERT INTO outfit_feedback (id, user_id, item_titles, type, feedback, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  deleteFeedback: db.prepare('DELETE FROM outfit_feedback WHERE id = ?'),
  
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

export function getItemsByUser(userId: string): WardrobeItem[] {
  const rows = stmts.getItemsByUser.all(userId) as any[];
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
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
    description: row.description || undefined,
    imageUrl: row.image_url || undefined,
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
    item.description || null,
    item.imageUrl || null,
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
    updates.description ?? item.description ?? null,
    updates.imageUrl ?? item.imageUrl ?? null,
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
    itemTitles: JSON.parse(row.item_titles),
    prompt: row.prompt || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at
  }));
}

export function insertSavedOutfit(userId: string, outfit: any) {
  stmts.insertSavedOutfit.run(
    outfit.id,
    userId,
    JSON.stringify(outfit.itemTitles),
    outfit.prompt || null,
    outfit.notes || null,
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
    itemTitles: JSON.parse(row.item_titles),
    type: row.type,
    feedback: row.feedback || undefined,
    prompt: row.prompt || undefined,
    createdAt: row.created_at
  }));
}

export function insertFeedback(userId: string, feedback: OutfitFeedback) {
  stmts.insertFeedback.run(
    feedback.id,
    userId,
    JSON.stringify(feedback.itemTitles),
    feedback.type,
    feedback.feedback || null,
    feedback.prompt || null,
    feedback.createdAt
  );
}

export function deleteFeedback(feedbackId: string) {
  stmts.deleteFeedback.run(feedbackId);
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

// Close database connection (call on shutdown)
export function closeDatabase() {
  db.close();
}

// Export db for migrations
export { db };

