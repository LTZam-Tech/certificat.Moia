'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

class SharedFolderUnavailableError extends Error {}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extPattern() {
  return config.supportedExtensions.map((e) => escapeRegExp(e)).join('|');
}

/**
 * Builds the exact-match regex for a given employee's certificate files per
 * the BRD 6.1 naming convention: {ID}.{ext} for a single certificate, or
 * {ID}-1.{ext}, {ID}-2.{ext}, ... for multiple. Anchored on both ends so
 * "1012345678" never matches "10123456780" or "1012345678-x-1".
 */
function certPatternForId(nationalId) {
  const idEsc = escapeRegExp(nationalId);
  return new RegExp(`^${idEsc}(?:-([1-9][0-9]*))?(${extPattern()})$`, 'i');
}

/** Lists this employee's certificates by scanning the shared folder. Never caches results. */
function listCertificatesForEmployee(nationalId) {
  let entries;
  try {
    entries = fs.readdirSync(config.sharedFolderPath, { withFileTypes: true });
  } catch (err) {
    throw new SharedFolderUnavailableError(err.message);
  }

  const pattern = certPatternForId(nationalId);
  const matches = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const m = entry.name.match(pattern);
    if (!m) continue;
    const index = m[1] ? Number(m[1]) : 1;
    const ext = m[2].toLowerCase();
    let stat;
    try {
      stat = fs.statSync(path.join(config.sharedFolderPath, entry.name));
    } catch {
      continue;
    }
    matches.push({
      fileName: entry.name,
      index,
      ext,
      sizeBytes: stat.size,
      issuedAt: stat.mtime,
    });
  }

  matches.sort((a, b) => a.index - b.index);
  return matches;
}

/**
 * Server-side ownership re-verification (BRD 5.3): the requested file name
 * must match the naming pattern for the logged-in employee's own ID, and
 * must resolve to a real file physically inside the shared folder (no
 * traversal outside it).
 */
function resolveOwnedFile(nationalId, fileName) {
  const pattern = certPatternForId(nationalId);
  if (typeof fileName !== 'string' || !pattern.test(fileName)) return null;

  const fullPath = path.resolve(config.sharedFolderPath, fileName);
  const root = path.resolve(config.sharedFolderPath) + path.sep;
  if (!fullPath.startsWith(root)) return null; // defense in depth vs traversal

  try {
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) return null;
  } catch {
    return null;
  }

  return fullPath;
}

const MIME_TYPES = {
  '.pdf': 'application/pdf',
};

function mimeTypeFor(ext) {
  return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  SharedFolderUnavailableError,
  listCertificatesForEmployee,
  resolveOwnedFile,
  mimeTypeFor,
};
