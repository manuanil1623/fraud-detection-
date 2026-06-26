# Fraud Detection Analytics

<<<<<<< HEAD
A rules-based + statistical fraud scoring engine, JSON API, and analytics
dashboard, built with Next.js (App Router) so it deploys directly to Vercel
as serverless functions + a static/SSR frontend.

## What's inside

```
lib/fraudEngine.js       Scoring engine (pure JS, no dependencies)
lib/mockData.js          Mock transaction generator for demo data
app/api/transactions/score/route.js   POST endpoint — score one transaction
app/api/analytics/summary/route.js    GET endpoint — aggregate analytics
app/dashboard/page.jsx   Dashboard UI (charts + flagged transactions table)
scripts/test-engine.js   Standalone sanity check, no server needed
```

## How scoring works

`scoreTransaction(tx)` in `lib/fraudEngine.js` combines several signals into
a 0–100 risk score:

| Signal | What it checks | Weight |
|---|---|---|
| Amount anomaly | Z-score of this transaction's amount vs. the user's own recent history | 28 |
| Velocity | Number of transactions from this user in the last hour | 22 |
| Geo mismatch | Transaction country ≠ user's home country | 18 |
| New device | Device fingerprint not seen before for this user | 12 |
| Odd hour | Transaction between 1am–5am UTC | 8 |
| High-risk category | e.g. gift cards, crypto, wire transfers | 7 |
| New account, high value | New account attempting a transaction over $500 | 15 |

Score bands: **0–24 low**, **25–49 medium**, **50–74 high**, **75–100 critical**.

This is a starting ruleset, not a finished fraud model — tune the weights,
thresholds, and add/remove signals to match your real fraud patterns. All
the logic is in one file (`lib/fraudEngine.js`) so it's easy to read and
extend without touching the API or UI.

## Running locally

```bash
npm install
npm run dev
```

- Dashboard: http://localhost:3000/dashboard
- Score one transaction: `POST http://localhost:3000/api/transactions/score`
- Aggregate analytics: `GET http://localhost:3000/api/analytics/summary`

Test the engine directly without starting a server:

```bash
node scripts/test-engine.js
```

## Example: scoring a transaction

```bash
curl -X POST http://localhost:3000/api/transactions/score \
  -H "Content-Type: application/json" \
  -d '{
    "id": "tx_123",
    "userId": "user_42",
    "amount": 980,
    "country": "RU",
    "homeCountry": "US",
    "device": "device_unknown_1",
    "knownDevices": ["device_42_a"],
    "timestamp": "2026-06-26T03:14:00.000Z",
    "category": "gift_card",
    "userHistoryAmounts": [42, 38, 51, 45, 60],
    "userTxCountLastHour": 4,
    "isNewAccount": false
  }'
```

Response:

```json
{
  "transactionId": "tx_123",
  "score": 85,
  "level": "critical",
  "reasons": [
    "Amount is 25.3σ above this user's typical spend",
    "Transaction country (RU) differs from home country (US)",
    "Transaction made from a previously unseen device",
    "Transaction occurred during an unusual hour (1am–5am UTC)",
    "Category \"gift_card\" is historically associated with higher fraud rates"
  ],
  "signals": { "amountZScore": 25.3, "txCountLastHour": 4, "geoMismatch": true, "newDevice": true, "oddHour": true, "highRiskCategory": true, "newAccountHighValue": false }
}
```

## Deploying to Vercel

1. Push this folder to a GitHub repo (or run `vercel` directly from it).
2. Go to https://vercel.com/new and import the repo, or run:
   ```bash
   npm i -g vercel
   vercel
   ```
3. Framework preset: Vercel auto-detects **Next.js** — no config needed.
4. Deploy. The API routes become serverless functions automatically;
   `/dashboard` is server-rendered on request.

## Connecting real data

Right now `/api/analytics/summary` generates fresh mock transactions on
every request (`lib/mockData.js`) so the demo works with zero setup.
For production:

1. Replace the call to `generateMockTransactions(...)` in
   `app/api/analytics/summary/route.js` with a real query — e.g. read
   recent transactions from Postgres/Supabase/MongoDB, or pull them from
   your payment processor's API.
2. Call `scoreTransaction(tx)` synchronously at the moment a transaction
   happens (checkout, login, withdrawal) by hitting
   `POST /api/transactions/score`, and act on the result (block, hold for
   review, allow) before completing the transaction.
3. Persist scored transactions somewhere queryable so
   `/api/analytics/summary` can aggregate real history instead of mock data.
4. Consider adding `export const revalidate = 60` (or similar) to the
   analytics route once it reads from a real, slower data source.
=======
## Overview
Fraud Detection Analytics is a web application built using **Next.js** that helps analyze transaction data to identify potential fraudulent activities. The application provides a dashboard for fraud insights, allows dataset uploads, and visualizes analytics for better decision-making.

---

## Features

- Upload transaction datasets
- Interactive analytics dashboard
- Fraud detection and visualization
- Responsive user interface
- API routes for data processing
- Built with Next.js App Router

---

## Tech Stack

- Next.js
- React.js
- JavaScript
- Node.js
- CSS
- Chart.js (or your chart library)

---

## Project Structure

```
FRAUD-DETECTION/
│
├── .next/
├── app/
│   ├── api/
│   ├── dashboard/
│   ├── upload/
│   ├── layout.jsx
│   └── page.jsx
│
├── lib/
├── node_modules/
├── sample-data/
├── scripts/
│
├── .gitignore
├── next.config.js
├── package.json
├── package-lock.json
└── README.md
```

---

## Folder Description

- **app/** – Contains all application pages and routes.
- **api/** – API endpoints for processing data.
- **dashboard/** – Displays fraud analytics and visualizations.
- **upload/** – Dataset upload page.
- **layout.jsx** – Root layout of the application.
- **page.jsx** – Home page.
- **lib/** – Utility functions and helper modules.
- **sample-data/** – Sample datasets for testing.
- **scripts/** – Data processing scripts.

---

## Installation

Clone the repository:

```bash
git clone <repository-url>
```

Move to the project directory:

```bash
cd FRAUD-DETECTION
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open your browser and visit:

```
http://localhost:3000
```

---

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build production version
npm run start    # Start production server
npm run lint     # Run ESLint
```

---

## Future Enhancements

- Machine Learning-based fraud prediction
- Real-time fraud alerts
- User authentication
- Advanced analytics dashboard
- Database integration
- Cloud deployment

---

## Author

**Manu Anil**

---

## License

This project is developed for educational and academic purposes.
>>>>>>> 6494dd2f9fc900f3105592016d9acc8d12a7b5a4
