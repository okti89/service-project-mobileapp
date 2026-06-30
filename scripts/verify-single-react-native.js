const fs = require('fs');
const path = require('path');

const root = process.cwd();
const packageLockPath = path.join(root, 'package-lock.json');

if (!fs.existsSync(packageLockPath)) {
  console.error('package-lock.json not found');
  process.exit(1);
}

const lock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
const packages = lock.packages || {};
const reactNativeEntries = Object.entries(packages).filter(([pkgPath, pkg]) => {
  return (
    pkg &&
    typeof pkg.version === 'string' &&
    (pkgPath === 'node_modules/react-native' || pkgPath.endsWith('/node_modules/react-native'))
  );
});

const versions = [...new Set(reactNativeEntries.map(([, pkg]) => pkg.version))];

if (versions.length !== 1 || reactNativeEntries.length !== 1) {
  console.error('Expected exactly one installed react-native version in package-lock.json.');
  console.error(`Found ${reactNativeEntries.length} entries across versions: ${versions.join(', ')}`);
  reactNativeEntries.forEach(([pkgPath, pkg]) => {
    console.error(` - ${pkgPath}: ${pkg.version}`);
  });
  process.exit(1);
}

console.log(`Single react-native verified: ${versions[0]}`);
