const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'build');
const destDir = path.join(__dirname, 'build');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (!exists) {
    console.error(`[copy-build] Source not found: ${src}`);
    return;
  }
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach((child) => {
      const srcChild = path.join(src, child);
      const destChild = path.join(dest, child);
      const childStats = fs.statSync(srcChild);
      if (childStats.isDirectory()) {
        console.log(`[copy-build] Copying directory: ${child}/`);
        copyRecursiveSync(srcChild, destChild);
      } else {
        console.log(`[copy-build] Copying file: ${child}`);
        fs.copyFileSync(srcChild, destChild);
      }
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function cleanDir(dir) {
  if (!fs.existsSync(dir)) return;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`[copy-build] Cleaned: ${dir}`);
}

console.log(`[copy-build] Source: ${srcDir}`);
console.log(`[copy-build] Destination: ${destDir}`);

// Verify source exists and has files
if (fs.existsSync(srcDir)) {
  const srcFiles = fs.readdirSync(srcDir);
  console.log(`[copy-build] Source contains ${srcFiles.length} items:`, srcFiles.slice(0, 5).join(', '));
} else {
  console.error(`[copy-build] ERROR: Source build folder does not exist!`);
  process.exit(1);
}

// Verify index.html exists in source
const indexPath = path.join(srcDir, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`[copy-build] ERROR: index.html not found in source: ${indexPath}`);
  process.exit(1);
}
console.log(`[copy-build] Source index.html verified: ${indexPath}`);

console.log('[copy-build] Cleaning destination...');
cleanDir(destDir);

console.log('[copy-build] Copying React build to electron/build...');
// Create destination dir first
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}
copyRecursiveSync(srcDir, destDir);

// Verify copy was successful
const destIndexPath = path.join(destDir, 'index.html');
if (fs.existsSync(destIndexPath)) {
  console.log('[copy-build] ✓ Success! index.html found in destination');
  const destFiles = fs.readdirSync(destDir);
  console.log(`[copy-build] Destination now contains ${destFiles.length} items`);
} else {
  console.error(`[copy-build] ✗ ERROR: index.html NOT found in destination: ${destIndexPath}`);
  console.error(`[copy-build] Destination contents:`, fs.readdirSync(destDir));
  process.exit(1);
}

console.log('[copy-build] Done.');
