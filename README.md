# MOIA Employee Certificate Distribution Portal

On-premise, self-service portal that lets ~4,000 ministry employees log in
with their **National ID + registered mobile number** and download their own
training certificates. Built directly from `moia_certificate_portal.html`
(UI reference) and `Certificate_Portal_BRD.docx` (v1.1 requirements).

## Why this stack

Target host: **4 vCPU / 8 GB RAM / 100 GB disk, Windows Server 2022
Standard** — a small, single-purpose intranet box. The app is built as a
**single Node.js process with zero external dependencies**:

- **Node.js LTS** (native `http`/`https` server, no Express/etc.)
- **`node:sqlite`** (built into Node 22.5+) for employee master data,
  sessions, and the audit log — no separate DB server to install, patch, or
  back up on a box this size.
- No build step, no `npm install`, no internet access required at
  deploy time — copy the folder, install Node, run it.

This matches the BRD's non-functional requirements directly: on-premise
only, no cloud dependency, minimal footprint, easy to maintain without a
dedicated DBA.

**Certificates are never stored by the app.** Every list/download reads
live from the shared folder configured in `config.json`
(`sharedFolderPath`). The SQLite database only ever holds employee identity
records (National ID, username, mobile) and the audit log — never
certificate bytes.

## Project layout

```
certificate-portal/
  config.json           # all configurable settings (see below)
  index.js              # entry point
  src/                  # server, validators, services
  public/                # login/landing/admin pages, CSS, client JS
  scripts/
    import-employees.js  # CLI import, accepts .xlsx or .csv
    seed-admin.js          # create/reset an admin account
    seed-demo.js            # local demo data + demo admin — test only
  data/                  # portal.db (created at runtime)
```

## Configuration (`config.json`)

| Key | Purpose |
|---|---|
| `port` | HTTP(S) port the Node process listens on |
| `https.enabled` / `certPath` / `keyPath` | Terminate TLS in Node directly. Leave `enabled: false` if IIS/ARR in front of the app terminates TLS instead (recommended, see below). |
| `sharedFolderPath` | Path to the ministry's shared certificate folder. The app has **read-only** needs — grant only Read at the OS/share level. |
| `supportedExtensions` | File extensions served, e.g. `[".pdf"]` |
| `acceptedIdPrefixes` | `["1"]` for nationals only, `["1","2"]` to include Iqama holders — confirm with the ministry (BRD open item) |
| `lockout.maxAttempts` / `windowMinutes` / `lockoutMinutes` | Brute-force throttling per BRD 5.8 |
| `sessionTimeoutMinutes` | Idle session timeout (BRD recommends 15) |
| `sessionSecret` | Long random string — used to salt/hash National IDs before they're written to the audit log. **Change before go-live.** |
| `dbPath` | Where the SQLite file lives |

There's no `adminToken` setting — `/admin` is a real username/password
account stored (scrypt-hashed) in the database. See **Admin access** below.

## Certificate naming convention (must match BRD section 6)

- One certificate: `{NationalID}.pdf` → `1012345672.pdf`
- Multiple: `{NationalID}-1.pdf`, `{NationalID}-2.pdf`, `{NationalID}-3.pdf`, …

