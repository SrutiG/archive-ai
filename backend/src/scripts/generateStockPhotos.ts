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
const DEFAULT_IMAGE_MODEL = 'dall-e-3';
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
// Use service role key for uploads to bypass RLS policies
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!openaiApiKey) throw new Error('Missing OPENAI_API_KEY');
if (!supabaseUrl) throw new Error('Missing SUPABASE_URL');
if (!supabaseServiceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY');

const IMAGE_SIZE = normalizeImageSize(process.env.IMAGE_SIZE);
const IMAGE_MODEL = process.env.IMAGE_MODEL || DEFAULT_IMAGE_MODEL;
const SUPABASE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;
const PROMPTS_JSON = process.env.PROMPTS_JSON || DEFAULT_PROMPT_SPEC;

const openai = new OpenAI({ apiKey: openaiApiKey });
// Use service role key to bypass RLS for storage uploads
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
  // Remove any references to models, people, figures from the base prompt
  let prompt = base
    .replace(/\{gender\}/gi, '')
    // Remove phrases like "on women model", "for men", "with unisex figure"
    .replace(/\b(on|for|with|styled on|designed for)\s+(women|men|unisex|gender)\s*(model|figure|person|body)?\b/gi, '')
    // Remove standalone references
    .replace(/\bmodel\b/gi, '')
    .replace(/\bfigure\b/gi, '')
    .replace(/\bperson\b/gi, '')
    .replace(/\bpose\b/gi, '')
    .replace(/\bstance\b/gi, '')
    .replace(/\bdynamic fashion pose\b/gi, '')
    .replace(/\bhigh-fashion pose\b/gi, '')
    .replace(/\bneutral pose\b/gi, '')
    // Replace fancy design terms with basic/simple
    .replace(/\bavant-garde\b/gi, 'basic')
    .replace(/\barchitectural\b/gi, 'simple')
    .replace(/\bsculptural\b/gi, 'simple')
    .replace(/\bdeconstructed\b/gi, 'simple')
    .replace(/\bexperimental\b/gi, 'basic')
    .replace(/\bconceptual\b/gi, 'basic')
    .replace(/\bmodular\b/gi, 'simple')
    .replace(/\bexaggerated\b/gi, 'standard')
    .replace(/\belongated\b/gi, 'standard')
    .replace(/\basymmetric\b/gi, 'standard')
    .replace(/\bprecise contouring\b/gi, 'standard fit')
    .replace(/\bcutout geometry\b/gi, 'simple design')
    .replace(/\blayered panels\b/gi, 'simple panels')
    .replace(/\blayered construction\b/gi, 'simple construction')
    .replace(/\bpanelled texture\b/gi, 'simple texture')
    .replace(/\btechnical details\b/gi, 'simple details')
    .replace(/\btechnical textures\b/gi, 'simple textures')
    .replace(/\bgeometric cutouts\b/gi, 'simple design')
    .replace(/\bfuturistic curves\b/gi, 'simple curves')
    .replace(/\bsculptural outsole\b/gi, 'simple outsole')
    .replace(/\bfaceted shell\b/gi, 'simple design')
    .replace(/\bangular hardware\b/gi, 'simple hardware')
    .replace(/\bangular geometry\b/gi, 'simple design')
    .replace(/\bsculptural metalwork\b/gi, 'simple metalwork')
    .replace(/\barchitectural facets\b/gi, 'simple design')
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  // Always make it product-only: basic black garment on plain background, no humans
  prompt = 'Basic black ' + prompt.replace(/^black\s+/i, '').replace(/^basic\s+/i, '');
  prompt += ' Product photography: basic black garment only displayed on plain white or neutral grey background, flat lay or on invisible mannequin/hanger, no human, no person, no model, no face, no body parts, no people visible, no hands, no arms, no legs. Simple, basic design, solid black color, matte textures, minimal neutral background, controlled studio lighting, e-commerce product shot style.';

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
