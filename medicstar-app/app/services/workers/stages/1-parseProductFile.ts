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
  optionName: ["ausprägungsauswahl"],
  optionValue: ["varianten"],
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

function toIntegerOrNull(value: unknown): number | null {
  const s = toStringOrEmpty(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function deriveBaseTitle(fullTitle: string, variantValue: string): string {
  if (!fullTitle) return fullTitle;
  if (!variantValue) return fullTitle;
  const valueTrim = variantValue.trim();
  if (!valueTrim) return fullTitle;
  const trailingRegex = new RegExp(`\\s+${escapeRegExp(valueTrim)}$`, "i");
  let base = fullTitle.replace(trailingRegex, "");
  if (base === fullTitle) {
    const anywhereRegex = new RegExp(`\\b${escapeRegExp(valueTrim)}\\b`, "i");
    base = fullTitle.replace(anywhereRegex, "");
  }
  return base.replace(/\s{2,}/g, " ").trim();
}

async function createOrUpdateProductFromRow(row: RowRecord, fixedLastSyncedAt: Date): Promise<void> {
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
        lastSyncedAt: fixedLastSyncedAt,
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
        lastSyncedAt: fixedLastSyncedAt,
      },
    });
    console.log(`[stage-1] Created product SKU=${sku}`);
  }
}