The app matches **exactly** this pattern per employee (anchored regex, so
`1012345672` can never match `10123456780` or another ID's file). Any file
not matching a known employee's ID is simply invisible to everyone.

## Running locally / for UAT

```bash
node scripts/seed-demo.js   # creates one demo employee + 3 placeholder PDFs (test only)
node index.js                # starts on http://localhost:3000
```

Demo login printed by the seed script: National ID `1012345672`, mobile
`0512345678`.

## Employee master data

The ministry's source of record has **no employee names** — only National ID
and mobile number — so that's the entire data model. There is nothing to
display or log except the ID (masked) and mobile; the UI never shows a
name.

## Admin access

`/admin` is a real signed-in account — a username and password stored
(scrypt-hashed, never plaintext) in the database — not a shared token link.
There is no self-registration: an admin account is created on the server
via a script.

```bash
node scripts/seed-admin.js <username> <password>   # create, or reset the password of, an admin account
```

`seed-demo.js` also creates a demo admin (`admin` / `ChangeMe#2026`,
printed to the console) purely for local testing — replace it with a real
account via `seed-admin.js` before go-live, or delete it once a real
account exists.

Signed in, an admin can:

- **View every employee** currently loaded (National ID, mobile, last
  updated) — nothing else is stored, so there's nothing else to show.
- **Add employees** by uploading the ministry's `.xlsx` sheet directly —
  no conversion step. The importer looks for a header column containing
  "ID" and one containing "mobile" (case-insensitive), matching the
  ministry's actual export (`ID`, `Mobile Number`). Re-importing an
  existing National ID just updates its mobile number.
- **Remove employees** — one at a time, or all at once ("Remove all", e.g.
  before a full sheet refresh). Removing here only deletes the login
  record; it never touches files in the shared certificate folder.
- **View the audit log** — every employee login attempt (success/failure)
  and certificate download, most recent first.

There is deliberately no edit-in-place for an employee record — the only
operations are add (import) and remove, matching the sheet-driven source
of truth. Admin login attempts are throttled the same way employee login
is (BRD 5.8 pattern, separate counters) — 5 failed attempts locks that
username + source IP out for 15 minutes by default.

For scripted/offline imports without the web UI, the same importer is
available from the command line and accepts either `.xlsx` or `.csv`:

```bash
node scripts/import-employees.js path\to\employees.xlsx
node scripts/import-employees.js path\to\employees.csv   # header: national_id,mobile
```

Invalid rows (bad ID checksum, bad mobile format) are skipped and
reported, not silently dropped, whichever way you import.

## Deploying on Windows Server 2022 Standard (4 vCPU / 8 GB / 100 GB)

1. **Install Node.js LTS (22.x or later)** from the offline MSI installer
   (no internet needed on the server itself once downloaded).
2. Copy the `certificate-portal` folder to e.g. `D:\Apps\certificate-portal`.
3. Edit `config.json`:
   - Point `sharedFolderPath` at the real UNC or local path to the
     certificates share.
   - Set a strong random `sessionSecret`.
   - Set `acceptedIdPrefixes` and `supportedExtensions` per the ministry's
     confirmation.
   Then create the real admin account (see **Admin access** above):
   `node scripts/seed-admin.js <username> <strong-password>`
4. **Shared folder permissions**: grant the service account running Node
   **Read-only** NTFS/share permissions on the certificates folder. Do not
   grant Write/Modify — this enforces the "app never writes to the shared
   folder" constraint independent of the app code (BRD risk mitigation).
5. **Run as a Windows Service** (so it survives reboots/logoff) using
   [NSSM](https://nssm.cc/) or `node-windows`:
   ```powershell
   nssm install MoiaCertificatePortal "C:\Program Files\nodejs\node.exe" "D:\Apps\certificate-portal\index.js"
   nssm set MoiaCertificatePortal AppDirectory "D:\Apps\certificate-portal"
   nssm start MoiaCertificatePortal
   ```
6. **Put IIS in front for HTTPS** (recommended over enabling `https` in
   `config.json` directly, since IIS makes certificate renewal/rotation
   and internal-CA trust easier to manage):
   - Install the **URL Rewrite** and **Application Request Routing (ARR)**
     IIS modules.
   - Bind the site to your internal hostname with an internal-CA TLS
     certificate, port 443.
   - Add a reverse-proxy rule forwarding all traffic to
     `http://127.0.0.1:3000`.
   - Restrict the site binding / firewall to the internal network only —
     this app must never be reachable from the public internet (BRD 3.2,
     Section 7).
7. Confirm the Windows Firewall only allows inbound 443 (or your chosen
   port) from internal subnets.
8. Smoke test: sign in as one real imported employee, download a real
   certificate, confirm it appears in `/admin`'s audit log, then sign out.

### Sizing note
At ~4,000 employees with occasional seasonal spikes, a single Node process
on this hardware comfortably handles the expected load — the app does no
CPU-heavy work (no certificate generation/rendering), only auth checks,
small SQLite reads/writes, and file streaming. No load balancer or
clustering is needed at this scale; if desired later, Node's built-in
`cluster` module can fan the process out across the 4 vCPUs without any
architecture change.

## Security notes (mapping to BRD requirements)

- **No certificate persistence** (BRD 7): downloads stream directly from
  `sharedFolderPath` via `fs.createReadStream`; nothing is ever written to
  disk, DB, or an in-memory cache by the app.
- **Paired auth, generic errors** (BRD 5.1, 5.8): a wrong ID, wrong mobile,
  or right-ID-wrong-mobile all return the identical
  `verification_failed` response — no signal about which field was wrong.
- **Server-side ownership re-check on every download** (BRD 5.3): the
  requested filename is validated against the *session's* National ID
  pattern on every single request, not just filtered in the UI — closes
  the IDOR risk called out in BRD Section 12.
- **National ID never logged in plaintext** (BRD 5.9): the audit log stores
  an HMAC hash (keyed by `sessionSecret`) plus the last 4 digits only.
- **Lockout** (BRD 5.8): throttled independently by National ID and by
  source IP, configurable thresholds.
- **No certificate content ever leaves the shared folder's authority**: if
  the shared folder is unreachable, the app returns a clear "service
  unavailable" response and logs the failure — there is no local fallback
  copy to serve instead (BRD 6.2, Acceptance Criteria).
- **Admin passwords are never stored or logged in plaintext**: `scrypt`
  (Node's built-in `crypto`, no external dependency) with a random
  per-account salt. Admin login is throttled the same as employee login.

## Known open items to confirm with the ministry before go-live

1. **The 3 National IDs in the sample `Certificate.xlsx`
   (`1022334455`, `1122334455`, `1911334455`) all fail the Appendix A
   checksum** and are correctly rejected by the importer. Confirm with the
   ministry whether that file was placeholder/test data or is meant to
   contain real employee IDs — if real, something upstream of this app is
   producing IDs that don't pass the ministry's own validation rule.
2. Whether `acceptedIdPrefixes` should include `"2"` (Iqama/resident) or
   `["1"]` only.
3. Confirm `supportedExtensions` — currently defaults to PDF only.
4. Decide whether TLS should terminate at IIS (recommended, see above) or
   directly in Node via `config.json`'s `https` block.
