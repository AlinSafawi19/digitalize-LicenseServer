/**
 * Utility script to kill processes using a specific port
 * Usage: node scripts/kill-port.js [port]
 * Default port: 3000
 */

const { execSync } = require('child_process');
const port = process.argv[2] || '3000';

console.log(`Finding processes using port ${port}...\n`);

try {
  // Find process using the port (Windows)
  const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
  const lines = result.trim().split('\n').filter(line => line.includes('LISTENING'));
  
  if (lines.length === 0) {
    console.log(`✓ Port ${port} is free - no processes found.`);
    process.exit(0);
  }

  const pids = new Set();
  lines.forEach(line => {
    const match = line.match(/\s+(\d+)$/);
    if (match) {
      pids.add(match[1]);
    }
  });

  if (pids.size === 0) {
    console.log(`✓ Port ${port} is free - no processes found.`);
    process.exit(0);
  }

  console.log(`Found ${pids.size} process(es) using port ${port}:\n`);

  pids.forEach(pid => {
    try {
      const cmdLine = execSync(
        `powershell -Command "(Get-CimInstance Win32_Process -Filter \\\"ProcessId = ${pid}\\\").CommandLine"`,
        { encoding: 'utf8', stdio: 'pipe' }
      ).trim();
      
      console.log(`  PID ${pid}: ${cmdLine.substring(0, 100)}${cmdLine.length > 100 ? '...' : ''}`);
    } catch (e) {
      console.log(`  PID ${pid}: (unable to get command line)`);
    }
  });

  console.log(`\nKilling process(es)...`);
  pids.forEach(pid => {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
      console.log(`  ✓ Killed PID ${pid}`);
    } catch (e) {
      console.log(`  ✗ Failed to kill PID ${pid}: ${e.message}`);
    }
  });

  // Verify port is free
  setTimeout(() => {
    try {
      const verify = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: 'pipe' });
      if (verify.trim()) {
        console.log(`\n⚠ Warning: Port ${port} may still be in use.`);
      } else {
        console.log(`\n✓ Port ${port} is now free.`);
      }
    } catch (e) {
      console.log(`\n✓ Port ${port} is now free.`);
    }
  }, 1000);

} catch (error) {
  if (error.message.includes('findstr')) {
    console.log(`✓ Port ${port} is free - no processes found.`);
  } else {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

