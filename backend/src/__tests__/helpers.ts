import * as db from '../database';

export interface TestUser {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * Create a test user for testing
 */
export async function createTestUser(name: string = 'TestUser'): Promise<TestUser> {
  const id = `test-user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = new Date().toISOString();
  await db.createUser(id, name, createdAt);
  return { id, name, createdAt };
}

/**
 * Clean up test user and all associated data
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    // Delete the user - CASCADE will automatically delete all related data
    // (items, outfits, feedback, explore suggestions, profiles, etc.)
    await db.deleteUser(userId);
  } catch (error) {
    console.error(`Error cleaning up test user ${userId}:`, error);
  }
}

/**
 * Seed test data for a user
 */
export async function seedTestData(userId: string) {
  const { v4: uuidv4 } = require('uuid');
  const now = new Date().toISOString();
  
  // Create test items
  const items = [
    {
      id: uuidv4(),
      title: 'Test T-Shirt',
      category: 'Tops',
      description: 'A test t-shirt',
      imageUrl: undefined,
      measurements: undefined,
      createdAt: now,
    },
    {
      id: uuidv4(),
      title: 'Test Jeans',
      category: 'Bottoms',
      description: 'A test pair of jeans',
      imageUrl: undefined,
      measurements: { size: 'M', waist: 32 },
      createdAt: now,
    },
    {
      id: uuidv4(),
      title: 'Test Jacket',
      category: 'Outerwear',
      description: 'A test jacket',
      imageUrl: undefined,
      measurements: undefined,
      createdAt: now,
    },
  ];
  
  for (const item of items) {
    await db.insertItem(item, userId);
  }
  
  // Create test profile
  await db.upsertProfile(userId, {
    height: 65,
    weight: 130,
    heightUnit: 'inches',
    weightUnit: 'lbs',
    stylePreferences: 'Test style preferences',
    brands: ['Test Brand 1', 'Test Brand 2'],
  });
  
  // Create test saved outfit
  const outfitId = uuidv4();
  const referenceItems = items.slice(0, 2);
  await db.insertSavedOutfit(userId, {
    id: outfitId,
    itemIds: referenceItems.map(item => item.id),
    itemTitles: referenceItems.map(item => item.title),
    prompt: 'Test outfit generation',
    notes: 'Test notes',
    createdAt: now,
  });
  
  return { items };
}

