# Deploying to the DigitalOcean test droplet (Ubuntu)

Target: `209.38.213.186`, domain DNS managed on Hostinger. This is a
**temporary public test deployment** — per your call, it's reachable from
the internet for now, but this does not meet the BRD's on-premise/intranet-
only requirement and should not be how the real production instance is
exposed.

Run the **[local]** blocks in your own terminal on this Windows machine.
Run the **[server]** blocks after you've SSH'd into the droplet
(`ssh youruser@209.38.213.186`). Don't paste these into an unrelated shell —
the Linux commands will simply fail on Windows and vice versa.

## 1. DNS on Hostinger (optional but recommended over a bare IP)

In Hostinger's DNS panel for your domain, add an **A record**:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `certs` (or `@` for the root domain) | `209.38.213.186` | default |

Propagation is usually minutes, sometimes up to a few hours. You can keep
using the bare IP while you wait — HTTPS setup in step 6 needs the domain
to already resolve, so do this step first and let it propagate in the
background while you do steps 2–5.

## 2. [server] Install Node.js LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # confirm 22.x or later — node:sqlite needs 22.5+
```

## 3. [local] Package and upload the app

From `D:\Claude\certificate-portal`, exclude local test artifacts
(`data/`, `certs-demo/`) — you'll seed fresh directly on the server instead.

```bash
cd "D:/Claude/certificate-portal"
rsync -avz --exclude 'data' --exclude 'certs-demo' --exclude '.git' \
  ./ youruser@209.38.213.186:/opt/certificate-portal/
```

If `rsync` isn't available in your shell, `scp` works too (slightly
clunkier, no exclude support — clean the two folders locally first):

```bash
scp -r "D:/Claude/certificate-portal" youruser@209.38.213.186:/opt/
```

## 4. [server] Configure the app

```bash
cd /opt/certificate-portal
```

Edit `config.json` (`nano config.json`):
- `sharedFolderPath` — where certificates will actually live on this box.
  For a quick test, a local folder is fine (create it: `mkdir -p /srv/certificates`,
  drop a few `{NationalID}.pdf` files in there per the BRD naming
  convention). If you need to mount the ministry's real Windows/SMB share
  from Linux instead, see **Appendix: mounting an SMB share** below.
- `sessionSecret` — replace with a long random string:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `acceptedIdPrefixes` / `supportedExtensions` — leave as-is for testing
  unless you already have the ministry's confirmation.

Then seed the database fresh on the server (don't reuse your local one):

```bash
node scripts/seed-admin.js Admin 'Alaa@0501'
# optionally, for a quick smoke-test employee + placeholder certs:
node scripts/seed-demo.js
```

Quick manual start to confirm it boots before wiring up the service:

```bash
node index.js
# Ctrl+C once you see "Certificate Portal listening on http://localhost:3000"
```

## 5. [server] Run it as a systemd service (survives reboots/crashes)

```bash
sudo tee /etc/systemd/system/certificate-portal.service > /dev/null <<'EOF'
[Unit]
Description=MOIA Certificate Portal
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/certificate-portal
ExecStart=/usr/bin/node /opt/certificate-portal/index.js
Restart=on-failure
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
EOF

sudo chown -R www-data:www-data /opt/certificate-portal
sudo systemctl daemon-reload
sudo systemctl enable --now certificate-portal
sudo systemctl status certificate-portal   # should show "active (running)"
```

Logs from here on: `sudo journalctl -u certificate-portal -f`.

## 6. [server] Nginx reverse proxy + HTTPS

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/certificate-portal > /dev/null <<'EOF'
server {
    listen 80;
    server_name certs.yourdomain.com;   # <-- replace with your real domain/subdomain

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/certificate-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Only once the DNS A record from step 1 has propagated:
sudo certbot --nginx -d certs.yourdomain.com
```

Certbot edits the Nginx config to redirect HTTP→HTTPS and auto-renews the
cert going forward — nothing else to do.

If DNS hasn't propagated yet, you can test over plain HTTP against the
bare IP first (`http://209.38.213.186`) and run certbot later once the
domain resolves.

## 7. [server] Firewall

Keep this even for a "public is fine" test — no reason to leave every port
open:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'   # 80 + 443
sudo ufw enable
sudo ufw status
```

Node itself listens only on `127.0.0.1:3000` (never exposed directly) —
Nginx is the only thing reachable from outside on 80/443.

## 8. Smoke test

- Visit `https://certs.yourdomain.com` (or `http://209.38.213.186` if DNS
  isn't ready yet) — should show the login page in Arabic/RTL.
- Log in with the demo employee if you ran `seed-demo.js`: National ID
  `1012345672`, mobile `512345678`.
- Visit `/admin`, sign in with `Admin` / `Alaa@0501`, confirm the employee
  list and audit log render, try uploading the real `.xlsx` sheet.
- `sudo journalctl -u certificate-portal -f` while testing to watch for
  errors in real time.

## Redeploying after a code change

```bash
# [local]
rsync -avz --exclude 'data' --exclude 'certs-demo' --exclude '.git' \
  ./ youruser@209.38.213.186:/opt/certificate-portal/

# [server]
sudo systemctl restart certificate-portal
```

---

## Appendix: mounting an SMB/Windows shared folder from Linux (optional)

Only needed if the real certificate shared folder lives on a Windows file
server and this Linux box needs read-only access to it, instead of using a
local test folder.

```bash
sudo apt-get install -y cifs-utils
sudo mkdir -p /mnt/certificates

# Store credentials outside the fstab line:
sudo tee /etc/samba-creds > /dev/null <<'EOF'
username=svc_certportal
password=REPLACE_ME
domain=MOIA
EOF
sudo chmod 600 /etc/samba-creds

echo '//fileserver.internal/certificates /mnt/certificates cifs credentials=/etc/samba-creds,ro,uid=www-data,gid=www-data,iocharset=utf8 0 0' | sudo tee -a /etc/fstab
sudo mount -a
```

Then set `sharedFolderPath` in `config.json` to `/mnt/certificates` and
restart the service. The `ro` mount option enforces read-only at the OS
level, independent of the app code — matching the BRD's read-only
requirement.
