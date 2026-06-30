const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'screens', 'auth', 'LandingScreen.jsx');
const code = fs.readFileSync(filePath, 'utf8');

const failures = [];

if (/Şifremi unuttum|Sifremi unuttum/.test(code)) {
  failures.push('forgot password action still exists');
}

if (/logoSection|logoWrap|appName/.test(code)) {
  failures.push('legacy logo-centric landing structure still exists');
}

if (!/Görünüm|Tema|Açık|Koyu|Sistem/.test(code)) {
  failures.push('theme selection UI is missing');
}

if (!/navigation\.navigate\('Login'\)/.test(code)) {
  failures.push('primary login action is missing');
}

if (failures.length) {
  console.error(failures.join(' | '));
  process.exit(1);
}

console.log('Landing screen structure verified');
