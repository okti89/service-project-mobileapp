const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src', 'screens', 'auth', 'LoginScreen.jsx');
const code = fs.readFileSync(filePath, 'utf8');

const failures = [];

if (!/Servis Yönetimi/.test(code)) {
  failures.push('brand label is not using proper Turkish text');
}

if (/Servis Yönetimi|Hos Geldiniz|giris yapin|Sifremi Unuttum|Kayit Ol/.test(code)) {
  failures.push('ASCII fallback Turkish copy still exists');
}

if (!/behavior=\{Platform\.OS === 'ios' \? 'padding' : 'height'\}/.test(code)) {
  failures.push('keyboard behavior is not adjusted for Android');
}

if (!/fontSize:\s*2[0-9]/.test(code)) {
  failures.push('brand label is not large enough');
}

if (failures.length) {
  console.error(failures.join(' | '));
  process.exit(1);
}

console.log('Login copy and layout verified');
