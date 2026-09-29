'use strict';

const db = require('./db');

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Dashboard summary
// ---------------------------------------------------------------------

const latestConductedStmt = db.prepare(`
  SELECT t.id, t.title_ar, t.title_en, t.deadline,
         COUNT(r.national_id) AS registrantCount,
         SUM(CASE WHEN r.outcome = 'attended' THEN 1 ELSE 0 END) AS attendedCount,
         MAX(r.marked_at) AS conductedAt
  FROM trainings t
  LEFT JOIN training_registrations r ON r.training_id = t.id AND r.status = 'registered'
  WHERE t.status = 'conducted'
  GROUP BY t.id
  ORDER BY conductedAt DESC
  LIMIT ?
`);

const upcomingStmt = db.prepare(`
  SELECT t.id, t.title_ar, t.title_en, t.deadline,
         COUNT(r.national_id) AS registrantCount
  FROM trainings t
  LEFT JOIN training_registrations r ON r.training_id = t.id AND r.status = 'registered'
  WHERE t.status = 'open' AND t.deadline >= ?
  GROUP BY t.id
  ORDER BY t.deadline ASC
  LIMIT ?
`);

const outcomeCountsStmt = db.prepare(`
  SELECT
    SUM(CASE WHEN r.outcome = 'attended' THEN 1 ELSE 0 END) AS attended,
    SUM(CASE WHEN r.outcome = 'absent' THEN 1 ELSE 0 END) AS absent,
    SUM(CASE WHEN r.outcome IS NULL AND (t.status = 'conducted' OR (t.status = 'open' AND t.deadline < ?)) THEN 1 ELSE 0 END) AS awaiting
  FROM training_registrations r
  JOIN trainings t ON t.id = r.training_id
  WHERE r.status = 'registered'
`);

const totalsStmt = db.prepare(`
  SELECT
    (SELECT COUNT(*) FROM trainings WHERE status = 'conducted') AS totalConducted,
    (SELECT COUNT(*) FROM trainings WHERE status = 'open' AND deadline >= ?) AS totalUpcoming,
    (SELECT COUNT(*) FROM employees) AS totalEmployees,
    (SELECT COUNT(*) FROM training_registrations WHERE status = 'registered') AS totalRegistrations
`);

const monthlyRegistrationsStmt = db.prepare(`
  SELECT strftime('%Y-%m', registered_at) AS ym, COUNT(*) AS n
  FROM training_registrations
  WHERE status = 'registered' AND registered_at >= ?
  GROUP BY ym
`);

const monthlyAttendedStmt = db.prepare(`
  SELECT strftime('%Y-%m', marked_at) AS ym, COUNT(*) AS n
  FROM training_registrations
  WHERE outcome = 'attended' AND marked_at >= ?
  GROUP BY ym
`);

const departmentBreakdownStmt = db.prepare(`
  SELECT e.department AS department,
         COUNT(*) AS total,
         SUM(CASE WHEN r.outcome = 'attended' THEN 1 ELSE 0 END) AS attended
  FROM training_registrations r
  JOIN employees e ON e.national_id = r.national_id
  WHERE r.status = 'registered' AND e.department IS NOT NULL AND e.department != ''
  GROUP BY e.department
  ORDER BY total DESC
  LIMIT 6
`);

