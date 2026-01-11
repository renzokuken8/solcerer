# Solcerer (∩๏﹏๏)⊃━☆ﾟ.*

A Solana memecoin tracking Discord bot with real-time Twitter scraping, AI sentiment analysis, whale tracking, and honeypot detection.

## Features

### Token Analysis
- **Contract Lookup** - Get price, market cap, volume, liquidity, and age for any Solana token
- **Risk Assessment** - Automatic detection of mint authority, freeze authority, and top holder concentration
- **Honeypot Detection** - Simulates sells via Jupiter to detect scam tokens
- **Deployer History** - Flags serial deployers who may be rug pullers
- <img width="545" height="389" alt="image" src="https://github.com/user-attachments/assets/074f643d-e689-4396-80d2-e30c52e8e9fd" />


###  Price Tracking
- **Watchlist** - Track your favorite tokens
- **Market Cap Alerts** - Get notified when tokens hit your target market cap
- **Trending Tokens** - See what's hot on Solana (scraped from DEX Screener)
- **New Launches** - Monitor latest token launches

### Twitter Integration
- **Twitter Scraping** - Real-time scraping with cookie authentication and stealth mode
- **Account Tracking** - Follow Twitter accounts and get their tweets posted to Discord
- **Reply/Quote Detection** - Properly displays retweets, quotes, and replies
- **AI Sentiment Analysis** - GPT-4o powered analysis of Twitter sentiment for any token
<img width="497" height="424" alt="image" src="https://github.com/user-attachments/assets/bb61e3b9-1c69-4d78-83fe-397c3629d40e" />
- <img width="978" height="799" alt="image" src="https://github.com/user-attachments/assets/2add042e-6ba0-4a4a-88d3-e86852803c01" />


### Whale Tracking
- **Large Transaction Monitoring** - Detects $10K+ buys and sells on tracked tokens
- **Real-time Alerts** - Posts whale movements to dedicated Discord channel

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Discord**: Discord.js v14
- **Database**: Supabase (PostgreSQL)
- **Scraping**: Playwright with stealth plugin
- **APIs**: 
  - Helius (Solana RPC + token data)
  - DEX Screener (price data)
  - Jupiter (swap simulation)
  - OpenAI GPT-4o (sentiment analysis)
  - LunarCrush (social metrics)

## Commands

| Command | Description |
|---------|-------------|
| `/ping` | Check if bot is online |
| `/ca <mint/ticker/name>` | Look up token with full risk analysis |
| `/track <mint>` | Add token to watchlist |
| `/untrack <mint>` | Remove token from watchlist |
| `/watchlist` | View tracked tokens |
| `/setalert <mint> <above/below> <marketcap>` | Set market cap alert |
| `/removealert <mint>` | Remove price alert |
| `/alerts` | View active alerts |
| `/launches` | Show latest token launches |
| `/trending` | Show trending Solana tokens |
| `/pulse <query>` | Get social stats for a token |
| `/analyze <query>` | AI analysis of Twitter sentiment |
| `/addtwitter <handle>` | Track a Twitter account |
| `/removetwitter <handle>` | Stop tracking Twitter account |
| `/following` | View tracked Twitter accounts |
| `/checktwitter` | Manually check for new tweets |

## Installation

### Prerequisites
- Node.js 18+
- npm or yarn
- Discord Bot Token
- Supabase Account
- Helius API Key
- OpenAI API Key (optional, for AI analysis)
- Twitter Account (for scraping cookies)

### Setup

1. **Clone the repository**
```bash
git clone https://github.com/renzokuken8/solcerer.git
cd solcerer
```

2. **Install dependencies**
```bash
npm install
npx playwright install chromium
```

3. **Configure environment variables**

