import * as sqliteDb from '../databaseSQLite';
import * as postgresDb from '../databasePostgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Migrate data from SQLite to PostgreSQL
 */
async function migrateToPostgres() {
  console.log('🚀 Starting migration from SQLite to PostgreSQL...\n');

  // Check if PostgreSQL is configured
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set!');
    console.error('Please set DATABASE_URL in your .env file');
    console.error('Example: DATABASE_URL=postgresql://postgres:password@host:5432/postgres');
    process.exit(1);
  }

  // Initialize PostgreSQL schema
  console.log('📋 Initializing PostgreSQL schema...');
  try {
    await postgresDb.initializeSchema();
    console.log('✅ Schema initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize schema:', error);
    process.exit(1);
  }

  let totalMigrated = 0;
  let errors: string[] = [];

  // Migrate users
  console.log('👥 Migrating users...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    for (const user of users) {
      try {
        await postgresDb.createUser(user.id, user.name, user.created_at);
        totalMigrated++;
      } catch (error: any) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`  User ${user.name} already exists, skipping...`);
        } else {
          errors.push(`User ${user.name}: ${error.message}`);
        }
      }
    }
    console.log(`✅ Migrated ${totalMigrated} users\n`);
  } catch (error) {
    console.error('❌ Error migrating users:', error);
    errors.push(`Users: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate user data
  console.log('📊 Migrating user data...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    for (const user of users) {
      try {
        const userData = await sqliteDb.getUserData(user.id) as any;
        if (userData) {
          await postgresDb.updateUserData(
            user.id,
            userData.outfit_generation_clicks || 0,
            userData.last_click_reset_date || new Date().toDateString()
          );
        }
      } catch (error: any) {
        errors.push(`User data for ${user.name}: ${error.message}`);
      }
    }
    console.log('✅ Migrated user data\n');
  } catch (error) {
    console.error('❌ Error migrating user data:', error);
    errors.push(`User data: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate user profiles
  console.log('👤 Migrating user profiles...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    let profileCount = 0;
    for (const user of users) {
      try {
        const profile = await sqliteDb.getProfile(user.id) as any;
        if (profile) {
          await postgresDb.upsertProfile(user.id, profile);
          profileCount++;
        }
      } catch (error: any) {
        errors.push(`Profile for ${user.name}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${profileCount} profiles\n`);
  } catch (error) {
    console.error('❌ Error migrating profiles:', error);
    errors.push(`Profiles: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate wardrobe items
  console.log('👕 Migrating wardrobe items...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    let itemCount = 0;
    for (const user of users) {
      try {
        const items = await sqliteDb.getItemsByUser(user.id) as any[];
        for (const item of items) {
          try {
            await postgresDb.insertItem(item, user.id);
            itemCount++;
          } catch (error: any) {
            if (error.code === '23505') { // Unique constraint violation
              console.log(`  Item ${item.title} already exists, skipping...`);
            } else {
              errors.push(`Item ${item.title}: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        errors.push(`Items for ${user.name}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${itemCount} wardrobe items\n`);
  } catch (error) {
    console.error('❌ Error migrating items:', error);
    errors.push(`Items: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate saved outfits
  console.log('👗 Migrating saved outfits...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    let outfitCount = 0;
    for (const user of users) {
      try {
        const outfits = await sqliteDb.getSavedOutfits(user.id) as any[];
        for (const outfit of outfits) {
          try {
            await postgresDb.insertSavedOutfit(user.id, outfit);
            outfitCount++;
          } catch (error: any) {
            if (error.code === '23505') {
              console.log(`  Outfit ${outfit.id} already exists, skipping...`);
            } else {
              errors.push(`Outfit ${outfit.id}: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        errors.push(`Outfits for ${user.name}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${outfitCount} saved outfits\n`);
  } catch (error) {
    console.error('❌ Error migrating outfits:', error);
    errors.push(`Outfits: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate outfit feedback
  console.log('💬 Migrating outfit feedback...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    let feedbackCount = 0;
    for (const user of users) {
      try {
        const feedback = await sqliteDb.getFeedback(user.id) as any[];
        for (const fb of feedback) {
          try {
            await postgresDb.insertFeedback(user.id, fb);
            feedbackCount++;
          } catch (error: any) {
            if (error.code === '23505') {
              console.log(`  Feedback ${fb.id} already exists, skipping...`);
            } else {
              errors.push(`Feedback ${fb.id}: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        errors.push(`Feedback for ${user.name}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${feedbackCount} feedback entries\n`);
  } catch (error) {
    console.error('❌ Error migrating feedback:', error);
    errors.push(`Feedback: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate explore suggestions
  console.log('🔍 Migrating explore suggestions...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    let suggestionCount = 0;
    for (const user of users) {
      try {
        const suggestions = await sqliteDb.getExploreSuggestions(user.id) as any[];
        for (const suggestion of suggestions) {
          try {
            await postgresDb.insertExploreSuggestion(user.id, suggestion);
            suggestionCount++;
          } catch (error: any) {
            if (error.code === '23505') {
              console.log(`  Suggestion ${suggestion.id} already exists, skipping...`);
            } else {
              errors.push(`Suggestion ${suggestion.id}: ${error.message}`);
            }
          }
        }
      } catch (error: any) {
        errors.push(`Suggestions for ${user.name}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${suggestionCount} explore suggestions\n`);
  } catch (error) {
    console.error('❌ Error migrating suggestions:', error);
    errors.push(`Suggestions: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Migrate explore updates
  console.log('🕐 Migrating explore updates...');
  try {
    const users = await sqliteDb.getAllUsers() as any[];
    let updateCount = 0;
    for (const user of users) {
      try {
        const lastUpdate = await sqliteDb.getExploreUpdate(user.id) as string | null;
        if (lastUpdate) {
          await postgresDb.upsertExploreUpdate(user.id, lastUpdate);
          updateCount++;
        }
      } catch (error: any) {
        errors.push(`Explore update for ${user.name}: ${error.message}`);
      }
    }
    console.log(`✅ Migrated ${updateCount} explore updates\n`);
  } catch (error) {
    console.error('❌ Error migrating explore updates:', error);
    errors.push(`Explore updates: ${error instanceof Error ? error.message : String(error)}`);
  }

  // Summary
  console.log('='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Total records migrated: ${totalMigrated}`);
  console.log(`   ❌ Errors: ${errors.length}`);
  console.log('='.repeat(50));

  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.slice(0, 10).forEach(error => console.log(`   - ${error}`));
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`);
    }
  }

  // Close connections
  await postgresDb.closeDatabase();
  sqliteDb.closeDatabase();

  console.log('\n✅ Migration complete!');
}

// Run migration
migrateToPostgres()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

