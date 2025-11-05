# Wardrobe App

A full-stack wardrobe management application with AI-powered categorization and outfit generation. Built with React (frontend) and Express/TypeScript (backend).

## Features

- 📸 **Photo Upload**: Take photos or upload images of wardrobe items
- 🤖 **AI Categorization**: Automatically categorizes items using OpenAI's vision model
- 👔 **Outfit Generation**: Generates outfit combinations using AI (limited to 10 clicks per day)
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean and intuitive user interface
- 👥 **Multi-User Support**: Support for multiple users with separate wardrobes
- 💾 **Cloud Storage**: Images stored in Supabase Storage
- 🗄️ **PostgreSQL Database**: Scalable database with automatic fallback to SQLite for local development

## Tech Stack

- **Frontend**: React, TypeScript
- **Backend**: Express, TypeScript
- **Database**: PostgreSQL (Supabase) with SQLite fallback for local development
- **Image Storage**: Supabase Storage with local file system fallback
- **AI**: OpenAI GPT-4o-mini (vision model for categorization, text model for outfit generation)
- **File Upload**: Multer

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key
- Supabase account (for production) - optional for local development

### 1. Configure API Keys

#### OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key

#### Pexels API Key (Optional but Recommended)

1. Go to [Pexels API](https://www.pexels.com/api/)
2. Sign up for a free account
3. Navigate to the API section
4. Copy your API key

**Note**: Pexels API is free and provides 200 requests per hour. If you don't provide a key, the app will fall back to Unsplash Source API (which may have limited functionality).

#### Supabase Setup (Optional - for Production)

For production deployment, you'll need Supabase for:
- PostgreSQL database
- Image storage

1. Go to [Supabase](https://supabase.com/)
2. Create a new project
3. Get your connection string from **Settings** → **Database** → **Connection string** (URI format)
4. Get your API keys from **Settings** → **API**
5. Create a storage bucket named `wardrobe-images` (or set `SUPABASE_STORAGE_BUCKET`)

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001

# Optional but recommended
PEXELS_API_KEY=your_pexels_api_key_here

# Production (PostgreSQL + Supabase Storage)
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_STORAGE_BUCKET=wardrobe-images
```

**Database Configuration:**
- If `DATABASE_URL` is set: Uses PostgreSQL (Supabase)
- If `DATABASE_URL` is not set: Uses SQLite (local development)

**Image Storage Configuration:**
- If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set: Uses Supabase Storage
- If not set: Uses local file system (`backend/uploads/`)

Start the backend server:

```bash
npm run dev
```

The backend will run on `http://localhost:3001`

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory (optional, defaults to localhost:3001):

```env
REACT_APP_API_URL=http://localhost:3001
```

Start the frontend development server:

```bash
npm start
```

The frontend will run on `http://localhost:3000`

## Database Migration

### Migrating from SQLite to PostgreSQL

If you have existing SQLite data and want to migrate to PostgreSQL:

1. Set `DATABASE_URL` in your `.env` file
2. Run the migration script:

```bash
cd backend
npm run migrate-postgres
```

This will:
- Initialize PostgreSQL schema
- Copy all data from SQLite to PostgreSQL
- Show a summary of migrated records

### Migrating Images to Supabase Storage

If you have existing local images and want to migrate to Supabase Storage:

1. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` in your `.env` file
2. Run the migration script:

```bash
cd backend
npm run migrate-supabase
```

This will:
- Upload all local images to Supabase Storage
- Update image URLs in the database
- Show a summary of migrated images

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
- `GET /api/users/:userId` - Get user by ID
- `GET /api/items` - Get all wardrobe items (requires `x-user-id` header)
- `GET /api/items/by-category` - Get items grouped by category (requires `x-user-id` header)
- `POST /api/items` - Create a new item (requires photo and title, `x-user-id` header)
- `PUT /api/items/:id` - Update an item (requires `x-user-id` header)
- `DELETE /api/items/:id` - Delete an item (requires `x-user-id` header)
- `POST /api/outfits/generate` - Generate outfit combinations (limited to 10 clicks per day, requires `x-user-id` header)
- `GET /api/outfits/status` - Get outfit generation status (requires `x-user-id` header)
- `GET /api/outfits/saved` - Get saved outfits (requires `x-user-id` header)
- `POST /api/outfits/save` - Save an outfit (requires `x-user-id` header)
- `GET /api/outfits/feedback` - Get outfit feedback (requires `x-user-id` header)
- `POST /api/outfits/feedback` - Submit outfit feedback (requires `x-user-id` header)
- `GET /api/user/profile` - Get user profile (requires `x-user-id` header)
- `POST /api/user/profile` - Update user profile (requires `x-user-id` header)
- `GET /api/explore/suggestions` - Get explore suggestions (requires `x-user-id` header)
- `POST /api/explore/generate` - Generate explore suggestions (requires `x-user-id` header)

**Note**: All endpoints except `/api/health` and `/api/users` require the `x-user-id` header to identify the user.

## Cost Considerations

This app uses **OpenAI GPT-4o-mini**, which is one of the most cost-effective options:

- **Categorization**: Uses vision model (GPT-4o-mini) with image input
  - Approximate cost: ~$0.0001-0.0003 per item categorization
- **Outfit Generation**: Uses text model (GPT-4o-mini)
  - Approximate cost: ~$0.0005-0.001 per outfit generation
  - Limited to 10 clicks per day to control costs

**Example monthly costs** (assuming moderate usage):
- 100 items categorized: ~$0.01-0.03
- 50 outfit generations: ~$0.025-0.05
- **Total: ~$0.035-0.08/month**

### Alternative LLM Options (if you want to switch)

1. **Google Gemini Pro**: 
   - Similar cost, sometimes cheaper
   - Update `backend/src/llmService.ts` to use Gemini API
   - Requires `@google/generative-ai` package

2. **Anthropic Claude**:
   - Slightly more expensive but very capable
   - Update `backend/src/llmService.ts` to use Anthropic API
   - Requires `@anthropic-ai/sdk` package

3. **Local Models** (free but requires setup):
   - Ollama with Llama 3.1 Vision
   - Requires running Ollama locally
   - Update `backend/src/llmService.ts` to call local API

## Project Structure

```
wardrobe-app/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server
│   │   ├── llmService.ts         # OpenAI integration
│   │   ├── database.ts           # Database abstraction layer
│   │   ├── databasePostgres.ts   # PostgreSQL implementation
│   │   ├── databaseSQLite.ts     # SQLite implementation
│   │   ├── supabaseStorage.ts    # Supabase Storage integration
│   │   └── scripts/              # Migration and utility scripts
│   ├── data/                     # SQLite database (local dev)
│   ├── uploads/                  # Local image storage (fallback)
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   ├── pages/
│   │   ├── contexts/
│   │   └── utils/
│   └── package.json
└── README.md
```

## Usage

1. **Login/Select User**: 
   - On first visit, create a new user or select an existing one
   - Your user selection is saved in localStorage and cookies

2. **Add Items**: 
   - Enter a title for your item
   - Take a photo or upload an image
   - Click "Add Item"
   - The AI will automatically categorize it

3. **View Items**:
   - View all items or filter by category
   - Edit or delete items you no longer want

4. **Generate Outfits**:
   - Click "Generate Outfit Combinations"
   - Requires at least 2 items in 2 different categories
   - Limited to 10 clicks per day to control API costs
   - Save outfits you like for future reference

5. **Explore**:
   - Get AI-generated suggestions for new items to add
   - Suggestions are generated daily based on your wardrobe and style preferences

## Production Deployment

### Deploy Backend to Render

1. **Create a Render Web Service**:
   - Connect your GitHub repository
   - Set root directory to `backend`
   - Build command: `npm install && npm run build`
   - Start command: `npm start`

2. **Set Environment Variables**:
   - `NODE_ENV=production`
   - `PORT` (auto-set by Render)
   - `OPENAI_API_KEY`
   - `PEXELS_API_KEY` (optional)
   - `DATABASE_URL` (PostgreSQL connection string from Supabase)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`

3. **Important Notes**:
   - No persistent disk needed when using PostgreSQL
   - Make sure `DATABASE_URL` is set for PostgreSQL
   - Images will be stored in Supabase Storage (set Supabase env vars)

### Deploy Frontend

1. **Build the frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Deploy to any static hosting**:
   - Vercel
   - Netlify
   - GitHub Pages
   - Or any static hosting service

3. **Set Environment Variable**:
   - `REACT_APP_API_URL` - Your backend API URL (e.g., `https://your-backend.onrender.com`)

## Development

### Running Tests

The backend includes comprehensive integration tests that verify all API endpoints work correctly.

#### Run All Tests

```bash
cd backend
npm test
```

This will:
- Create a test user with unique ID
- Seed test data (3 items, profile, 1 saved outfit)
- Run all integration tests
- Clean up test user and data after tests complete

#### Run Tests in Watch Mode

```bash
cd backend
npm run test:watch
```

This will watch for file changes and automatically re-run tests.

#### Test Coverage

The test suite covers:
- ✅ Health check endpoint
- ✅ User management (create, get all)
- ✅ Item CRUD operations (create, read, update, delete)
- ✅ Items grouped by category
- ✅ User profile (get, update)
- ✅ Saved outfits (get, save)
- ✅ Outfit feedback (get, submit)
- ✅ Outfit generation status
- ✅ Explore suggestions

**Note**: Tests use a separate test user and automatically clean up all test data after completion. They work with both PostgreSQL and SQLite databases.

#### Manual API Testing

For manual API testing with a running server:

```bash
# Start backend server
cd backend
npm run dev  # In one terminal

# Run PostgreSQL connection test (in another terminal)
./test-postgres.sh
```

### Database Scripts

```bash
# Migrate SQLite to PostgreSQL
npm run migrate-postgres

# Migrate images to Supabase Storage
npm run migrate-supabase

# Verify Supabase setup
npm run verify-supabase
```

## Troubleshooting

### Frontend Not Showing Items

1. Check browser console for errors
2. Verify user ID is set in localStorage: `localStorage.getItem('archive_current_user')`
3. Check Network tab to see if `x-user-id` header is being sent
4. Verify backend is running and accessible
5. Check backend logs for user ID being used

### Database Connection Issues

1. **PostgreSQL**: Verify `DATABASE_URL` is correct and accessible
2. **SQLite**: Check that `backend/data/` directory exists and is writable
3. Check backend logs for connection errors

### Image Upload Issues

1. **Supabase Storage**: Verify `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` are set
2. **Local Storage**: Check that `backend/uploads/` directory exists and is writable
3. Check backend logs for upload errors

## License

ISC
