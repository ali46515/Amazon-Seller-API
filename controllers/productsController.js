import Product from "../models/Product";
import {
  getSellerListings,
  normalizeListingItem,
  searchCatalogItemsByKeyword,
  getCatalogItemByAsin,
} from "../services/amazonServices.js";
import { generateProductsCsv } from "../services/fileService.js";

const syncProducts = async (req, res) => {
  const { asin, keyword } = req.query;

  let itemsToProcess = [];

  if (asin) {
    const item = await getCatalogItemByAsin(asin.toUpperCase());
    const normalized = {
      asin: item.asin || asin,
      sku: item.sku || asin,
      title: item.summaries?.[0]?.itemName || "",
      price: 0,
      quantity: 0,
      fulfillmentChannel: "MFN",
      lastSynced: new Date(),
    };
    itemsToProcess.push(normalized);
  } else if (keyword) {
    const results = await searchCatalogItemsByKeyword(keyword);
    for (const item of results) {
      itemsToProcess.push({
        asin: item.asin || null,
        sku: item.asin || `KW-${Date.now()}`,
        title: item.summaries?.[0]?.itemName || "",
        price: 0,
        quantity: 0,
        fulfillmentChannel: "MFN",
        lastSynced: new Date(),
      });
    }
  } else {
    const listings = await getSellerListings();
    itemsToProcess = listings.map(normalizeListingItem);
  }

  if (itemsToProcess.length === 0) {
    return res.json({
      success: true,
      data: { synced: 0, products: [] },
      message: "No products found to sync",
    });
  }

  const upsertedProducts = [];
  for (const product of itemsToProcess) {
    if (!product.sku) continue;

    const updated = await Product.findOneAndUpdate(
      { sku: product.sku },
      { $set: product },
      { upsert: true, new: true, runValidators: true },
    );
    upsertedProducts.push(updated);
  }

  return res.json({
    success: true,
    data: {
      synced: upsertedProducts.length,
      products: upsertedProducts,
    },
    message: `Successfully synced ${upsertedProducts.length} product(s) from Amazon`,
  });
};

const getProducts = async (req, res) => {
  const { fulfillmentChannel, sku, page = 1, limit = 50 } = req.query;

  const filter = {};

  if (fulfillmentChannel) {
    const channel = fulfillmentChannel.toUpperCase();
    if (!["AFN", "MFN"].includes(channel)) {
      return res.status(400).json({
        success: false,
        message: "fulfillmentChannel must be 'AFN' or 'MFN'",
      });
    }
    filter.fulfillmentChannel = channel;
  }

  if (sku) {
    filter.sku = { $regex: sku, $options: "i" };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return res.json({
    success: true,
    data: {
      products,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
    message: `Found ${products.length} product(s)`,
  });
};

const downloadAfnProducts = async (req, res) => {
  const products = await Product.find({ fulfillmentChannel: "AFN" }).lean();

  if (products.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No AFN products found",
    });
  }

  const csvContent = await generateProductsCsv(products);
  const filename = `afn-products-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", Buffer.byteLength(csvContent, "utf8"));

  return res.send(csvContent);
};

const downloadMfnProducts = async (req, res) => {
  const products = await Product.find({ fulfillmentChannel: "MFN" }).lean();

  if (products.length === 0) {
    return res.status(404).json({
      success: false,
      message: "No MFN products found",
    });
  }

  const csvContent = await generateProductsCsv(products);
  const filename = `mfn-products-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", Buffer.byteLength(csvContent, "utf8"));

  return res.send(csvContent);
};

export { syncProducts, getProducts, downloadAfnProducts, downloadMfnProducts };
