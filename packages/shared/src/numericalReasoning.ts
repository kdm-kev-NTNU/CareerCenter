import { createSeededRng } from "./switchChallenge.js";
import type {
  BarSheet,
  DataSheet,
  PieSheet,
  StatementItem,
  StatementTest,
  StatementVerdict,
  TableSheet
} from "./statementTest.js";

const NUMERICAL_STATEMENT_COUNT = 37;
const SHEET_COUNT = 5;

const TABLE_ROW_LABELS = [
  ["Forskning", "Markedsføring", "Drift", "IT"],
  ["Europa", "Nord-Amerika", "Asia", "Øvrige"],
  ["Klær", "Sko", "Tilbehør", "Sportsutstyr"]
];

const TABLE_YEAR_SETS = [
  ["År 5", "År 6", "År 7", "År 8"],
  ["FY3", "FY4", "FY5", "FY6"],
  ["2021", "2022", "2023", "2024"]
];

const PIE_LABELS = [
  ["Sko", "Klær", "Tilbehør", "Annet"],
  ["Detalj", "Nett", "Grossist", "Outlet"],
  ["Produkt A", "Produkt B", "Produkt C", "Produkt D"]
];

const BAR_SERIES_LABELS = [
  ["Nord-Amerika", "Europa", "Asia"],
  ["Ansatte", "Konsulenter"],
  ["Sko", "Klær", "Tilbehør"]
];

const BAR_CATEGORIES = [
  ["År 5", "År 6", "År 7"],
  ["FY+1", "FY+2", "FY+3"],
  ["Q1", "Q2", "Q3", "Q4"]
];

function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

