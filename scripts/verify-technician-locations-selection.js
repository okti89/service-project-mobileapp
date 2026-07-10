const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, '..', 'src', 'screens', 'technician', 'TechnicianLocationsScreen.jsx');
const source = fs.readFileSync(screenPath, 'utf8');

const hasRouteParam = /export default function TechnicianLocationsScreen\(\{ navigation,\s*route \}\)/.test(source);
const readsTechnicianId = /route\?\.params\?\.technicianId|route\?\.(params|params\?\.)?.*technicianId/.test(source);
const alwaysSelectsFirst = /if \(sorted\.length > 0\) \{\s*setSelectedTechnician\(sorted\[0\]\);\s*\}/.test(source);

if (!hasRouteParam) {
    console.error('TechnicianLocationsScreen should receive route in its component params.');
    process.exit(1);
}

if (!readsTechnicianId) {
    console.error('TechnicianLocationsScreen should read technicianId from route params.');
    process.exit(1);
}

if (alwaysSelectsFirst) {
    console.error('TechnicianLocationsScreen should not always fall back to the first technician.');
    process.exit(1);
}

console.log('Technician location selection wiring looks good.');
