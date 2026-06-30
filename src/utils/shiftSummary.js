import dayjs from 'dayjs';

const formatTime = (value) => {
    if (!value) return '--:--';
    const date = dayjs(value);
    return date.isValid() ? date.format('HH:mm') : '--:--';
};

const formatDuration = (totalSeconds) => {
    const safe = Math.max(0, Number(totalSeconds) || 0);
    const hours = String(Math.floor(safe / 3600)).padStart(2, '0');
    const minutes = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
    const seconds = String(safe % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};

const getTodayWorkingHours = (workingHours = [], now = dayjs()) => {
    const today = now.day();
    const normalizedDay = today === 0 ? 6 : today - 1;
    return workingHours.find((item) => Number(item?.day_of_week) === normalizedDay) || null;
};

const getShiftBreakSeconds = (shift, now = dayjs()) => {
    const persisted = Math.max(
        0,
        Number(shift?.break_seconds ?? (Math.max(0, Number(shift?.break_minutes || 0)) * 60))
    );
    const isOnBreak = Boolean(shift?.break_started_at && !shift?.end_time);
    if (!isOnBreak) return persisted;

    const breakStart = dayjs(shift.break_started_at);
    if (!breakStart.isValid()) return persisted;
    return persisted + Math.max(0, now.diff(breakStart, 'second'));
};

const getShiftWorkedSeconds = (shift, now = dayjs()) => {
    if (!shift?.start_time) return 0;

    const backendDurationMinutes = shift?.duration_minutes == null ? null : Number(shift.duration_minutes);
    if (shift?.end_time && Number.isFinite(backendDurationMinutes)) {
        return Math.max(0, backendDurationMinutes * 60);
    }

    const start = dayjs(shift.start_time);
    if (!start.isValid()) return 0;

    const end = shift?.end_time
        ? dayjs(shift.end_time)
        : shift?.break_started_at
            ? dayjs(shift.break_started_at)
            : now;

    if (!end?.isValid()) return 0;
    const grossSeconds = Math.max(0, end.diff(start, 'second'));
    return Math.max(0, grossSeconds - getShiftBreakSeconds(shift, now));
};

const buildShiftHistory = (shifts, now = dayjs()) => {
    return (Array.isArray(shifts) ? shifts : [])
        .filter((shift) => shift?.start_time)
        .sort((a, b) => dayjs(b.start_time).valueOf() - dayjs(a.start_time).valueOf())
        .map((shift) => {
            const start = dayjs(shift.start_time);
            const end = shift?.end_time ? dayjs(shift.end_time) : null;
            const dateKey = start.isValid() ? start.format('YYYY-MM-DD') : null;
            const isToday = Boolean(dateKey && dateKey === now.format('YYYY-MM-DD'));
            const isOpen = Boolean(shift?.start_time && !shift?.end_time);

            return {
                id: shift?.id || `${shift?.start_time}-${shift?.end_time || 'open'}`,
                dateKey,
                dateLabel: start.isValid()
                    ? start.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })
                    : '--',
                fullDateLabel: start.isValid()
                    ? start.toDate().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '--',
                rangeLabel: `${formatTime(shift?.start_time)} - ${shift?.end_time ? formatTime(shift?.end_time) : '--:--'}`,
                durationLabel: formatDuration(getShiftWorkedSeconds(shift, now)),
                statusLabel: isOpen ? 'Açık mesai' : isToday ? 'Bugün tamamlandı' : 'Tamamlandı',
                statusColor: isOpen ? '#F59E0B' : '#16A34A',
                isOpen,
                isToday,
                startValue: start.isValid() ? start.valueOf() : 0,
                endValue: end?.isValid() ? end.valueOf() : null,
            };
        });
};

const getScheduleSeconds = (hours) => {
    const startHour = hours?.start_time?.slice(0, 5) || null;
    const endHour = hours?.end_time?.slice(0, 5) || null;
    if (!startHour || !endHour) return 0;

    const start = dayjs(`2000-01-01T${startHour}`);
    const end = dayjs(`2000-01-01T${endHour}`);
    if (!start.isValid() || !end.isValid() || !end.isAfter(start)) return 0;
    return end.diff(start, 'second');
};