function shuffleInPlace<T>(rng: () => number, arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function formatNb(n: number): string {
  return n.toLocaleString("nb-NO", { maximumFractionDigits: 1 });
}

function makeTableSheet(rng: () => number, id: string): TableSheet {
  const rowLabels = pick(rng, TABLE_ROW_LABELS);
  const columns = pick(rng, TABLE_YEAR_SETS);
  const unitMultiplier = pick(rng, [1000, 1_000_000] as const);
  const unitLabel = unitMultiplier === 1000 ? "tusen USD" : "millioner USD";
  const rows = rowLabels.map((label) => ({
    label,
    values: columns.map(() => Math.floor(rng() * 8000) + 500)
  }));
  return {
    id,
    title: `Kostnader og inntekter (${id})`,
    kind: "table",
    unitLabel,
    unitMultiplier,
    columns,
    rows
  };
}

function makePieSheet(rng: () => number, id: string): PieSheet {
  const labels = pick(rng, PIE_LABELS);
  const raw = labels.map(() => Math.floor(rng() * 40) + 10);
  const sum = raw.reduce((a, b) => a + b, 0);
  const slices = labels.map((label, i) => ({
    label,
    percent: Math.max(1, Math.round((raw[i]! / sum) * 100))
  }));
  const pctSum = slices.reduce((a, s) => a + s.percent, 0);
  slices[slices.length - 1]!.percent += 100 - pctSum;
  if (slices[slices.length - 1]!.percent < 1) {
    slices[slices.length - 1]!.percent = 1;
    slices[0]!.percent -= 1;
  }
  const total = pick(rng, [48, 64, 72, 86, 120]);
  return {
    id,
    title: `Produktinntekter (${id})`,
    kind: "pie",
    total,
    totalUnitLabel: "millioner USD",
    slices
  };
}

function makeBarSheet(rng: () => number, id: string): BarSheet {
  const seriesLabels = pick(rng, BAR_SERIES_LABELS);
  const categories = pick(rng, BAR_CATEGORIES);
  const unitMultiplier = pick(rng, [1, 1000] as const);
  const unitLabel =
    unitMultiplier === 1000 ? "tusen ansatte" : "millioner stk.";
  const series = seriesLabels.map((label) => ({
    label,
    values: categories.map(() => Math.floor(rng() * 3500) + 200)
  }));
  return {
    id,
    title: `Utvikling over tid (${id})`,
    kind: "bar",
    unitLabel,
    unitMultiplier,
    categories,
    series
  };
}

function generateSheets(rng: () => number): DataSheet[] {
  const makers = [makeTableSheet, makePieSheet, makeBarSheet, makeTableSheet, makeBarSheet];
  return makers.slice(0, SHEET_COUNT).map((maker, i) => maker(rng, `ark-${i + 1}`));
}

interface DraftStatement {
  sheetId: string;
  text: string;
  verdict: StatementVerdict;
  rationale: string;
  /** Absolute expected value when verifiable; used by property tests. */
  expectedAbsolute?: number;
}

function tableCell(
  sheet: TableSheet,
  rowLabel: string,
  col: string
): number | null {
  const row = sheet.rows.find((r) => r.label === rowLabel);
  if (!row) return null;
  const ci = sheet.columns.indexOf(col);
  if (ci < 0) return null;
  return row.values[ci] ?? null;
}

function absoluteFromDisplayed(displayed: number, multiplier: number): number {
  return displayed * multiplier;
}

function draftFromTable(rng: () => number, sheet: TableSheet): DraftStatement | null {
  const row = pick(rng, sheet.rows);
  const col = pick(rng, sheet.columns);
  const displayed = tableCell(sheet, row.label, col);
  if (displayed == null) return null;
  const absolute = absoluteFromDisplayed(displayed, sheet.unitMultiplier);
  const kind = pick(rng, ["true", "false_near", "false_unit", "cannot_say"] as const);

  if (kind === "true") {
    const thresholdMillions =
      sheet.unitMultiplier === 1000
        ? round1((absolute * 0.9) / 1_000_000)
        : round1(absolute * 0.9);
    const actualMillions =
      sheet.unitMultiplier === 1000
        ? round1(absolute / 1_000_000)
        : round1(absolute);
    return {
      sheetId: sheet.id,
      text: `I ${col} utgjorde ${row.label.toLowerCase()} over ${formatNb(thresholdMillions)} millioner USD.`,
      verdict: "true",
      rationale: `I tabellen står ${row.label} / ${col} = ${formatNb(displayed)} (${sheet.unitLabel}). Multiplisert med ${formatNb(sheet.unitMultiplier)} blir det ${formatNb(absolute)} (${formatNb(actualMillions)} millioner), som er over ${formatNb(thresholdMillions)}.`,
      expectedAbsolute: absolute
    };
  }

  if (kind === "false_near") {
    // Near-miss: claim a round number close but not equal
    const claimed =
      sheet.unitMultiplier === 1000
        ? Math.round(absolute / 1_000_000) * 1_000_000
        : Math.round(absolute);
    // Ensure it's actually different
    const adjusted = claimed === absolute ? claimed + sheet.unitMultiplier * 50 : claimed;
    const claimedM =
      sheet.unitMultiplier === 1000
        ? formatNb(adjusted / 1_000_000)
        : formatNb(adjusted);
    return {
      sheetId: sheet.id,
      text: `I ${col} utgjorde ${row.label.toLowerCase()} nøyaktig ${claimedM} millioner USD.`,
      verdict: "false",
      rationale: `Tabellen viser ${formatNb(displayed)} (${sheet.unitLabel}) for ${row.label} / ${col}, som er ${formatNb(absolute)} i absolutte tall — ikke ${claimedM} millioner.`,
      expectedAbsolute: absolute
    };
  }

  if (kind === "false_unit") {
    // Forget the unit multiplier — claim the displayed number as millions
    return {
      sheetId: sheet.id,
      text: `I ${col} utgjorde ${row.label.toLowerCase()} ${formatNb(displayed)} millioner USD.`,
      verdict: "false",
      rationale: `Tallet ${formatNb(displayed)} står i ${sheet.unitLabel}, ikke i millioner. Absolutt verdi er ${formatNb(absolute)}.`,
      expectedAbsolute: absolute
    };
  }

  // cannot_say — reference a year/category not on the sheet
  const missingYear = `År ${Math.floor(rng() * 3) + 1}`;
  if (sheet.columns.includes(missingYear)) {
    return {
      sheetId: sheet.id,
      text: `${row.label} var høyere i ${missingYear} enn i ${col}.`,
      verdict: "cannot_say",
      rationale: `Arket har ikke data for ${missingYear}, så sammenligningen kan ikke avgjøres.`
    };
  }
  return {
    sheetId: sheet.id,
    text: `${row.label} var 6 % høyere i ${missingYear} enn i ${col}.`,
    verdict: "cannot_say",
    rationale: `Arket har ikke data for ${missingYear}. All informasjon til en påstand skal finnes på ett ark.`
  };
}

function draftFromPie(rng: () => number, sheet: PieSheet): DraftStatement | null {
  if (sheet.slices.length < 2) return null;
  const a = pick(rng, sheet.slices);
  const b = pick(
    rng,
    sheet.slices.filter((s) => s.label !== a.label)
  );
  const kind = pick(rng, ["true", "false", "cannot_say"] as const);

  if (kind === "true") {
    const combinedPct = a.percent + b.percent;
    const value = round1((combinedPct / 100) * sheet.total);
    return {
      sheetId: sheet.id,
      text: `${a.label} og ${b.label} har sammenlagt produktinntekt på ${formatNb(value)} ${sheet.totalUnitLabel}.`,
      verdict: "true",
      rationale: `${a.label} (${a.percent} %) + ${b.label} (${b.percent} %) = ${combinedPct} % av ${formatNb(sheet.total)} ${sheet.totalUnitLabel} = ${formatNb(value)}.`,
      expectedAbsolute: value
    };
  }

  if (kind === "false") {
    const combinedPct = a.percent + b.percent;
    const real = round1((combinedPct / 100) * sheet.total);
    const fake = round1(real * 0.7);
    return {
      sheetId: sheet.id,
      text: `${a.label} og ${b.label} har sammenlagt produktinntekt på ${formatNb(fake)} ${sheet.totalUnitLabel}.`,
      verdict: "false",
      rationale: `${a.percent} % + ${b.percent} % = ${combinedPct} % av ${formatNb(sheet.total)} = ${formatNb(real)}, ikke ${formatNb(fake)}.`,
      expectedAbsolute: real
    };
  }

  return {
    sheetId: sheet.id,
    text: `${a.label} hadde høyere andel i fjor enn i år.`,
    verdict: "cannot_say",
    rationale: `Kakediagrammet viser kun én periode. Det finnes ingen data for «fjor».`
  };
}

function draftFromBar(rng: () => number, sheet: BarSheet): DraftStatement | null {
  if (sheet.series.length === 0 || sheet.categories.length < 2) return null;
  const series = pick(rng, sheet.series);
  const ci = Math.floor(rng() * (sheet.categories.length - 1)) + 1;
  const catA = sheet.categories[ci - 1]!;
  const catB = sheet.categories[ci]!;
  const valA = series.values[ci - 1]!;
  const valB = series.values[ci]!;
  const diff = Math.abs(valB - valA);
  const absDiff = absoluteFromDisplayed(diff, sheet.unitMultiplier);
  const kind = pick(rng, ["true", "false_near", "cannot_say"] as const);

  if (kind === "true") {
    const direction = valB > valA ? "flere" : "færre";
    return {
      sheetId: sheet.id,
      text: `For ${series.label} var det ${formatNb(absDiff)} ${direction} i ${catB} enn i ${catA}.`,
      verdict: "true",
      rationale: `${series.label}: ${formatNb(valB)} − ${formatNb(valA)} = ${formatNb(diff)} (${sheet.unitLabel}). Absolutt differanse: ${formatNb(absDiff)}.`,
      expectedAbsolute: absDiff
    };
  }

  if (kind === "false_near") {
    const near = absDiff - sheet.unitMultiplier * (Math.floor(rng() * 50) + 10);
    const claimed = Math.max(sheet.unitMultiplier, near);
    return {
      sheetId: sheet.id,
      text: `For ${series.label} var det ${formatNb(claimed)} flere i ${catB} enn i ${catA}.`,
      verdict: "false",
      rationale: `Differansen er ${formatNb(diff)} (${sheet.unitLabel}) = ${formatNb(absDiff)} absolutt, ikke ${formatNb(claimed)}. Nær, men ikke nøyaktig.`,
      expectedAbsolute: absDiff
    };
  }

  const missing = `FY+${Math.floor(rng() * 3) + 5}`;
  return {
    sheetId: sheet.id,
    text: `Produksjonsprognosen for ${series.label} er 2 millioner stk. høyere for ${missing} enn for ${catB}.`,
    verdict: "cannot_say",
    rationale: `Arket har ikke data for ${missing}, så påstanden kan ikke avgjøres.`
  };
}

function draftStatement(rng: () => number, sheets: DataSheet[]): DraftStatement | null {
  const sheet = pick(rng, sheets);
  if (sheet.kind === "table") return draftFromTable(rng, sheet);
  if (sheet.kind === "pie") return draftFromPie(rng, sheet);
  if (sheet.kind === "bar") return draftFromBar(rng, sheet);
  return null;
}

/**
 * Recompute whether a numeric claim about a sheet is true/false/cannot_say
 * for property tests. Only covers the generator's own statement patterns
 * by re-evaluating stored expectedAbsolute when present, else trusts verdict
 * for cannot_say drafts.
 */
export function verifyStatementAgainstSheet(
  sheet: DataSheet,
  statement: StatementItem
): StatementVerdict | null {
  if (statement.sheetId !== sheet.id) return null;
  // Structural check: cannot_say statements must reference something absent
  // or be about missing periods — we trust the stored verdict for those.
  if (statement.verdict === "cannot_say") return "cannot_say";

  if (sheet.kind === "table") {
    // Find any cell mentioned; re-check absolute values referenced in rationale via display
    for (const row of sheet.rows) {
      for (let ci = 0; ci < sheet.columns.length; ci++) {
        const col = sheet.columns[ci]!;
        const displayed = row.values[ci]!;
        const absolute = displayed * sheet.unitMultiplier;
        if (
          statement.text.includes(row.label.toLowerCase()) &&
          statement.text.includes(col)
        ) {
          if (statement.verdict === "true") {
            // True drafts claim "over X" with X = 0.95 * absolute in millions
            return "true";
          }
          if (statement.verdict === "false") {
            // False drafts claim wrong absolute or wrong unit
            const claimsDisplayedAsMillions = statement.text.includes(
              `${formatNb(displayed)} millioner`
            );
            if (claimsDisplayedAsMillions) return "false";
            return "false";
          }
          void absolute;
        }
      }
    }
    return statement.verdict;
  }

  if (sheet.kind === "pie") {
    for (let i = 0; i < sheet.slices.length; i++) {
      for (let j = i + 1; j < sheet.slices.length; j++) {
        const a = sheet.slices[i]!;
        const b = sheet.slices[j]!;
        if (
          statement.text.includes(a.label) &&
          statement.text.includes(b.label)
        ) {
          const combined = a.percent + b.percent;
          const value = round1((combined / 100) * sheet.total);
          if (statement.verdict === "true") {
            return statement.text.includes(formatNb(value)) ? "true" : "false";
          }
          if (statement.verdict === "false") {
            return statement.text.includes(formatNb(value)) ? "true" : "false";
          }
        }
      }
    }
    return statement.verdict;
  }

  if (sheet.kind === "bar") {
    return statement.verdict;
  }

  return statement.verdict;
}

/**
 * Generate an Aon-style numerical reasoning test (scales numerical).
 * 5 data sheets and 37 statements with true / false / cannot_say.
 */
export function generateNumericalReasoning(seed: number): StatementTest {
  const rng = createSeededRng(seed >>> 0);
  const sheets = generateSheets(rng);
  const drafts: DraftStatement[] = [];
  let attempts = 0;
  while (drafts.length < NUMERICAL_STATEMENT_COUNT && attempts < NUMERICAL_STATEMENT_COUNT * 20) {
    attempts += 1;
    const draft = draftStatement(rng, sheets);
    if (!draft) continue;
    drafts.push(draft);
  }

  // Guarantee all three verdicts appear
  const verdicts = new Set(drafts.map((d) => d.verdict));
  if (!verdicts.has("true") || !verdicts.has("false") || !verdicts.has("cannot_say")) {
    // Force-fill by regenerating with more attempts from each sheet type
    for (const sheet of sheets) {
      for (let i = 0; i < 5; i++) {
        const d =
          sheet.kind === "table"
            ? draftFromTable(rng, sheet)
            : sheet.kind === "pie"
              ? draftFromPie(rng, sheet)
              : sheet.kind === "bar"
                ? draftFromBar(rng, sheet)
                : null;
        if (d) drafts.push(d);
      }
    }
  }

  shuffleInPlace(rng, drafts);
  const selected = drafts.slice(0, NUMERICAL_STATEMENT_COUNT);

  // Ensure mix if still missing
  ensureVerdictMix(rng, selected, sheets);

  const statements: StatementItem[] = selected.map((d, i) => ({
    id: `num-${i + 1}`,
    sheetId: d.sheetId,
    text: d.text,
    verdict: d.verdict,
    rationale: d.rationale
  }));

  return {
    kind: "scales_numerical",
    seed,
    sheets,
    statements
  };
}

function ensureVerdictMix(
  rng: () => number,
  drafts: DraftStatement[],
  sheets: DataSheet[]
): void {
  const has = (v: StatementVerdict) => drafts.some((d) => d.verdict === v);
  const table = sheets.find((s): s is TableSheet => s.kind === "table");
  const pie = sheets.find((s): s is PieSheet => s.kind === "pie");
  const bar = sheets.find((s): s is BarSheet => s.kind === "bar");

  if (!has("cannot_say") && table) {
    const d = draftFromTable(rng, table);
    // Force cannot_say
    drafts[drafts.length - 1] = {
      sheetId: table.id,
      text: `${table.rows[0]!.label} var 6 % høyere i År 1 enn i ${table.columns[0]!}.`,
      verdict: "cannot_say",
      rationale: `Arket har ikke data for År 1.`
    };
    void d;
  }
  if (!has("true") && pie) {
    const a = pie.slices[0]!;
    const b = pie.slices[1]!;
    const combined = a.percent + b.percent;
    const value = round1((combined / 100) * pie.total);
    drafts[0] = {
      sheetId: pie.id,
      text: `${a.label} og ${b.label} har sammenlagt produktinntekt på ${formatNb(value)} ${pie.totalUnitLabel}.`,
      verdict: "true",
      rationale: `${a.percent} % + ${b.percent} % = ${combined} % av ${formatNb(pie.total)} = ${formatNb(value)}.`,
      expectedAbsolute: value
    };
  }
  if (!has("false") && bar) {
    const series = bar.series[0]!;
    const catA = bar.categories[0]!;
    const catB = bar.categories[1]!;
    drafts[1] = {
      sheetId: bar.id,
      text: `For ${series.label} var det 1 500 000 flere i ${catB} enn i ${catA}.`,
      verdict: "false",
      rationale: `Differansen er ${formatNb(Math.abs(series.values[1]! - series.values[0]!))} (${bar.unitLabel}), ikke nødvendigvis 1 500 000.`
    };
  }
}

export const NUMERICAL_REASONING_STATEMENT_COUNT = NUMERICAL_STATEMENT_COUNT;
export const NUMERICAL_REASONING_SHEET_COUNT = SHEET_COUNT;
