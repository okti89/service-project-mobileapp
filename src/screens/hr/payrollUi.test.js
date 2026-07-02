const test = require('node:test');
const assert = require('node:assert/strict');

const {
    buildDashboardSummary,
    buildPayrollPdfFileName,
    buildPayrollPdfHtml,
    extractPayrollFormErrors,
    filterPayrolls,
    filterPayrollsForUser,
    formatMonthKey,
    getTechnicianInitials,
    isExpoGoRuntime,
    getSelectedTechnicianLabel,
    technicianName,
} = require('./payrollUi');

const payrolls = [
    {
        id: '1',
        status: 'draft',
        net_salary: '1000',
        total_premiums: '200',
        total_deductions: '50',
        technician_name: 'Ayse Demir',
        period_start: '2026-06-01',
        period_end: '2026-06-30',
    },
    {
        id: '2',
        status: 'paid',
        net_salary: '2500',
        total_premiums: '300',
        total_deductions: '0',
        technician_name: 'Mehmet Kaya',
        period_start: '2026-06-01',
        period_end: '2026-06-30',
    },
    {
        id: '3',
        status: 'approved',
        net_salary: '3200',
        total_premiums: '100',
        total_deductions: '20',
        technician_name: 'Selin Yildiz',
        period_start: '2026-05-01',
        period_end: '2026-05-31',
    },
];

test('formatMonthKey returns YYYY-MM for date-like values', () => {
    assert.equal(formatMonthKey('2026-06-15T10:30:00Z'), '2026-06');
    assert.equal(formatMonthKey('invalid'), null);
});

test('filterPayrolls narrows rows by selected month and search query', () => {
    const filtered = filterPayrolls(payrolls, {
        selectedMonth: new Date('2026-06-05T00:00:00Z'),
        search: 'meh',
    });

    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, '2');
});

test('filterPayrollsForUser keeps rows linked to the current user when identifiers exist', () => {
    const rows = [
        { id: '1', technician_detail: { user: { id: 12, email: 'me@example.com' } } },
        { id: '2', technician_detail: { user: { id: 99, email: 'other@example.com' } } },
        { id: '3', technician_user_id: 12 },
    ];

    const filtered = filterPayrollsForUser(rows, { id: 12, email: 'me@example.com' });

    assert.deepEqual(filtered.map((row) => row.id), ['1', '3']);
});

test('filterPayrollsForUser falls back to original rows when backend already returns unidentifiable personal rows', () => {
    const rows = [
        { id: '1', technician_name: 'Ayse Demir' },
        { id: '2', technician_name: 'Ayse Demir' },
    ];

    assert.deepEqual(filterPayrollsForUser(rows, { id: 12 }), rows);
});

test('buildDashboardSummary calculates compact KPI totals for a month', () => {
    const summary = buildDashboardSummary(payrolls, new Date('2026-06-10T00:00:00Z'));

    assert.deepEqual(summary, {
        pendingCount: 1,
        paidCount: 1,
        totalNet: 3500,
    });
});

test('getTechnicianInitials builds a two-letter fallback safely', () => {
    assert.equal(getTechnicianInitials('Ayse Demir'), 'AD');
    assert.equal(getTechnicianInitials('tek isim'), 'TI');
    assert.equal(getTechnicianInitials(''), 'TE');
});

test('getSelectedTechnicianLabel returns a mobile-friendly picker label', () => {
    assert.equal(getSelectedTechnicianLabel(null), 'Teknisyen sec');
    assert.equal(
        getSelectedTechnicianLabel({ full_name: 'Ayse Demir' }),
        'Ayse Demir'
    );
});

test('technicianName falls back to email when name and surname are missing', () => {
    assert.equal(
        technicianName({
            technician_name: '',
            technician_detail: {
                user: {
                    full_name: '',
                    email: 'tech@example.com',
                },
            },
        }),
        'tech@example.com'
    );
});

