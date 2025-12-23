# Deployment Guide

This guide covers deploying the Handwriting to LaTeX application in three stages:

- **Stage 1**: Basic deployment (single user, no auth)
- **Stage 2**: Multi-user with authentication
- **Stage 3**: SaaS with payments

---

# Stage 1: Basic Deployment

Deploy a working application using Render (API + Worker + Redis), Supabase (Database), and Vercel (Frontend).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                        │
│                      Next.js App                            │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Render (Backend)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  FastAPI    │  │   Redis     │  │   Celery Worker     │  │
│  │  (API)      │◄─┤  (Queue)    │◄─┤   (LaTeX + AI)      │  │
│  └──────┬──────┘  └─────────────┘  └─────────────────────┘  │
└─────────┼───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────┐     ┌─────────────────┐
│    Supabase     │     │     AWS S3      │
│   (PostgreSQL)  │     │   (Storage)     │
└─────────────────┘     └─────────────────┘
```

## Prerequisites

- GitHub account with your code pushed
- Accounts on: [Supabase](https://supabase.com), [Render](https://render.com), [Vercel](https://vercel.com)
- AWS S3 bucket (already configured)
- Google Gemini API key (for AI enhancement)

## Cost Estimate

| Service | Plan | Cost |
|---------|------|------|
| Supabase | Free | $0 (500MB database) |
| Render API | Free | $0 (750 hrs/month) |
| Render Redis | Free | $0 (25MB) |
| Render Worker | Starter | **$7/month** |
| Vercel | Hobby | $0 |
| AWS S3 | Pay-as-you-go | ~$0.02/GB |

**Total: ~$7/month**

---

## Step 1: Database (Supabase)

1. Go to [supabase.com](https://supabase.com) → **New Project**
2. Enter project details:
   - Name: `handwriting`
   - Database Password: (save this!)
   - Region: Choose closest to you
3. Wait for project to initialize (~2 min)
4. Go to **Settings → Database → Connection string → URI**
5. Copy the connection string:
   ```
   postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

### Initialize Database Schema

From your local machine (with the connection string):

```bash
# Install dependencies if needed
pip install alembic psycopg2-binary

# Run migrations
DATABASE_URL="your-supabase-url" alembic upgrade head
```

Or use Supabase SQL Editor to run the schema manually.

---

## Step 2: Backend (Render)

### 2.1 Create Redis

1. Go to [render.com](https://render.com) → **New → Redis**
2. Configure:
   - Name: `handwriting-redis`
   - Plan: **Free** (25MB)
   - Region: Oregon (or closest)
3. Click **Create Redis**
4. Copy the **Internal Redis URL**:
   ```
   redis://red-xxxxx:6379
   ```

### 2.2 Create API Service

1. Render → **New → Web Service**
2. Connect your GitHub repository
3. Configure:
   - Name: `handwriting-api`
   - Region: Oregon (same as Redis)
   - Branch: `main`
   - Runtime: **Python 3**
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
4. Select **Free** plan
5. Add Environment Variables:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Supabase connection string |
| `CELERY_BROKER_URL` | Your Render Redis internal URL |
| `CELERY_RESULT_BACKEND_URL` | Your Render Redis internal URL |
| `GEMINI_API_KEY` | Your Gemini API key |
| `IMAGE_ENHANCER` | `gemini` |
| `AWS_ACCESS_KEY_ID` | Your AWS access key |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key |
| `AWS_REGION` | `us-east-1` |
| `S3_BUCKET_NAME` | Your S3 bucket name |
| `CORS_ORIGINS` | (leave empty for now, add after Vercel deploy) |

6. Click **Create Web Service**
7. Note your API URL: `https://handwriting-api.onrender.com`

### 2.3 Create Worker Service

1. Render → **New → Background Worker**
2. Connect same GitHub repository
3. Configure:
   - Name: `handwriting-worker`
   - Region: Oregon (same as Redis)
   - Branch: `main`
   - Runtime: **Docker**
   - Dockerfile Path: `./Dockerfile.worker`
4. Select **Starter** plan ($7/month) - required for Docker
5. Add **same environment variables** as the API (except CORS_ORIGINS)
6. Click **Create Background Worker**

---

## Step 3: Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import your GitHub repository
3. Configure:
   - Framework Preset: **Next.js**
   - Root Directory: `apps/web`
4. Add Environment Variable:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://handwriting-api.onrender.com` |

5. Click **Deploy**
6. Note your frontend URL: `https://your-app.vercel.app`

### Update CORS on Render

1. Go to Render → `handwriting-api` → Environment
2. Add/Update:
   ```
   CORS_ORIGINS=https://your-app.vercel.app
   ```
3. The service will auto-redeploy

---

## Step 4: Verify Deployment

1. Open your Vercel URL
2. Upload a test PDF
3. Wait for processing (check Render logs if issues)
4. Test segmentation
5. Test compilation
6. Download the final PDF

### Troubleshooting

| Issue | Solution |
|-------|----------|
| API returns 500 | Check Render API logs, verify DATABASE_URL |
| Jobs stuck in pending | Check Worker logs, verify Redis connection |
| CORS errors | Verify CORS_ORIGINS matches your Vercel URL exactly |
| Images not loading | Check AWS credentials and S3 bucket permissions |
| Worker build fails | Check Dockerfile.worker syntax, ensure all files exist |

---

## Updating the Application

Push to your `main` branch and all services auto-redeploy:
- Render: Auto-deploys API and Worker
- Vercel: Auto-deploys Frontend

---

# Stage 2: Multi-User (Coming Soon)

Add authentication so multiple users can have their own jobs.

## Components to Add

- **Clerk** or **Supabase Auth** for authentication
- User table in database
- Jobs linked to users
- Protected API routes
- Login/signup pages

## Database Changes

```sql
-- Add users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Link jobs to users
ALTER TABLE jobs ADD COLUMN user_id UUID REFERENCES users(id);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
```

## Implementation Steps

1. Set up Clerk/Supabase Auth
2. Add auth middleware to API
3. Add login/signup pages to frontend
4. Update job queries to filter by user
5. Protect routes

---

# Stage 3: SaaS with Payments (Coming Soon)

Add subscription plans and payment processing.

## Components to Add

- **Stripe** for payments
- Subscription plans (Free, Starter, Pro)
- Usage tracking and limits
- Customer portal
- Webhooks for subscription events

## Pricing Model Example

| Plan | Price | Conversions/month | AI Enhancement |
|------|-------|-------------------|----------------|
| Free | $0 | 5 | No |
| Starter | $9/mo | 50 | Yes |
| Pro | $29/mo | 200 | Yes + Priority |

## Database Changes

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR;
ALTER TABLE users ADD COLUMN subscription_status VARCHAR DEFAULT 'free';
ALTER TABLE users ADD COLUMN subscription_plan VARCHAR DEFAULT 'free';
ALTER TABLE users ADD COLUMN credits_remaining INT DEFAULT 5;

-- Usage tracking
CREATE TABLE usage_logs (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR,
    credits_used INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Implementation Steps

1. Set up Stripe account and products
2. Create pricing page
3. Implement checkout flow
4. Set up webhooks for subscription events
5. Add usage tracking middleware
6. Implement credit limits
7. Add customer portal for subscription management
