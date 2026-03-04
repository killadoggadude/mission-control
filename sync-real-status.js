// Direct sync of real cron statuses → Mission Control
const BASE_URL = 'http://192.168.1.39:3000';

// Ground truth from: openclaw cron list
// status: ok→online, error→error, idle→idle
const AGENT_STATUS = {
  'Traudl':  { status: 'online',  model: 'anthropic/claude-sonnet-4-6',    note: 'Main gateway session' },
  'Vega':    { status: 'online',  model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 4m ago' },
  'Echo':    { status: 'online',  model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 33m ago' },
  'Blaze':   { status: 'online',  model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 27m ago' },
  'Cosmo':   { status: 'online',  model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 5h ago' },
  'Orion':   { status: 'online',  model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 17h ago' },
  'Rex':     { status: 'online',  model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 11h ago' },
  'Sage':    { status: 'error',   model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 9h ago — errored' },
  'Mira':    { status: 'error',   model: 'lmstudio/qwen3.5-9b',            note: 'Auto-refill erroring (Mira Auto-Refill cron)' },
  'Luna':    { status: 'error',   model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 7h ago — errored' },
  'Nova':    { status: 'error',   model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 7h ago — errored' },
  'Maya':    { status: 'error',   model: 'lmstudio/qwen3.5-9b',            note: 'Last ran 32m ago — errored' },
  'Iris':    { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: Sunday 03:00' },
  'Zara':    { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: 09:00' },
  'Atlas':   { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: 09:00' },
  'Cleo':    { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: 09:00' },
  'Phoenix': { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: 09:00' },
  'Kai':     { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: 09:00' },
  'Jaxon':   { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: 09:00' },
  'Ryder':   { status: 'idle',    model: 'lmstudio/qwen3.5-9b',            note: 'Never run yet — next: Monday 09:00' },
};

const STATUS_ICON = { online: '🟢', error: '🔴', idle: '🟡', offline: '⚫', busy: '🔵' };

async function main() {
  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = login.headers.get('set-cookie').match(/mc-session=[^;]+/)[0];

  const agentsResp = await fetch(`${BASE_URL}/api/agents?limit=100`, { headers: { Cookie: cookie } });
  const { agents } = await agentsResp.json();

  console.log('🔄 Syncing real status + model to Mission Control\n');

  for (const agent of agents) {
    const data = AGENT_STATUS[agent.name];
    if (!data) { console.log(`   ⚪ ${agent.name} — skipped (no mapping)`); continue; }

    const existingConfig = agent.config || {};
    const updatedConfig = {
      ...existingConfig,
      model: { primary: data.model },
    };

    const r = await fetch(`${BASE_URL}/api/agents`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: agent.name,
        status: data.status,
        last_activity: data.note,
        config: updatedConfig,
      })
    });

    const icon = STATUS_ICON[data.status] || '⚪';
    if (r.ok) console.log(`   ${icon} ${agent.name.padEnd(10)} ${data.status.padEnd(8)} | ${data.model}`);
    else {
      const d = await r.json();
      console.log(`   ❌ ${agent.name}: ${d.error}`);
    }
  }

  console.log('\n✅ Sync complete. Refresh http://192.168.1.39:3000/agents');
}

main().catch(e => { console.error(e.message); process.exit(1); });
