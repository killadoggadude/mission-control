const fs = require('fs');
const path = require('path');

const ROSTER_FILE = path.join(__dirname, 'agents-roster.json');
const BASE_URL = 'http://192.168.1.39:3000';

async function login() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'admin',
      password: 'admin123'
    })
  });
  
  if (!response.ok) {
    throw new Error(`Login failed: ${response.statusText}`);
  }
  
  // Get the session cookie
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('No session cookie received');
  }
  
  // Extract the mc-session cookie value
  const match = setCookie.match(/mc-session=([^;]+)/);
  if (!match) {
    throw new Error('Could not parse mc-session cookie');
  }
  
  return `mc-session=${match[1]}`;
}

async function createAgent(cookie, agent) {
  const response = await fetch(`${BASE_URL}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookie
    },
    body: JSON.stringify({
      name: agent.name,
      role: agent.role,
      status: agent.status,
      config: {
        identity: {
          name: agent.name,
          title: agent.title,
          theme: agent.department
        },
        model: {
          primary: agent.model
        },
        description: agent.description,
        schedule: agent.schedule,
        avatar: agent.avatar,
        department: agent.department,
        reports_to: agent.reports_to
      }
    })
  });
  
  const data = await response.json();
  
  if (response.status === 409) {
    console.log(`  ⚠️  ${agent.name} already exists, skipping...`);
    return { skipped: true, name: agent.name };
  }
  
  if (!response.ok) {
    console.error(`  ❌ Failed to create ${agent.name}: ${data.error || response.statusText}`);
    return { error: true, name: agent.name, error: data.error };
  }
  
  console.log(`  ✅ Created ${agent.name} (${agent.role})`);
  return { success: true, name: agent.name };
}

async function main() {
  console.log('🚀 Importing agents to Mission Control...\n');
  
  // Load roster
  const roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf8'));
  
  // Login
  console.log('📝 Logging in...');
  const token = await login();
  console.log('✅ Logged in successfully\n');
  
  // Create agents
  const results = { created: 0, skipped: 0, errors: 0 };
  
  for (const team of roster.teams) {
    console.log(`📁 ${team.icon} ${team.name} Team`);
    
    for (const agent of team.agents) {
      const result = await createAgent(token, agent);
      
      if (result.success) results.created++;
      else if (result.skipped) results.skipped++;
      else results.errors++;
    }
    
    console.log('');
  }
  
  // Summary
  console.log('📊 Summary:');
  console.log(`   ✅ Created: ${results.created}`);
  console.log(`   ⚠️  Skipped: ${results.skipped}`);
  console.log(`   ❌ Errors: ${results.errors}`);
  console.log(`\n🎉 Done! Visit ${BASE_URL}/agents to see your team.`);
}

main().catch(err => {
  console.error('💥 Fatal error:', err.message);
  process.exit(1);
});
