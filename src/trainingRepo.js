'use strict';

const db = require('./db');

const nextIdStmt = db.prepare(`
  SELECT id FROM trainings WHERE id LIKE ? ORDER BY id DESC LIMIT 1
`);
const insertTrainingStmt = db.prepare(`
  INSERT INTO trainings (id, title_ar, title_en, desc_ar, desc_en, deadline, status, created_by)
  VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
`);
const getTrainingStmt = db.prepare('SELECT * FROM trainings WHERE id = ?');
const listTrainingsStmt = db.prepare('SELECT * FROM trainings ORDER BY created_at DESC');
const setStatusStmt = db.prepare('UPDATE trainings SET status = ? WHERE id = ?');

const countRegistrantsStmt = db.prepare(`
  SELECT training_id, COUNT(*) AS n FROM training_registrations
  WHERE status = 'registered' GROUP BY training_id
`);

const findRegistrationStmt = db.prepare(`
  SELECT * FROM training_registrations WHERE training_id = ? AND national_id = ?
`);
const activeRegistrationStmt = db.prepare(`
  SELECT r.training_id FROM training_registrations r
  JOIN trainings t ON t.id = r.training_id
  WHERE r.national_id = ? AND r.status = 'registered' AND t.status NOT IN ('conducted', 'cancelled')
`);
const insertRegistrationStmt = db.prepare(`
  INSERT INTO training_registrations (training_id, national_id, status)
  VALUES (?, ?, 'registered')
  ON CONFLICT(training_id, national_id) DO UPDATE SET
    status = 'registered', registered_at = datetime('now'), outcome = NULL, marked_by = NULL, marked_at = NULL
`);
const cancelRegistrationStmt = db.prepare(`
  UPDATE training_registrations SET status = 'cancelled' WHERE training_id = ? AND national_id = ? AND status = 'registered'
`);

const listRegistrantsStmt = db.prepare(`
  SELECT r.national_id, e.mobile_e164, r.registered_at, r.status, r.outcome
  FROM training_registrations r
  LEFT JOIN employees e ON e.national_id = r.national_id
  WHERE r.training_id = ? AND r.status = 'registered'
  ORDER BY r.registered_at ASC
`);

const myTrainingsStmt = db.prepare(`
  SELECT r.training_id, r.registered_at, r.status, r.outcome, r.marked_at, t.title_ar, t.title_en, t.status AS training_status, t.deadline
  FROM training_registrations r
  JOIN trainings t ON t.id = r.training_id
  WHERE r.national_id = ? AND r.status = 'registered'
  ORDER BY r.registered_at DESC
`);

const setOutcomeStmt = db.prepare(`
  UPDATE training_registrations SET outcome = ?, marked_by = ?, marked_at = datetime('now')
  WHERE training_id = ? AND national_id = ? AND status = 'registered'
`);

const attendedCheckStmt = db.prepare(`
  SELECT 1 FROM training_registrations
  WHERE training_id = ? AND national_id = ? AND status = 'registered' AND outcome = 'attended'
`);

const listAttendedStmt = db.prepare(`
  SELECT r.national_id, e.mobile_e164, r.registered_at, r.marked_at
  FROM training_registrations r
  LEFT JOIN employees e ON e.national_id = r.national_id
  WHERE r.training_id = ? AND r.status = 'registered' AND r.outcome = 'attended'
  ORDER BY r.national_id ASC
`);
const listNotAttendedStmt = db.prepare(`
  SELECT r.national_id, e.mobile_e164, r.registered_at, r.outcome
  FROM training_registrations r
  LEFT JOIN employees e ON e.national_id = r.national_id
  WHERE r.training_id = ? AND r.status = 'registered' AND (r.outcome IS NULL OR r.outcome = 'absent')
  ORDER BY r.national_id ASC
`);

function pad4(n) {
  return String(n).padStart(4, '0');
}

/** Generates the next TRN-YYYY-NNNN id for the current year (BRD Appendix C). */
function nextId() {
  const year = new Date().getFullYear();
  const prefix = `TRN-${year}-`;
  const row = nextIdStmt.get(`${prefix}%`);
  let n = 1;
  if (row) {
    const last = Number(row.id.slice(prefix.length));
    if (Number.isFinite(last)) n = last + 1;
  }
  return `${prefix}${pad4(n)}`;
}

