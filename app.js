import { config } from "dotenv";
config();

import express from "express";
import "express-async-errors";
import cors from "cors";
import morgan from "morgan";

import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import errorHandler from "./middlewares/errorHandler.js";

const app = express();

connectDB();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/products", productRoutes);
app.use("/api/stock", stockRoutes);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Amazon Seller Backend is running",
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res
    .status(404)
    .json({ success: false, message: `Route ${req.originalUrl} not found` });
});

app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
