const fs = require('fs');
const path = require('path');

const endpointsPath = path.join(process.cwd(), 'src', 'api', 'endpoints.js');
const code = fs.readFileSync(endpointsPath, 'utf8');

const hasRegisterDevice = /REGISTER_DEVICE\s*:\s*['"`]accounts\/devices\/register\//.test(code);
const hasDefaultExport = /export\s+default\s+ENDPOINTS\s*;?/.test(code);
const hasCommonJsExport = /module\.exports\s*=\s*ENDPOINTS\s*;?/.test(code);

if (!hasRegisterDevice) {
  console.error('REGISTER_DEVICE endpoint is missing from src/api/endpoints.js');
  process.exit(1);
}

if (!hasDefaultExport && !hasCommonJsExport) {
  console.error('ENDPOINTS is defined but not exported from src/api/endpoints.js');
  process.exit(1);
}

console.log('ENDPOINTS export verified');