Create a `.env` file:
```env
# Discord
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_server_id

# Discord Channels
CHANNEL_NEW_LAUNCHES=channel_id
CHANNEL_PRICE_ALERTS=channel_id
CHANNEL_WHALE_MOVES=channel_id
CHANNEL_TRACKED_TWEETS=channel_id

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key

# APIs
HELIUS_API_KEY=your_helius_key
OPENAI_API_KEY=your_openai_key
LUNARCRUSH_API_KEY=your_lunarcrush_key

# Twitter (for scraping)
TWITTER_AUTH_TOKEN=your_auth_token
TWITTER_CT0=your_ct0_cookie
```

4. **Set up database**

Run these SQL commands in Supabase:
```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tokens table
CREATE TABLE tokens (
  mint TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  image TEXT,
  price DECIMAL,
  market_cap DECIMAL,
  liquidity DECIMAL,
  mint_authority_revoked BOOLEAN,
  freeze_authority_revoked BOOLEAN,
  risk_score INTEGER,
  risk_flags JSONB,
  first_scanned_by TEXT,
  first_scanned_mc TEXT,
  first_scanned_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Watchlist table
CREATE TABLE watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT REFERENCES users(id),
  mint TEXT,
  added_at TIMESTAMP DEFAULT NOW()
);

-- Price alerts table
CREATE TABLE price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  mint TEXT,
  type TEXT,
  threshold DECIMAL,
  triggered BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Tracked Twitter handles
CREATE TABLE tracked_twitter_handles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  handle TEXT,
  followed_at TIMESTAMP DEFAULT NOW()
);

-- Tweets table
CREATE TABLE tweets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id TEXT UNIQUE,
  handle TEXT,
  content TEXT,
  posted_at TIMESTAMP,
  alert_sent BOOLEAN DEFAULT FALSE
);

-- Whale moves table
CREATE TABLE whale_moves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature TEXT UNIQUE,
  mint TEXT,
  wallet TEXT,
  amount DECIMAL,
  usd_value DECIMAL,
  type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

5. **Register Discord commands**
```bash
npm run register
```

6. **Start the bot**
```bash
npm run dev
```

## Project Structure
```
solcerer/
├── src/
│   ├── commands/          # Discord slash commands
│   │   ├── ca.ts
│   │   ├── track.ts
│   │   ├── analyze.ts
│   │   └── ...
│   ├── workers/           # Background workers
│   │   ├── twitterWorker.ts
│   │   ├── priceAlertWorker.ts
│   │   └── whaleWorker.ts
│   ├── scrapers/          # Web scrapers
│   │   ├── twitter.ts
│   │   └── dexscreener.ts
│   ├── utils/             # Utility functions
│   │   ├── supabase.ts
│   │   ├── helius.ts
│   │   ├── openai.ts
│   │   ├── riskcheck.ts
│   │   └── lunarcrush.ts
│   ├── index.ts           # Main entry point
│   └── register-commands.ts
├── .env
├── package.json
├── tsconfig.json
└── README.md
```

## How Twitter Scraping Works

Solcerer uses advanced techniques to scrape Twitter without getting blocked:

1. **Cookie Authentication** - Uses your Twitter session cookies to appear as a logged-in user
2. **Stealth Mode** - Playwright stealth plugin hides automation indicators
3. **Fingerprint Randomization** - Randomizes viewport, timezone, and locale for each request
4. **Human-like Delays** - Random delays between actions to mimic human behavior
5. **DOM Parsing** - Extracts tweets using Twitter's data-testid attributes

## Background Workers

| Worker | Interval | Function |
|--------|----------|----------|
| Twitter Worker | 1 minute | Checks tracked accounts for new tweets |
| Price Alert Worker | 1 minute | Checks market caps against alert thresholds |
| Whale Worker | 2 minutes | Monitors tracked tokens for large transactions |


## License

MIT License - see [LICENSE](LICENSE) for details.

## Disclaimer

This bot is for educational and informational purposes only. Always do your own research before trading. Cryptocurrency trading involves significant risk of loss.

---

