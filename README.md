# Amazon Seller Backend

A production-ready **Amazon Seller Tool** backend built with **Node.js**, **Express.js**, and **MongoDB (Mongoose)**. It integrates with the **Amazon Selling Partner API (SP-API)** to sync product listings, manage inventory, import stock files, and push quantity updates back to Amazon — all via a clean REST API.

---

## Features

1. **Fetch Products from Amazon** — Sync your seller listings (or search by ASIN/keyword) via the SP-API Catalog Items API and persist them to MongoDB.
2. **Import Stock File (CSV/Excel)** — Upload a `.csv` or `.xlsx` file with `sku` and `quantity` columns to bulk-update inventory in the database.
3. **Push Updated Stock to Amazon** — Submit pending quantity changes to Amazon via the SP-API Feeds API (JSON_LISTINGS_FEED). Track feed status in MongoDB.
4. **Download AFN Products File** — Export all Fulfilled-by-Amazon products as a downloadable CSV.
5. **Download MFN Products File** — Export all Merchant-Fulfilled products as a downloadable CSV.

---

## Tech Stack

| Layer        | Technology                   |
| ------------ | ---------------------------- |
| Runtime      | Node.js (v18+)               |
| Framework    | Express.js                   |
| Database     | MongoDB + Mongoose           |
| Amazon API   | SP-API via LWA OAuth + Axios |
| File Parsing | fast-csv, xlsx (SheetJS)     |
| File Upload  | Multer                       |
| Dev Server   | Nodemon                      |

---

## Folder Structure

```
amazon-seller-backend/
├── src/
│   ├── config/
│   │   ├── db.js                 # MongoDB connection
│   │   └── amazon.js             # SP-API credentials config
│   ├── models/
│   │   ├── Product.js            # Mongoose product schema
│   │   └── FeedJob.js            # Feed submission tracking schema
│   ├── routes/
│   │   ├── productRoutes.js      # /api/products routes
│   │   └── stockRoutes.js        # /api/stock routes
│   ├── controllers/
│   │   ├── productController.js  # Product logic
│   │   └── stockController.js    # Stock import/push logic
│   ├── services/
│   │   ├── amazonService.js      # All SP-API calls (LWA auth, Catalog, Feeds)
│   │   └── fileService.js        # CSV/Excel parse + CSV generation
│   ├── middleware/
│   │   └── errorHandler.js       # Centralized error handler
│   └── index.js                  # App entry point
├── uploads/                      # Temp file uploads (gitignored)
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/ali46515/Amazon-Seller-API.git
cd amazon-seller-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in all values (see [.env.example contents](#envexample-contents) below).

### 4. Start the development server

```bash
npm run dev
```

The server will start on `http://localhost:8080`.

### 5. Production start

```bash
npm start
```

---

## API Endpoints

All responses follow this shape:

```json
{
  "success": true,
  "data": { ... },
  "message": "Human-readable message"
}
```

---

### Products

#### `GET /api/products/sync`

Fetch products from Amazon SP-API and upsert them into MongoDB.

| Query Param | Type   | Description                                   |
| ----------- | ------ | --------------------------------------------- |
| `asin`      | string | Fetch a single product by ASIN                |
| `keyword`   | string | Search catalog items by keyword               |
| _(none)_    |        | Fetches all of your seller listings (default) |

**Example Request:**

```
GET /api/products/sync?keyword=wireless+earbuds
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "synced": 5,
    "products": [
      {
        "_id": "...",
        "asin": "B08N5LNQCX",
        "sku": "MY-SKU-001",
        "title": "Wireless Earbuds Pro",
        "price": 29.99,
        "quantity": 120,
        "fulfillmentChannel": "AFN",
        "lastSynced": "2024-02-01T10:00:00.000Z"
      }
    ]
  },
  "message": "Successfully synced 5 product(s) from Amazon"
}
```

---

#### `GET /api/products`

Return all products from MongoDB with optional filters.

| Query Param          | Type   | Description                              |
| -------------------- | ------ | ---------------------------------------- |
| `fulfillmentChannel` | string | Filter by `AFN` or `MFN`                 |
| `sku`                | string | Filter by SKU (partial match supported)  |
| `page`               | number | Page number (default: 1)                 |
| `limit`              | number | Results per page (default: 50, max: 200) |

**Example Request:**

```
GET /api/products?fulfillmentChannel=MFN&page=1&limit=20
```

---

#### `GET /api/products/download/afn`

Download all AFN products as a CSV file.

- **Response:** Binary CSV download with `Content-Disposition` header
- **Columns:** `sku, asin, title, quantity, price`

**Example Request:**