test('buildPayrollPdfFileName creates a safe payroll pdf file name', () => {
    assert.equal(
        buildPayrollPdfFileName({
            technician_name: 'Ayse Demir',
            period_start: '2026-06-01',
        }),
        'bordro-ayse-demir-2026-06.pdf',
    );
});

test('buildPayrollPdfHtml renders payroll summary and escapes component text', () => {
    const html = buildPayrollPdfHtml({
        technician_name: 'Ayse <Demir>',
        period_start: '2026-06-01',
        period_end: '2026-06-30',
        status: 'paid',
        base_salary: '30000',
        total_premiums: '5000',
        total_deductions: '750',
        net_salary: '34250',
        components: [
            { name: 'Servis <Primi>', type: 'addition', amount: '5000' },
            { name: 'Avans', type: 'deduction', amount: '750' },
        ],
    });

    assert.match(html, /Bordro Dokumu/);
    assert.match(html, /Servis Yönetim Sistemi/);
    assert.match(html, /Ayse &lt;Demir&gt;/);
    assert.match(html, /Servis &lt;Primi&gt;/);
    assert.match(html, /34\.250,00/);
    assert.doesNotMatch(html, /Ayse <Demir>/);
});

test('buildPayrollPdfHtml uses provided company config name in the header and footer', () => {
    const html = buildPayrollPdfHtml(
        {
            technician_name: 'Ayse Demir',
            period_start: '2026-06-01',
            period_end: '2026-06-30',
            net_salary: '1000',
            components: [],
        },
        { name: 'Tekno Servis' },
    );

    assert.match(html, /Tekno Servis/);
    assert.doesNotMatch(html, /ServicePro/);
});

test('isExpoGoRuntime detects only Expo Go ownership', () => {
    assert.equal(isExpoGoRuntime('expo'), true);
    assert.equal(isExpoGoRuntime('standalone'), false);
    assert.equal(isExpoGoRuntime(undefined), false);
});

test('extractPayrollFormErrors separates backend field and general errors', () => {
    const result = extractPayrollFormErrors({
        response: {
            data: {
                non_field_errors: ['Bu teknisyen icin bu donemde bordro zaten var.'],
                base_salary: ['Taban maas zorunludur.'],
                period_end: 'Bitis tarihi hatali.',
            },
        },
    });

    assert.deepEqual(result, {
        generalError: 'Bu teknisyen icin bu donemde bordro zaten var.',
        fieldErrors: {
            base_salary: 'Taban maas zorunludur.',
            period_end: 'Bitis tarihi hatali.',
        },
    });
});

test('extractPayrollFormErrors translates unique payroll period backend errors', () => {
    const result = extractPayrollFormErrors({
        response: {
            data: {
                detail: 'UNIQUE constraint failed: unique_payroll_period',
            },
        },
    });

    assert.equal(result.generalError, 'Bu teknisyen icin secilen donemde zaten bir bordro var.');
});

test('extractPayrollFormErrors translates DRF unique set payroll period message', () => {
    const result = extractPayrollFormErrors({
        response: {
            data: {
                non_field_errors: ['The fields technician, period_start, period_end must make a unique set.'],
            },
        },
    });

    assert.equal(result.generalError, 'Bu teknisyen icin secilen donemde zaten bir bordro var.');
});

test('extractPayrollFormErrors translates localized unique set payroll period message', () => {
    const result = extractPayrollFormErrors({
        response: {
            data: {
                __all__: ['Technician, period_start, period_end alanlari benzersiz bir set yapmak gerekir.'],
            },
        },
    });

    assert.equal(result.generalError, 'Bu teknisyen icin secilen donemde zaten bir bordro var.');
    assert.deepEqual(result.fieldErrors, {});
});

test('extractPayrollFormErrors translates plain localized unique payroll period message', () => {
    const result = extractPayrollFormErrors({
        response: {
            data: 'Technician, period_Start, period_end alanlari benzersiz bir set yapmak gerekir.',
        },
    });

    assert.equal(result.generalError, 'Bu teknisyen icin secilen donemde zaten bir bordro var.');
    assert.deepEqual(result.fieldErrors, {});
});