/** A training reads as Closed once its deadline has passed, even if still stored as 'open' (BRD 13.2). */
function effectiveStatus(training) {
  if (training.status === 'open' && training.deadline < todayIso()) return 'closed';
  return training.status;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function withCounts(training) {
  return Object.assign({}, training, { effectiveStatus: effectiveStatus(training) });
}

function create({ titleAr, titleEn, descAr, descEn, deadline, createdBy }) {
  const id = nextId();
  insertTrainingStmt.run(id, titleAr, titleEn, descAr || null, descEn || null, deadline, createdBy || null);
  return getTrainingStmt.get(id);
}

function getById(id) {
  return getTrainingStmt.get(id);
}

function listAllForAdmin() {
  const counts = new Map(countRegistrantsStmt.all().map((r) => [r.training_id, r.n]));
  return listTrainingsStmt.all().map((t) => Object.assign(withCounts(t), { registrantCount: counts.get(t.id) || 0 }));
}

/** Trainings an employee can currently browse/register for (BRD 13.3). */
function listOpenForEmployee() {
  return listTrainingsStmt.all()
    .filter((t) => t.status === 'open' && t.deadline >= todayIso())
    .map(withCounts);
}

/**
 * An employee may only hold one active registration at a time (a training
 * they've registered for but that hasn't yet been conducted or cancelled).
 * Once that training is conducted (attendance recorded) or cancelled, they
 * are free to register for another.
 */
function register(trainingId, nationalId) {
  const training = getById(trainingId);
  if (!training) return { ok: false, error: 'not_found' };
  if (effectiveStatus(training) !== 'open') return { ok: false, error: 'not_open' };
  const existing = findRegistrationStmt.get(trainingId, nationalId);
  if (existing && existing.status === 'registered') return { ok: false, error: 'already_registered' };
  const active = activeRegistrationStmt.get(nationalId);
  if (active && active.training_id !== trainingId) return { ok: false, error: 'active_training_exists' };
  insertRegistrationStmt.run(trainingId, nationalId);
  return { ok: true };
}

function cancelRegistration(trainingId, nationalId) {
  const training = getById(trainingId);
  if (!training) return { ok: false, error: 'not_found' };
  if (effectiveStatus(training) !== 'open') return { ok: false, error: 'deadline_passed' };
  const result = cancelRegistrationStmt.run(trainingId, nationalId);
  return { ok: result.changes > 0 };
}

function listRegistrants(trainingId) {
  return listRegistrantsStmt.all(trainingId);
}

function myTrainings(nationalId) {
  return myTrainingsStmt.all(nationalId).map((r) => Object.assign({}, r, {
    trainingEffectiveStatus: effectiveStatus({ status: r.training_status, deadline: r.deadline }),
  }));
}

/** Bulk-sets attendance outcomes and moves the training to Conducted (BRD 13.4). Every change is attributed. */
function setOutcomes(trainingId, outcomes, adminUsername) {
  const training = getById(trainingId);
  if (!training) return { ok: false, error: 'not_found' };
  for (const { nationalId, outcome } of outcomes) {
    if (outcome !== 'attended' && outcome !== 'absent') continue;
    setOutcomeStmt.run(outcome, adminUsername, trainingId, nationalId);
  }
  setStatusStmt.run('conducted', trainingId);
  return { ok: true };
}

function cancelTraining(trainingId) {
  const training = getById(trainingId);
  if (!training) return { ok: false, error: 'not_found' };
  if (training.status === 'conducted') return { ok: false, error: 'already_conducted' };
  setStatusStmt.run('cancelled', trainingId);
  return { ok: true };
}

/** Used by certService to gate training-tied certificate files (BRD 6.3, 13.4). */
function isAttended(trainingId, nationalId) {
  return !!attendedCheckStmt.get(trainingId, nationalId);
}

/** Registrants marked Attended for a training -- for the admin CSV export. */
function listAttended(trainingId) {
  return listAttendedStmt.all(trainingId);
}

/** Registrants who signed up but were not marked Attended (absent or not yet marked). */
function listNotAttended(trainingId) {
  return listNotAttendedStmt.all(trainingId);
}

module.exports = {
  create,
  getById,
  listAllForAdmin,
  listOpenForEmployee,
  register,
  cancelRegistration,
  listRegistrants,
  myTrainings,
  setOutcomes,
  cancelTraining,
  isAttended,
  listAttended,
  listNotAttended,
};
