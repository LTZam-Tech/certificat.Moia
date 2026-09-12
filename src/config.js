const fs = require('fs');
const path = require('path');

const configPath = process.env.PORTAL_CONFIG || path.join(__dirname, '..', 'config.json');
const raw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(raw);

// Resolve relative paths against the project root (directory containing config.json)
const root = path.dirname(configPath);
config.sharedFolderPath = path.resolve(root, config.sharedFolderPath);
config.dbPath = path.resolve(root, config.dbPath);

// Bind to localhost only by default -- the app is meant to sit behind a
// reverse proxy (IIS/ARR, Nginx) that's the only thing actually exposed to
// the network. Only listen on all interfaces if explicitly configured to
// (e.g. a standalone deployment terminating its own TLS with no proxy).
if (!config.bindHost) config.bindHost = '127.0.0.1';

module.exports = config;
