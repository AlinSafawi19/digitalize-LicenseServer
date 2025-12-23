/**
 * Utility script to stop dev-related Node.js processes
 * This helps free up Prisma DLL locks before building
 * Usage: node scripts/stop-dev.js
 */

const { execSync } = require('child_process');

console.log('Finding dev-related Node.js processes...\n');

try {
  // Get all Node.js processes
  const result = execSync(
    'powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"',
    { encoding: 'utf8', stdio: 'pipe' }
  );
  
  const pids = result.trim().split('\n').filter(pid => pid.trim());
  
  if (pids.length === 0) {
    console.log('✓ No Node.js processes found.\n');
    process.exit(0);
  }

  const devProcesses = [];
  
  // Check each process to see if it's dev-related
  pids.forEach(pid => {
    try {
      const cmdLine = execSync(
        `powershell -Command "(Get-CimInstance Win32_Process -Filter \\\"ProcessId = ${pid.trim()}\\\").CommandLine"`,
        { encoding: 'utf8', stdio: 'pipe' }
      ).trim();
      
      // Identify dev-related processes
      const isDevProcess = 
        cmdLine.includes('nodemon') ||
        cmdLine.includes('ts-node') ||
        cmdLine.includes('src/server.ts') ||
        (cmdLine.includes('npm') && cmdLine.includes('dev')) ||
        (cmdLine.includes('node') && cmdLine.includes('dev.js'));
      
      if (isDevProcess) {
        devProcesses.push({ pid: pid.trim(), cmd: cmdLine });
      }
    } catch (e) {
      // Skip processes we can't inspect
    }
  });

  if (devProcesses.length === 0) {
    console.log('✓ No dev-related processes found.\n');
    process.exit(0);
  }

  console.log(`Found ${devProcesses.length} dev-related process(es):\n`);
  devProcesses.forEach(({ pid, cmd }) => {
    console.log(`  PID ${pid}: ${cmd.substring(0, 120)}${cmd.length > 120 ? '...' : ''}`);
  });

  console.log('\nStopping processes...\n');
  
  devProcesses.forEach(({ pid, cmd }) => {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
      console.log(`  ✓ Stopped PID ${pid}`);
    } catch (e) {
      console.log(`  ✗ Failed to stop PID ${pid}: ${e.message}`);
    }
  });

  console.log('\n✓ Done. You can now run npm run build without file lock issues.\n');

} catch (error) {
  if (error.message.includes('Get-Process')) {
    console.log('✓ No Node.js processes found.\n');
  } else {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

