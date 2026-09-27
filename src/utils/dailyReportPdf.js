import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/api/axios';
import { getNativeShare } from '@/utils/nativeShare';

const normalizeWhatsAppPhone = (phone) => {
    let digits = String(phone || '').replace(/[^0-9]/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
    if (digits.length === 10 && digits.startsWith('5')) digits = `90${digits}`;
    return digits;
};

const getDownloadHeaders = async () => {
    const token = await AsyncStorage.getItem('auth_token');
    const tenantCode = await AsyncStorage.getItem('tenant_code');
    return {
        ...(token ? { Authorization: `Token ${token}` } : {}),
        ...(tenantCode ? { 'X-Tenant-Code': tenantCode } : {}),
    };
};

export async function exportDailyReportPdf({ type, date, technicianId, technicianPhone }) {
    const technicianReport = type === 'technician-service-list';
    const summary = type === 'summary';
    const query = `date=${encodeURIComponent(date)}${technicianReport ? `&technician_id=${encodeURIComponent(technicianId || '')}` : ''}`;
    const endpoint = summary ? '/reports/daily-summary/pdf/' : '/reports/daily-service-list/pdf/';
    const dateFilePart = String(date || '').replace(/-/g, '_');
    const filename = summary
        ? `gunluk_icmal_${dateFilePart}.pdf`
        : technicianReport
            ? `teknisyen_servis_listesi_${dateFilePart}.pdf`
            : `gunluk_servis_listesi_${dateFilePart}.pdf`;
    const localUri = `${FileSystem.cacheDirectory}${Date.now()}_${filename}`;

    if (technicianReport && !normalizeWhatsAppPhone(technicianPhone)) {
        throw new Error('Bu teknisyenin kayıtlı telefon numarası bulunamadı.');
    }

    const downloadResult = await FileSystem.downloadAsync(
        `${api.defaults.baseURL}${endpoint}?${query}`,
        localUri,
        { headers: await getDownloadHeaders() },
    );
    if (downloadResult.status !== 200) {
        throw new Error('PDF dosyası indirilemedi.');
    }

    if (technicianReport) {
        const nativeShare = getNativeShare();
        if (!nativeShare) {
            throw new Error('WhatsApp PDF gönderimi bu development build içinde kullanılamaz.');
        }
        if (Platform.OS === 'android') {
            const { isInstalled } = await nativeShare.isPackageInstalled('com.whatsapp');
            if (!isInstalled) throw new Error('WhatsApp yüklü değil.');
        }
        const pdfBase64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        await nativeShare.shareSingle({
            social: nativeShare.Social.WHATSAPP,
            whatsAppNumber: normalizeWhatsAppPhone(technicianPhone),
            url: `data:application/pdf;base64,${pdfBase64}`,
            type: 'application/pdf',
            filename,
            useInternalStorage: true,
            message: 'Günlük servis programınız ektedir.',
        });
        return;
    }

    if (Platform.OS === 'android') {
        try {
            const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri,
                type: 'application/pdf',
                flags: 1,
            });
            return;
        } catch (error) {
            // Cihazda PDF görüntüleyici yoksa sistem paylaşımını açarız.
        }
    }
    await Sharing.shareAsync(downloadResult.uri, {
        mimeType: 'application/pdf',
        dialogTitle: summary ? 'Günlük İcmal Raporu' : 'Günlük Servis Listesi',
        UTI: 'com.adobe.pdf',
    });
}
