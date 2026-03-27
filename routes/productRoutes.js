import express from "express";
const router = express.Router();

const {
  syncProducts,
  getProducts,
  downloadAfnProducts,
  downloadMfnProducts,
} = require("../controllers/productsController.js");

router.get("/download/afn", downloadAfnProducts);
router.get("/download/mfn", downloadMfnProducts);

router.get("/sync", syncProducts);

router.get("/", getProducts);

export default router;
