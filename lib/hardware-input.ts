import type { InventoryItem } from "@/lib/db";

export type ScaleTargetUnit = InventoryItem["unit"];

export interface ParsedScaleReading {
  valid: boolean;
  quantity: number;
  normalizedUnit: string;
  rawText: string;
  error?: string;
}

const GRAMS_PER_KG = 1000;
const GRAMS_PER_LB = 453.59237;
const GRAMS_PER_OZ = 28.349523125;

function roundQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function convertWeightUnit(
  value: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  if (from === to) return value;

  // Mass conversions (g, kg, oz, lbs)
  const massToGrams: Record<string, number> = {
    g: 1,
    gm: 1,
    gms: 1,
    gram: 1,
    grams: 1,
    kg: GRAMS_PER_KG,
    kgs: GRAMS_PER_KG,
    oz: GRAMS_PER_OZ,
    lb: GRAMS_PER_LB,
    lbs: GRAMS_PER_LB,
  };

  if (from in massToGrams && to in massToGrams) {
    const grams = value * massToGrams[from];
    return grams / massToGrams[to];
  }

  // Volume conversions (ml, l)
  const volToMl: Record<string, number> = {
    ml: 1,
    l: 1000,
    ltr: 1000,
    liter: 1000,
    litre: 1000,
  };

  if (from in volToMl && to in volToMl) {
    const ml = value * volToMl[from];
    return ml / volToMl[to];
  }

  // Discrete unit aliases
  const discreteUnits = new Set(["unit", "units", "pcs", "pc", "count", "ea"]);
  if (discreteUnits.has(from) && discreteUnits.has(to)) {
    return value;
  }

  return null;
}

/**
 * Parses USB HID / RS-232 serial weighing scale outputs such as:
 * - "ST,GS,+001.450kg"
 * - "US,NT,+000.750 kg"
 * - "1.450 kg"
 * - "1450 g"
 * - "500 ml"
 * - "2.5"
 * into normalized numeric quantities in `targetUnit`.
 */
export function parseScaleWeightReading(
  rawInput: string,
  targetUnit: ScaleTargetUnit = "kg",
): ParsedScaleReading {
  const rawText = String(rawInput ?? "").trim();
  if (!rawText) {
    return {
      valid: false,
      quantity: 0,
      normalizedUnit: targetUnit,
      rawText,
      error: "Empty scale reading.",
    };
  }

  // Match optional serial status prefix (e.g. "ST,GS,", "US,NT,"), signed decimal, and optional unit
  const serialMatch = rawText.match(
    /^(?:[A-Z]{2}\s*,\s*[A-Z]{2}\s*,\s*)?([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/i,
  );

  if (!serialMatch) {
    return {
      valid: false,
      quantity: 0,
      normalizedUnit: targetUnit,
      rawText,
      error: `Unrecognized scale reading format: "${rawText}"`,
    };
  }

  const parsedNumber = Number.parseFloat(serialMatch[1]);
  const detectedUnit = (serialMatch[2] || "").trim().toLowerCase();

  if (!Number.isFinite(parsedNumber) || parsedNumber <= 0) {
    return {
      valid: false,
      quantity: 0,
      normalizedUnit: targetUnit,
      rawText,
      error: "Scale reading must be a positive number.",
    };
  }

  if (!detectedUnit) {
    return {
      valid: true,
      quantity: roundQuantity(parsedNumber),
      normalizedUnit: targetUnit,
      rawText,
    };
  }

  const converted = convertWeightUnit(parsedNumber, detectedUnit, targetUnit);
  if (converted === null) {
    return {
      valid: false,
      quantity: 0,
      normalizedUnit: targetUnit,
      rawText,
      error: `Incompatible scale unit "${detectedUnit}" for target unit "${targetUnit}".`,
    };
  }

  return {
    valid: true,
    quantity: roundQuantity(converted),
    normalizedUnit: targetUnit,
    rawText,
  };
}

/**
 * Matches a scanned barcode / SKU string case-insensitively against
 * `sku`, `id`, or `ingredientId` across a kitchen's inventory list.
 */
export function resolveScannedIngredient(
  scanCode: string,
  ingredients: InventoryItem[],
): InventoryItem | null {
  const normalized = String(scanCode ?? "").trim().toLowerCase();
  if (!normalized) return null;

  return (
    ingredients.find(
      (item) =>
        item.sku.trim().toLowerCase() === normalized ||
        item.id.trim().toLowerCase() === normalized ||
        (item.ingredientId &&
          item.ingredientId.trim().toLowerCase() === normalized),
    ) ?? null
  );
}
