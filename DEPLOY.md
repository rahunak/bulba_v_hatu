# Veggie Bot - Deployment Guide for Render.com

## Prerequisites
- Render.com account
- PostgreSQL database created on Render (veggie-bot-db)
- Telegram bot tokens (client and admin)

## Database Setup

Your Render PostgreSQL database info:
- **Database Name**: veggie_bot_db
- **Username**: rahunak66bratz
- **Hostname**: dpg-d7lsbev7f7vs739bkpug-a.frankfurt-postgres.render.com
- **Port**: 5432
- **Version**: PostgreSQL 18

## Deployment Steps

### 1. Configure Environment Variables in Render Dashboard

Go to your Render service → Environment and add:

```
DATABASE_URL=postgresql://rahunak66bratz:YOUR_PASSWORD@dpg-d7lsbev7f7vs739bkpug-a.frankfurt-postgres.render.com:5432/veggie_bot_db

CLIENT_BOT_TOKEN=8718537827:AAHibfos8WC8iW6M1FR-KyHibQMw5sMaUOA

ADMIN_BOT_TOKEN=8732689788:AAGmDOl3l0VXRIJ7REpMd0DsqdCK4CwJQoY

ADMIN_WHITELIST=5151069944

PORT=3000

NODE_ENV=production
```

**Important**: Replace `YOUR_PASSWORD` with your actual database password from Render dashboard.

### 2. Deploy Options

#### Option A: Connect GitHub Repository
1. Push code to GitHub
2. In Render dashboard: New → Web Service
3. Connect your repository
4. Render will auto-detect Dockerfile
5. Set environment variables
6. Deploy

#### Option B: Manual Deploy
1. Install Render CLI: `npm install -g render`
2. Login: `render login`
3. Deploy: `render deploy`

### 3. Post-Deployment

After first deployment:
- Check logs for `[INIT] Order expiration service started`
- Check logs for `[STARTUP] Starting bots in polling mode...`
- Test both bots in Telegram

## Features Enabled

✅ Automatic order expiration (60 minutes)
✅ Admin whitelist authorization
✅ Stock limit enforcement
✅ Comprehensive logging
✅ Phone number validation
✅ PostgreSQL 18 support

## Troubleshooting

If migrations fail:
- Check DATABASE_URL is correct
- Ensure database is accessible from Render
- Check logs: `render logs`

If bots don't start:
- Verify bot tokens are correct
- Check ADMIN_WHITELIST format (comma-separated IDs)
- Review application logs in Render dashboard
