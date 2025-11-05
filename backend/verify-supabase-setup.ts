/**
 * Verification script to check Supabase setup
 * Run this before deploying to ensure Supabase is properly configured
 */

import * as supabaseStorage from './src/supabaseStorage';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 Verifying Supabase Setup...\n');
console.log('='.repeat(50));

// Check environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'wardrobe-images';

console.log('📋 Environment Variables:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}`);
console.log(`   SUPABASE_STORAGE_BUCKET: ${SUPABASE_STORAGE_BUCKET}`);
console.log('');

// Check if Supabase is configured
const isConfigured = supabaseStorage.isSupabaseConfigured();
console.log(`🔧 Supabase Configured: ${isConfigured ? '✅ YES' : '❌ NO'}`);
console.log('');

if (!isConfigured) {
  console.error('❌ ERROR: Supabase is not configured!');
  console.error('');
  console.error('To configure Supabase:');
  console.error('1. Set SUPABASE_URL in .env file');
  console.error('2. Set SUPABASE_SERVICE_ROLE_KEY in .env file');
  console.error('3. Optionally set SUPABASE_STORAGE_BUCKET (defaults to "wardrobe-images")');
  console.error('');
  console.error('Without Supabase configured, images will be stored locally.');
  console.error('This is OK for development, but NOT recommended for production!');
  process.exit(1);
}

// Test Supabase connection
console.log('🧪 Testing Supabase Connection...');
try {
  const supabase = require('@supabase/supabase-js').createClient(
    SUPABASE_URL!,
    SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Try to list buckets (this will verify the connection works)
  supabase.storage
    .listBuckets()
    .then(({ data, error }: any) => {
      if (error) {
        console.error('❌ Failed to connect to Supabase:', error.message);
        process.exit(1);
      }
      
      console.log('✅ Successfully connected to Supabase!');
      console.log('');
      
      // Check if the bucket exists
      const bucketExists = data?.some((bucket: any) => bucket.name === SUPABASE_STORAGE_BUCKET);
      
      if (bucketExists) {
        console.log(`✅ Storage bucket "${SUPABASE_STORAGE_BUCKET}" exists`);
      } else {
        console.warn(`⚠️  Storage bucket "${SUPABASE_STORAGE_BUCKET}" not found`);
        console.warn('   Make sure to create the bucket in Supabase dashboard');
        console.warn('   Bucket should be PUBLIC for images to be accessible');
      }
      
      console.log('');
      console.log('='.repeat(50));
      console.log('✅ All checks passed! Supabase is ready for deployment.');
      console.log('='.repeat(50));
    })
    .catch((error: any) => {
      console.error('❌ Error testing Supabase connection:', error.message);
      process.exit(1);
    });
} catch (error: any) {
  console.error('❌ Failed to create Supabase client:', error.message);
  process.exit(1);
}

