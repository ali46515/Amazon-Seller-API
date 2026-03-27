import express from "express";
const router = express.Router();
import { upload } from "../config/multer.js";

import {
  importStockFile,
  pushStockToAmazon,
  getFeedStatusById,
} from "../controllers/stockController.js";

router.post("/import", upload.single("file"), importStockFile);

router.post("/push-to-amazon", pushStockToAmazon);

router.get("/feed-status/:feedId", getFeedStatusById);

export default router;
