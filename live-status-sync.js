#!/usr/bin/env node
/**
 * live-status-sync.js
 * Delegates to dashboard-vercel/scripts/live-status-sync.js
 * This ensures the sync runs from the correct directory with git access.
 */

const { execSync } = require('child_process');
const path = require('path');

const SCRIPT_PATH = path.join(__dirname, '..', 'dashboard-vercel', 'scripts', 'live-status-sync.js');

try {
  execSync(`node "${SCRIPT_PATH}"`, { 
    stdio: 'inherit',
    cwd: path.join(__dirname, '..', 'dashboard-vercel')
  });
} catch (e) {
  console.error('Sync failed:', e.message);
  process.exit(1);
}
