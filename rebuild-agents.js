// Rebuild agent roster in Mission Control from actual named cron agents

const BASE_URL = 'http://192.168.1.39:3000';

// IDs to delete (fake/generic ones I added earlier)
const DELETE_IDS = [4, 5, 6, 7, 8, 9]; // Mira, Qwen Local, Qwen Cloud, Healthcheck, Browser Monitor, Web Search

// Real team roster based on cron jobs
const REAL_AGENTS = [
  // ── Operations ──────────────────────────────────────────────
  {
    name: 'Vega',
    role: 'Browser Watcher',
    title: 'Browser Health Monitor',
    description: 'Monitors browser process health every 5 minutes. Checks CDP endpoint responsiveness, memory/CPU usage, and tab stability. Posts health reports to #browser-health.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Every 5 minutes',
    status: 'online',
    department: 'Operations',
    reports_to: 'Traudl',
  },
  {
    name: 'Echo',
    role: 'Git Sync Operator',
    title: 'Workspace Git Manager',
    description: 'Runs every hour at :45 to commit and push workspace changes (mission-control data, memory files, scripts). Keeps repos in sync with GitHub.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Every hour at :45 (Asia/Manila)',
    status: 'online',
    department: 'Operations',
    reports_to: 'Traudl',
  },
  {
    name: 'Blaze',
    role: 'Backup Manager',
    title: 'Data Integrity Specialist',
    description: 'Runs hourly database backups at :15 past the hour. Ensures Mission Control SQLite DB and config files are safely backed up. Runs periodic integrity drills nightly.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Every hour at :15 (Asia/Manila)',
    status: 'online',
    department: 'Operations',
    reports_to: 'Traudl',
  },
  {
    name: 'Iris',
    role: 'Memory Keeper',
    title: 'Weekly Memory Synthesizer',
    description: 'Runs weekly memory synthesis every Sunday at 03:00. Reviews recent daily memory files, extracts key decisions and learnings, updates MEMORY.md with curated long-term knowledge.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Weekly Sunday 03:00 PHT',
    status: 'online',
    department: 'Operations',
    reports_to: 'Traudl',
  },

  // ── Content ──────────────────────────────────────────────────
  {
    name: 'Mira',
    role: 'Content Creator',
    title: 'Social Media Manager (Mira Cruz)',
    description: 'Manages the Mira Cruz persona — generates iPhone Pro Max photography prompts, content for Instagram/TikTok/Fanvue. Coordinates with Typefully for auto-posting and manages the warmup strategy.',
    model: 'dashscope/qwen3.5-32b-instruct',
    schedule: 'Daily content batch at 03:00 PHT',
    status: 'error',
    department: 'Content',
    reports_to: 'Traudl',
  },
  {
    name: 'Luna',
    role: 'Prompt Artist',
    title: 'Higgsfield Prompt Generator',
    description: 'Generates daily Mira prompts for Higgsfield Nano Banana Pro imaging. Creates structured iPhone-style photography prompts with scene ideas, prompt components, and negative prompts.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 03:00 PHT',
    status: 'error',
    department: 'Content',
    reports_to: 'Mira',
  },
  {
    name: 'Maya',
    role: 'Content Strategist',
    title: 'Viral Content Strategist',
    description: 'Develops content strategy across social platforms. Analyzes what\'s working, identifies content gaps, and provides strategic direction for Mira\'s content calendar.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 10:00 PHT',
    status: 'error',
    department: 'Content',
    reports_to: 'Mira',
  },

  // ── Growth ───────────────────────────────────────────────────
  {
    name: 'Phoenix',
    role: 'Growth Strategist',
    title: 'Social Growth Lead',
    description: 'Drives follower growth strategy across Instagram and TikTok. Analyzes engagement metrics, identifies growth opportunities, and generates daily advisory briefings.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 09:00 PHT',
    status: 'idle',
    department: 'Growth',
    reports_to: 'Traudl',
  },
  {
    name: 'Zara',
    role: 'Growth Tweeter',
    title: 'X/Twitter Growth Engine',
    description: 'Generates vibe-coding and founder-lifestyle tweets for X/Twitter. Focuses on authentic builder content, growth hacking insights, and AI workflow posts via Typefully.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 09:00 PHT',
    status: 'idle',
    department: 'Growth',
    reports_to: 'Phoenix',
  },
  {
    name: 'Jaxon',
    role: 'Lead Tweeter',
    title: 'Twitter Lead Generation',
    description: 'Crafts high-engagement tweets targeting potential leads. Focuses on positioning, authority building, and funneling traffic to revenue channels.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 09:00 PHT',
    status: 'idle',
    department: 'Growth',
    reports_to: 'Phoenix',
  },
  {
    name: 'Kai',
    role: 'TikTok Strategist',
    title: 'TikTok Intelligence Lead',
    description: 'Monitors TikTok trends, analyzes viral content patterns in the creator economy space, provides daily TikTok intel briefs for content strategy adaptation.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 09:00 PHT',
    status: 'idle',
    department: 'Growth',
    reports_to: 'Phoenix',
  },
  {
    name: 'Atlas',
    role: 'X Researcher',
    title: 'Twitter Intelligence Analyst',
    description: 'Researches X/Twitter landscape — competitor analysis, trending topics, audience insights, and hashtag intelligence. Feeds data to Zara and Jaxon.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 09:00 PHT',
    status: 'idle',
    department: 'Growth',
    reports_to: 'Phoenix',
  },

  // ── Finance ──────────────────────────────────────────────────
  {
    name: 'Rex',
    role: 'Revenue Tracker',
    title: 'Fanvue Earnings Monitor',
    description: 'Tracks daily Fanvue earnings, monitors subscription metrics, and generates revenue reports at midnight. Alerts on earnings anomalies.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 00:05 PHT',
    status: 'online',
    department: 'Finance',
    reports_to: 'Cosmo',
  },

  // ── Engineering ──────────────────────────────────────────────
  {
    name: 'Nova',
    role: 'Lead Developer',
    title: 'Nightly Code Reviewer',
    description: 'Runs nightly code reviews on workspace repos, identifies tech debt, suggests refactors, and ensures code quality across all projects. Senior engineering oversight.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 03:00 PHT',
    status: 'error',
    department: 'Engineering',
    reports_to: 'Traudl',
  },
  {
    name: 'Orion',
    role: 'SaaS Scout',
    title: 'Daily SaaS Opportunity Scout',
    description: 'Scouts new SaaS prototype opportunities daily. Analyzes market gaps, identifies buildable ideas, and provides daily briefings on potential revenue opportunities.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 18:00 PHT',
    status: 'online',
    department: 'Engineering',
    reports_to: 'Traudl',
  },

  // ── Intelligence ─────────────────────────────────────────────
  {
    name: 'Ryder',
    role: 'Cross-Project Intel',
    title: 'Cross-Project Intelligence Lead',
    description: 'Synthesizes intelligence across all active projects weekly. Identifies dependencies, risks, and opportunities that span multiple projects. Provides Monday morning briefings.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Weekly Monday 09:00 PHT',
    status: 'idle',
    department: 'Intelligence',
    reports_to: 'Traudl',
  },
  {
    name: 'Sage',
    role: 'Project Monitor',
    title: 'Nightly Project Scanner',
    description: 'Monitors all active projects nightly at 02:00. Checks git status, open blockers, progress metrics, and generates project health reports.',
    model: 'lmstudio/qwen3.5-9b',
    schedule: 'Daily 02:00 PHT',
    status: 'error',
    department: 'Intelligence',
    reports_to: 'Ryder',
  },
];

