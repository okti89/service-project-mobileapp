const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screenPath = path.join(__dirname, 'TechnicianLocationsScreen.jsx');
const source = fs.readFileSync(screenPath, 'utf8');

test('technician locations screen reads the incoming route technician id', () => {
    assert.match(
        source,
        /export default function TechnicianLocationsScreen\(\{ navigation,\s*route \}\)/,
    );
    assert.match(
        source,
        /route\?\.(params|params\?\.)?.*technicianId|route\?\.params\?\.technicianId/,
    );
});

test('technician locations screen does not always fall back to the first technician', () => {
    assert.doesNotMatch(
        source,
        /if \(sorted\.length > 0\) \{\s*setSelectedTechnician\(sorted\[0\]\);\s*\}/,
    );
});
