/**
 * Dev script that kills any process on port 3000 before starting nodemon
 */

const { execSync } = require('child_process');
const port = process.env.PORT || '3000';

console.log('Starting dev server...\n');

// Kill any process using the port
try {
  const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: 'pipe' });
  const lines = result.trim().split('\n').filter(line => line.includes('LISTENING'));
  
  if (lines.length > 0) {
    const pids = new Set();
    lines.forEach(line => {
      const match = line.match(/\s+(\d+)$/);
      if (match) {
        pids.add(match[1]);
      }
    });

    if (pids.size > 0) {
      console.log(`Found ${pids.size} process(es) using port ${port}. Killing...\n`);
      pids.forEach(pid => {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
          console.log(`  ✓ Killed PID ${pid}`);
        } catch (e) {
          // Ignore errors
        }
      });
      // Wait a moment for port to be released
      require('child_process').execSync('timeout /t 1 /nobreak >nul 2>&1', { stdio: 'pipe' });
    }
  }
} catch (error) {
  // Port is free, continue
}

// Start nodemon
console.log('Starting nodemon...\n');
execSync('npx nodemon --exec ts-node src/server.ts', { stdio: 'inherit' });