async function main() {
  // Login
  const login = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const cookie = login.headers.get('set-cookie').match(/mc-session=[^;]+/)[0];
  console.log('✅ Logged in\n');

  // Delete old generic agents
  console.log('🗑️  Removing generic placeholder agents...');
  for (const id of DELETE_IDS) {
    const r = await fetch(`${BASE_URL}/api/agents/${id}`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    const d = await r.json();
    if (r.ok) console.log(`   ✅ Deleted agent #${id}`);
    else console.log(`   ⚠️  Could not delete #${id}: ${d.error}`);
  }
  console.log('');

  // Create real agents
  console.log('👥 Creating real agents...\n');
  let created = 0, skipped = 0, errors = 0;

  for (const agent of REAL_AGENTS) {
    const r = await fetch(`${BASE_URL}/api/agents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        name: agent.name,
        role: agent.role,
        status: agent.status,
        config: {
          identity: { name: agent.name, title: agent.title },
          model: { primary: agent.model },
          description: agent.description,
          schedule: agent.schedule,
          department: agent.department,
          reports_to: agent.reports_to,
        }
      })
    });
    const d = await r.json();
    if (r.status === 409) { console.log(`   ⚠️  ${agent.name} already exists`); skipped++; }
    else if (!r.ok) { console.log(`   ❌ ${agent.name}: ${d.error}`); errors++; }
    else { console.log(`   ✅ ${agent.name} — ${agent.role} [${agent.department}]`); created++; }
  }

  console.log(`\n📊 Done — Created: ${created} | Skipped: ${skipped} | Errors: ${errors}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
