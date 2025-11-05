import * as db from '../database';
import * as supabaseStorage from '../supabaseStorage';
import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Migrate existing local images to Supabase Storage
 * Updates all image URLs in the database to point to Supabase
 */
async function migrateToSupabase() {
  console.log('🚀 Starting migration to Supabase Storage...\n');

  // Check if Supabase is configured
  if (!supabaseStorage.isSupabaseConfigured()) {
    console.error('❌ Supabase is not configured!');
    console.error('Please set the following environment variables:');
    console.error('  - SUPABASE_URL');
    console.error('  - SUPABASE_SERVICE_ROLE_KEY');
    console.error('  - SUPABASE_STORAGE_BUCKET (optional, defaults to "wardrobe-images")');
    process.exit(1);
  }

  // Check if uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌ Uploads directory not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  // Get all items with local image URLs
  const allItems = db.getAllItems();
  const itemsWithImages = allItems.filter(item => 
    item.imageUrl && 
    (item.imageUrl.startsWith('/uploads/') || item.imageUrl.includes('localhost'))
  );

  console.log(`📊 Found ${itemsWithImages.length} items with local image URLs\n`);

  if (itemsWithImages.length === 0) {
    console.log('✅ No items to migrate!');
    return;
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  // Process each item
  for (const item of itemsWithImages) {
    try {
      // TypeScript doesn't narrow after filter, so check again
      if (!item.imageUrl) continue;
      
      const localPath = item.imageUrl.replace('/uploads/', '');
      const filePath = path.join(UPLOADS_DIR, localPath);

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${filePath} (item: ${item.title})`);
        // Remove invalid imageUrl from database
        db.updateItem(item.id, { imageUrl: undefined });
        errorCount++;
        errors.push(`Item "${item.title}" (${item.id}): File not found`);
        continue;
      }

      // Read file
      const fileBuffer = fs.readFileSync(filePath);
      const fileName = path.basename(filePath);

      console.log(`📤 Uploading: ${fileName} (item: "${item.title}")`);

      // Upload to Supabase
      const supabaseUrl = await supabaseStorage.uploadBuffer(
        fileBuffer,
        fileName,
        getContentType(fileName)
      );

      // Update database with new URL
      db.updateItem(item.id, { imageUrl: supabaseUrl });

      console.log(`✅ Uploaded: ${supabaseUrl}`);
      successCount++;

    } catch (error) {
      console.error(`❌ Error migrating item "${item.title}" (${item.id}):`, error);
      errorCount++;
      errors.push(`Item "${item.title}" (${item.id}): ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successfully migrated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log('='.repeat(50));

  if (errors.length > 0) {
    console.log('\n❌ Errors encountered:');
    errors.forEach(error => console.log(`   - ${error}`));
  }

  // Ask about deleting local files
  if (successCount > 0) {
    console.log('\n💡 Tip: After verifying all images are working in Supabase,');
    console.log('   you can delete the local uploads directory to save space.');
  }

  console.log('\n✅ Migration complete!');
}

function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return contentTypes[ext] || 'image/jpeg';
}

// Run migration
migrateToSupabase()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

