const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'build');
const destDir = path.join(__dirname, 'build');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (!exists) {
    console.error(`[copy-build] Source build folder not found: ${src}`);
    process.exitCode = 1;
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
        copyRecursiveSync(srcChild, destChild);
      } else {
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
}

console.log('[copy-build] Copying React build to electron/build ...');
cleanDir(destDir);
copyRecursiveSync(srcDir, destDir);
console.log('[copy-build] Done.');
