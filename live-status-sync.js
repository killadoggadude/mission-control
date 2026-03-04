#!/usr/bin/env node
/**
 * live-status-sync.js
 * Reads live status from `openclaw cron list --json`, maps named agents
 * to their real status + model, and pushes updates to Mission Control.
 * No hardcoded statuses — everything comes from the live cron system.
 */

const { execSync } = require('child_process');
const BASE_URL = 'http://localhost:3000';

// Cron job status → MC agent status
const STATUS_MAP = { ok: 'online', error: 'error', idle: 'idle' };

// Extract clean agent name from cron job name (strips emoji + suffix)
function extractName(raw = '') {
  return raw
    .replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D\u20E3]+\s*/gu, '')
    .split(/\s*[—–-]\s*/)[0]
    .trim();
}

async function main() {
  // 1. Pull live cron data — JSON for model/id, text for status (--json omits status)
  let jobs = [];
  const cronTextStatus = {}; // id → cron status string (ok/error/idle)

  try {
    const raw = execSync('openclaw cron list --json 2>/dev/null', { timeout: 10000 }).toString();
    jobs = JSON.parse(raw).jobs || [];
  } catch (e) {
    console.error('Failed to read cron list --json:', e.message);
    process.exit(1);
  }

  try {
    // Parse text output for status column (not in JSON)
    // Columns: ID  Name  Schedule  Next  Last  Status  Target  AgentID  Model
    const text = execSync('openclaw cron list 2>/dev/null', { timeout: 10000 }).toString();
    for (const line of text.split('\n')) {
      const idMatch = line.match(/^([a-f0-9-]{36})\s+/);
      if (!idMatch) continue;
      const id = idMatch[1];
      const statusMatch = line.match(/\b(ok|error|idle)\b/);
      if (statusMatch) cronTextStatus[id] = statusMatch[1];
    }
  } catch (e) {
    console.error('Failed to read cron list text:', e.message);
  }

  // 2. Build cronId → agent name map + name → live data map
  const cronIdToAgent = {};
  const liveData = {};
  for (const job of jobs) {
    const name = extractName(job.name);
    if (!name) continue;
    if (job.id) cronIdToAgent[job.id] = name;
    const cronStatus = (job.id && cronTextStatus[job.id]) || 'idle';
    if (!liveData[name]) {
      liveData[name] = {
        status: STATUS_MAP[cronStatus] || 'idle',
        model:  job.payload?.model || null,
        cronStatus,
      };
    }
  }

  // 3. Login to MC
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!loginRes.ok) { console.error('MC login failed'); process.exit(1); }
  const cookie = loginRes.headers.get('set-cookie').match(/mc-session=[^;]+/)[0];

  // 4. Fetch active sessions — detect which cron agents are currently running
  const sessionsRes = await fetch(`${BASE_URL}/api/sessions?limit=200`, { headers: { Cookie: cookie } });
  const { sessions = [] } = await sessionsRes.json();

  // A session key like agent:main:cron:<id>:run:<runId> with active=true means the agent is working RIGHT NOW
  const activeRunningCronIds = new Set();
  for (const s of sessions) {
    if (!s.active) continue;
    const m = s.key?.match(/cron:([a-f0-9-]{36}):run:/);
    if (m) activeRunningCronIds.add(m[1]);
  }

  // Promote status to 'busy' for any agent with an active run session
  for (const [cronId, agentName] of Object.entries(cronIdToAgent)) {
    if (activeRunningCronIds.has(cronId) && liveData[agentName]) {
      liveData[agentName].status = 'busy';
    }
  }

  // 5. Fetch all MC agents
  const agentsRes = await fetch(`${BASE_URL}/api/agents?limit=100`, { headers: { Cookie: cookie } });
  const { agents } = await agentsRes.json();

  // Special agents not driven by cron — check live sources instead
  // Traudl = main session, always online if gateway is reachable
  const gatewayAlive = await fetch(`${BASE_URL}/api/gateways/health`, { method: 'POST', headers: { Cookie: cookie } })
    .then(r => r.json()).then(d => d.results?.[0]?.status === 'online').catch(() => false);
  liveData['Traudl'] = {
    status: gatewayAlive ? 'online' : 'error',
    model: 'anthropic/claude-sonnet-4-6',
    cronStatus: gatewayAlive ? 'ok' : 'error',
  };

  // 5. Update each agent that has live cron data
  let updated = 0, skipped = 0;
  for (const agent of agents) {
    const live = liveData[agent.name];
    if (!live) { skipped++; continue; }

    // Skip if nothing changed (avoid noisy writes)
    if (agent.status === live.status && agent.config?.model?.primary === live.model) {
      skipped++;
      continue;
    }

    const updatedConfig = {
      ...(agent.config || {}),
      ...(live.model ? { model: { primary: live.model } } : {}),
    };

    const r = await fetch(`${BASE_URL}/api/agents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: agent.name,
        status: live.status,
        config: updatedConfig,
      }),
    });

    if (r.ok) updated++;
    else {
      const d = await r.json().catch(() => ({}));
      console.error(`Failed to update ${agent.name}: ${d.error}`);
    }
  }

  console.log(`[agent-status-sync] updated=${updated} skipped=${skipped} total=${agents.length}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
