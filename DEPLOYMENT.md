# Deployment Guide for Wardrobe App Backend

This guide will walk you through deploying the backend to Render.

## Prerequisites

1. **GitHub Repository**: Your code must be pushed to a GitHub repository
2. **Supabase Account**: For PostgreSQL database and image storage
3. **Render Account**: Sign up at [render.com](https://render.com)

## Step 1: Prepare Your Code

### 1.1 Push Code to GitHub

Make sure all your code is committed and pushed to GitHub:

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 1.2 Verify Environment Variables

Make sure you have all the necessary environment variables ready:
- `OPENAI_API_KEY` - Your OpenAI API key
- `PEXELS_API_KEY` - Your Pexels API key (optional but recommended)
- `DATABASE_URL` - PostgreSQL connection string from Supabase
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `SUPABASE_STORAGE_BUCKET` - Your Supabase storage bucket name (default: `wardrobe-images`)

## Step 2: Create Render Web Service

### 2.1 Create New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** button
3. Select **"Web Service"**
4. Connect your GitHub account if not already connected
5. Select your repository (`wardrobe-app`)

### 2.2 Configure Service Settings

Configure the service with these settings:

- **Name**: `wardrobe-app-backend` (or any name you prefer)
- **Region**: Choose the closest region to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: `backend`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Instance Type**: `Free` (or upgrade to `Starter` for better performance)

### 2.3 Set Environment Variables

Click on **"Environment"** tab and add these environment variables:

**Required:**
```
NODE_ENV=production
OPENAI_API_KEY=your_openai_api_key_here
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_STORAGE_BUCKET=wardrobe-images
```

**Optional (but recommended):**
```
PEXELS_API_KEY=your_pexels_api_key_here
```

**Notes:**
- `PORT` is automatically set by Render - **DO NOT** set it manually
- `DATABASE_URL` should be your Supabase PostgreSQL connection string
- Make sure to use the **Service Role Key** (not the anon key) for `SUPABASE_SERVICE_ROLE_KEY`

### 2.4 Deploy

1. Click **"Create Web Service"**
2. Render will start building and deploying your service
3. Wait for the deployment to complete (usually 5-10 minutes)

## Step 3: Verify Deployment

### 3.1 Check Service Status

Once deployed, you should see:
- ✅ **Live** status
- A public URL like `https://wardrobe-app-backend.onrender.com`

### 3.2 Test Health Endpoint

Open your browser or use curl:
```bash
curl https://your-backend-url.onrender.com/api/health
```

You should see:
```json
{"status":"ok"}
```

### 3.3 Check Logs

In Render dashboard, go to **"Logs"** tab to see:
- Build logs
- Runtime logs
- Any errors

## Step 4: Post-Deployment Setup

### 4.1 Verify Database Connection

The backend will automatically initialize the PostgreSQL schema on first startup. Check the logs to confirm:
- Look for: `📊 Using PostgreSQL database`
- Look for: Schema initialization messages

### 4.2 Test API Endpoints

Test a few endpoints to make sure everything works:

```bash
# Get health status
curl https://your-backend-url.onrender.com/api/health

# Get users (should return empty array or existing users)
curl https://your-backend-url.onrender.com/api/users
```

### 4.3 Update Frontend API URL

Update your frontend `.env` file or deployment configuration:

```env
REACT_APP_API_URL=https://your-backend-url.onrender.com
```

## Troubleshooting

### Build Fails

**Error**: `npm install` fails
- **Solution**: Check that all dependencies in `package.json` are valid
- Check build logs for specific error messages

**Error**: `npm run build` fails
- **Solution**: Check TypeScript compilation errors in `tsconfig.json`
- Verify all TypeScript files compile correctly locally

### Deployment Fails

**Error**: Service won't start
- **Solution**: Check logs for runtime errors
- Verify `DATABASE_URL` is correct and accessible
- Verify all required environment variables are set

### Database Connection Issues

**Error**: Cannot connect to PostgreSQL
- **Solution**: 
  - Verify `DATABASE_URL` is correct
  - Check Supabase connection settings
  - Ensure your Supabase database allows connections from Render's IPs
  - Check Supabase dashboard for connection issues

### Image Upload Issues

**Error**: Images not uploading to Supabase
- **Solution**:
  - Verify `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET` are set
  - Check that the storage bucket exists in Supabase
  - Verify bucket permissions allow uploads
  - Check logs for Supabase API errors

### Service Keeps Restarting

**Error**: Service restarts repeatedly
- **Solution**:
  - Check logs for crashes
  - Verify environment variables are correctly set
  - Check for unhandled promise rejections
  - Verify database connection is stable

## Performance Tips

### Free Tier Limitations

- **Spins down after 15 minutes of inactivity**
- **Cold start** can take 30-60 seconds
- **Limited resources** - may be slow under load

### Upgrade Recommendations

For production use, consider upgrading to:
- **Starter Plan** ($7/month) - No spin-down, better performance
- **Standard Plan** ($25/month) - Even better performance and reliability

## Monitoring

### Health Checks

Render automatically monitors your service:
- Checks `/api/health` endpoint periodically
- Restarts service if health checks fail

### Logs

Monitor your service logs:
- Go to **"Logs"** tab in Render dashboard
- Set up log alerts if needed
- Monitor for errors and warnings

## Next Steps

1. **Deploy Frontend**: Update frontend to use the new backend URL
2. **Test End-to-End**: Test the full application flow
3. **Set Up Monitoring**: Consider adding error tracking (e.g., Sentry)
4. **Backup Strategy**: Set up regular database backups in Supabase

## Support

If you encounter issues:
1. Check Render logs first
2. Verify all environment variables are set correctly
3. Test API endpoints directly
4. Check Supabase dashboard for database/storage issues
5. Review this guide's troubleshooting section

