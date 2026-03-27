import mongoose from "mongoose";

const feedJobSchema = new mongoose.Schema(
  {
    feedId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    feedType: {
      type: String,
      required: true,
      default: "JSON_LISTINGS_FEED",
    },
    status: {
      type: String,
      enum: ["SUBMITTED", "IN_PROGRESS", "CANCELLED", "DONE", "FATAL"],
      default: "SUBMITTED",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    resultFeedDocumentId: {
      type: String,
      default: null,
    },
    skusIncluded: {
      type: [String],
      default: [],
    },
    errorDetails: {
      type: String,
      default: null,
    },
    rawResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const FeedJob = mongoose.model("FeedJob", feedJobSchema);

export default FeedJob;