export const buildShiftState = ({ shifts, config, now = dayjs() }) => {
    const safeShifts = Array.isArray(shifts) ? shifts : [];
    const workingHours = Array.isArray(config?.working_hours) ? config.working_hours : [];
    const todayHours = getTodayWorkingHours(workingHours, now);
    const startHour = todayHours?.start_time?.slice(0, 5) || null;
    const endHour = todayHours?.end_time?.slice(0, 5) || null;
    const todayDate = now.format('YYYY-MM-DD');
    const scheduleSeconds = getScheduleSeconds(todayHours);
    const todayScheduleLabel = todayHours?.is_holiday
        ? 'Bugün tatil'
        : startHour && endHour
            ? `${startHour} - ${endHour}`
            : 'Tanımlı değil';

    const openShift = safeShifts.find((shift) => shift?.start_time && !shift?.end_time) || null;
    const openShiftStart = openShift?.start_time ? dayjs(openShift.start_time) : null;
    const openShiftDate = openShiftStart?.isValid() ? openShiftStart.format('YYYY-MM-DD') : null;
    const isOpenShiftToday = Boolean(openShift && openShiftDate === todayDate);
    const hasOvernightOpenShift = Boolean(openShift && openShiftDate && openShiftDate !== todayDate);
    const todayShifts = safeShifts
        .filter((shift) => shift?.start_time && dayjs(shift.start_time).isValid() && dayjs(shift.start_time).format('YYYY-MM-DD') === todayDate)
        .sort((a, b) => dayjs(a.start_time).valueOf() - dayjs(b.start_time).valueOf());
    const latestTodayShift = todayShifts[todayShifts.length - 1] || null;

    const warnings = [];
    const startBoundary = startHour ? dayjs(`${todayDate}T${startHour}`) : null;
    const endBoundary = endHour ? dayjs(`${todayDate}T${endHour}`) : null;

    if (!isOpenShiftToday && startBoundary?.isValid() && now.isAfter(startBoundary)) {
        warnings.push('Mesai başlangıç saati geçti. Mesaiye başlamanız bekleniyor.');
    }

    if (hasOvernightOpenShift) {
        warnings.push('Önceki güne ait açık mesai kaydı var. Lütfen yeni mesai başlatmadan önce mevcut kaydı bitirin.');
    }

    const todayWorkedSeconds = todayShifts.reduce((total, shift) => total + getShiftWorkedSeconds(shift, now), 0);
    const completedPercentage = scheduleSeconds > 0
        ? Math.min(100, Math.round((todayWorkedSeconds / scheduleSeconds) * 100))
        : 0;
    const remainingSeconds = Math.max(0, scheduleSeconds - todayWorkedSeconds);
    const exceededSeconds = Math.max(0, todayWorkedSeconds - scheduleSeconds);

    let statusLabel = 'Mesai Dışı';
    let statusColor = '#6B7280';
    let counterLabel = formatDuration(todayWorkedSeconds);
    let metaLabel = 'Bugün için mesai kaydı bulunmuyor.';
    let startLabel = latestTodayShift?.start_time ? formatTime(latestTodayShift.start_time) : '--:--';
    let endLabel = latestTodayShift?.end_time ? formatTime(latestTodayShift.end_time) : '--:--';

    if (isOpenShiftToday && openShiftStart?.isValid()) {
        statusLabel = 'Mesaide';
        statusColor = '#16A34A';
        counterLabel = formatDuration(todayWorkedSeconds);
        startLabel = formatTime(openShift.start_time);
        metaLabel = endBoundary?.isValid() && now.isAfter(endBoundary)
            ? 'Mesai saati aşıldı, mesaiyi bitirmeniz bekleniyor.'
            : 'Bugünkü aktif mesai devam ediyor.';
        if (endBoundary?.isValid() && now.isAfter(endBoundary)) {
            warnings.push('Şirket mesai bitiş saati geçti. Mesaiyi bitirmeniz isteniyor.');
        }
    } else if (hasOvernightOpenShift && openShiftStart?.isValid()) {
        statusLabel = 'Mesai Kapanışı Bekleniyor';
        statusColor = '#F59E0B';
        counterLabel = '00:00:00';
        startLabel = formatTime(openShift.start_time);
        endLabel = '--:--';
        metaLabel = 'Dünden açık kalan mesai yeni güne devretmez.';
    } else if (latestTodayShift?.end_time) {
        statusLabel = 'Bugün Tamamlandı';
        statusColor = '#16A34A';
        counterLabel = formatDuration(todayWorkedSeconds);
        metaLabel = completedPercentage >= 100
            ? 'Bugünkü planlanan mesai tamamlandı.'
            : 'Bugünkü mesai kapatıldı.';
    }

    const shouldStopShift = Boolean(isOpenShiftToday || hasOvernightOpenShift);
    const actionDisabled = Boolean(!shouldStopShift && hasOvernightOpenShift);
    const actionDisabledReason = actionDisabled
        ? 'Önceki güne ait açık mesai kaydı bitirilmeden yeni mesai başlatılamaz.'
        : null;

    const historyShifts = buildShiftHistory(safeShifts, now);
    const markedShiftDates = Array.from(new Set(historyShifts.map((item) => item.dateKey).filter(Boolean)));

    return {
        visible: true,
        isHoliday: Boolean(todayHours?.is_holiday),
        isActiveToday: isOpenShiftToday,
        hasOvernightOpenShift,
        statusLabel,
        statusColor,
        counterLabel,
        metaLabel,
        startLabel,
        endLabel,
        todayScheduleLabel,
        scheduleSeconds,
        workedSeconds: todayWorkedSeconds,
        workedDurationLabel: formatDuration(todayWorkedSeconds),
        targetDurationLabel: scheduleSeconds > 0 ? formatDuration(scheduleSeconds) : '--:--:--',
        remainingDurationLabel: exceededSeconds > 0 ? formatDuration(exceededSeconds) : formatDuration(remainingSeconds),
        remainingLabel: exceededSeconds > 0 ? 'Fazla mesai' : 'Kalan süre',
        completedPercentage,
        progressLabel: scheduleSeconds > 0 ? `%${completedPercentage} tamamlandı` : 'Hedef süre tanımlı değil',
        progressShortLabel: scheduleSeconds > 0 ? `%${completedPercentage}` : 'Plansız',
        isCompletedTarget: scheduleSeconds > 0 && todayWorkedSeconds >= scheduleSeconds,
        warnings,
        shouldStopShift,
        actionDisabled,
        actionDisabledReason,
        recentShifts: historyShifts.slice(0, 5),
        historyShifts,
        markedShiftDates,
    };
};

export { formatDuration, formatTime, getTodayWorkingHours };
export default buildShiftState;
