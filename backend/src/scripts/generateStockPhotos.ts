import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_IMAGE_SIZES = new Set([
  '1024x1024',
  '1024x1536',
  '1536x1024',
  'auto',
]);

const DEFAULT_IMAGE_SIZE = '1024x1024' as const;
const DEFAULT_IMAGE_MODEL = 'gpt-image-1-mini';
const DEFAULT_BUCKET = 'wardrobe-images';
const DEFAULT_PROMPT_SPEC = 'src/scripts/json/stockPhotoPrompts.json';

function normalizeImageSize(value: string | undefined): typeof DEFAULT_IMAGE_SIZE | string {
  if (!value) return DEFAULT_IMAGE_SIZE;
  return ALLOWED_IMAGE_SIZES.has(value) ? value : DEFAULT_IMAGE_SIZE;
}

type Spec = {
  wardrobe_categories?: Array<{
    category: string;
    subcategories?: Array<{
      name: string;
      gender?: string[];
      image_type?: string;
      prompt_template: string;
      aspect_ratio?: string;
      variations?: number;
    }>;
  }>;
};

const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!openaiApiKey) throw new Error('Missing OPENAI_API_KEY');
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseAnonKey) throw new Error('Missing SUPABASE_ANON_KEY');

const IMAGE_SIZE = normalizeImageSize(process.env.IMAGE_SIZE);
const IMAGE_MODEL = process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
const PROMPTS_JSON = process.env.PROMPTS_JSON || DEFAULT_PROMPT_SPEC;

const openai = new OpenAI({ apiKey: openaiApiKey });
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[\/\\]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '');
}

function buildPrompt(base: string, gender: string, imageType?: string): string {
  const genderString = gender || 'unisex';
  let prompt = base.replace(/\{gender\}/gi, genderString.toLowerCase());
  prompt += ' all-black palette, matte textures, minimal neutral background, controlled studio lighting, cohesive avant-garde aesthetic.';

  if (imageType?.toLowerCase().includes('product-only')) {
    prompt += ' product-only e-commerce angle, soft seamless shadow.';
  } else if (imageType?.toLowerCase().includes('macro')) {
    prompt += ' macro close-up, shallow depth of field, crisp texture.';
  } else if (imageType?.toLowerCase().includes('full-body')) {
    prompt += ' full-body framing, neutral pose.';
  }

  return prompt;
}

async function generatePng(prompt: string, size: string): Promise<Buffer> {
  const response = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: size as Parameters<typeof openai.images.generate>[0]['size'],
    n: 1,
  });

  const imageData = response.data?.[0];
  if (!imageData) {
    throw new Error('OpenAI image generation returned empty data');
  }

  if (imageData.b64_json) {
    return Buffer.from(imageData.b64_json, 'base64');
  }

  if (imageData.url) {
    const urlResponse = await fetch(imageData.url);
    if (!urlResponse.ok) {
      throw new Error(`Failed to download image from url (${urlResponse.status})`);
    }
    return Buffer.from(await urlResponse.arrayBuffer());
  }

  throw new Error('OpenAI image response missing both b64_json and url');
}

async function uploadToSupabase(folder: string, png: Buffer): Promise<string> {
  const filename = `${randomUUID()}.png`;
  const storagePath = `${folder}/${filename}`;

  const { error, data } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(storagePath, png, { contentType: 'image/png', upsert: false });

  if (error) throw error;

  return data?.path || storagePath;
}

function ensurePositiveInteger(value: unknown, fallback = 1): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.floor(parsed));
}

async function runBatch(jsonPath: string) {
  console.info(`[SETUP] Reading prompt spec from ${jsonPath}`);
  const raw = fs.readFileSync(path.resolve(jsonPath), 'utf-8');
  const spec: Spec = JSON.parse(raw);

  let ok = 0;
  let fail = 0;

  const categories = spec.wardrobe_categories ?? [];
  console.info(`[INFO] Generating images for ${categories.length} categories (model=${IMAGE_MODEL}, size=${IMAGE_SIZE}).`);

  for (const group of categories) {
    const category = group.category?.trim();
    if (!category) continue;

    console.info(`\n[CATEGORY] ${category}`);

    for (const sub of group.subcategories ?? []) {
      const subcategory = sub.name?.trim();
      const promptTemplate = sub.prompt_template?.trim();
      if (!subcategory || !promptTemplate) {
        console.warn(`[SKIP] ${category} -> missing subcategory name or prompt.`);
        continue;
      }

      const genders = sub.gender && sub.gender.length > 0 ? sub.gender : ['Unisex'];
      const imageType = sub.image_type || 'Full-body';
      const variations = ensurePositiveInteger(sub.variations, 1);

      console.info(`  [SUBCATEGORY] ${subcategory} (genders=${genders.join(', ')}, variations=${variations}, type=${imageType})`);

      for (const gender of genders) {
        const genderPrefix = gender && gender.toLowerCase() !== 'unisex' ? `${slugify(gender)}-` : '';
        const folder = `${genderPrefix}${slugify(category)}-${slugify(subcategory)}`;

        console.info(`    [GENDER] ${gender} -> folder=${folder}`);

        for (let i = 0; i < variations; i++) {
          const prompt = buildPrompt(promptTemplate, gender, imageType);
          console.info(`      [VARIATION ${i + 1}/${variations}] Prompt preview: ${prompt.slice(0, 120)}...`);

          try {
            const png = await generatePng(prompt, IMAGE_SIZE);
            const storagePath = await uploadToSupabase(folder, png);
            ok += 1;
            console.info(`      [OK] Uploaded to ${storagePath}`);
          } catch (error) {
            fail += 1;
            const message = error instanceof Error ? error.message : String(error);
            console.error(`      [ERROR] ${folder}: ${message}`);
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        }
      }
    }
  }

  console.info(`\n✅ Finished generating stock photos. Created=${ok}, Failed=${fail}`);
}

runBatch(PROMPTS_JSON).catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
