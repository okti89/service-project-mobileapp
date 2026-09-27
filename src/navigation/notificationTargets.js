const normalizeScreenName = (value) => String(value || '')
    .replace(/[\s_-]/g, '')
    .toLocaleLowerCase('tr-TR');

const nestedAdminTarget = (screen, params) => ({
    name: 'Tabs',
    params: {
        screen: 'AdminPanel',
        params: {
            screen,
            params,
        },
    },
});

export const resolveNotificationTarget = (data = {}) => {
    const screen = normalizeScreenName(data.related_screen || data.screen);
    const relatedId = data.related_id ?? data.relatedId ?? data.params?.id;

    if (['servicedetail', 'service'].includes(screen)) {
        return relatedId
            ? { name: 'ServiceDetail', params: { serviceId: relatedId } }
            : { name: 'ServiceList' };
    }

    if (['payroll', 'payrolldetail', 'technicianpayrolldetail'].includes(screen)) {
        return relatedId
            ? { name: 'TechnicianPayrollDetail', params: { payrollId: relatedId } }
            : { name: 'AdminPayroll' };
    }

    if (['myshifts', 'profilemyshifts', 'shiftstartreminder', 'shiftendreminder'].includes(screen)) {
        return { name: 'ProfileMyShifts' };
    }

    if (screen === 'userdetail') {
        return nestedAdminTarget(
            relatedId ? 'AdminEditUser' : 'AdminUsers',
            relatedId ? { userId: relatedId } : undefined
        );
    }

    if (['dailyservicesummary', 'servicelist', 'services'].includes(screen)) {
        return { name: 'ServiceList' };
    }

    if (screen === 'overdueservices') {
        return { name: 'ServiceList', params: { filter: 'overdue' } };
    }

    if (screen === 'tenantmemberships') {
        return nestedAdminTarget('AdminCompanySettings');
    }

    if (screen === 'subscriptionexpiry') {
        return { name: 'Tabs', params: { screen: 'Settings' } };
    }

    if (screen === 'notifications') {
        return { name: 'Notifications' };
    }

    return null;
};

export const openNotificationTarget = (navigation, data, { fromRoot = false } = {}) => {
    const resolvedTarget = resolveNotificationTarget(data);
    const target = resolvedTarget || { name: 'Notifications' };

    if (fromRoot) {
        navigation.navigate('App', {
            screen: target.name,
            params: target.params,
        });
    } else {
        navigation.navigate(target.name, target.params);
    }

    return Boolean(resolvedTarget);
};
