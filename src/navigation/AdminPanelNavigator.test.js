const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const navigatorPath = path.join(__dirname, 'AdminPanelNavigator.jsx');
const hrDashboardPath = path.join(__dirname, '..', 'screens', 'hr', 'HRDashboardScreen.jsx');

test('admin payroll route is wired to the HR flow screens', () => {
    const navigatorSource = fs.readFileSync(navigatorPath, 'utf8');

    assert.match(navigatorSource, /import HRDashboardScreen from ['"]@\/screens\/hr\/HRDashboardScreen['"]/);
    assert.match(navigatorSource, /<Stack\.Screen\s+name="AdminPayroll"\s+component=\{HRDashboardScreen\}/);
    assert.match(navigatorSource, /<Stack\.Screen\s+name="PayrollCreate"\s+component=\{PayrollCreateScreen\}/);
    assert.match(navigatorSource, /<Stack\.Screen\s+name="PayrollDetail"\s+component=\{PayrollDetailScreen\}/);
    assert.match(navigatorSource, /<Stack\.Screen\s+name="PayrollTemplates"\s+component=\{PayrollTemplatesScreen\}/);
});

test('HR dashboard exposes a link to payroll templates', () => {
    const hrDashboardSource = fs.readFileSync(hrDashboardPath, 'utf8');

    assert.match(hrDashboardSource, /navigation\.navigate\('PayrollTemplates'\)/);
});

