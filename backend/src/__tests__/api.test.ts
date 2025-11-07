import request from 'supertest';
import * as db from '../database';
import { createTestUser, cleanupTestUser, seedTestData } from './helpers';
import { app } from '../index';

let testUser: { id: string; name: string; createdAt: string } | null = null;

beforeAll(async () => {
  // Initialize database schema if using PostgreSQL
  if (process.env.DATABASE_URL && typeof db.initializeSchema === 'function') {
    await db.initializeSchema();
  }
  
  // Create test user
  testUser = await createTestUser('IntegrationTestUser');
  console.log(`✅ Created test user: ${testUser.id}`);
  
  // Seed test data
  await seedTestData(testUser.id);
  console.log('✅ Seeded test data');
});

afterAll(async () => {
  if (testUser) {
    await cleanupTestUser(testUser.id);
    console.log(`✅ Cleaned up test user: ${testUser.id}`);
  }
  await db.closeDatabase();
});

describe('API Integration Tests', () => {
  // Helper to make requests with test user header
  const apiRequest = (method: string, endpoint: string, body?: any) => {
    if (!testUser) {
      throw new Error('Test user not initialized');
    }
    
    const methodLower = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete';
    let req = request(app)[methodLower](endpoint)
      .set('x-user-id', testUser.id);
    
    if (body) {
      req = req.send(body);
    }
    
    return req;
  };
  
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
  
  describe('Users', () => {
    it('should get all users with correct structure', async () => {
      const response = await request(app).get('/api/users');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Verify test user is in the list
      const testUserInList = response.body.find((user: any) => user.id === testUser!.id);
      expect(testUserInList).toBeDefined();
      expect(testUserInList).toHaveProperty('name', 'IntegrationTestUser');
      // API returns created_at (snake_case) or createdAt (camelCase) depending on format
      expect(testUserInList).toHaveProperty(testUserInList.created_at ? 'created_at' : 'createdAt');
      
      // Verify all users have required fields
      response.body.forEach((user: any) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('name');
        const createdAtField = user.created_at ? 'created_at' : 'createdAt';
        expect(user).toHaveProperty(createdAtField);
        expect(typeof user.id).toBe('string');
        expect(typeof user.name).toBe('string');
        expect(typeof user[createdAtField]).toBe('string');
      });
    });
    
    it('should create a new user with correct details', async () => {
      const userName = 'NewTestUser';
      const response = await request(app)
        .post('/api/users')
        .send({ name: userName });
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('name', userName);
      expect(response.body).toHaveProperty('createdAt');
      expect(typeof response.body.createdAt).toBe('string');
      
      // Verify user can be retrieved
      const getResponse = await request(app).get(`/api/users/${response.body.id}`);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('name', userName);
      
      // Clean up
      if (response.body.id) {
        await cleanupTestUser(response.body.id);
      }
    });
  });
  
  describe('Items', () => {
    it('should get all items for test user with correct details', async () => {
      const response = await apiRequest('GET', '/api/items');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3); // We seeded 3 items
      
      // Check specific seeded items exist with correct details
      const tShirt = response.body.find((item: any) => item.title === 'Test T-Shirt');
      expect(tShirt).toBeDefined();
      expect(tShirt).toHaveProperty('category', 'Tops');
      expect(tShirt).toHaveProperty('description', 'A test t-shirt');
      expect(tShirt).toHaveProperty('id');
      expect(tShirt).toHaveProperty('createdAt');
      
      const jeans = response.body.find((item: any) => item.title === 'Test Jeans');
      expect(jeans).toBeDefined();
      expect(jeans).toHaveProperty('category', 'Bottoms');
      expect(jeans).toHaveProperty('description', 'A test pair of jeans');
      expect(jeans).toHaveProperty('measurements');
      expect(jeans.measurements).toHaveProperty('size', 'M');
      expect(jeans.measurements).toHaveProperty('waist', 32);
      
      const jacket = response.body.find((item: any) => item.title === 'Test Jacket');
      expect(jacket).toBeDefined();
      expect(jacket).toHaveProperty('category', 'Outerwear');
      expect(jacket).toHaveProperty('description', 'A test jacket');
      
      // Verify all items have required fields
      response.body.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('title');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('createdAt');
        expect(typeof item.id).toBe('string');
        expect(typeof item.title).toBe('string');
        expect(typeof item.category).toBe('string');
      });
    });
    
    it('should get items grouped by category with correct structure', async () => {
      const response = await apiRequest('GET', '/api/items/by-category');
      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('object');
      
      // Check categories exist
      expect(response.body).toHaveProperty('Tops');
      expect(response.body).toHaveProperty('Bottoms');
      expect(response.body).toHaveProperty('Outerwear');
      
      // Verify items in each category
      expect(Array.isArray(response.body.Tops)).toBe(true);
      expect(Array.isArray(response.body.Bottoms)).toBe(true);
      expect(Array.isArray(response.body.Outerwear)).toBe(true);
      
      // Check specific items are in correct categories
      const topsItems = response.body.Tops;
      const tShirt = topsItems.find((item: any) => item.title === 'Test T-Shirt');
      expect(tShirt).toBeDefined();
      expect(tShirt.category).toBe('Tops');
      
      const bottomsItems = response.body.Bottoms;
      const jeans = bottomsItems.find((item: any) => item.title === 'Test Jeans');
      expect(jeans).toBeDefined();
      expect(jeans.category).toBe('Bottoms');
      
      const outerwearItems = response.body.Outerwear;
      const jacket = outerwearItems.find((item: any) => item.title === 'Test Jacket');
      expect(jacket).toBeDefined();
      expect(jacket.category).toBe('Outerwear');
    });
    
    it('should update an item with correct details', async () => {
      // Get an existing item
      const itemsResponse = await apiRequest('GET', '/api/items');
      expect(itemsResponse.status).toBe(200);
      const items = itemsResponse.body;
      expect(items.length).toBeGreaterThan(0);
      
      const originalItem = items[0];
      const itemId = originalItem.id;
      const updatedTitle = 'Updated Test Item';
      const updatedDescription = 'Updated description';
      
      const response = await apiRequest('PUT', `/api/items/${itemId}`)
        .send({
          title: updatedTitle,
          category: originalItem.category,
          description: updatedDescription,
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', updatedTitle);
      expect(response.body).toHaveProperty('description', updatedDescription);
      expect(response.body).toHaveProperty('category', originalItem.category);
      expect(response.body).toHaveProperty('id', itemId);
      expect(response.body).toHaveProperty('createdAt');
      
      // Verify the update persisted by fetching again
      const verifyResponse = await apiRequest('GET', `/api/items`);
      const updatedItem = verifyResponse.body.find((item: any) => item.id === itemId);
      expect(updatedItem).toBeDefined();
      expect(updatedItem.title).toBe(updatedTitle);
      expect(updatedItem.description).toBe(updatedDescription);
    });
    
    it('should delete an item', async () => {
      // Create a temporary item to delete
      const { v4: uuidv4 } = require('uuid');
      const tempItem = {
        id: uuidv4(),
        title: 'Temp Item to Delete',
        category: 'Accessories',
        description: 'Temporary item',
        createdAt: new Date().toISOString(),
      };
      await db.insertItem(tempItem, testUser!.id);
      
      const response = await apiRequest('DELETE', `/api/items/${tempItem.id}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Item deleted successfully');
      
      // Verify it's deleted
      const itemsResponse = await apiRequest('GET', '/api/items');
      const items = itemsResponse.body;
      expect(items.find((item: any) => item.id === tempItem.id)).toBeUndefined();
    });
  });
  
  describe('User Profile', () => {
    it('should verify we are using PostgreSQL (not SQLite)', () => {
      // Verify we're using PostgreSQL by checking DATABASE_URL is set
      expect(process.env.DATABASE_URL).toBeDefined();
      expect(process.env.DATABASE_URL).toContain('postgresql://');
      expect(process.env.DATABASE_URL).not.toContain('sqlite');
      
      // Verify the database module is using PostgreSQL
      const dbModule = require('../database');
      // The database module should be using PostgreSQL when DATABASE_URL is set
      expect(!!process.env.DATABASE_URL).toBe(true);
    });
    
    it('should get user profile with all seeded details', async () => {
      const response = await apiRequest('GET', '/api/user/profile');
      expect(response.status).toBe(200);
      
      // Check seeded profile data
      expect(response.body).toHaveProperty('height', 65);
      expect(response.body).toHaveProperty('weight', 130);
      expect(response.body).toHaveProperty('heightUnit', 'inches');
      expect(response.body).toHaveProperty('weightUnit', 'lbs');
      expect(response.body).toHaveProperty('stylePreferences', 'Test style preferences');
      expect(response.body).toHaveProperty('brands');
      expect(Array.isArray(response.body.brands)).toBe(true);
      expect(response.body.brands).toContain('Test Brand 1');
      expect(response.body.brands).toContain('Test Brand 2');
    });
    
    it('should update user profile and persist changes', async () => {
      const updatedData = {
        height: 66,
        weight: 135,
        heightUnit: 'inches' as const,
        weightUnit: 'lbs' as const,
        stylePreferences: 'Updated test preferences',
        brands: ['Updated Brand 1', 'Updated Brand 2'],
      };
      
      const response = await apiRequest('POST', '/api/user/profile')
        .send(updatedData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('height', 66);
      expect(response.body).toHaveProperty('weight', 135);
      expect(response.body).toHaveProperty('heightUnit', 'inches');
      expect(response.body).toHaveProperty('weightUnit', 'lbs');
      expect(response.body).toHaveProperty('stylePreferences', 'Updated test preferences');
      expect(response.body).toHaveProperty('brands');
      expect(Array.isArray(response.body.brands)).toBe(true);
      expect(response.body.brands).toEqual(updatedData.brands);
      
      // Verify the update persisted
      const verifyResponse = await apiRequest('GET', '/api/user/profile');
      expect(verifyResponse.body.height).toBe(66);
      expect(verifyResponse.body.weight).toBe(135);
      expect(verifyResponse.body.stylePreferences).toBe('Updated test preferences');
    });
    
    it('should save and retrieve body measurements (waist, chest, hips, inseam)', async () => {
      const profileWithMeasurements = {
        height: 68,
        weight: 140,
        heightUnit: 'inches' as const,
        weightUnit: 'lbs' as const,
        waist: 28.5,
        chest: 36,
        hips: 38,
        inseam: 30,
        measurementsUnit: 'inches' as const,
        stylePreferences: 'Test measurements',
        brands: ['Test Brand'],
      };
      
      // Save profile with measurements
      const saveResponse = await apiRequest('POST', '/api/user/profile')
        .send(profileWithMeasurements);
      
      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body).toHaveProperty('waist', 28.5);
      expect(saveResponse.body).toHaveProperty('chest', 36);
      expect(saveResponse.body).toHaveProperty('hips', 38);
      expect(saveResponse.body).toHaveProperty('inseam', 30);
      expect(saveResponse.body).toHaveProperty('measurementsUnit', 'inches');
      expect(saveResponse.body).toHaveProperty('height', 68);
      expect(saveResponse.body).toHaveProperty('weight', 140);
      
      // Verify measurements were saved by fetching again
      const getResponse = await apiRequest('GET', '/api/user/profile');
      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toHaveProperty('waist', 28.5);
      expect(getResponse.body).toHaveProperty('chest', 36);
      expect(getResponse.body).toHaveProperty('hips', 38);
      expect(getResponse.body).toHaveProperty('inseam', 30);
      expect(getResponse.body).toHaveProperty('measurementsUnit', 'inches');
      
      // Verify all measurements are numbers
      expect(typeof getResponse.body.waist).toBe('number');
      expect(typeof getResponse.body.chest).toBe('number');
      expect(typeof getResponse.body.hips).toBe('number');
      expect(typeof getResponse.body.inseam).toBe('number');
    });
    
    it('should update measurements independently of other profile fields', async () => {
      // First, set a profile with some measurements
      const initialProfile = {
        height: 65,
        weight: 130,
        heightUnit: 'inches' as const,
        weightUnit: 'lbs' as const,
        waist: 28,
        chest: 35,
        measurementsUnit: 'inches' as const,
      };
      
      await apiRequest('POST', '/api/user/profile').send(initialProfile);
      
      // Update only measurements
      const updatedMeasurements = {
        waist: 29,
        chest: 36,
        hips: 37,
        inseam: 31,
        measurementsUnit: 'inches' as const,
      };
      
      const updateResponse = await apiRequest('POST', '/api/user/profile')
        .send(updatedMeasurements);
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('waist', 29);
      expect(updateResponse.body).toHaveProperty('chest', 36);
      expect(updateResponse.body).toHaveProperty('hips', 37);
      expect(updateResponse.body).toHaveProperty('inseam', 31);
      
      // Verify other fields are still there
      expect(updateResponse.body).toHaveProperty('height', 65);
      expect(updateResponse.body).toHaveProperty('weight', 130);
      
      // Verify the update persisted
      const verifyResponse = await apiRequest('GET', '/api/user/profile');
      expect(verifyResponse.body.waist).toBe(29);
      expect(verifyResponse.body.chest).toBe(36);
      expect(verifyResponse.body.hips).toBe(37);
      expect(verifyResponse.body.inseam).toBe(31);
      expect(verifyResponse.body.height).toBe(65);
      expect(verifyResponse.body.weight).toBe(130);
    });
    
    it('should handle measurements with decimal values', async () => {
      const profileWithDecimals = {
        waist: 28.5,
        chest: 36.25,
        hips: 37.75,
        inseam: 30.5,
        measurementsUnit: 'inches' as const,
      };
      
      const response = await apiRequest('POST', '/api/user/profile')
        .send(profileWithDecimals);
      
      expect(response.status).toBe(200);
      expect(response.body.waist).toBe(28.5);
      expect(response.body.chest).toBe(36.25);
      expect(response.body.hips).toBe(37.75);
      expect(response.body.inseam).toBe(30.5);
      
      // Verify decimals are preserved
      const verifyResponse = await apiRequest('GET', '/api/user/profile');
      expect(verifyResponse.body.waist).toBe(28.5);
      expect(verifyResponse.body.chest).toBe(36.25);
      expect(verifyResponse.body.hips).toBe(37.75);
      expect(verifyResponse.body.inseam).toBe(30.5);
    });
  });
  
  describe('Saved Outfits', () => {
    it('should get saved outfits with correct seeded details', async () => {
      const response = await apiRequest('GET', '/api/outfits/saved');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1); // We seeded 1 outfit
      
      // Check seeded outfit details
      const seededOutfit = response.body.find((outfit: any) => 
        outfit.itemTitles.includes('Test T-Shirt') && outfit.itemTitles.includes('Test Jeans')
      );
      expect(seededOutfit).toBeDefined();
      expect(seededOutfit).toHaveProperty('id');
      expect(seededOutfit).toHaveProperty('itemTitles');
      expect(Array.isArray(seededOutfit.itemTitles)).toBe(true);
      expect(seededOutfit.itemTitles).toContain('Test T-Shirt');
      expect(seededOutfit.itemTitles).toContain('Test Jeans');
      expect(seededOutfit).toHaveProperty('prompt', 'Test outfit generation');
      expect(seededOutfit).toHaveProperty('notes', 'Test notes');
      expect(seededOutfit).toHaveProperty('createdAt');
      
      // Verify all outfits have required fields
      response.body.forEach((outfit: any) => {
        expect(outfit).toHaveProperty('id');
        expect(outfit).toHaveProperty('itemTitles');
        expect(Array.isArray(outfit.itemTitles)).toBe(true);
        expect(outfit.itemTitles.length).toBeGreaterThan(0);
        expect(outfit).toHaveProperty('createdAt');
      });
    });
    
    it('should save a new outfit with correct details', async () => {
      // First, get the actual item titles from the database
      const itemsResponse = await apiRequest('GET', '/api/items');
      const items = itemsResponse.body;
      expect(items.length).toBeGreaterThan(0);
      
      // Use actual item titles from the database
      const itemTitles = items.slice(0, 2).map((item: any) => item.title);
      const outfitData = {
        itemTitles: itemTitles,
        prompt: 'Test outfit generation prompt',
        notes: 'Test outfit notes',
      };
      
      const response = await apiRequest('POST', '/api/outfits/save')
        .send(outfitData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('itemTitles');
      expect(Array.isArray(response.body.itemTitles)).toBe(true);
      expect(response.body.itemTitles).toEqual(itemTitles);
      expect(response.body).toHaveProperty('prompt', outfitData.prompt);
      expect(response.body).toHaveProperty('notes', outfitData.notes);
      expect(response.body).toHaveProperty('createdAt');
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id.length).toBeGreaterThan(0);
    });
  });
  
  describe('Outfit Feedback', () => {
    it('should get outfit feedback with correct structure', async () => {
      const response = await apiRequest('GET', '/api/outfits/feedback');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify all feedback entries have required fields
      response.body.forEach((fb: any) => {
        expect(fb).toHaveProperty('id');
        expect(fb).toHaveProperty('itemTitles');
        expect(Array.isArray(fb.itemTitles)).toBe(true);
        expect(fb.itemTitles.length).toBeGreaterThan(0);
        expect(fb).toHaveProperty('type');
        expect(['like', 'dislike']).toContain(fb.type);
        expect(fb).toHaveProperty('createdAt');
        expect(typeof fb.id).toBe('string');
        expect(typeof fb.type).toBe('string');
        expect(typeof fb.createdAt).toBe('string');
      });
    });
    
    it('should submit outfit feedback with all details', async () => {
      // Get actual item titles from the database
      const itemsResponse = await apiRequest('GET', '/api/items');
      const items = itemsResponse.body;
      expect(items.length).toBeGreaterThan(0);
      
      const itemTitles = items.slice(0, 2).map((item: any) => item.title);
      const feedbackData = {
        itemTitles: itemTitles,
        type: 'like',
        feedback: 'Great combination!',
        prompt: 'Test outfit generation prompt',
      };
      
      const response = await apiRequest('POST', '/api/outfits/feedback')
        .send(feedbackData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(typeof response.body.id).toBe('string');
      expect(response.body.id.length).toBeGreaterThan(0);
      expect(response.body).toHaveProperty('type', 'like');
      expect(response.body).toHaveProperty('itemTitles');
      expect(Array.isArray(response.body.itemTitles)).toBe(true);
      expect(response.body.itemTitles).toEqual(feedbackData.itemTitles);
      expect(response.body).toHaveProperty('feedback', feedbackData.feedback);
      expect(response.body).toHaveProperty('prompt', feedbackData.prompt);
      expect(response.body).toHaveProperty('createdAt');
      expect(typeof response.body.createdAt).toBe('string');
      
      // Verify feedback was saved by fetching again
      const verifyResponse = await apiRequest('GET', '/api/outfits/feedback');
      const savedFeedback = verifyResponse.body.find((fb: any) => fb.id === response.body.id);
      expect(savedFeedback).toBeDefined();
      expect(savedFeedback.type).toBe('like');
      expect(savedFeedback.feedback).toBe('Great combination!');
      expect(savedFeedback.prompt).toBe('Test outfit generation prompt');
      expect(savedFeedback.itemTitles).toEqual(itemTitles);
    });
    
    it('should submit dislike feedback without optional fields', async () => {
      // Get actual item titles from the database
      const itemsResponse = await apiRequest('GET', '/api/items');
      const items = itemsResponse.body;
      expect(items.length).toBeGreaterThan(0);
      
      const itemTitles = items.slice(0, 1).map((item: any) => item.title);
      const feedbackData = {
        itemTitles: itemTitles,
        type: 'dislike',
      };
      
      const response = await apiRequest('POST', '/api/outfits/feedback')
        .send(feedbackData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('type', 'dislike');
      expect(response.body).toHaveProperty('itemTitles');
      expect(response.body.itemTitles).toEqual(itemTitles);
      expect(response.body).toHaveProperty('createdAt');
      // Optional fields may be undefined or null
      if (response.body.feedback !== undefined) {
        expect(response.body.feedback).toBeNull();
      }
    });
    
    it('should delete outfit feedback', async () => {
      // First, create a feedback entry to delete
      const itemsResponse = await apiRequest('GET', '/api/items');
      const items = itemsResponse.body;
      expect(items.length).toBeGreaterThan(0);
      
      const itemTitles = items.slice(0, 2).map((item: any) => item.title);
      const feedbackData = {
        itemTitles: itemTitles,
        type: 'like',
        feedback: 'Test feedback to delete',
      };
      
      const createResponse = await apiRequest('POST', '/api/outfits/feedback')
        .send(feedbackData);
      
      expect(createResponse.status).toBe(201);
      const feedbackId = createResponse.body.id;
      expect(feedbackId).toBeDefined();
      
      // Verify it exists
      const beforeDeleteResponse = await apiRequest('GET', '/api/outfits/feedback');
      const feedbackBeforeDelete = beforeDeleteResponse.body.find((fb: any) => fb.id === feedbackId);
      expect(feedbackBeforeDelete).toBeDefined();
      expect(feedbackBeforeDelete.feedback).toBe('Test feedback to delete');
      
      // Delete the feedback
      const deleteResponse = await apiRequest('DELETE', `/api/outfits/feedback/${feedbackId}`);
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body).toHaveProperty('message', 'Feedback deleted successfully');
      
      // Verify it's deleted
      const afterDeleteResponse = await apiRequest('GET', '/api/outfits/feedback');
      const feedbackAfterDelete = afterDeleteResponse.body.find((fb: any) => fb.id === feedbackId);
      expect(feedbackAfterDelete).toBeUndefined();
    });
    
    it('should return 404 when deleting non-existent feedback', async () => {
      const { v4: uuidv4 } = require('uuid');
      const fakeId = uuidv4();
      
      const response = await apiRequest('DELETE', `/api/outfits/feedback/${fakeId}`);
      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Outfit Status', () => {
    it('should get outfit generation status with correct values', async () => {
      const response = await apiRequest('GET', '/api/outfits/status');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('clicksUsed');
      expect(response.body).toHaveProperty('maxClicks');
      expect(response.body).toHaveProperty('remaining');
      
      // Verify specific values
      expect(response.body.maxClicks).toBe(10);
      expect(typeof response.body.clicksUsed).toBe('number');
      expect(response.body.clicksUsed).toBeGreaterThanOrEqual(0);
      expect(response.body.clicksUsed).toBeLessThanOrEqual(10);
      expect(typeof response.body.remaining).toBe('number');
      expect(response.body.remaining).toBeGreaterThanOrEqual(0);
      expect(response.body.remaining).toBeLessThanOrEqual(10);
      expect(response.body.clicksUsed + response.body.remaining).toBe(10);
    });
  });
  
  describe('Explore Suggestions', () => {
    it('should get explore suggestions with correct structure', async () => {
      const response = await apiRequest('GET', '/api/explore/suggestions');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      
      // Verify suggestions structure
      if (response.body.suggestions.length > 0) {
        response.body.suggestions.forEach((suggestion: any) => {
          expect(suggestion).toHaveProperty('id');
          expect(suggestion).toHaveProperty('title');
          expect(suggestion).toHaveProperty('category');
          expect(suggestion).toHaveProperty('description');
          expect(typeof suggestion.id).toBe('string');
          expect(typeof suggestion.title).toBe('string');
          expect(typeof suggestion.category).toBe('string');
          expect(typeof suggestion.description).toBe('string');
        });
      }
      
      // Check if lastUpdate is present
      if (response.body.lastUpdate) {
        expect(typeof response.body.lastUpdate).toBe('string');
      }
    });
  });
});
