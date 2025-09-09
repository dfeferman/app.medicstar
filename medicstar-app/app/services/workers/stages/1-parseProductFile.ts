import * as fs from "fs";
import * as path from "path";
import XLSX from "xlsx";
import prisma from "../../../db.server";

type RowRecord = Record<string, unknown>;

const DOWNLOADS_DIR = "downloads";

const headerAliases: Record<string, string[]> = {
  gruppeId: ["gruppeid"],
  title: ["titel"],
  vendor: ["hersteller"],
  sku: ["produktnummer"],
  description: ["beschreibung"],
  priceNetto: ["ek netto"],
  quantity: ["lagerbestand"],
  deliveryTime: ["lieferzeit"],
  collection1: ["kategorie 1"],
  collection2: ["kategorie 2"],
  collection3: ["kategorie 3"],
  collection4: ["kategorie 4"],
  listOfAdvantages: ["listofadvantages"],
  metaTitle: ["meta-titel"],
  metaDescription: ["meta beschreibung"],
};

function getLatestXlsxFile(downloadsAbsolutePath: string): string | null {
  if (!fs.existsSync(downloadsAbsolutePath)) return null;
  const entries = fs
    .readdirSync(downloadsAbsolutePath)
    .filter((f) => f.toLowerCase().endsWith(".xlsx"))
    .map((f) => path.join(downloadsAbsolutePath, f))
    .map((fullPath) => ({
      fullPath,
      mtimeMs: fs.statSync(fullPath).mtimeMs,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return entries.length > 0 ? entries[0].fullPath : null;
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

function buildLowerKeyMap(row: RowRecord): Record<string, unknown> {
  const lowerMap: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    lowerMap[normalizeKey(String(rawKey))] = value;
  }
  return lowerMap;
}

function pickFirst(rowLower: Record<string, unknown>, candidates: string[]): unknown {
  for (const c of candidates) {
    if (c in rowLower) return rowLower[c];
  }
  return undefined;
}

function toStringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toNullableString(value: unknown): string | null {
  const s = toStringOrEmpty(value);
  return s.length === 0 ? null : s;
}

function toIntegerOrZero(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function toPriceStringOrZero(value: unknown): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

async function createOrUpdateProductFromRow(row: RowRecord): Promise<void> {
  const lower = buildLowerKeyMap(row);

  const gruppeIdRaw = pickFirst(lower, headerAliases.gruppeId);
  const gruppeIdStr = toStringOrEmpty(gruppeIdRaw);
  const isProductRow = gruppeIdStr === "";
  if (!isProductRow) return; // only create products for rows where GruppeID is empty

  const title = toStringOrEmpty(pickFirst(lower, headerAliases.title));
  const vendor = toStringOrEmpty(pickFirst(lower, headerAliases.vendor));
  const sku = toStringOrEmpty(pickFirst(lower, headerAliases.sku));

  const description = toNullableString(pickFirst(lower, headerAliases.description));
  const priceNetto = toPriceStringOrZero(pickFirst(lower, headerAliases.priceNetto));
  const quantity = toIntegerOrZero(pickFirst(lower, headerAliases.quantity));
  const deliveryTime = toStringOrEmpty(pickFirst(lower, headerAliases.deliveryTime));
  const collection1 = toStringOrEmpty(pickFirst(lower, headerAliases.collection1));
  const collection2 = toNullableString(pickFirst(lower, headerAliases.collection2));
  const collection3 = toNullableString(pickFirst(lower, headerAliases.collection3));
  const collection4 = toNullableString(pickFirst(lower, headerAliases.collection4));
  const listOfAdvantages = toStringOrEmpty(pickFirst(lower, headerAliases.listOfAdvantages));
  const metaTitle = toNullableString(pickFirst(lower, headerAliases.metaTitle));
  const metaDescription = toNullableString(pickFirst(lower, headerAliases.metaDescription));

  if (!title || !vendor || !sku) {
    console.warn(
      `[stage-1] Skipping row due to missing required fields (title/vendor/SKU). Row keys: ${Object.keys(row).join(", ")}`
    );
    return;
  }

  const now = new Date();

  const existing = await prisma.product.findFirst({ where: { SKU: sku } });
  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: {
        title,
        vendor,
        SKU: sku,
        groupId: 0,
        description,
        priceNetto,
        quantity,
        deliveryTime,
        collection1,
        collection2,
        collection3,
        collection4,
        listOfAdvantages,
        metaTitle,
        metaDescription,
        lastSyncedAt: now,
      },
    });
    console.log(`[stage-1] Updated product SKU=${sku}`);
  } else {
    await prisma.product.create({
      data: {
        title,
        vendor,
        SKU: sku,
        groupId: 0,
        description,
        priceNetto,
        quantity,
        deliveryTime,
        collection1,
        collection2,
        collection3,
        collection4,
        listOfAdvantages,
        metaTitle,
        metaDescription,
        lastSyncedAt: now,
      },
    });
    console.log(`[stage-1] Created product SKU=${sku}`);
  }
}

export async function parseLatestDownloadedFile(): Promise<void> {
  const downloadsPath = path.resolve(process.cwd(), DOWNLOADS_DIR);
  const latest = getLatestXlsxFile(downloadsPath);
  if (!latest) {
    console.error(`[stage-1] No .xlsx files found in ${downloadsPath}`);
    return;
  }
  console.log(`[stage-1] Parsing file: ${latest}`);

  const workbook = XLSX.readFile(latest);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<RowRecord>(sheet, { defval: null });

  let processed = 0;
  for (const row of rows) {
    try {
      await createOrUpdateProductFromRow(row);
      processed += 1;
    } catch (err) {
      console.error(`[stage-1] Error processing row`, err);
    }
  }
  console.log(`[stage-1] Finished. Processed ${processed} rows.`);
}

// Execute when run directly
parseLatestDownloadedFile()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });


