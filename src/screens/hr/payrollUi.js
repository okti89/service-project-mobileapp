const pickText = (...values) => values.find((value) => String(value || '').trim()) || null;

const technicianName = (payroll) => (
    pickText(
        payroll?.technician_name,
        payroll?.technician_detail?.user?.full_name,
        payroll?.technician_detail?.name,
        payroll?.full_name,
        payroll?.user?.full_name,
        [payroll?.user?.first_name, payroll?.user?.last_name].filter(Boolean).join(' '),
        payroll?.technician_email,
        payroll?.technician_detail?.user?.email,
        payroll?.user?.email,
    )
    || `Teknisyen #${String(payroll?.technician || '').slice(0, 6)}`
);

const formatMonthKey = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const isMonthMatch = (payroll, monthDate) => {
    const key = formatMonthKey(monthDate);
    if (!key) return true;
    return formatMonthKey(payroll?.period_start) === key || formatMonthKey(payroll?.period_end) === key;
};

const filterPayrolls = (payrolls, { selectedMonth, search }) => {
    const query = String(search || '').trim().toLowerCase();
    return (Array.isArray(payrolls) ? payrolls : [])
        .filter((item) => isMonthMatch(item, selectedMonth))
        .filter((item) => {
            if (!query) return true;
            return technicianName(item).toLowerCase().includes(query);
        });
};

const normalizeId = (value) => (value === undefined || value === null || value === '' ? null : String(value));

const collectUserKeys = (userInfo = {}) => new Set([
    normalizeId(userInfo?.id),
    normalizeId(userInfo?.user_id),
    normalizeId(userInfo?.technician_profile_id),
    String(userInfo?.email || '').trim().toLowerCase() || null,
].filter(Boolean));

const payrollUserKeys = (payroll = {}) => new Set([
    normalizeId(payroll?.user),
    normalizeId(payroll?.user_id),
    normalizeId(payroll?.technician_user_id),
    normalizeId(payroll?.technician_detail?.user?.id),
    normalizeId(payroll?.technician_detail?.user_id),
    normalizeId(payroll?.technician_detail?.id),
    normalizeId(payroll?.technician),
    normalizeId(payroll?.technician_id),
    String(payroll?.user?.email || '').trim().toLowerCase() || null,
    String(payroll?.technician_email || '').trim().toLowerCase() || null,
    String(payroll?.technician_detail?.user?.email || '').trim().toLowerCase() || null,
].filter(Boolean));

const filterPayrollsForUser = (payrolls, userInfo = {}) => {
    const rows = Array.isArray(payrolls) ? payrolls : [];
    const userKeys = collectUserKeys(userInfo);
    if (!userKeys.size) return rows;

    const matched = rows.filter((payroll) => {
        const keys = payrollUserKeys(payroll);
        if (!keys.size) return false;
        return [...keys].some((key) => userKeys.has(key));
    });

    return matched.length ? matched : rows;
};

const buildDashboardSummary = (payrolls, selectedMonth) => {
    const monthlyRows = filterPayrolls(payrolls, { selectedMonth, search: '' });
    return monthlyRows.reduce((acc, item) => {
        if (item?.status === 'paid') {
            acc.paidCount += 1;
        } else if (item?.status === 'draft' || item?.status === 'approved') {
            acc.pendingCount += 1;
        }
        acc.totalNet += Number(item?.net_salary || 0);
        return acc;
    }, {
        pendingCount: 0,
        paidCount: 0,
        totalNet: 0,
    });
};

const getTechnicianInitials = (fullName) => {
    const initials = String(fullName || '')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join('')
        .toUpperCase();

    return initials || 'TE';
};

const getSelectedTechnicianLabel = (technician) => {
    if (!technician) return 'Teknisyen sec';
    return technicianName(technician);
};

const normalizeErrorMessage = (value) => {
    if (Array.isArray(value)) return normalizeErrorMessage(value[0]);
    if (value && typeof value === 'object') {
        const nested = Object.values(value).flat?.() || Object.values(value);
        return normalizeErrorMessage(nested[0]);
    }
    return String(value || '').trim();
};

const friendlyPayrollError = (message) => {
    const lower = String(message || '').toLowerCase();
    if (
        lower.includes('unique_payroll_period')
        || lower.includes('payroll with this technician')
        || lower.includes('unique constraint')
        || lower.includes('already exists')
        || (
            lower.includes('unique set')
            && lower.includes('technician')
            && lower.includes('period_start')
            && lower.includes('period_end')
        )
        || (
            lower.includes('benzersiz')
            && lower.includes('technician')
            && lower.includes('period_start')
            && lower.includes('period_end')
        )
        || (
            lower.includes('unique')
            && lower.includes('technician')
            && lower.includes('period_start')
            && lower.includes('period_end')
        )
    ) {
        return 'Bu teknisyen icin secilen donemde zaten bir bordro var.';
    }
    return message || 'Bordro olusturulamadi. Bilgileri kontrol edip tekrar deneyin.';
};

const extractPayrollFormErrors = (error) => {
    const responseData = error?.response?.data;
    const fieldErrors = {};
    let generalError = '';

    if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
        Object.keys(responseData).forEach((key) => {
            const message = normalizeErrorMessage(responseData[key]);
            if (!message) return;
            if (key === 'detail' || key === 'non_field_errors' || key === 'nonFieldErrors' || key === '__all__') {
                generalError = friendlyPayrollError(message);
                return;
            }
            fieldErrors[key] = friendlyPayrollError(message);
        });
    } else {
        generalError = friendlyPayrollError(normalizeErrorMessage(responseData));
    }

    if (!generalError) {
        generalError = friendlyPayrollError(error?.message);
    }

    return {
        generalError,
        fieldErrors,
    };
};

const money = (value) => Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatDisplayDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';
    return parsed.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
};

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const slugify = (value) => String(value || 'bordro')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'bordro';

const buildPayrollPdfFileName = (payroll) => {
    const person = slugify(technicianName(payroll));
    const month = formatMonthKey(payroll?.period_start) || 'donem';
    return `bordro-${person}-${month}.pdf`;
};

const companyDisplayName = (companyConfig) => (
    pickText(
        companyConfig?.name,
        companyConfig?.company_name,
        companyConfig?.title,
        companyConfig?.appName,
    )
    || 'Servis Yönetim Sistemi'
);

const buildComponentRows = (components, type) => {
    const rows = (Array.isArray(components) ? components : []).filter((item) => item?.type === type);
    if (!rows.length) {
        return '<tr><td colspan="2" class="muted">Kayit yok</td></tr>';
    }

    return rows.map((item) => `
        <tr>
            <td>${escapeHtml(item?.name || 'Kalem')}</td>
            <td class="amount">${money(item?.amount)} TL</td>
        </tr>
    `).join('');
};

const buildPayrollPdfHtml = (payroll, companyConfig = null) => {
    const name = technicianName(payroll);
    const companyName = companyDisplayName(companyConfig);
    return `
<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <style>
        body { font-family: Arial, sans-serif; color: #101828; padding: 28px; }
        .header { border-bottom: 3px solid #0066CC; padding-bottom: 16px; margin-bottom: 22px; }
        .brand { color: #0066CC; font-size: 24px; font-weight: 800; }
        h1 { font-size: 22px; margin: 18px 0 4px; }
        .muted { color: #667085; }
        .summary { background: #F0F5FF; border-radius: 16px; padding: 18px; margin-bottom: 18px; }
        .net { font-size: 32px; font-weight: 900; margin-top: 8px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 18px 0; }
        .box { border: 1px solid #E5E7EB; border-radius: 12px; padding: 12px; }
        .label { color: #667085; font-size: 12px; font-weight: 700; }
        .value { font-size: 16px; font-weight: 800; margin-top: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { text-align: left; color: #667085; font-size: 12px; border-bottom: 1px solid #E5E7EB; padding: 8px; }
        td { border-bottom: 1px solid #F0F2F5; padding: 10px 8px; }
        .amount { text-align: right; font-weight: 800; }
        .footer { margin-top: 28px; color: #98A2B3; font-size: 11px; text-align: center; }
    </style>
</head>
<body>
    <div class="header">
        <div class="brand">${escapeHtml(companyName)}</div>
        <h1>Bordro Dokumu</h1>
        <div class="muted">${escapeHtml(formatDisplayDate(payroll?.period_start))} - ${escapeHtml(formatDisplayDate(payroll?.period_end))}</div>
    </div>

    <div class="summary">
        <div class="label">Teknisyen</div>
        <div class="value">${escapeHtml(name)}</div>
        <div class="label" style="margin-top: 16px;">Net odeme</div>
        <div class="net">${money(payroll?.net_salary)} TL</div>
    </div>

    <div class="grid">
        <div class="box"><div class="label">Taban maas</div><div class="value">${money(payroll?.base_salary)} TL</div></div>
        <div class="box"><div class="label">Toplam prim</div><div class="value">${money(payroll?.total_premiums)} TL</div></div>
        <div class="box"><div class="label">Toplam kesinti</div><div class="value">${money(payroll?.total_deductions)} TL</div></div>
    </div>

    <h2>Eklentiler</h2>
    <table>
        <thead><tr><th>Kalem</th><th class="amount">Tutar</th></tr></thead>
        <tbody>${buildComponentRows(payroll?.components, 'addition')}</tbody>
    </table>

    <h2>Kesintiler</h2>
    <table>
        <thead><tr><th>Kalem</th><th class="amount">Tutar</th></tr></thead>
        <tbody>${buildComponentRows(payroll?.components, 'deduction')}</tbody>
    </table>

    <div class="footer">Bu dokum ${escapeHtml(companyName)} tarafindan olusturulmustur.</div>
</body>
</html>`;
};

const isExpoGoRuntime = (appOwnership) => appOwnership === 'expo';

module.exports = {
    buildDashboardSummary,
    buildPayrollPdfFileName,
    buildPayrollPdfHtml,
    companyDisplayName,
    extractPayrollFormErrors,
    filterPayrolls,
    filterPayrollsForUser,
    formatMonthKey,
    getSelectedTechnicianLabel,
    getTechnicianInitials,
    isExpoGoRuntime,
    isMonthMatch,
    technicianName,
};
