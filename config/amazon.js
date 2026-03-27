import { config } from "dotenv";
config();

const amazonConfig = {
  clientId: process.env.AMAZON_CLIENT_ID,
  clientSecret: process.env.AMAZON_CLIENT_SECRET,
  refreshToken: process.env.AMAZON_REFRESH_TOKEN,
  marketplaceId: process.env.AMAZON_MARKETPLACE_ID,
  sellerId: process.env.AMAZON_SELLER_ID,
  spApiBaseUrl:
    process.env.SP_API_BASE_URL || "https://sellingpartnerapi-na.amazon.com",
  lwaTokenUrl: "https://api.amazon.com/auth/o2/token",
};

const validateConfig = () => {
  const required = [
    "clientId",
    "clientSecret",
    "refreshToken",
    "marketplaceId",
    "sellerId",
  ];
  const missing = required.filter((key) => !amazonConfig[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing Amazon SP-API config: ${missing.join(", ")}. Check your .env file.`,
    );
  }
};

export { amazonConfig, validateConfig };
