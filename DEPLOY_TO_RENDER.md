# Deploy Backend to Render + Frontend on ngrok

## Overview

- **Backend**: Deploy to Render (stable, persistent URL)
- **Frontend**: Run on ngrok (easy sharing, temporary URL)

## Step 1: Deploy Backend to Render

### Prerequisites
1. Sign up at https://render.com (free tier available)
2. Connect your GitHub account (or use manual deploy)

### Deployment Steps

1. **Push code to GitHub** (if using GitHub deploy)

2. **Create Web Service on Render:**
   - Go to https://dashboard.render.com
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select the `backend` directory as root

3. **Configure Service:**
   - **Name**: `wardrobe-app-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend`

4. **Set Environment Variables** (in Render dashboard):
   - `NODE_ENV` = `production`
   - `OPENAI_API_KEY` = `your_openai_key` (required)
   - `PEXELS_API_KEY` = `your_pexels_key` (optional)

5. **Add Persistent Disk** (CRITICAL for SQLite):
   - In Render dashboard, go to your service
   - Click "Disks" tab
   - Click "Connect Disk"
   - **Name**: `wardrobe-data`
   - **Mount Path**: `/opt/render/project/src/data`
   - **Size**: 1GB (minimum)

6. **Deploy** - Render will automatically deploy

### Important: SQLite Database Persistence

Render uses **ephemeral file systems** - data is lost on restart/deploy unless you use a persistent disk.

**You MUST add the persistent disk** or your database will be empty after each deploy!

### After Deployment

You'll get a URL like: `https://wardrobe-app-backend.onrender.com`

**Copy this URL** - you'll need it for the frontend!

---

## Step 2: Update Frontend to Use Render Backend

1. **Update frontend `.env` file:**
   ```bash
   cd frontend
   echo "REACT_APP_API_URL=https://your-render-url.onrender.com" > .env
   ```

2. **Restart frontend** (if already running):
   ```bash
   # Stop current frontend (Ctrl+C)
   npm start
   ```

---

## Step 3: Run Frontend on ngrok

1. **Start frontend** (if not already running):
   ```bash
   cd frontend
   npm start
   ```

2. **Start ngrok for frontend:**
   ```bash
   ngrok http 3000
   ```

3. **You'll get a URL like**: `https://xyz789.ngrok-free.app`

4. **Share this ngrok URL** with your partner!

---

## Benefits of This Setup

✅ **Backend on Render:**
- Stable URL (doesn't change)
- Always online (with free tier spin-down)
- Professional hosting
- Persistent disk for database

✅ **Frontend on ngrok:**
- Easy to share quickly
- No deployment needed
- Simple setup

---

## Render Free Tier Notes

- **Spins down after 15 minutes** of inactivity
- Takes ~30 seconds to wake up after spin-down
- 750 hours/month free
- For production, consider paid plan

---

## Troubleshooting

### Backend not starting?
- Check Render logs in dashboard
- Verify environment variables are set
- Check that persistent disk is mounted correctly

### Database empty after deploy?
- Make sure persistent disk is added and mounted
- Check disk mount path: `/opt/render/project/src/data`
- Run migration script via Render shell if needed

### Frontend can't connect to backend?
- Verify `REACT_APP_API_URL` matches your Render URL
- Check CORS is enabled (already done: `app.use(cors())`)
- Restart frontend after changing `.env`

### File uploads not working?
- Uploaded images stored in `uploads/` directory
- Consider adding `uploads/` to persistent disk or use cloud storage (S3, Cloudinary)

---

## Migration Steps After First Deploy

After deploying to Render, you may need to migrate existing data:

1. **Connect to Render shell** (via dashboard)
2. **Run migration script**:
   ```bash
   npm run migrate-sqlite
   ```
   (Note: This requires the JSON file to be uploaded or available)

---

## Files Created

- `backend/render.yaml` - Render configuration (optional, can use manual setup)
- `backend/.gitignore` - Prevents committing sensitive files
