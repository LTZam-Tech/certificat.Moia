const fs = require('fs');
const path = require('path');

const configPath = process.env.PORTAL_CONFIG || path.join(__dirname, '..', 'config.json');
const raw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(raw);

// Resolve relative paths against the project root (directory containing config.json)
const root = path.dirname(configPath);
config.sharedFolderPath = path.resolve(root, config.sharedFolderPath);
config.dbPath = path.resolve(root, config.dbPath);

module.exports = config;
