import Product from "../models/productModel.js";
import FeedJob from "../models/feedJobModel.js";
import {
  parseStockFile,
  validateStockRow,
  deleteFileIfExists,
} from "../services/fileService.js";
import {
  createFeedDocument,
  uploadFeedContent,
  submitFeed,
  getFeedStatus,
  buildInventoryFeedPayload,
} from "../services/amazonServices.js";

const importStockFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message:
        'No file uploaded. Use multipart/form-data with field name "file"',
    });
  }

  const { path: filePath, originalname } = req.file;

  let rows;
  try {
    rows = await parseStockFile(filePath, originalname);
  } catch (parseError) {
    deleteFileIfExists(filePath);
    return res.status(400).json({
      success: false,
      message: `File parsing failed: ${parseError.message}`,
    });
  }

  if (!rows || rows.length === 0) {
    deleteFileIfExists(filePath);
    return res.status(400).json({
      success: false,
      message: "The uploaded file is empty or has no data rows",
    });
  }

  const importedSkus = [];
  const skippedRows = [];
  const errors = [];

  for (let i = 0; i < rows.length; i++) {
    const rowIndex = i + 2;
    const validation = validateStockRow(rows[i], rowIndex);

    if (!validation.valid) {
      skippedRows.push(rows[i]);
      errors.push(validation.error);
      continue;
    }

    const { sku, quantity } = validation.data;

    const updated = await Product.findOneAndUpdate(
      { sku },
      {
        $set: {
          quantity,
          quantityUpdatedAt: new Date(),
          feedSubmitted: false,
        },
      },
      { new: true },
    );

    if (!updated) {
      skippedRows.push(rows[i]);
      errors.push(
        `Row ${rowIndex} (SKU: ${sku}): SKU not found in database — skipped`,
      );
      continue;
    }

    importedSkus.push(sku);
  }

  deleteFileIfExists(filePath);

  return res.json({
    success: true,
    data: {
      imported: importedSkus.length,
      skipped: skippedRows.length,
      errors,
      importedSkus,
    },
    message: `Import complete: ${importedSkus.length} updated, ${skippedRows.length} skipped`,
  });
};

const pushStockToAmazon = async (req, res) => {
  const products = await Product.find({
    quantityUpdatedAt: { $ne: null },
    feedSubmitted: false,
  }).lean();

  if (products.length === 0) {
    return res.status(400).json({
      success: false,
      message:
        "No products with pending quantity updates found. Import a stock file first.",
    });
  }

  const { feedDocumentId, uploadUrl } = await createFeedDocument();

  const feedPayload = buildInventoryFeedPayload(
    products.map((p) => ({ sku: p.sku, quantity: p.quantity })),
  );

  await uploadFeedContent(uploadUrl, feedPayload);

  const feedSubmission = await submitFeed(feedDocumentId, "JSON_LISTINGS_FEED");
  const feedId = feedSubmission.feedId;

  const feedJob = await FeedJob.create({
    feedId,
    feedType: "JSON_LISTINGS_FEED",
    status: "SUBMITTED",
    submittedAt: new Date(),
    skusIncluded: products.map((p) => p.sku),
    rawResponse: feedSubmission,
  });

  await Product.updateMany(
    { sku: { $in: products.map((p) => p.sku) } },
    { $set: { feedSubmitted: true } },
  );

  return res.json({
    success: true,
    data: {
      feedId,
      feedDocumentId,
      status: "SUBMITTED",
      skusSubmitted: products.length,
      feedJob,
    },
    message: `Feed submitted to Amazon for ${products.length} product(s). Feed ID: ${feedId}`,
  });
};

const getFeedStatusById = async (req, res) => {
  const { feedId } = req.params;

  if (!feedId) {
    return res
      .status(400)
      .json({ success: false, message: "feedId param is required" });
  }

  let feedJob = await FeedJob.findOne({ feedId });

  if (!feedJob) {
    return res.status(404).json({
      success: false,
      message: `Feed job with ID '${feedId}' not found in database`,
    });
  }

  if (["DONE", "FATAL", "CANCELLED"].includes(feedJob.status)) {
    return res.json({
      success: true,
      data: feedJob,
      message: `Feed ${feedId} is in terminal state: ${feedJob.status}`,
    });
  }

  const amazonStatus = await getFeedStatus(feedId);

  feedJob = await FeedJob.findOneAndUpdate(
    { feedId },
    {
      $set: {
        status: amazonStatus.processingStatus,
        processedAt: amazonStatus.processingEndTime
          ? new Date(amazonStatus.processingEndTime)
          : null,
        resultFeedDocumentId: amazonStatus.resultFeedDocumentId || null,
        rawResponse: amazonStatus,
      },
    },
    { new: true },
  );

  return res.json({
    success: true,
    data: {
      feedJob,
      amazonRaw: amazonStatus,
    },
    message: `Feed status: ${amazonStatus.processingStatus}`,
  });
};

export { importStockFile, pushStockToAmazon, getFeedStatusById };