```
GET /api/products/download/afn
```

---

#### `GET /api/products/download/mfn`

Download all MFN products as a CSV file.

- **Response:** Binary CSV download with `Content-Disposition` header
- **Columns:** `sku, asin, title, quantity, price`

---

### Stock

#### `POST /api/stock/import`

Upload a CSV or Excel file to bulk-update product quantities.

- **Content-Type:** `multipart/form-data`
- **Field name:** `file`
- **Accepted formats:** `.csv`, `.xlsx`
- **Required columns:** `sku`, `quantity`
- **Max file size:** 10 MB

**Example Request (curl):**

```bash
curl -X POST http://localhost:8080/api/stock/import \
  -F "file=@/path/to/stock.csv"
```

**Example CSV content:**

```csv
sku,quantity
MY-SKU-001,150
MY-SKU-002,0
INVALID-SKU,abc
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "imported": 2,
    "skipped": 1,
    "errors": [
      "Row 4 (SKU: INVALID-SKU): 'quantity' must be a non-negative integer, got 'abc'"
    ],
    "importedSkus": ["MY-SKU-001", "MY-SKU-002"]
  },
  "message": "Import complete: 2 updated, 1 skipped"
}
```

---

#### `POST /api/stock/push-to-amazon`

Submit pending inventory updates to Amazon via the SP-API Feeds API.

Finds all products where `feedSubmitted = false` and `quantityUpdatedAt` is set, builds a `JSON_LISTINGS_FEED`, uploads it, submits it, and saves the feed job.

**Example Request:**

```
POST /api/stock/push-to-amazon
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "feedId": "23492394872349",
    "feedDocumentId": "amzn1.tortuga.3.ed4c3e30-...",
    "status": "SUBMITTED",
    "skusSubmitted": 3,
    "feedJob": { ... }
  },
  "message": "Feed submitted to Amazon for 3 product(s). Feed ID: 23492394872349"
}
```

---

#### `GET /api/stock/feed-status/:feedId`

Check the processing status of a previously submitted feed.

Fetches the latest status from Amazon SP-API and updates the local `FeedJob` record.

**Example Request:**

```
GET /api/stock/feed-status/23492394872349
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "feedJob": {
      "feedId": "23492394872349",
      "status": "DONE",
      "submittedAt": "2024-02-01T10:00:00.000Z",
      "processedAt": "2024-02-01T10:05:32.000Z",
      "skusIncluded": ["MY-SKU-001", "MY-SKU-002"]
    },
    "amazonRaw": { ... }
  },
  "message": "Feed status: DONE"
}
```

---

## How to Get Amazon SP-API Credentials

1. **Register as a Developer** at [developer.amazonservices.com](https://developer.amazonservices.com) and create a developer account linked to your seller account.

2. **Create an SP-API Application** in Seller Central → Apps & Services → Develop Apps. Select **Self-authorized** if this is for your own account only.

3. **Get LWA Credentials** (Login with Amazon):
   - `AMAZON_CLIENT_ID` — Found in your app's LWA credentials
   - `AMAZON_CLIENT_SECRET` — Found alongside the client ID
   - `AMAZON_REFRESH_TOKEN` — Generated after authorizing your app in Seller Central

4. **Get Seller & Marketplace IDs**:
   - `AMAZON_SELLER_ID` — Seller Central → Account Info → Merchant Token
   - `AMAZON_MARKETPLACE_ID` — e.g., `ATVPDKIKX0DER` for US, `A1F83G8C2ARO7P` for UK. [Full list](https://developer-docs.amazon.com/sp-api/docs/marketplace-ids)

5. **Set the API endpoint** based on your region:
   - North America: `https://sellingpartnerapi-na.amazon.com`
   - Europe: `https://sellingpartnerapi-eu.amazon.com`
   - Far East: `https://sellingpartnerapi-fe.amazon.com`

---

## .env.example Contents

```env
PORT=8080
MONGO_URI=mongodb://localhost:27017/amazon-seller
AMAZON_CLIENT_ID=
AMAZON_CLIENT_SECRET=
AMAZON_REFRESH_TOKEN=
AMAZON_MARKETPLACE_ID=
AMAZON_SELLER_ID=
SP_API_BASE_URL=https://sellingpartnerapi-na.amazon.com
```

---

## Git Setup & Push to GitHub

```bash
# Initialize git repository
git init

# Stage all files
git add .

# Initial commit
git commit -m "feat: initial production-ready Amazon Seller backend"

# Add your GitHub remote
git remote add origin https://github.com/ali46515/Amazon-Seller-API.git

# Push to main branch
git branch -M main
git push -u origin main
```

---

## License

MIT
