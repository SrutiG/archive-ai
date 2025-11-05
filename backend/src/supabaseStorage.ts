import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'wardrobe-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Supabase credentials not set. Image uploads will fail.');
}

// Create Supabase client with service role key (has admin privileges)
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
    }
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }
  return supabaseClient;
}

/**
 * Upload a file to Supabase Storage
 * @param filePath Local file path to upload
 * @param fileName Name for the file in storage (can include path)
 * @returns Public URL of the uploaded file
 */
export async function uploadFile(filePath: string, fileName: string): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
    // Read file from local path
    const fileBuffer = fs.readFileSync(filePath);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: getContentType(fileName),
        upsert: false // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading file to Supabase:', error);
    throw error;
  }
}

/**
 * Upload a file buffer directly to Supabase Storage
 * @param buffer File buffer
 * @param fileName Name for the file in storage
 * @param contentType MIME type of the file
 * @returns Public URL of the uploaded file
 */
export async function uploadBuffer(
  buffer: Buffer,
  fileName: string,
  contentType: string
): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, buffer, {
        contentType,
        upsert: false
      });

    if (error) {
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading buffer to Supabase:', error);
    throw error;
  }
}

/**
 * Delete a file from Supabase Storage
 * @param filePath Path to the file in storage (relative to bucket)
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    // Extract path from URL if full URL is provided
    const storagePath = extractStoragePath(filePath);
    
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.warn(`Failed to delete file from Supabase: ${error.message} (file: ${storagePath})`);
      // Don't throw - file might not exist
    } else {
      console.log(`Deleted file from Supabase: ${storagePath}`);
    }
  } catch (error) {
    console.error('Error deleting file from Supabase:', error);
    // Don't throw - deletion failures shouldn't break the app
  }
}

/**
 * Extract storage path from a Supabase public URL or local path
 */
function extractStoragePath(filePath: string): string {
  // If it's a Supabase URL, extract the path
  if (filePath.includes('supabase.co/storage/v1/object/public/')) {
    const parts = filePath.split('/object/public/');
    if (parts.length > 1) {
      const pathAfterBucket = parts[1].split('/').slice(1); // Remove bucket name
      return pathAfterBucket.join('/');
    }
  }
  
  // If it's a local path like /uploads/filename, extract just the filename
  if (filePath.startsWith('/uploads/')) {
    return path.basename(filePath);
  }
  
  // Otherwise, assume it's already a storage path (filename only)
  return path.basename(filePath);
}

/**
 * Get content type from file extension
 */
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

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