/** Builds the last `months` YYYY-MM keys ending with the current month, oldest first. */
function lastMonthKeys(months) {
  const keys = [];
  const d = new Date();
  d.setDate(1);
  for (let i = months - 1; i >= 0; i--) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

function getDashboard() {
  const today = todayIso();
  const twelveMonthsAgo = lastMonthKeys(12)[0] + '-01';

  const latestConducted = latestConductedStmt.all(5);
  const upcoming = upcomingStmt.all(today, 5);
  const outcomes = outcomeCountsStmt.get(today);
  const totals = totalsStmt.get(today);

  const regByMonth = new Map(monthlyRegistrationsStmt.all(twelveMonthsAgo).map((r) => [r.ym, r.n]));
  const attByMonth = new Map(monthlyAttendedStmt.all(twelveMonthsAgo).map((r) => [r.ym, r.n]));
  const months = lastMonthKeys(12);
  const monthlyTrend = months.map((ym) => ({
    ym,
    registrations: regByMonth.get(ym) || 0,
    attended: attByMonth.get(ym) || 0,
  }));

  const departmentBreakdown = departmentBreakdownStmt.all();

  return {
    latestConducted,
    upcoming,
    outcomes: {
      attended: outcomes.attended || 0,
      absent: outcomes.absent || 0,
      awaiting: outcomes.awaiting || 0,
    },
    totals,
    monthlyTrend,
    departmentBreakdown,
  };
}

// ---------------------------------------------------------------------
// Advanced search -- trainings
// ---------------------------------------------------------------------

/**
 * status: '' (all) | 'open' | 'closed' | 'conducted' | 'cancelled'.
 * 'closed' is a derived state (open but past its deadline), not a stored one.
 */
function searchTrainings({ status, dateFrom, dateTo, q } = {}) {
  const today = todayIso();
  const clauses = [];
  const params = [];

  if (status === 'open') {
    clauses.push('t.status = ?', 't.deadline >= ?');
    params.push('open', today);
  } else if (status === 'closed') {
    clauses.push('t.status = ?', 't.deadline < ?');
    params.push('open', today);
  } else if (status === 'conducted' || status === 'cancelled') {
    clauses.push('t.status = ?');
    params.push(status);
  }

  if (dateFrom) { clauses.push('t.deadline >= ?'); params.push(dateFrom); }
  if (dateTo) { clauses.push('t.deadline <= ?'); params.push(dateTo); }
  if (q) {
    clauses.push('(t.id LIKE ? OR t.title_en LIKE ? OR t.title_ar LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`
    SELECT t.id, t.title_ar, t.title_en, t.deadline, t.status, t.created_by, t.created_at,
           COUNT(r.national_id) AS registrantCount,
           SUM(CASE WHEN r.outcome = 'attended' THEN 1 ELSE 0 END) AS attendedCount,
           SUM(CASE WHEN r.outcome = 'absent' THEN 1 ELSE 0 END) AS absentCount
    FROM trainings t
    LEFT JOIN training_registrations r ON r.training_id = t.id AND r.status = 'registered'
    ${where}
    GROUP BY t.id
    ORDER BY t.created_at DESC
    LIMIT 500
  `).all(...params);

  return rows.map((t) => Object.assign({}, t, {
    effectiveStatus: t.status === 'open' && t.deadline < today ? 'closed' : t.status,
  }));
}

// ---------------------------------------------------------------------
// Advanced search -- registrations
// ---------------------------------------------------------------------

/** outcome: '' (all) | 'attended' | 'absent' | 'awaiting'. */
function searchRegistrations({ nationalId, department, trainingId, outcome, dateFrom, dateTo } = {}) {
  const today = todayIso();
  const clauses = ["r.status = 'registered'"];
  const params = [];

  if (nationalId) { clauses.push('r.national_id LIKE ?'); params.push(`%${nationalId}%`); }
  if (department) { clauses.push('e.department = ?'); params.push(department); }
  if (trainingId) { clauses.push('r.training_id = ?'); params.push(trainingId); }
  if (outcome === 'attended' || outcome === 'absent') {
    clauses.push('r.outcome = ?');
    params.push(outcome);
  } else if (outcome === 'awaiting') {
    clauses.push("r.outcome IS NULL AND (t.status = 'conducted' OR (t.status = 'open' AND t.deadline < ?))");
    params.push(today);
  }
  if (dateFrom) { clauses.push('date(r.registered_at) >= ?'); params.push(dateFrom); }
  if (dateTo) { clauses.push('date(r.registered_at) <= ?'); params.push(dateTo); }

  const where = `WHERE ${clauses.join(' AND ')}`;
  return db.prepare(`
    SELECT r.training_id, r.national_id, r.registered_at, r.outcome, r.marked_at,
           e.mobile_e164, e.name, e.department,
           t.title_ar, t.title_en, t.status AS training_status, t.deadline
    FROM training_registrations r
    JOIN trainings t ON t.id = r.training_id
    LEFT JOIN employees e ON e.national_id = r.national_id
    ${where}
    ORDER BY r.registered_at DESC
    LIMIT 1000
  `).all(...params);
}

function listDepartments() {
  return db.prepare(`
    SELECT DISTINCT department FROM employees
    WHERE department IS NOT NULL AND department != ''
    ORDER BY department ASC
  `).all().map((r) => r.department);
}

module.exports = { getDashboard, searchTrainings, searchRegistrations, listDepartments };