async function processVariantGroup(rows: RowRecord[], fixedLastSyncedAt: Date): Promise<void> {
  if (rows.length === 0) return;
  const firstLower = buildLowerKeyMap(rows[0]);
  const gruppeIdVal = pickFirst(firstLower, headerAliases.gruppeId);
  const gruppeIdStr = toStringOrEmpty(gruppeIdVal);
  const groupId = toIntegerOrNull(gruppeIdStr);
  if (groupId === null) return;

  const optionName = toStringOrEmpty(pickFirst(firstLower, headerAliases.optionName));

  const firstTitle = toStringOrEmpty(pickFirst(firstLower, headerAliases.title));
  const firstVariantValue = toStringOrEmpty(pickFirst(firstLower, headerAliases.optionValue));
  const baseTitle = deriveBaseTitle(firstTitle, firstVariantValue);

  const vendor = toStringOrEmpty(pickFirst(firstLower, headerAliases.vendor));
  const description = toNullableString(pickFirst(firstLower, headerAliases.description));
  const deliveryTime = toStringOrEmpty(pickFirst(firstLower, headerAliases.deliveryTime));
  const collection1 = toStringOrEmpty(pickFirst(firstLower, headerAliases.collection1));
  const collection2 = toNullableString(pickFirst(firstLower, headerAliases.collection2));
  const collection3 = toNullableString(pickFirst(firstLower, headerAliases.collection3));
  const collection4 = toNullableString(pickFirst(firstLower, headerAliases.collection4));
  const listOfAdvantages = toStringOrEmpty(pickFirst(firstLower, headerAliases.listOfAdvantages));
  const metaTitle = toNullableString(pickFirst(firstLower, headerAliases.metaTitle));
  const metaDescription = toNullableString(pickFirst(firstLower, headerAliases.metaDescription));

  // Aggregate quantity across variants for the parent
  const totalQuantity = rows.reduce((sum, r) => {
    const lowerMap = buildLowerKeyMap(r);
    return sum + toIntegerOrZero(pickFirst(lowerMap, headerAliases.quantity));
  }, 0);
  const firstPrice = toPriceStringOrZero(pickFirst(firstLower, headerAliases.priceNetto));

  // Upsert parent product by groupId
  const parentSku = `group-${groupId}-parent`;
  const existingParent = await prisma.product.findFirst({ where: { groupId } });
  let parentId: number;
  if (existingParent) {
    const updated = await prisma.product.update({
      where: { id: existingParent.id },
      data: {
        title: baseTitle || existingParent.title,
        vendor,
        SKU: parentSku,
        groupId: groupId,
        description,
        priceNetto: firstPrice,
        quantity: totalQuantity,
        deliveryTime,
        collection1,
        collection2,
        collection3,
        collection4,
        listOfAdvantages,
        metaTitle,
        metaDescription,
        lastSyncedAt: fixedLastSyncedAt,
      },
    });
    parentId = updated.id;
    console.log(`[stage-1] Updated parent product for groupId=${groupId}`);
  } else {
    const created = await prisma.product.create({
      data: {
        title: baseTitle || "",
        vendor,
        SKU: parentSku,
        groupId: groupId,
        description,
        priceNetto: firstPrice,
        quantity: totalQuantity,
        deliveryTime,
        collection1,
        collection2,
        collection3,
        collection4,
        listOfAdvantages,
        metaTitle,
        metaDescription,
        lastSyncedAt: fixedLastSyncedAt,
      },
    });
    parentId = created.id;
    console.log(`[stage-1] Created parent product for groupId=${groupId}`);
  }

  // Upsert variants by SKU under the parent
  for (const row of rows) {
    const lower = buildLowerKeyMap(row);
    const rowTitle = toStringOrEmpty(pickFirst(lower, headerAliases.title));
    const variantValue = toStringOrEmpty(pickFirst(lower, headerAliases.optionValue));
    // Variant title must be the value from Varianten column
    const variantTitle = variantValue || rowTitle || baseTitle;
    const sku = toStringOrEmpty(pickFirst(lower, headerAliases.sku));
    if (!sku) {
      console.warn(`[stage-1] Skipping variant with empty SKU in groupId=${groupId}`);
      continue;
    }
    const priceNetto = toPriceStringOrZero(pickFirst(lower, headerAliases.priceNetto));
    const quantity = toIntegerOrZero(pickFirst(lower, headerAliases.quantity));
    const vListOfAdvantages = toStringOrEmpty(pickFirst(lower, headerAliases.listOfAdvantages));

    const existingVariant = await prisma.productVariant.findFirst({ where: { SKU: sku } });
    if (existingVariant) {
      await prisma.productVariant.update({
        where: { id: existingVariant.id },
        data: {
          title: variantTitle,
          SKU: sku,
          groupId: groupId,
          priceNetto,
          quantity,
          productId: parentId,
          lastSyncedAt: fixedLastSyncedAt,
        },
      });
      console.log(`[stage-1] Updated variant SKU=${sku} for groupId=${groupId}`);
    } else {
      await prisma.productVariant.create({
        data: {
          title: variantTitle,
          optionName,
          SKU: sku,
          groupId,
          priceNetto,
          quantity,
          productId: parentId,
          lastSyncedAt: fixedLastSyncedAt,
        },
      });
      console.log(`[stage-1] Created variant SKU=${sku} for groupId=${groupId}`);
    }
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

  const fixedLastSyncedAt = new Date();
  const groups = new Map<number, RowRecord[]>();
  const standalone: RowRecord[] = [];

  for (const row of rows) {
    const lower = buildLowerKeyMap(row);
    const gruppeIdRaw = pickFirst(lower, headerAliases.gruppeId);
    const gruppeIdStr = toStringOrEmpty(gruppeIdRaw);
    const maybeId = toIntegerOrNull(gruppeIdStr);
    if (gruppeIdStr === "" || maybeId === null) {
      standalone.push(row);
    } else {
      const gid = maybeId;
      const list = groups.get(gid) ?? [];
      list.push(row);
      groups.set(gid, list);
    }
  }

  let processed = 0;
  // First, process standalone (no variants)
  for (const row of standalone) {
    try {
      await createOrUpdateProductFromRow(row, fixedLastSyncedAt);
      processed += 1;
    } catch (err) {
      console.error(`[stage-1] Error processing standalone row`, err);
    }
  }

  // Then process variant groups
  for (const [gid, list] of groups.entries()) {
    try {
      await processVariantGroup(list, fixedLastSyncedAt);
      processed += list.length;
    } catch (err) {
      console.error(`[stage-1] Error processing variant group ${gid}`, err);
    }
  }

  console.log(`[stage-1] Finished. Processed ${processed} rows across ${standalone.length} standalone and ${groups.size} variant group(s).`);
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


