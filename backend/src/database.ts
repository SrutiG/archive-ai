// Database abstraction layer
// Uses PostgreSQL if DATABASE_URL is set, otherwise falls back to SQLite
// Provides a unified async interface for both

import dotenv from 'dotenv';
import type { SavedOutfit } from './index';
import type { StyleMetrics } from './styleMetricsTypes';
import type { OutfitFeedback, FeedbackSignalSummary } from './outfitFeedback';
import type {
  AdminGeneratedOutfitRecord,
  AdminWardrobeItem,
  OutfitTrainingRecord,
} from './adminTypes';
dotenv.config();

// Check if PostgreSQL is configured
const USE_POSTGRES = !!process.env.DATABASE_URL;

export function isPostgresDatabase(): boolean {
  return USE_POSTGRES;
}

let pgDb: any = null;
let sqliteDb: any = null;

if (USE_POSTGRES) {
  console.log('📊 Using PostgreSQL database');
  pgDb = require('./databasePostgres');
  // Log connection info after module is loaded (ensures logs show up in Render)
  if (pgDb && typeof pgDb.logConnectionInfo === 'function') {
    pgDb.logConnectionInfo();
  }
} else {
  console.log('📊 Using SQLite database (local development)');
  sqliteDb = require('./databaseSQLite');
}

// Unified async interface
export async function initializeSchema() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.initializeSchema();
  }
  return Promise.resolve();
}

export async function getUserById(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getUserById(userId);
  }
  return Promise.resolve(sqliteDb.getUserById(userId));
}

export async function getAllUsers() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getAllUsers();
  }
  return Promise.resolve(sqliteDb.getAllUsers());
}

export async function createUser(id: string, name: string, createdAt: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.createUser(id, name, createdAt);
  }
  return Promise.resolve(sqliteDb.createUser(id, name, createdAt));
}

export async function deleteUser(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteUser(userId);
  }
  return Promise.resolve(sqliteDb.deleteUser(userId));
}

export async function getUserData(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getUserData(userId);
  }
  return Promise.resolve(sqliteDb.getUserData(userId));
}

export async function updateUserData(userId: string, clicks: number, resetDate: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.updateUserData(userId, clicks, resetDate);
  }
  return Promise.resolve(sqliteDb.updateUserData(userId, clicks, resetDate));
}

export async function resetAllUserClicks(resetDate: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.resetAllUserClicks(resetDate);
  }
  return Promise.resolve(sqliteDb.resetAllUserClicks(resetDate));
}

export async function getItemsByUser(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getItemsByUser(userId);
  }
  return Promise.resolve(sqliteDb.getItemsByUser(userId));
}

export async function getAllItems() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getAllItems();
  }
  return Promise.resolve(sqliteDb.getAllItems());
}

export async function getItemById(itemId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getItemById(itemId);
  }
  return Promise.resolve(sqliteDb.getItemById(itemId));
}

export async function insertItem(item: any, userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertItem(item, userId);
  }
  return Promise.resolve(sqliteDb.insertItem(item, userId));
}

export async function updateItem(itemId: string, updates: Partial<any>) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.updateItem(itemId, updates);
  }
  return Promise.resolve(sqliteDb.updateItem(itemId, updates));
}

export async function deleteItem(itemId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteItem(itemId);
  }
  return Promise.resolve(sqliteDb.deleteItem(itemId));
}

export async function getProfile(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getProfile(userId);
  }
  return Promise.resolve(sqliteDb.getProfile(userId));
}

export async function upsertProfile(userId: string, profile: any) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.upsertProfile(userId, profile);
  }
  return Promise.resolve(sqliteDb.upsertProfile(userId, profile));
}

export async function getSavedOutfits(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getSavedOutfits(userId);
  }
  return Promise.resolve(sqliteDb.getSavedOutfits(userId));
}

export async function getAllUserOutfits(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getAllUserOutfits(userId);
  }
  return Promise.resolve(sqliteDb.getAllUserOutfits(userId));
}

export async function insertSavedOutfit(userId: string, outfit: SavedOutfit) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertSavedOutfit(userId, outfit);
  }
  return Promise.resolve(sqliteDb.insertSavedOutfit(userId, outfit));
}

export async function deleteSavedOutfit(outfitId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteSavedOutfit(outfitId);
  }
  return Promise.resolve(sqliteDb.deleteSavedOutfit(outfitId));
}

export async function getFeedback(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getFeedback(userId);
  }
  return Promise.resolve(sqliteDb.getFeedback(userId));
}

export async function getFeedbackSummary(userId: string): Promise<FeedbackSignalSummary | null> {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getFeedbackSummary(userId);
  }
  return Promise.resolve(sqliteDb.getFeedbackSummary(userId));
}

export async function upsertFeedbackSummary(userId: string, summary: FeedbackSignalSummary) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.upsertFeedbackSummary(userId, summary);
  }
  return Promise.resolve(sqliteDb.upsertFeedbackSummary(userId, summary));
}

export async function deleteFeedbackSummary(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteFeedbackSummary(userId);
  }
  return Promise.resolve(sqliteDb.deleteFeedbackSummary(userId));
}

export async function insertFeedback(userId: string, feedback: OutfitFeedback) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertFeedback(userId, feedback);
  }
  return Promise.resolve(sqliteDb.insertFeedback(userId, feedback));
}

export async function deleteFeedback(feedbackId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteFeedback(feedbackId);
  }
  return Promise.resolve(sqliteDb.deleteFeedback(feedbackId));
}

export async function updateFeedbackOutfitRefs(feedbackId: string, outfitId: string, styleMetrics: StyleMetrics | null) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.updateFeedbackOutfitRefs(feedbackId, outfitId, styleMetrics);
  }
  return Promise.resolve(sqliteDb.updateFeedbackOutfitRefs(feedbackId, outfitId, styleMetrics));
}

export async function getExploreSuggestions(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getExploreSuggestions(userId);
  }
  return Promise.resolve(sqliteDb.getExploreSuggestions(userId));
}

export async function insertExploreSuggestion(userId: string, suggestion: any) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertExploreSuggestion(userId, suggestion);
  }
  return Promise.resolve(sqliteDb.insertExploreSuggestion(userId, suggestion));
}

export async function deleteExploreSuggestions(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteExploreSuggestions(userId);
  }
  return Promise.resolve(sqliteDb.deleteExploreSuggestions(userId));
}

export async function backfillSavedOutfitItemIds() {
  if (USE_POSTGRES && pgDb && typeof pgDb.backfillOutfitItemIds === 'function') {
    return pgDb.backfillOutfitItemIds();
  }
  if (!USE_POSTGRES && sqliteDb && typeof sqliteDb.backfillOutfitItemIds === 'function') {
    return Promise.resolve(sqliteDb.backfillOutfitItemIds());
  }
  return Promise.resolve();
}

export async function getExploreUpdate(userId: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getExploreUpdate(userId);
  }
  return Promise.resolve(sqliteDb.getExploreUpdate(userId));
}

export async function upsertExploreUpdate(userId: string, lastUpdate: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.upsertExploreUpdate(userId, lastUpdate);
  }
  return Promise.resolve(sqliteDb.upsertExploreUpdate(userId, lastUpdate));
}

export async function getAdminWardrobeItems(): Promise<AdminWardrobeItem[]> {
  if (USE_POSTGRES && pgDb) {
    return pgDb.getAdminWardrobeItems();
  }
  return Promise.resolve(sqliteDb.getAdminWardrobeItems());
}

export async function insertAdminWardrobeItems(items: AdminWardrobeItem[]) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertAdminWardrobeItems(items);
  }
  return Promise.resolve(sqliteDb.insertAdminWardrobeItems(items));
}

export async function clearAdminWardrobeItems() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.clearAdminWardrobeItems();
  }
  return Promise.resolve(sqliteDb.clearAdminWardrobeItems());
}

export async function insertAdminGeneratedOutfits(records: AdminGeneratedOutfitRecord[]) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertAdminGeneratedOutfits(records);
  }
  return Promise.resolve(sqliteDb.insertAdminGeneratedOutfits(records));
}

export async function listAdminGeneratedOutfits(): Promise<AdminGeneratedOutfitRecord[]> {
  if (USE_POSTGRES && pgDb) {
    return pgDb.listAdminGeneratedOutfits();
  }
  return Promise.resolve(sqliteDb.listAdminGeneratedOutfits());
}

export async function deleteAdminGeneratedOutfit(id: string) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.deleteAdminGeneratedOutfit(id);
  }
  return Promise.resolve(sqliteDb.deleteAdminGeneratedOutfit(id));
}

export async function clearAdminGeneratedOutfits() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.clearAdminGeneratedOutfits();
  }
  return Promise.resolve(sqliteDb.clearAdminGeneratedOutfits());
}

export async function listOutfitTrainingData(limit = 50, offset = 0): Promise<OutfitTrainingRecord[]> {
  if (USE_POSTGRES && pgDb) {
    return pgDb.listOutfitTrainingData(limit, offset);
  }
  return Promise.resolve(sqliteDb.listOutfitTrainingData(limit, offset));
}

export async function insertOutfitTrainingRecord(record: OutfitTrainingRecord) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.insertOutfitTrainingRecord(record);
  }
  return Promise.resolve(sqliteDb.insertOutfitTrainingRecord(record));
}

export async function bulkInsertOutfitTrainingRecords(records: OutfitTrainingRecord[]) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.bulkInsertOutfitTrainingRecords(records);
  }
  return Promise.resolve(sqliteDb.bulkInsertOutfitTrainingRecords(records));
}

export async function clearOutfitTrainingData() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.clearOutfitTrainingData();
  }
  return Promise.resolve(sqliteDb.clearOutfitTrainingData());
}

export async function deleteOutfitTrainingRecord(id: string) {
  if (USE_POSTGRES && pgDb && typeof pgDb.deleteOutfitTrainingRecord === 'function') {
    return pgDb.deleteOutfitTrainingRecord(id);
  }
  if (!USE_POSTGRES && sqliteDb && typeof sqliteDb.deleteOutfitTrainingRecord === 'function') {
    return Promise.resolve(sqliteDb.deleteOutfitTrainingRecord(id));
  }
  return Promise.resolve();
}

export async function closeDatabase() {
  if (USE_POSTGRES && pgDb) {
    return pgDb.closeDatabase();
  }
  return Promise.resolve(sqliteDb.closeDatabase());
}

export async function updateSavedOutfitStyleMetrics(id: string, styleMetrics: StyleMetrics | null) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.updateSavedOutfitStyleMetrics(id, styleMetrics);
  }
  return Promise.resolve(sqliteDb.updateSavedOutfitStyleMetrics(id, styleMetrics));
}

export async function updateSavedOutfitSavedFlag(id: string, saved: boolean) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.updateSavedOutfitSavedFlag(id, saved);
  }
  return Promise.resolve(sqliteDb.updateSavedOutfitSavedFlag(id, saved));
}

export async function updateAdminGeneratedOutfitStyleMetrics(id: string, styleMetrics: StyleMetrics | null) {
  if (USE_POSTGRES && pgDb) {
    return pgDb.updateAdminGeneratedOutfitStyleMetrics(id, styleMetrics);
  }
  return Promise.resolve(sqliteDb.updateAdminGeneratedOutfitStyleMetrics(id, styleMetrics));
}
