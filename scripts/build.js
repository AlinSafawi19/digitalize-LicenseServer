const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const prismaClientPath = path.join(__dirname, '../node_modules/.prisma/client/index.js');
const prismaDllPath = path.join(__dirname, '../node_modules/.prisma/client/query_engine-windows.dll.node');

console.log('Starting build process...\n');

// Check for running Node processes that might lock Prisma files
function checkForLockingProcesses() {
  try {
    const { execSync } = require('child_process');
    const result = execSync('powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Id"', { encoding: 'utf8', stdio: 'pipe' });
    const pids = result.trim().split('\n').filter(pid => pid.trim());
    if (pids.length > 0) {
      console.log('⚠ Warning: Found running Node.js processes that may lock Prisma files:');
      pids.forEach(pid => {
        try {
          const cmd = execSync(`powershell -Command "(Get-CimInstance Win32_Process -Filter \\\"ProcessId = ${pid.trim()}\\\").CommandLine"`, { encoding: 'utf8', stdio: 'pipe' });
          console.log(`   PID ${pid.trim()}: ${cmd.trim()}`);
        } catch (e) {
          console.log(`   PID ${pid.trim()}`);
        }
      });
      console.log('   Tip: Stop dev server (npm run dev) or other Node processes before building.\n');
    }
  } catch (error) {
    // Ignore errors in process detection
  }
}

// Check for file locks
function isFileLocked(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return false;
  } catch (error) {
    return error.code === 'EBUSY' || error.code === 'EACCES' || error.message.includes('being used');
  }
}

// Check for potential issues before generating
if (isFileLocked(prismaDllPath)) {
  console.log('⚠ Warning: Prisma DLL file appears to be locked.');
  checkForLockingProcesses();
  console.log('   Attempting generation anyway...\n');
}

// Try to generate Prisma client
try {
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✓ Prisma client generated successfully\n');
} catch (error) {
  // Check if Prisma client already exists
  if (fs.existsSync(prismaClientPath)) {
    console.log('⚠ Prisma generation failed, but client already exists. Continuing with build...');
    if (error.message && error.message.includes('EPERM')) {
      console.log('   Error: File lock detected. Make sure to stop any running dev servers (npm run dev).\n');
    } else {
      console.log('');
    }
  } else {
    console.error('✗ Prisma generation failed and client does not exist. Build aborted.');
    if (error.message && error.message.includes('EPERM')) {
      console.error('   Error: File lock detected. Stop any running Node.js processes and try again.');
      checkForLockingProcesses();
    }
    process.exit(1);
  }
}

// Compile TypeScript
try {
  console.log('Compiling TypeScript...');
  execSync('npx tsc', { stdio: 'inherit' });
  console.log('\n✓ Build completed successfully');
} catch (error) {
  console.error('\n✗ TypeScript compilation failed');
  process.exit(1);
}

