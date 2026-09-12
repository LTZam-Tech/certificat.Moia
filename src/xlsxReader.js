'use strict';

const zlib = require('zlib');

/**
 * Minimal, dependency-free .xlsx (OOXML) reader.
 *
 * An .xlsx file is a ZIP archive of XML parts. This module implements just
 * enough of the ZIP format (central directory walk + local-header data
 * extraction, DEFLATE via Node's built-in zlib) and just enough of the
 * SpreadsheetML schema (sheetData rows/cells + shared strings) to read a
 * simple single-sheet table back out as an array of row arrays. It is not
 * a general-purpose XLSX library -- no styles, formulas, merged cells,
 * multiple sheets, etc. -- only what's needed to import a flat employee
 * list (National ID / Mobile columns).
 */

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;

function findEndOfCentralDirectory(buf) {
  const maxCommentLen = 65535;
  const searchStart = Math.max(0, buf.length - (22 + maxCommentLen));
  for (let i = buf.length - 22; i >= searchStart; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i;
  }
  throw new Error('Not a valid .xlsx/.zip file (no end-of-central-directory record found)');
}

/** Walks the ZIP central directory, returning a map of entry name -> extracted Buffer. */
function readZipEntries(buf, wantedNames) {
  const eocdOffset = findEndOfCentralDirectory(buf);
  const totalEntries = buf.readUInt16LE(eocdOffset + 10);
  let cdOffset = buf.readUInt32LE(eocdOffset + 16);

  const wanted = new Set(wantedNames);
  const found = {};

  for (let i = 0; i < totalEntries && wanted.size > 0; i++) {
    if (buf.readUInt32LE(cdOffset) !== CDFH_SIG) break;

    const compressionMethod = buf.readUInt16LE(cdOffset + 10);
    const compressedSize = buf.readUInt32LE(cdOffset + 20);
    const nameLen = buf.readUInt16LE(cdOffset + 28);
    const extraLen = buf.readUInt16LE(cdOffset + 30);
    const commentLen = buf.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buf.readUInt32LE(cdOffset + 42);
    const name = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + nameLen);

    if (wanted.has(name)) {
      found[name] = extractEntryData(buf, localHeaderOffset, compressionMethod, compressedSize);
      wanted.delete(name);
    }

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }

  return found;
}

function extractEntryData(buf, localHeaderOffset, compressionMethod, compressedSize) {
  if (buf.readUInt32LE(localHeaderOffset) !== LFH_SIG) {
    throw new Error('Malformed .xlsx (bad local file header)');
  }
  const nameLen = buf.readUInt16LE(localHeaderOffset + 26);
  const extraLen = buf.readUInt16LE(localHeaderOffset + 28);
  const dataStart = localHeaderOffset + 30 + nameLen + extraLen;
  const compressed = buf.subarray(dataStart, dataStart + compressedSize);

  if (compressionMethod === 0) return compressed; // stored, no compression
  if (compressionMethod === 8) return zlib.inflateRawSync(compressed); // DEFLATE
  throw new Error(`Unsupported ZIP compression method: ${compressionMethod}`);
}

const ENTITY_MAP = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decodeXmlEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X'
        ? parseInt(ent.slice(2), 16)
        : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITY_MAP[ent] !== undefined ? ENTITY_MAP[ent] : m;
  });
}

/** Parses xl/sharedStrings.xml into an array of strings, indexed as referenced by <c t="s"><v>index</v></c>. */
function parseSharedStrings(xml) {
  if (!xml) return [];
  const strings = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m;
  while ((m = siRegex.exec(xml))) {
    const body = m[1];
    const parts = [];
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm;
    while ((tm = tRegex.exec(body))) parts.push(decodeXmlEntities(tm[1]));
    strings.push(parts.join(''));
  }
  return strings;
}

function columnLetterToIndex(letters) {
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1; // zero-based
}

/** Parses a sheetN.xml into an array of rows, each an array of cell string values (or null). */
function parseSheetRows(xml, sharedStrings) {
  const rows = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm;
  while ((rm = rowRegex.exec(xml))) {
    const rowBody = rm[1];
    const cells = [];
    // Matches both <c ...>...</c> and self-closing <c .../>
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cm;
    while ((cm = cellRegex.exec(rowBody))) {
      const attrs = cm[1];
      const inner = cm[2] || '';

      const refMatch = attrs.match(/r="([A-Z]+)\d+"/);
      const colIdx = refMatch ? columnLetterToIndex(refMatch[1]) : cells.length;
      const typeMatch = attrs.match(/t="([^"]+)"/);
      const type = typeMatch ? typeMatch[1] : null;

      let value = null;
      if (type === 's') {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) value = sharedStrings[Number(vMatch[1])] ?? null;
      } else if (type === 'inlineStr') {
        const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
        if (tMatch) value = decodeXmlEntities(tMatch[1]);
      } else {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vMatch) value = decodeXmlEntities(vMatch[1]);
      }

      cells[colIdx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/**
 * Reads the first worksheet of an .xlsx file buffer into an array of row
 * arrays (each cell a string or null). Throws if the buffer isn't a
 * readable .xlsx.
 */
function readFirstSheetRows(buffer) {
  const entries = readZipEntries(buffer, ['xl/worksheets/sheet1.xml', 'xl/sharedStrings.xml']);
  const sheetXmlBuf = entries['xl/worksheets/sheet1.xml'];
  if (!sheetXmlBuf) {
    throw new Error('Could not find xl/worksheets/sheet1.xml -- is this a valid, single-sheet .xlsx file?');
  }
  const sharedStrings = parseSharedStrings(entries['xl/sharedStrings.xml']?.toString('utf8'));
  const rows = parseSheetRows(sheetXmlBuf.toString('utf8'), sharedStrings);

  // Normalise ragged rows to a rectangular grid (fill gaps with null).
  const maxCols = rows.reduce((max, r) => Math.max(max, r.length), 0);
  for (const r of rows) {
    for (let i = 0; i < maxCols; i++) {
      if (r[i] === undefined) r[i] = null;
    }
  }
  return rows;
}

module.exports = { readFirstSheetRows };
