# AuthSwitch Demo

> A simulated security checkpoint and multi-step form state machine application ready for local execution and **Cloudflare Pages** edge deployment.

---

## Architecture & Cloudflare Pages Integration

The project is structured to run seamlessly in **both environments**:
1. **Local Express Development & Testing:** Server runs via `node src/server.js` (`http://localhost:3000`).
2. **Cloudflare Pages Edge Deployment:** Static assets are served from `./public`, and API endpoints run on V8 edge isolates via **Cloudflare Pages Functions** (`./functions`).

---

## Cloudflare Pages Project Structure

```text
├── wrangler.toml              # Cloudflare Pages configuration
├── functions/                 # Cloudflare Pages Functions (V8 Edge API)
│   ├── _middleware.js         # Edge router middleware
│   ├── [[path]].js            # SPA wildcard fallback route
│   ├── utils/
│   │   └── edgeSession.js     # Web Crypto signed cookie session engine & Telegram monitor
│   └── api/                   # Serverless edge API routes
│       ├── session.js         # GET  /api/session
│       ├── access-check.js    # POST /api/access-check
│       ├── login-demo.js      # POST /api/login-demo
│       ├── activation/        # POST /api/activation/*
│       └── logout.js          # POST /api/logout
├── public/                    # Static UI Assets
│   ├── _routes.json           # Pages route rules
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
├── src/                       # Local Express Server
└── test/                      # Integration Test Suite
```

---

## Deployment Instructions

### Option 1: Direct Deployment via Wrangler CLI

1. **Install Wrangler & Authenticate:**
   ```bash
   npx wrangler login
   ```

2. **Deploy to Cloudflare Pages:**
   ```bash
   npx wrangler pages deploy public
   ```

3. **Set Environment Variables in Cloudflare Pages Dashboard:**
   Go to **Cloudflare Dashboard → Workers & Pages → authswitch-demo → Settings → Environment variables**:
   - `SESSION_SECRET`: Set a secure secret key.
   - `TELEGRAM_BOT_TOKEN`: (Optional) Your Telegram bot token.
   - `TELEGRAM_CHAT_ID`: (Optional) Your Telegram target chat ID.

---

### Option 2: Continuous Deployment via Git (GitHub / GitLab)

1. Push your repository to GitHub or GitLab.
2. In the Cloudflare Dashboard: **Create an Application → Pages → Connect to Git**.
3. Configure Build Settings:
   - **Framework Preset:** None / Static
   - **Build Command:** (leave empty or `npm test`)
   - **Build Output Directory:** `public`
4. Add environment variables (`SESSION_SECRET`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).
5. Click **Save and Deploy**!

---

## Local Development & Testing

```bash
# 1. Run local Express server (http://localhost:3000)
npm start

# 2. Run local Cloudflare Pages emulator
npx wrangler pages dev public

# 3. Run automated test suite
npm test
```
