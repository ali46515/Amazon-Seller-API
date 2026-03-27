import axios from "axios";
import { amazonConfig, validateConfig } from "../config/amazon.js";

let cachedToken = null;
let tokenExpiresAt = null;

const getLwaAccessToken = async () => {
  const now = Date.now();

  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt) {
    return cachedToken;
  }

  validateConfig();

  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", amazonConfig.refreshToken);
  params.append("client_id", amazonConfig.clientId);
  params.append("client_secret", amazonConfig.clientSecret);

  const response = await axios.post(amazonConfig.lwaTokenUrl, params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  const { access_token, expires_in } = response.data;

  cachedToken = access_token;
  tokenExpiresAt = now + (expires_in - 60) * 1000;

  return cachedToken;
};

const getAuthHeaders = async () => {
  const token = await getLwaAccessToken();
  return {
    "x-amz-access-token": token,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

const searchCatalogItemsByKeyword = async (keyword) => {
  const headers = await getAuthHeaders();
  const url = `${amazonConfig.spApiBaseUrl}/catalog/2022-04-01/items`;

  const response = await axios.get(url, {
    headers,
    params: {
      keywords: keyword,
      marketplaceIds: amazonConfig.marketplaceId,
      includedData: "summaries,attributes,salesRanks,images,productTypes",
      pageSize: 20,
    },
  });

  return response.data.items || [];
};

const getCatalogItemByAsin = async (asin) => {
  const headers = await getAuthHeaders();
  const url = `${amazonConfig.spApiBaseUrl}/catalog/2022-04-01/items/${asin}`;

  const response = await axios.get(url, {
    headers,
    params: {
      marketplaceIds: amazonConfig.marketplaceId,
      includedData: "summaries,attributes,salesRanks",
    },
  });

  return response.data;
};

const getSellerListings = async () => {
  const headers = await getAuthHeaders();
  const url = `${amazonConfig.spApiBaseUrl}/listings/2021-08-01/items/${amazonConfig.sellerId}`;

  const response = await axios.get(url, {
    headers,
    params: {
      marketplaceIds: amazonConfig.marketplaceId,
      includedData: "summaries,fulfillmentAvailability,attributes",
      pageSize: 50,
    },
  });

  return response.data.items || [];
};

const normalizeListingItem = (item) => {
  const summaries = item.summaries?.[0] || {};
  const fulfillment = item.fulfillmentAvailability?.[0] || {};
  const attributes = item.attributes || {};

  const priceAttr =
    attributes.purchasable_offer?.[0]?.our_price?.[0]?.schedule?.[0]
      ?.value_with_tax;

  return {
    asin: summaries.asin || item.asin || null,
    sku: item.sku,
    title: summaries.itemName || "",
    price: priceAttr ? parseFloat(priceAttr) : 0,
    quantity: fulfillment.quantity || 0,
    fulfillmentChannel:
      fulfillment.fulfillmentChannelCode === "AMAZON_NA" ? "AFN" : "MFN",
    lastSynced: new Date(),
  };
};

const createFeedDocument = async () => {
  const headers = await getAuthHeaders();
  const url = `${amazonConfig.spApiBaseUrl}/feeds/2021-06-30/documents`;

  const response = await axios.post(
    url,
    { contentType: "application/json; charset=UTF-8" },
    { headers },
  );

  return {
    feedDocumentId: response.data.feedDocumentId,
    uploadUrl: response.data.url,
  };
};

const uploadFeedContent = async (uploadUrl, feedContent) => {
  await axios.put(uploadUrl, JSON.stringify(feedContent), {
    headers: { "Content-Type": "application/json; charset=UTF-8" },
  });
};

const submitFeed = async (feedDocumentId, feedType = "JSON_LISTINGS_FEED") => {
  const headers = await getAuthHeaders();
  const url = `${amazonConfig.spApiBaseUrl}/feeds/2021-06-30/feeds`;

  const response = await axios.post(
    url,
    {
      feedType,
      marketplaceIds: [amazonConfig.marketplaceId],
      inputFeedDocumentId: feedDocumentId,
    },
    { headers },
  );

  return response.data;
};

const getFeedStatus = async (feedId) => {
  const headers = await getAuthHeaders();
  const url = `${amazonConfig.spApiBaseUrl}/feeds/2021-06-30/feeds/${feedId}`;

  const response = await axios.get(url, { headers });
  return response.data;
};

const buildInventoryFeedPayload = (products) => {
  return {
    header: {
      sellerId: amazonConfig.sellerId,
      version: "2.0",
      issueLocale: "en_US",
    },
    messages: products.map((product, index) => ({
      messageId: index + 1,
      sku: product.sku,
      operationType: "PATCH",
      productType: "PRODUCT",
      patches: [
        {
          op: "replace",
          path: "/attributes/fulfillment_availability",
          value: [
            {
              fulfillment_channel_code: "DEFAULT",
              quantity: product.quantity,
              marketplace_id: amazonConfig.marketplaceId,
            },
          ],
        },
      ],
    })),
  };
};

export {
  getLwaAccessToken,
  searchCatalogItemsByKeyword,
  getCatalogItemByAsin,
  getSellerListings,
  normalizeListingItem,
  createFeedDocument,
  uploadFeedContent,
  submitFeed,
  getFeedStatus,
  buildInventoryFeedPayload,
};
