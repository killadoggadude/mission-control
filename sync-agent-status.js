// Sync real cron status + model → Mission Control agents
const { execSync } = require('child_process');

const BASE_URL = 'http://192.168.1.39:3000';

// Map cron job name → MC agent name
const CRON_TO_AGENT = {
  'Vega':    'Vega',
  'Echo':    'Echo',
  'Blaze':   'Blaze',
  'Cosmo':   'Cosmo',
  'Orion':   'Orion',
  'Rex':     'Rex',
  'Sage':    'Sage',
  'Luna':    'Luna',
  'Nova':    'Nova',
  'Zara':    'Zara',
  'Atlas':   'Atlas',
  'Cleo':    'Cleo',
  'Phoenix': 'Phoenix',
  'Kai':     'Kai',
  'Jaxon':   'Jaxon',
  'Maya':    'Maya',  // stored as "️ Maya" in cron due to emoji issue
  'Iris':    'Iris',
  'Ryder':   'Ryder',
  'Mira':    'Mira',
};

// Cron status → MC status
function mapStatus(cronStatus) {
  if (cronStatus === 'ok')    return 'online';
  if (cronStatus === 'error') return 'error';
  if (cronStatus === 'idle')  return 'idle';
  return 'offline';
}

async function main() {
  // Get cron data
  const cronRaw = execSync('openclaw cron list --json 2>/dev/null').toString();
  const cronData = JSON.parse(cronRaw);
  const jobs = cronData.jobs || [];

  // Build map: agentName → { status, model, lastRun, schedule }
  const agentData = {};
  for (const job of jobs) {
    const name = (job.name || '').replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F\u200D]+\s*/gu, '').split(/\s*[—–-]\s*/)[0].trim();
    const mcName = CRON_TO_AGENT[name];
    if (!mcName) continue;

    // Only keep the named cron (skip duplicates like "Git Sync" vs "Echo")
    if (!agentData[mcName]) {
      const model = job.payload?.model || 'lmstudio/qwen3.5-9b (→ qwen35 fallback)';
      agentData[mcName] = {
        status: mapStatus(job.status),
        model,
        cronStatus: job.status,
        schedule: formatSchedule(job.schedule),
        lastActivity: job.lastRunAt ? `Last ran: ${new Date(job.lastRunAt * 1000).toLocaleString('en-PH', {timeZone:'Asia/Manila'})}` : 'Not yet run',
      };
    }
  }

  // Login to MC
  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = login.headers.get('set-cookie').match(/mc-session=[^;]+/)[0];

  // Get all agents from MC
  const agentsResp = await fetch(`${BASE_URL}/api/agents?limit=100`, { headers: { Cookie: cookie } });
  const { agents } = await agentsResp.json();

  console.log(`📡 Syncing ${Object.keys(agentData).length} agents from cron → Mission Control\n`);

  let updated = 0, notFound = 0;

  for (const mcAgent of agents) {
    const data = agentData[mcAgent.name];
    if (!data) { console.log(`   ⚪ ${mcAgent.name} — no cron data`); notFound++; continue; }

    // Merge new config
    const existingConfig = mcAgent.config || {};
    const newConfig = {
      ...existingConfig,
      model: { primary: data.model },
      schedule: data.schedule,
    };

    const r = await fetch(`${BASE_URL}/api/agents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: mcAgent.name,
        status: data.status,
        last_activity: data.lastActivity,
        config: newConfig,
      })
    });

    const icon = data.status === 'online' ? '🟢' : data.status === 'error' ? '🔴' : data.status === 'idle' ? '🟡' : '⚫';
    if (r.ok) {
      console.log(`   ${icon} ${mcAgent.name} → ${data.status} | model: ${data.model}`);
      updated++;
    } else {
      const d = await r.json();
      console.log(`   ❌ ${mcAgent.name}: ${d.error}`);
    }
  }

  console.log(`\n✅ Updated: ${updated} | No cron data: ${notFound}`);
}

function formatSchedule(s) {
  if (!s) return 'Unknown';
  if (s.kind === 'every') {
    const ms = s.everyMs;
    if (ms < 60000) return `Every ${ms/1000}s`;
    if (ms < 3600000) return `Every ${ms/60000}m`;
    return `Every ${ms/3600000}h`;
  }
  if (s.kind === 'cron') {
    const expr = s.expr;
    const tz = s.tz || 'UTC';
    // Human-friendly common patterns
    if (expr === '45 * * * *') return 'Every hour at :45';
    if (expr === '15 * * * *') return 'Every hour at :15';
    if (expr === '0 */6 * * *') return 'Every 6 hours';
    if (expr === '5 0 * * *') return 'Daily 00:05';
    if (expr === '0 2 * * *') return 'Daily 02:00';
    if (expr === '0 3 * * *') return 'Daily 03:00';
    if (expr === '0 4 * * *') return 'Daily 04:00';
    if (expr === '0 5 * * *') return 'Daily 05:00';
    if (expr === '30 3 * * *') return 'Daily 03:30';
    if (expr === '0 8 * * *') return 'Daily 08:00';
    if (expr === '0 9 * * *') return 'Daily 09:00';
    if (expr === '0 10 * * *') return 'Daily 10:00';
    if (expr === '0 18 * * *') return 'Daily 18:00';
    if (expr === '0 20 * * *') return 'Daily 20:00';
    if (expr === '0 3 * * 0') return 'Weekly Sunday 03:00';
    if (expr === '0 9 * * 1') return 'Weekly Monday 09:00';
    return `cron: ${expr} (${tz})`;
  }
  return JSON.stringify(s);
}

main().catch(e => { console.error(e.message); process.exit(1); });
