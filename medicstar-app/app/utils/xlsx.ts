
import * as fs from "fs";
import * as path from "path";
import { Decimal } from "@prisma/client/runtime/library";
type RowRecord = Record<string, unknown>;

export function getLatestXlsxFile(downloadsAbsolutePath: string): string | null {
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

export function normalizeKey(key: string): string {
  return key.trim().toLowerCase();
}

export function buildLowerKeyMap(row: RowRecord): Record<string, unknown> {
  const lowerMap: Record<string, unknown> = {};
  for (const [rawKey, value] of Object.entries(row)) {
    lowerMap[normalizeKey(String(rawKey))] = value;
  }
  return lowerMap;
}

export function pickFirst(rowLower: Record<string, unknown>, candidates: string[]): unknown {
  for (const c of candidates) {
    if (c in rowLower) return rowLower[c];
  }
  return undefined;
}

export function toStringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function toNullableString(value: unknown): string | null {
  const s = toStringOrEmpty(value);
  return s.length === 0 ? null : s;
}

export function toIntegerOrZero(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function toPriceStringOrZero(value: unknown): string {
  if (value === null || value === undefined || value === "") return "0.00";
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
}

export function normalizePriceForComparison(price: string | number | Decimal): string {
  if (typeof price === 'number') {
    return price.toFixed(2);
  }
  if (price instanceof Decimal) {
    return price.toFixed(2);
  }
  const num = Number(price);
  if (!Number.isFinite(num)) return "0.00";
  return num.toFixed(2);
}

export function arePricesEqual(price1: string | number | Decimal, price2: string | number | Decimal): boolean {
  return normalizePriceForComparison(price1) === normalizePriceForComparison(price2);
}

export function toIntegerOrNull(value: unknown): number | null {
  const s = toStringOrEmpty(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function deriveBaseTitle(fullTitle: string, variantValue: string): string {
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
