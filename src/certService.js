'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const trainingRepo = require('./trainingRepo');

class SharedFolderUnavailableError extends Error {}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extPattern() {
  return config.supportedExtensions.map((e) => escapeRegExp(e)).join('|');
}

// A Training Unique ID always contains letters (TRN-YYYY-NNNN), while the
// legacy multi-certificate suffix is always purely numeric -- the two never
// collide (BRD 6.3, Appendix C).
const TRAINING_SUFFIX = /^TRN-\d{4}-\d{4}$/i;

/**
 * Builds the exact-match regex for a given employee's certificate files per
 * the BRD 6.1 naming convention: {ID}.{ext} for a single certificate,
 * {ID}-1.{ext}, {ID}-2.{ext}, ... for multiple legacy certificates, or
 * {ID}-{TrainingID}.{ext} for a training-tied certificate (BRD 6.3).
 * Anchored on both ends so "1012345678" never matches "10123456780" or
 * "1012345678-x-1".
 */
function certPatternForId(nationalId) {
  const idEsc = escapeRegExp(nationalId);
  return new RegExp(`^${idEsc}(?:-([1-9][0-9]*|TRN-[0-9]{4}-[0-9]{4}))?(${extPattern()})$`, 'i');
}

/**
 * Lists this employee's certificates by scanning the shared folder. Never
 * caches results. Training-tied files ({ID}-{TrainingID}.ext) are only
 * included if the employee has an Attended outcome for that exact training
 * (BRD 6.3, 13.4) -- checked server-side here, not left to the UI.
 */
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
    const suffix = m[1] || null;
    const isTraining = suffix && TRAINING_SUFFIX.test(suffix);
    if (isTraining && !trainingRepo.isAttended(suffix.toUpperCase(), nationalId)) continue;

    const index = !suffix ? 1 : (isTraining ? null : Number(suffix));
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
      trainingId: isTraining ? suffix.toUpperCase() : null,
      ext,
      sizeBytes: stat.size,
      issuedAt: stat.mtime,
    });
  }

  matches.sort((a, b) => (a.index || 0) - (b.index || 0));
  return matches;
}

/**
 * Server-side ownership re-verification (BRD 5.3): the requested file name
 * must match the naming pattern for the logged-in employee's own ID, and
 * must resolve to a real file physically inside the shared folder (no
 * traversal outside it). A training-tied file additionally requires an
 * Attended outcome, re-checked here on every download (BRD 13.4) -- the
 * same defense-in-depth principle already used for legacy ownership checks.
 */
function resolveOwnedFile(nationalId, fileName) {
  const pattern = certPatternForId(nationalId);
  const m = typeof fileName === 'string' ? fileName.match(pattern) : null;
  if (!m) return null;
  const suffix = m[1] || null;
  if (suffix && TRAINING_SUFFIX.test(suffix) && !trainingRepo.isAttended(suffix.toUpperCase(), nationalId)) {
    return null;
  }

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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
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
