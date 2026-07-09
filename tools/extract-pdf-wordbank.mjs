import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const [inputPath = ".tmp/source.pdf", outputPath = "public/wordbank.json"] = process.argv.slice(2);

function normalizeAnswer(value) {
  return String(value)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function extractLessonItems(text) {
  const normalized = text
    .replace(/\s+/g, " ")
    .replace(/重\s*点\s*单\s*词/g, "重点单词")
    .replace(/常\s*考\s*短\s*语/g, "常考短语")
    .replace(/经\s*典\s*句\s*型/g, "经典句型");
  const unitBlocks = normalized.split(/(?=Unit\s+\d+\s+)/i).filter((block) => /^Unit\s+\d+/i.test(block.trim()));
  const entries = [];

  unitBlocks.forEach((block) => {
    const unitMatch = block.match(/^(Unit\s+\d+)(.*?)(?=重点单词|重\s)/i);
    const unit = unitMatch ? `${unitMatch[1]} ${unitMatch[2].trim()}`.trim() : `Unit ${entries.length + 1}`;
    const wordText = sectionBetween(block, /(?:重点单词|重\s*点\s*单\s*词)/, /(?:常考短语|常\s*考\s*短\s*语|经典句型|经\s*典\s*句\s*型)/);
    const phraseText = sectionBetween(block, /(?:常考短语|常\s*考\s*短\s*语)/, /(?:经典句型|经\s*典\s*句\s*型|核心|核\s*心|语音)/);
    entries.push(...parsePairs(wordText, unit, "word"));
    entries.push(...parsePairs(phraseText, unit, "phrase"));
  });

  return dedupeEntries(entries);
}

function sectionBetween(block, startPattern, endPattern) {
  const start = block.search(startPattern);
  if (start < 0) return "";
  const rest = block.slice(start).replace(startPattern, " ");
  const end = rest.search(endPattern);
  return end >= 0 ? rest.slice(0, end) : rest;
}

function parsePairs(text, unit, type) {
  const cleaned = text
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const englishToken = "[A-Za-z][A-Za-z0-9’'().,!?-]*";
  const pattern = new RegExp(`((?:${englishToken}\\s*){1,6})([^A-Za-z]*[\\u4e00-\\u9fa5][^A-Za-z]*?)(?=\\s+${englishToken}|$)`, "g");
  const items = [];
  let match;
  while ((match = pattern.exec(cleaned))) {
    let english = match[1].replace(/[，。；：、]/g, "").replace(/\s+/g, " ").trim();
    const chinese = match[2].replace(/^[\s,，.。;；:：]+|[\s,，.。;；:：]+$/g, "").trim();
    if (english === "clock" && chinese.includes("表示整点")) english = "o'clock";
    if (normalizeAnswer(english).length < 2 || !/[\u4e00-\u9fa5]/.test(chinese)) continue;
    items.push({
      id: `${unit}-${type}-${normalizeAnswer(english)}`,
      unit,
      type,
      english,
      chinese,
      source: "pdf"
    });
  }
  return items;
}

function dedupeEntries(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.unit}-${item.type}-${normalizeAnswer(item.english)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const input = resolve(inputPath);
const output = resolve(outputPath);
const data = new Uint8Array(readFileSync(input));
const pdf = await pdfjsLib.getDocument({ data }).promise;
const pages = [];

for (let i = 1; i <= pdf.numPages; i += 1) {
  const page = await pdf.getPage(i);
  const content = await page.getTextContent();
  pages.push(content.items.map((item) => item.str).join(" "));
}

const items = extractLessonItems(pages.join("\n"));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({
  name: "沪教牛津版四下知识清单",
  sourcePdf: "沪教牛津版四下知识清单全(1).pdf",
  extractedAt: new Date().toISOString(),
  count: items.length,
  items
}, null, 2), "utf8");

console.log(`Extracted ${items.length} items to ${output}`);
