# PrizePicks Discord Bot

Tracks a public PrizePicks user's open lineups and posts new entries to a Discord channel in real time.

## Setup

### 1. Install dependencies
npm install
npx playwright install chromium

### 2. Create a Discord Bot
1. Go to https://discord.com/developers/applications
2. Click New Application → give it a name
3. Go to Bot → click Add Bot
4. Under Token, click Reset Token and copy it
5. Go to OAuth2 > URL Generator:
   - Scopes: bot
   - Bot Permissions: Send Messages, Embed Links, View Channels
6. Copy the generated URL, open it, invite the bot to your server

### 3. Get your Channel ID
1. Discord Settings > Advanced > enable Developer Mode
2. Right-click the channel → Copy Channel ID

### 4. Configure environment
cp .env.example .env
(then fill in your values)

### 5. Run
npm start
```

