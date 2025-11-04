# Wardrobe App

A full-stack wardrobe management application with AI-powered categorization and outfit generation. Built with React (frontend) and Express/TypeScript (backend).

## Features

- 📸 **Photo Upload**: Take photos or upload images of wardrobe items
- 🤖 **AI Categorization**: Automatically categorizes items using OpenAI's vision model
- 👔 **Outfit Generation**: Generates outfit combinations using AI (limited to 10 clicks per day)
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Clean and intuitive user interface

## Tech Stack

- **Frontend**: React, TypeScript
- **Backend**: Express, TypeScript
- **AI**: OpenAI GPT-4o-mini (vision model for categorization, text model for outfit generation)
- **File Upload**: Multer
- **Image Storage**: Local file system (uploads directory)

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- OpenAI API key

### 1. Configure OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the API key

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
```

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

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/items` - Get all wardrobe items
- `GET /api/items/by-category` - Get items grouped by category
- `POST /api/items` - Create a new item (requires photo and title)
- `DELETE /api/items/:id` - Delete an item
- `POST /api/outfits/generate` - Generate outfit combinations (limited to 10 clicks per day)
- `GET /api/outfits/status` - Get outfit generation status

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
│   │   ├── index.ts          # Express server
│   │   └── llmService.ts     # OpenAI integration
│   ├── uploads/              # Image storage
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── ItemInput.tsx
│   │   │   ├── ItemList.tsx
│   │   │   └── OutfitGenerator.tsx
│   │   └── index.tsx
│   └── package.json
└── README.md
```

## Usage

1. **Add Items**: 
   - Enter a title for your item
   - Take a photo or upload an image
   - Click "Add Item"
   - The AI will automatically categorize it

2. **View Items**:
   - View all items or filter by category
   - Delete items you no longer want

3. **Generate Outfits**:
   - Click "Generate Outfit Combinations"
   - Requires at least 2 items in 2 different categories
   - Limited to 10 clicks per day to control API costs

## Production Deployment

For production, consider:

1. **Database**: Replace in-memory storage with PostgreSQL or MongoDB
2. **Image Storage**: Use cloud storage (AWS S3, Cloudinary, etc.)
3. **Environment Variables**: Use proper secret management
4. **Rate Limiting**: Add proper rate limiting middleware
5. **Authentication**: Add user authentication if needed
6. **Error Handling**: Enhanced error handling and logging

## License

ISC
