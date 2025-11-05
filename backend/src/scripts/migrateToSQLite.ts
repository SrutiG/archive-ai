import fs from 'fs';
import path from 'path';
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';

const JSON_FILE = path.join(__dirname, '../../data/wardrobe.json');

console.log('🔄 Migrating data from JSON to SQLite...\n');

try {
  // Check if JSON file exists
  if (!fs.existsSync(JSON_FILE)) {
    console.log('❌ No JSON file found. Nothing to migrate.');
    process.exit(0);
  }

  // Load JSON data
  const jsonData = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
  
  console.log(`📦 Found JSON data:`);
  console.log(`   - Users: ${jsonData.userList?.length || 0}`);
  
  const transaction = db.transaction(() => {
    // Clear existing data
    db.exec('DELETE FROM explore_suggestions; DELETE FROM outfit_feedback; DELETE FROM saved_outfits; DELETE FROM wardrobe_items; DELETE FROM user_profiles; DELETE FROM user_data; DELETE FROM explore_updates; DELETE FROM users;');
    
    // Migrate users
    if (jsonData.userList && Array.isArray(jsonData.userList)) {
      for (const user of jsonData.userList) {
        console.log(`   Migrating user: ${user.name} (${user.id})`);
        
        // Insert user
        db.prepare('INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)').run(
          user.id,
          user.name,
          user.createdAt
        );
        
        // Get user data
        const userData = jsonData.users?.[user.id];
        if (userData) {
          // Insert user data
          db.prepare('INSERT INTO user_data (user_id, outfit_generation_clicks, last_click_reset_date) VALUES (?, ?, ?)').run(
            user.id,
            userData.outfitGenerationClicks || 0,
            userData.lastClickResetDate || new Date().toDateString()
          );
          
          // Migrate items
          if (userData.items && Array.isArray(userData.items)) {
            for (const item of userData.items) {
              db.prepare('INSERT INTO wardrobe_items (id, user_id, title, category, description, image_url, measurements, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
                item.id,
                user.id,
                item.title,
                item.category,
                item.description || null,
                item.imageUrl || null,
                item.measurements ? JSON.stringify(item.measurements) : null,
                item.createdAt
              );
            }
            console.log(`      ✅ Migrated ${userData.items.length} items`);
          }
          
          // Migrate profile
          if (userData.userProfile) {
            const profile = userData.userProfile;
            db.prepare(`
              INSERT INTO user_profiles (user_id, height, weight, height_unit, weight_unit, style_preferences, favorite_brands, shoe_size, measurements_unit, hair_color, hair_texture, skin_color)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              user.id,
              profile.height || null,
              profile.weight || null,
              profile.heightUnit || null,
              profile.weightUnit || null,
              profile.stylePreferences || null,
              (profile.brands || profile.favoriteBrands) ? JSON.stringify(profile.brands || profile.favoriteBrands) : null,
              profile.shoeSize || null,
              profile.measurementsUnit || null,
              profile.hairColor || null,
              profile.hairTexture || null,
              profile.skinColor || null
            );
            console.log(`      ✅ Migrated profile`);
          }
          
          // Migrate saved outfits
          if (userData.savedOutfits && Array.isArray(userData.savedOutfits)) {
            for (const outfit of userData.savedOutfits) {
              db.prepare('INSERT INTO saved_outfits (id, user_id, item_titles, prompt, notes, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
                outfit.id,
                user.id,
                JSON.stringify(outfit.itemTitles),
                outfit.prompt || null,
                outfit.notes || null,
                outfit.createdAt
              );
            }
            console.log(`      ✅ Migrated ${userData.savedOutfits.length} saved outfits`);
          }
          
          // Migrate feedback
          if (userData.outfitFeedback && Array.isArray(userData.outfitFeedback)) {
            for (const feedback of userData.outfitFeedback) {
              db.prepare('INSERT INTO outfit_feedback (id, user_id, item_titles, type, feedback, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                feedback.id,
                user.id,
                JSON.stringify(feedback.itemTitles),
                feedback.type,
                feedback.feedback || null,
                feedback.prompt || null,
                feedback.createdAt
              );
            }
            console.log(`      ✅ Migrated ${userData.outfitFeedback.length} feedback entries`);
          }
          
          // Migrate explore suggestions
          if (userData.exploreSuggestions && Array.isArray(userData.exploreSuggestions)) {
            for (const suggestion of userData.exploreSuggestions) {
              db.prepare('INSERT INTO explore_suggestions (id, user_id, title, category, description, brand, link, image_url, pairs_well_with, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                suggestion.id,
                user.id,
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
            console.log(`      ✅ Migrated ${userData.exploreSuggestions.length} explore suggestions`);
          }
          
          // Migrate explore update
          if (userData.lastExploreUpdate) {
            db.prepare('INSERT INTO explore_updates (user_id, last_update) VALUES (?, ?)').run(
              user.id,
              userData.lastExploreUpdate
            );
          }
        }
      }
    }
  });
  
  transaction();
  
  console.log('\n✅ Migration complete!');
  console.log('\n📊 Summary:');
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  const itemCount = db.prepare('SELECT COUNT(*) as count FROM wardrobe_items').get() as any;
  const outfitCount = db.prepare('SELECT COUNT(*) as count FROM saved_outfits').get() as any;
  const feedbackCount = db.prepare('SELECT COUNT(*) as count FROM outfit_feedback').get() as any;
  
  console.log(`   - Users: ${userCount.count}`);
  console.log(`   - Items: ${itemCount.count}`);
  console.log(`   - Saved Outfits: ${outfitCount.count}`);
  console.log(`   - Feedback: ${feedbackCount.count}`);
  
  // Create backup of JSON file
  const backupFile = `${JSON_FILE}.pre-sqlite.${Date.now()}`;
  fs.copyFileSync(JSON_FILE, backupFile);
  console.log(`\n💾 Created backup: ${path.basename(backupFile)}`);
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

