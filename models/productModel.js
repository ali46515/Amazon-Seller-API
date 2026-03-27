import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    asin: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: "",
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    fulfillmentChannel: {
      type: String,
      enum: ["AFN", "MFN"],
      default: "MFN",
      uppercase: true,
    },
    lastSynced: {
      type: Date,
      default: null,
    },
    quantityUpdatedAt: {
      type: Date,
      default: null,
    },
    feedSubmitted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ quantityUpdatedAt: -1 });
productSchema.index({ fulfillmentChannel: 1 });

const Product = mongoose.model("Product", productSchema);

export default Product;
