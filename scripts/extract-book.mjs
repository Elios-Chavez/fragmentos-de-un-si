import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const source = readFileSync('public/book-text.txt', 'utf8');

const cleanLine = (line) =>
  line
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^-- \d+ of \d+ --$/, '')
    .trim();

const lines = source
  .split(/\r?\n/)
  .map(cleanLine)
  .filter(Boolean)
  .filter((line) => !/^\d+$/.test(line));

const chapterOneMatches = lines
  .map((line, index) => ({ line, index }))
  .filter(({ line }) => /^CAP\.?\s*1/i.test(line) && !line.includes('...'));
const startIndex = chapterOneMatches.at(-1)?.index ?? 0;
const contentLines = lines.slice(startIndex);
const headingPattern = /^CAP\.?\s*(\d+)\s*(.*)$/i;

const chapters = [];
let current = null;

for (const line of contentLines) {
  const heading = line.match(headingPattern);

  if (heading) {
    if (current) chapters.push(current);

    const number = Number(heading[1]);
    const rawTitle = heading[2]
      .replace(/^[“"'\s]+/, '')
      .replace(/[”"'\s]+$/, '')
      .trim();

    current = {
      number,
      title: rawTitle || `Capitulo ${number}`,
      lines: [],
    };
    continue;
  }

  if (!current) continue;

  current.lines.push(line);
}

if (current) chapters.push(current);

const dedicatoriaEnd = lines.findIndex((line) => /^CAP\.\s*1/i.test(line));
const indexStart = lines.findIndex((line) => /^CAP\.\s*1.*\.+/i.test(line));
const dedicationLines = toParagraphs(
  lines
    .slice(0, Math.min(indexStart > -1 ? indexStart : dedicatoriaEnd, dedicatoriaEnd))
    .filter((line) => line !== 'DEDICATORIA.')
);

function toParagraphs(rawLines) {
  const paragraphs = [];
  let buffer = '';

  for (const line of rawLines) {
    const next = buffer ? `${buffer} ${line}` : line;
    buffer = next;

    if (/[.!?…:)”"]$/.test(line) || line.length < 28) {
      paragraphs.push(buffer);
      buffer = '';
    }
  }

  if (buffer) paragraphs.push(buffer);

  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+([,.!?…:;])/g, '$1').trim())
    .filter(Boolean);
}

const renderedChapters = chapters.map((chapter) => ({
  number: chapter.number,
  title: chapter.title,
  paragraphs: toParagraphs(chapter.lines),
}));

const output = `export const bookMeta = {
  title: 'Fragmentos de un Si',
  subtitle: 'Primeros 8 capitulos',
  dedicationTitle: 'Dedicatoria',
};

export const dedication = ${JSON.stringify(dedicationLines, null, 2)};

export const chapters = ${JSON.stringify(renderedChapters, null, 2)};
`;

mkdirSync('src/data', { recursive: true });
writeFileSync('src/data/book-content.ts', output, 'utf8');

console.log(`Generated ${renderedChapters.length} chapters in src/data/book-content.ts`);
