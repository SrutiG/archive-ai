/**
 * Script to delete all test users by name
 * This will delete users with names "IntegrationTestUser" or "NewTestUser"
 * and all their associated data (items, outfits, feedback, etc.)
 * 
 * WARNING: This will NOT delete users named "Sruti"
 */

import dotenv from 'dotenv';
import * as db from '../database';

dotenv.config();

const TEST_USER_NAMES = ['IntegrationTestUser', 'NewTestUser'];

async function deleteTestUsers() {
  console.log('🧹 Starting cleanup of test users...\n');
  
  try {
    // Initialize database schema if using PostgreSQL
    if (process.env.DATABASE_URL && typeof db.initializeSchema === 'function') {
      await db.initializeSchema();
    }
    
    // Get all users
    const allUsers = await db.getAllUsers();
    console.log(`📊 Total users in database: ${allUsers.length}`);
    
    // Find test users to delete
    const testUsers = allUsers.filter((user: any) => 
      TEST_USER_NAMES.includes(user.name)
    );
    
    if (testUsers.length === 0) {
      console.log('✅ No test users found to delete.');
      return;
    }
    
    console.log(`\n🗑️  Found ${testUsers.length} test user(s) to delete:`);
    testUsers.forEach((user: any) => {
      console.log(`   - ${user.name} (${user.id})`);
    });
    
    // Verify we're not deleting Sruti
    const srutiUsers = allUsers.filter((user: any) => user.name === 'Sruti');
    if (srutiUsers.length > 0) {
      console.log(`\n✅ Sruti user(s) will be preserved:`);
      srutiUsers.forEach((user: any) => {
        console.log(`   - ${user.name} (${user.id})`);
      });
    }
    
    // Delete test users (CASCADE will delete all related data)
    console.log(`\n🗑️  Deleting ${testUsers.length} test user(s)...`);
    let deletedCount = 0;
    
    for (const user of testUsers) {
      try {
        await db.deleteUser(user.id);
        deletedCount++;
        console.log(`   ✅ Deleted ${user.name} (${user.id})`);
      } catch (error) {
        console.error(`   ❌ Failed to delete ${user.name} (${user.id}):`, error);
      }
    }
    
    console.log(`\n✅ Cleanup complete! Deleted ${deletedCount} out of ${testUsers.length} test user(s).`);
    
    // Show remaining users
    const remainingUsers = await db.getAllUsers();
    console.log(`\n📊 Remaining users in database: ${remainingUsers.length}`);
    remainingUsers.forEach((user: any) => {
      console.log(`   - ${user.name} (${user.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    // Close database connection if using PostgreSQL
    if (typeof db.closeDatabase === 'function') {
      await db.closeDatabase();
    }
  }
}

// Run the script
deleteTestUsers();

