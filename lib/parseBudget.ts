import * as XLSX from "xlsx";
import * as mammoth from "mammoth";
import JSZip from "jszip";

export type ParsedItem = { name: string; allocated: number };

const NAME_KEYWORDS = ["科目", "項目", "品項", "名稱"];
const AMOUNT_KEYWORDS = ["金額", "編列", "預算", "經費", "金额"];

/** Shared logic for anything that's already a grid (rows of cells):
 *  xlsx sheets and docx <table> elements both go through this. */
function extractFromGrid(rows: string[][]): ParsedItem[] {
  let headerRowIdx = -1;
  let nameCol = 0;
  let amountCol = 1;

  for (let r = 0; r < Math.min(rows.length, 5); r++) {
    const row = (rows[r] || []).map((c) => String(c ?? ""));
    const nIdx = row.findIndex((c) => NAME_KEYWORDS.some((k) => c.includes(k)));
    const aIdx = row.findIndex((c) => AMOUNT_KEYWORDS.some((k) => c.includes(k)));
    if (nIdx !== -1 && aIdx !== -1) {
      headerRowIdx = r;
      nameCol = nIdx;
      amountCol = aIdx;
      break;
    }
  }

  const dataRows = rows.slice(headerRowIdx + 1);
  const items: ParsedItem[] = [];
  for (const row of dataRows) {
    const name = String(row?.[nameCol] ?? "").trim();
    const raw = row?.[amountCol];
    const amount = typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(/[,$元 \s]/g, ""));
    if (name && Number.isFinite(amount) && amount > 0) {
      items.push({ name, allocated: Math.round(amount) });
    }
  }
  return items;
}

/** Fallback for plain text (docx with no table, or text reconstructed from
 *  a PDF's positioned text items): looks for "<name> ... <number>" per
 *  line, e.g. "教學設備費　80,000" or "1. 印刷費：30,000元". */
function extractFromLines(lines: string[]): ParsedItem[] {
  const numRe = /([0-9][0-9,]{1,})\s*元?\s*$/;
  const items: ParsedItem[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\u3000/g, " ").trim();
    if (!line) continue;
    const m = line.match(numRe);
    if (!m) continue;
    const amount = parseInt(m[1].replace(/,/g, ""), 10);
    if (!Number.isFinite(amount) || amount < 100) continue; // filters out page/item numbers
    let name = line.slice(0, m.index).trim();
    name = name.replace(/^[(（]?\s*[0-9一二三四五六七八九十]+[)）、.．]\s*/, "");
    name = name.replace(/[:：\-\s]+$/, "").trim();
    if (name.length >= 2 && name.length <= 30) {
      items.push({ name, allocated: amount });
    }
  }
  return items;
}

async function parseXlsx(file: File): Promise<ParsedItem[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  return extractFromGrid(rows.map((r) => r.map((c) => String(c ?? ""))));
}

async function parseDocx(file: File): Promise<ParsedItem[]> {
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));

  for (const table of tables) {
    const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("td,th")).map((td) => td.textContent?.trim() ?? "")
    );
    const items = extractFromGrid(rows);
    if (items.length > 0) return items; // first table that yields results wins
  }

  // No usable table — fall back to scanning plain paragraph text line by line.
  const { value: text } = await mammoth.extractRawText({ arrayBuffer: buf });
  return extractFromLines(text.split("\n"));
}

async function parsePdf(file: File): Promise<ParsedItem[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.js",
    import.meta.url
  ).toString();

  const buf = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buf }).promise;
  const lines: string[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const rows = new Map<number, { x: number; str: string }[]>();
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5]);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push({ x: item.transform[4], str: item.str });
    }
    // PDF y-coordinates increase upward, so sort descending for top-to-bottom order.
    const sortedYs = Array.from(rows.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const row = rows.get(y)!.sort((a, b) => a.x - b.x);
      lines.push(row.map((r) => r.str).join(" "));
    }
  }
  return extractFromLines(lines);
}

async function parseOdt(file: File): Promise<ParsedItem[]> {
  const zip = await JSZip.loadAsync(file);
  const contentXml = await zip.file("content.xml")?.async("string");
  if (!contentXml) return [];

  const doc = new DOMParser().parseFromString(contentXml, "application/xml");
  const tables = Array.from(doc.getElementsByTagName("table:table"));

  for (const table of tables) {
    const rows = Array.from(table.getElementsByTagName("table:table-row")).map((tr) =>
      Array.from(tr.getElementsByTagName("table:table-cell")).map((td) => td.textContent?.trim() ?? "")
    );
    const items = extractFromGrid(rows);
    if (items.length > 0) return items;
  }

  // No usable table — fall back to scanning paragraph text.
  const paragraphs = Array.from(doc.getElementsByTagName("text:p")).map((p) => p.textContent ?? "");
  return extractFromLines(paragraphs);
}

/**
 * Reads an uploaded 經費概算表 entirely in the browser and pulls out
 * (科目名稱, 編列金額) pairs. Supports .xlsx/.xls/.csv/.ods (spreadsheet
 * grid — best results), .docx/.odt (reads a table if present, otherwise
 * scans paragraph text), and .pdf with a real text layer (typed documents
 * — this does NOT do OCR, so photos and scanned PDFs won't work).
 * Nothing here ever leaves the browser — the raw file is never uploaded.
 */
export async function parseBudgetFile(file: File): Promise<ParsedItem[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".odt")) return parseOdt(file);
  if (name.endsWith(".pdf")) return parsePdf(file);
  return parseXlsx(file); // .xlsx / .xls / .csv / .ods
}
