import fs from "fs";
import path from "path";
import { format } from "@fast-csv/format";
import csv from "fast-csv";
import XLSX from "xlsx";

const parseCsv = (filePath) => {
  return new Promise((resolve, reject) => {
    const rows = [];

    fs.createReadStream(filePath)
      .pipe(
        csv.parse({
          headers: true,
          trim: true,
          ignoreEmpty: true,
          skipLines: 0,
        }),
      )
      .on("data", (row) => rows.push(row))
      .on("end", () => resolve(rows))
      .on("error", (err) => reject(err));
  });
};

const parseExcel = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  return rows;
};

const parseStockFile = async (filePath, originalName) => {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".csv") {
    return await parseCsv(filePath);
  } else if (ext === ".xlsx" || ext === ".xls") {
    return parseExcel(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Use .csv or .xlsx`);
  }
};

const validateStockRow = (row, rowIndex) => {
  const normalized = {};
  for (const key of Object.keys(row)) {
    normalized[key.toLowerCase().trim()] = String(row[key]).trim();
  }

  const sku = normalized["sku"];
  const quantityRaw = normalized["quantity"];

  if (!sku) {
    return {
      valid: false,
      error: `Row ${rowIndex}: missing or empty 'sku'`,
      row,
    };
  }

  if (quantityRaw === "" || quantityRaw === undefined || quantityRaw === null) {
    return {
      valid: false,
      error: `Row ${rowIndex} (SKU: ${sku}): missing 'quantity'`,
      row,
    };
  }

  const quantity = Number(quantityRaw);

  if (isNaN(quantity) || !Number.isInteger(quantity) || quantity < 0) {
    return {
      valid: false,
      error: `Row ${rowIndex} (SKU: ${sku}): 'quantity' must be a non-negative integer, got '${quantityRaw}'`,
      row,
    };
  }

  return { valid: true, data: { sku, quantity } };
};

const generateProductsCsv = (products) => {
  return new Promise((resolve, reject) => {
    const chunks = [];

    const csvStream = format({
      headers: ["sku", "asin", "title", "quantity", "price"],
      writeHeaders: true,
      delimiter: ",",
      quoteColumns: true,
    });

    csvStream.on("data", (chunk) => chunks.push(chunk));
    csvStream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    csvStream.on("error", reject);

    for (const product of products) {
      csvStream.write({
        sku: product.sku || "",
        asin: product.asin || "",
        title: product.title || "",
        quantity: product.quantity ?? 0,
        price:
          typeof product.price === "number" ? product.price.toFixed(2) : "0.00",
      });
    }

    csvStream.end();
  });
};

const deleteFileIfExists = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`Could not delete temp file ${filePath}:`, err.message);
  }
};

export {
  parseStockFile,
  validateStockRow,
  generateProductsCsv,
  deleteFileIfExists,
};
