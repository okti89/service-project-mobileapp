import React, { useCallback, useEffect, useState, useRef } from 'react';
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    Modal,
    SafeAreaView,
    Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import dayjs from 'dayjs';
import 'dayjs/locale/tr';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/api/axios';
import ENDPOINTS from '@/api/endpoints';
import WrapperContainer, { NO_BOTTOM_EDGES } from '@/components/WrapperContainer';
import Header from '@/components/Header';
import StatusPickerSheet from '@/components/home/StatusPickerSheet';
import TechnicianPickerSheet from '@/components/TechnicianPickerSheet';
import AppBottomSheet from '@/components/AppBottomSheet';
import ServiceOperationSheet from '@/components/services/ServiceOperationSheet';
import ServicePaymentSheet from '@/components/services/ServicePaymentSheet';
import { fs, sp } from '@/theme/scale';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/typography';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Share from 'react-native-share';
import SignatureScreen from 'react-native-signature-canvas';
import { getMapProvider } from '@/config/maps';
import serviceService from '@/services/serviceService';
import productService from '@/services/productService';

dayjs.locale('tr');

const WARRANTY_MONTH_OPTIONS = [6, 12, 24, 36];

const FALLBACK_SERVICE_STATUS_OPTIONS = [
    { key: 'new', label: 'Yeni', color: '#4F7CFF' },
    { key: 'assigned', label: 'Atandı', color: '#F59E0B' },
    { key: 'in_progress', label: 'Devam Ediyor', color: '#2563EB' },
    { key: 'postponed', label: 'Ertelendi', color: '#F97316' },
    { key: 'completed', label: 'Tamamlandı', color: '#16A34A' },
    { key: 'cancelled', label: 'İptal Edildi', color: '#EF4444' },
];

const TABS = [
    { key: 'genel', label: 'Genel' },
    { key: 'islemler', label: 'İşlemler' },
    { key: 'odeme', label: 'Ödeme' },
    { key: 'imza', label: 'İmza' },
    { key: 'zaman', label: 'Zaman' },
];

const formatCurrency = (val) => {
    const n = parseFloat(val) || 0;
    return `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── Ana bileşen ───────────────────────────────────────────────────────────────

export default function ServiceDetail({ route, navigation }) {
    const { colors, isDark } = useTheme();
    const { showToast } = useToast();
    const { isAdmin } = useAuth();
    const serviceId = route?.params?.serviceId || null;

    const [service, setService] = useState(route?.params?.service || null);
    const [loading, setLoading] = useState(!service);
    const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);
    const [techniciansLoading, setTechniciansLoading] = useState(false);
    const [technicians, setTechnicians] = useState([]);
    const [statusOptions, setStatusOptions] = useState(FALLBACK_SERVICE_STATUS_OPTIONS);
    const [activeTab, setActiveTab] = useState('genel');
    const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
    const [paymentMethods, setPaymentMethods] = useState([]);
    const [operationTemplatesLoading, setOperationTemplatesLoading] = useState(false);
    const [operationTemplates, setOperationTemplates] = useState([]);
    const [showOperationSheet, setShowOperationSheet] = useState(false);
    const [showPaymentSheet, setShowPaymentSheet] = useState(false);
    const [editingOperation, setEditingOperation] = useState(null);
    const [editingPayment, setEditingPayment] = useState(null);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(false);

    const [showMapModal, setShowMapModal] = useState(false);
    const [mapCoords, setMapCoords] = useState(null);
    const [userCoords, setUserCoords] = useState(null);
    const [routePoints, setRoutePoints] = useState([]);
    const [routeDistance, setRouteDistance] = useState('');
    const [routeDuration, setRouteDuration] = useState('');
    const [geocoding, setGeocoding] = useState(false);
    const [showDocumentSheet, setShowDocumentSheet] = useState(false);
    const [selectedWarrantyMonths, setSelectedWarrantyMonths] = useState(24);

    const statusSheetRef = useRef(null);
    const technicianSheetRef = useRef(null);
    const mapRef = useRef(null);

    const fetchService = useCallback(async () => {
        if (!serviceId) return;
        setLoading(true);
        try {
            const endpoint = isAdmin
                ? ENDPOINTS.SERVICES.ADMIN_DETAIL(serviceId)
                : ENDPOINTS.SERVICES.TECHNICIAN_DETAIL(serviceId);
            const res = await api.get(endpoint);
            setService(res.data);
        } catch (err) {
            showToast('error', 'Hata', 'Servis detayları alınamadı.');
        } finally {
            setLoading(false);
        }
    }, [serviceId, isAdmin]);

    const fetchServiceStatuses = useCallback(async () => {
        try {
            const response = await api.get(ENDPOINTS.SERVICES.STATUS_LIST);
            const data = response?.data || [];
            const normalized = data
                .filter((item) => item?.code && item?.is_active !== false)
                .map((item) => ({
                    key: String(item.code).trim().toLowerCase(),
                    label: item.name || item.code,
                    color: item.color || colors.primary,
                }));
            setStatusOptions(normalized.length > 0 ? normalized : FALLBACK_SERVICE_STATUS_OPTIONS);
        } catch {
            setStatusOptions(FALLBACK_SERVICE_STATUS_OPTIONS);
        }
    }, [colors.primary]);

    const fetchTechnicians = useCallback(async () => {
        try {
            setTechniciansLoading(true);
            const response = await api.get(ENDPOINTS.TECHNICIAN.LIST, { params: { include_inactive: 'false' } });
            setTechnicians(Array.isArray(response?.data) ? response.data : []);
        } catch {
            showToast('error', 'Hata', 'Teknisyen listesi yüklenemedi.');
        } finally {
            setTechniciansLoading(false);
        }
    }, []);

    const loadReferenceData = useCallback(async () => {
        try {
            setPaymentMethodsLoading(true);
            setOperationTemplatesLoading(true);
            setProductsLoading(true);
            const [methods, templates, productList] = await Promise.all([
                serviceService.getPaymentMethods(),
                serviceService.getServiceOperationTemplates(),
                productService.getProducts().catch(() => []),
            ]);
            setPaymentMethods(Array.isArray(methods) ? methods : []);
            setOperationTemplates(Array.isArray(templates) ? templates : []);
            setProducts(Array.isArray(productList) ? productList : []);
        } catch (error) {
            showToast('warning', 'Eksik Veri', 'Ödeme yöntemleri, işlem şablonları veya envanter ürünleri yüklenemedi.');
        } finally {
            setPaymentMethodsLoading(false);
            setOperationTemplatesLoading(false);
            setProductsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        fetchService();
        fetchServiceStatuses();
        loadReferenceData();
        if (isAdmin) fetchTechnicians();
    }, [fetchService, fetchServiceStatuses, fetchTechnicians, isAdmin, loadReferenceData]);

    useEffect(() => {
        const focus = route?.params?.focus;
        if (!loading && service) {
            if (focus === 'status') setTimeout(() => statusSheetRef.current?.present(), 300);
            else if (focus === 'technician') setTimeout(() => technicianSheetRef.current?.present(), 300);
        }
    }, [route?.params?.focus, loading, service]);

    const handleStatusSelect = useCallback(async (statusOption) => {
        if (!service?.id || !statusOption?.key) return;
        const currentStatus = String(service?.service_status || '').trim().toLowerCase();
        if (currentStatus === statusOption.key) { statusSheetRef.current?.dismiss(); return; }
        try {
            setStatusUpdateLoading(true);
            const res = await api.patch(ENDPOINTS.SERVICES.ADMIN_DETAIL(service.id), { service_status: statusOption.key });
            setService(res.data);
            showToast('success', 'Başarılı', 'Servis durumu güncellendi.');
            statusSheetRef.current?.dismiss();
        } catch (err) {
            showToast('error', 'Hata', err?.response?.data?.detail || 'Servis durumu güncellenemedi.');
        } finally {
            setStatusUpdateLoading(false);
        }
    }, [service]);

    const handleTechnicianSelect = useCallback(async (technician) => {
        if (!service?.id) return;
        const nextId = technician?.id || null;
        if (service?.technician === nextId) { technicianSheetRef.current?.dismiss(); return; }
        try {
            const res = await api.patch(ENDPOINTS.SERVICES.ADMIN_DETAIL(service.id), { technician: nextId });
            setService(res.data);
            showToast('success', 'Başarılı', 'Servis teknisyeni güncellendi.');
            technicianSheetRef.current?.dismiss();
        } catch (err) {
            showToast('error', 'Hata', err?.response?.data?.detail || 'Teknisyen atanamadı.');
        }
    }, [service]);

    const handleCall = () => {
        if (!service?.customer_phone) return;
        Linking.openURL(`tel:${service.customer_phone}`).catch(() => showToast('error', 'Hata', 'Arama başlatılamadı.'));
    };

    const handleWhatsApp = () => {
        if (!service?.customer_phone) return;
        const clean = service.customer_phone.replace(/\D/g, '');
        Linking.openURL(`https://wa.me/${clean}`).catch(() => showToast('error', 'Hata', 'WhatsApp açılamadı.'));
    };

    const normalizeWhatsAppPhone = useCallback((phone) => {
        let digits = String(phone || '').replace(/[^0-9]/g, '');
        if (digits.startsWith('00')) digits = digits.slice(2);
        else if (digits.startsWith('0')) digits = '90' + digits.slice(1);
        if (digits.length === 10 && digits.startsWith('5')) digits = '90' + digits;
        return digits;
    }, []);

    const ensureWhatsAppReady = useCallback(async () => {
        if (Platform.OS !== 'android') return true;
        const { isInstalled } = await Share.isPackageInstalled('com.whatsapp');
        if (!isInstalled) {
            showToast('error', 'Hata', 'WhatsApp yüklü değil.');
            return false;
        }
        return true;
    }, [showToast]);

    const sharePdfToWhatsApp = useCallback(async ({ fileUri, filename, phone, message }) => {
        const fileBase64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        await Share.shareSingle({
            social: Share.Social.WHATSAPP,
            whatsAppNumber: phone,
            url: `data:application/pdf;base64,${fileBase64}`,
            type: 'application/pdf',
            filename,
            useInternalStorage: true,
            message,
        });
    }, []);

    const shareLocalPdf = useCallback(async ({ fileUri, filename, message }) => {
        await Share.open({
            url: fileUri,
            type: 'application/pdf',
            filename,
            useInternalStorage: true,
            failOnCancel: false,
            message,
        });
    }, []);

    const openLocalPdf = useCallback(async ({ fileUri, dialogTitle }) => {
        if (Platform.OS === 'android') {
            const contentUri = await FileSystem.getContentUriAsync(fileUri);
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri,
                flags: 1,
                type: 'application/pdf',
            });
            return;
        }

        await Sharing.shareAsync(fileUri, {
            mimeType: 'application/pdf',
            dialogTitle,
            UTI: 'com.adobe.pdf',
        });
    }, []);

    const printLocalPdf = useCallback(async ({ fileUri }) => {
        await Print.printAsync({ uri: fileUri });
    }, []);

    const downloadServiceFormPdfFile = useCallback(async () => {
        return serviceService.downloadServiceFormPdf(service, { disposition: 'attachment' });
    }, [service]);

    const downloadWarrantyPdfFile = useCallback(async () => {
        return serviceService.downloadWarrantyCertificatePdf(service, selectedWarrantyMonths, { disposition: 'attachment' });
    }, [service, selectedWarrantyMonths]);

    const decodePolyline = (encoded) => {
        if (!encoded) return [];
        let index = 0;
        let lat = 0;
        let lng = 0;
        const coordinates = [];
        while (index < encoded.length) {
            let b;
            let shift = 0;
            let result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lat += dlat;
            shift = 0;
            result = 0;
            do {
                b = encoded.charCodeAt(index++) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
            lng += dlng;
            coordinates.push({
                latitude: lat / 1e5,
                longitude: lng / 1e5,
            });
        }
        return coordinates;
    };

    const handleMap = async () => {
        if (!service?.customer_address) return;
        const addr = service.customer_address;

        setGeocoding(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                showToast('error', 'İzin', 'Konum izni verilmedi. Rota gösterilemiyor.');
                setGeocoding(false);
                return;
            }

            const results = await Location.geocodeAsync(addr);
            if (results && results.length > 0) {
                const target = results[0];
                const targetCoords = {
                    latitude: target.latitude,
                    longitude: target.longitude,
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                };
                setMapCoords(targetCoords);

                // Haritayı hemen aç (10 saniye beklememek için)
                setShowMapModal(true);

                // Konum alma ve yön tarifi isteğini arka planda yap
                (async () => {
                    try {
                        // Öncelikle hızlıca son bilinen konumu almayı dene
                        let currentPos = await Location.getLastKnownPositionAsync();

                        // Son bilinen konum yoksa veya güncel değilse balanced doğrulukta almayı dene
                        if (!currentPos) {
                            currentPos = await Promise.race([
                                Location.getCurrentPositionAsync({
                                    accuracy: Location.Accuracy.Balanced,
                                }),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                            ]);
                        }

                        if (currentPos?.coords) {
                            const currentVal = {
                                latitude: currentPos.coords.latitude,
                                longitude: currentPos.coords.longitude
                            };
                            setUserCoords(currentVal);

                            const origin = `${currentVal.latitude},${currentVal.longitude}`;
                            const dest = `${target.latitude},${target.longitude}`;

                            const response = await api.get('/maps/directions/', {
                                params: { origin, dest },
                            });

                            const route = response?.data?.routes?.[0];
                            if (route) {
                                if (route.overview_polyline?.points) {
                                    setRoutePoints(decodePolyline(route.overview_polyline.points));
                                } else if (Array.isArray(route.geometry?.coordinates)) {
                                    setRoutePoints(route.geometry.coordinates.map(([lon, lat]) => ({
                                        latitude: lat,
                                        longitude: lon,
                                    })));
                                }

                                const leg = route.legs?.[0];
                                if (leg) {
                                    setRouteDistance(leg.distance?.text || '');
                                    setRouteDuration(leg.duration?.text || '');
                                }

                                // Haritayı tüm rotayı görecek şekilde sığdır
                                setTimeout(() => {
                                    if (mapRef.current && currentVal && target) {
                                        mapRef.current.fitToCoordinates(
                                            [
                                                { latitude: currentVal.latitude, longitude: currentVal.longitude },
                                                { latitude: target.latitude, longitude: target.longitude }
                                            ],
                                            {
                                                edgePadding: { top: 80, right: 80, bottom: 80, left: 80 },
                                                animated: true,
                                            }
                                        );
                                    }
                                }, 600);
                            }
                        }
                    } catch (posErr) {
                        console.log('Arka planda konum/yol tarifi alınamadı:', posErr);
                    }
                })();
            } else {
                showToast('error', 'Hata', 'Adres koordinatları bulunamadı.');
            }
        } catch (err) {
            showToast('error', 'Hata', 'Konum sorgulanırken bir sorun oluştu.');
        } finally {
            setGeocoding(false);
        }
    };

    const handleExternalNavigation = () => {
        if (!mapCoords) return;
        const { latitude, longitude } = mapCoords;
        const label = service?.customer_full_name || 'Müşteri';
        const url = Platform.select({
            ios: `maps:0,0?q=${latitude},${longitude}(${encodeURIComponent(label)})`,
            android: `geo:0,0?q=${latitude},${longitude}(${encodeURIComponent(label)})`,
            default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
        });
        Linking.openURL(url).catch(() => {
            Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
        });
    };

    const handlePdf = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        const phone = normalizeWhatsAppPhone(service?.customer_phone);
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'M\u00fc\u015fteri telefon numaras\u0131 bulunamad\u0131.');
            return;
        }

        try {
            const isReady = await ensureWhatsAppReady();
            if (!isReady) return;

            showToast('info', 'PDF', 'Servis formu WhatsApp i\u00e7in haz\u0131rlan\u0131yor...');
            const { uri, filename } = await downloadServiceFormPdfFile();
            await sharePdfToWhatsApp({
                fileUri: uri,
                filename,
                phone,
                message: (service?.customer_full_name ? `${service.customer_full_name} ` : '') + 'i\u00e7in servis formu ekte yer almaktad\u0131r.',
            });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Service form WhatsApp share error:', err);
                showToast('error', 'Hata', 'Servis formu WhatsApp ile g\u00f6nderilemedi.');
            }
        }
    }, [service, isAdmin, normalizeWhatsAppPhone, showToast, ensureWhatsAppReady, sharePdfToWhatsApp, downloadServiceFormPdfFile]);

    const handleServiceFormShare = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        try {
            setShowDocumentSheet(false);
            showToast('info', 'Servis Formu', 'Servis formu haz\u0131rlan\u0131yor...');
            const { uri, filename } = await downloadServiceFormPdfFile();
            await shareLocalPdf({
                fileUri: uri,
                filename,
                message: 'Servis formu ekte yer almaktad\u0131r.',
            });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Service form share error:', err);
                showToast('error', 'Hata', 'Servis formu payla\u015f\u0131lamad\u0131.');
            }
        }
    }, [service, isAdmin, showToast, shareLocalPdf, downloadServiceFormPdfFile]);

    const handleServiceFormShow = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        try {
            setShowDocumentSheet(false);
            showToast('info', 'Servis Formu', 'Servis formu a\u00e7\u0131l\u0131yor...');
            const { uri } = await downloadServiceFormPdfFile();
            await openLocalPdf({
                fileUri: uri,
                dialogTitle: 'Servis formu PDF',
            });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Service form open error:', err);
                showToast('error', 'Hata', 'Servis formu a\u00e7\u0131lamad\u0131.');
            }
        }
    }, [service, isAdmin, showToast, openLocalPdf, downloadServiceFormPdfFile]);

    const handleServiceFormPrint = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        try {
            setShowDocumentSheet(false);
            showToast('info', 'Servis Formu', 'Servis formu yazd\u0131rmaya haz\u0131rlan\u0131yor...');
            const { uri } = await downloadServiceFormPdfFile();
            await printLocalPdf({ fileUri: uri });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Service form print error:', err);
                showToast('error', 'Hata', 'Servis formu yazd\u0131r\u0131lamad\u0131.');
            }
        }
    }, [service, isAdmin, showToast, printLocalPdf, downloadServiceFormPdfFile]);

    const handleWarrantyPdfWhatsApp = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        const phone = normalizeWhatsAppPhone(service?.customer_phone);
        if (!phone) {
            showToast('warning', 'Telefon Eksik', 'M\u00fc\u015fteri telefon numaras\u0131 bulunamad\u0131.');
            return;
        }

        try {
            const isReady = await ensureWhatsAppReady();
            if (!isReady) return;

            setShowDocumentSheet(false);
            showToast('info', 'Garanti', 'Garanti belgesi WhatsApp i\u00e7in haz\u0131rlan\u0131yor...');
            const { uri, filename } = await downloadWarrantyPdfFile();
            await sharePdfToWhatsApp({
                fileUri: uri,
                filename,
                phone,
                message: (service?.customer_full_name || '') + (service?.customer_full_name ? ' ' : '') + 'i\u00e7in garanti belgesi ekte yer almaktad\u0131r.',
            });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Warranty certificate WhatsApp share error:', err);
                showToast('error', 'Hata', 'Garanti belgesi WhatsApp ile g\u00f6nderilemedi.');
            }
        }
    }, [service, isAdmin, normalizeWhatsAppPhone, showToast, ensureWhatsAppReady, sharePdfToWhatsApp, downloadWarrantyPdfFile]);

    const handleWarrantyPdfShare = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        try {
            setShowDocumentSheet(false);
            showToast('info', 'Garanti', 'Garanti belgesi haz\u0131rlan\u0131yor...');
            const { uri, filename } = await downloadWarrantyPdfFile();
            await shareLocalPdf({
                fileUri: uri,
                filename,
                message: 'Garanti belgesi ekte yer almaktad\u0131r.',
            });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Warranty certificate share error:', err);
                showToast('error', 'Hata', 'Garanti belgesi payla\u015f\u0131lamad\u0131.');
            }
        }
    }, [service, isAdmin, showToast, shareLocalPdf, downloadWarrantyPdfFile]);

    const handleWarrantyPdfShow = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        try {
            setShowDocumentSheet(false);
            showToast('info', 'Garanti', 'Garanti belgesi a\u00e7\u0131l\u0131yor...');
            const { uri } = await downloadWarrantyPdfFile();
            await openLocalPdf({
                fileUri: uri,
                dialogTitle: 'Garanti belgesi PDF',
            });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Warranty certificate open error:', err);
                showToast('error', 'Hata', 'Garanti belgesi a\u00e7\u0131lamad\u0131.');
            }
        }
    }, [service, isAdmin, showToast, openLocalPdf, downloadWarrantyPdfFile]);

    const handleWarrantyPdfPrint = useCallback(async () => {
        if (!service?.id || !isAdmin) return;

        try {
            setShowDocumentSheet(false);
            showToast('info', 'Garanti', 'Garanti belgesi yazd\u0131rmaya haz\u0131rlan\u0131yor...');
            const { uri } = await downloadWarrantyPdfFile();
            await printLocalPdf({ fileUri: uri });
        } catch (err) {
            if (err?.message && !String(err.message).toLowerCase().includes('cancel')) {
                console.log('Warranty certificate print error:', err);
                showToast('error', 'Hata', 'Garanti belgesi yazd\u0131r\u0131lamad\u0131.');
            }
        }
    }, [service, isAdmin, showToast, printLocalPdf, downloadWarrantyPdfFile]);

    const handleOperationSubmit = useCallback(async (payload, operation) => {
        if (operation?.id) {
            await serviceService.updateServiceOperation(operation.id, payload);
            showToast('success', 'İşlem', 'İşlem güncellendi.');
        } else {
            await serviceService.createServiceOperation(payload);
            showToast('success', 'İşlem', 'İşlem eklendi.');
        }
        setEditingOperation(null);
        await fetchService();
    }, [fetchService, showToast]);

    const handleOperationDelete = useCallback(async (operation) => {
        if (!operation?.id) return;
        await serviceService.deleteServiceOperation(operation.id);
        showToast('success', 'İşlem', 'İşlem silindi.');
        setEditingOperation(null);
        await fetchService();
    }, [fetchService, showToast]);

    const handleSaveOperationTemplate = useCallback(async (payload) => {
        const created = await serviceService.createServiceOperationTemplate(payload);
        setOperationTemplates((prev) => {
            const list = Array.isArray(prev) ? prev : [];
            if (list.some((item) => item?.id === created?.id)) return list;
            return [created, ...list];
        });
    }, []);

    const handlePaymentSubmit = useCallback(async (payload, payment) => {
        if (payment?.id) {
            await serviceService.updateServicePayment(payment.id, payload);
            showToast('success', 'Ödeme', 'Ödeme güncellendi.');
        } else {
            await serviceService.createServicePayment(payload);
            showToast('success', 'Ödeme', 'Ödeme eklendi.');
        }
        setEditingPayment(null);
        await fetchService();
    }, [fetchService, showToast]);

    const handlePaymentDelete = useCallback(async (payment) => {
        if (!payment?.id) return;
        await serviceService.deleteServicePayment(payment.id);
        showToast('success', 'Ödeme', 'Ödeme silindi.');
        setEditingPayment(null);
        await fetchService();
    }, [fetchService, showToast]);

    const handleCollectRemainingPayment = useCallback(async () => {
        const remainingBalance = Number(service?.remaining_balance ?? 0);
        if (!service?.id) return;
        if (remainingBalance <= 0) {
            showToast('info', 'Ödeme', 'Kalan bakiye bulunmuyor.');
            return;
        }
        const defaultMethod = paymentMethods.find((item) => item?.is_default) || paymentMethods[0];
        if (!defaultMethod?.id) {
            showToast('warning', 'Ödeme', 'Kayıtlı ödeme yöntemi bulunamadı.');
            return;
        }
        await serviceService.createServicePayment({
            service: service.id,
            amount: remainingBalance,
            payment_method: defaultMethod.id,
            note: '\u0048\u0131zl\u0131 tahsilat',
        });
        showToast('success', 'Ödeme', 'Kalan tutarın tamamı tahsil edildi.');
        await fetchService();
    }, [fetchService, paymentMethods, service, showToast]);

    const openCreateOperationSheet = useCallback(() => {
        setEditingOperation(null);
        setShowOperationSheet(true);
    }, []);

    const openEditOperationSheet = useCallback((operation) => {
        setEditingOperation(operation);
        setShowOperationSheet(true);
    }, []);

    const openCreatePaymentSheet = useCallback(() => {
        setEditingPayment(null);
        setShowPaymentSheet(true);
    }, []);

    const openEditPaymentSheet = useCallback((payment) => {
        setEditingPayment(payment);
        setShowPaymentSheet(true);
    }, []);

    // ── Yüklenme / Hata durumları ──────────────────────────────────────────────

    if (loading) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Yükleniyor...</Text>
                </View>
            </WrapperContainer>
        );
    }

    if (!service) {
        return (
            <WrapperContainer edges={NO_BOTTOM_EDGES}>
                <Header title="Servis Detayı" showBack />
                <View style={[styles.center, { backgroundColor: colors.background }]}>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Servis bulunamadı.</Text>
                </View>
            </WrapperContainer>
        );
    }

    const badge = statusOptions.find(o => o.key === String(service.service_status || '').trim().toLowerCase())
        || FALLBACK_SERVICE_STATUS_OPTIONS.find(o => o.key === service.service_status)
        || { label: 'Planlandı', color: '#4B5563' };

    const deviceDesc = [service.device_type_name, service.device_brand_name, service.device_model_name].filter(Boolean).join(' • ');
    const items = Array.isArray(service.items) ? service.items : [];
    const payments = Array.isArray(service.payments) ? service.payments : [];
    const timeline = Array.isArray(service.timeline) ? service.timeline : [];
    const bg = isDark ? colors.background : '#F8FAFC';

    return (
        <WrapperContainer edges={NO_BOTTOM_EDGES}>
            <View style={{ flex: 1, backgroundColor: bg, paddingBottom: 25 }}>
                <Header
                    title="Servis Detayı"
                    showBack
                    rightActions={isAdmin ? [
                        {
                            icon: 'pencil',
                            onPress: () => navigation.navigate('CreateService', {
                                service,
                                onSuccess: fetchService
                            }),
                            accessibilityLabel: 'Düzenle'
                        }
                    ] : undefined}
                />

                <ScrollView contentContainerStyle={[styles.container, { paddingBottom: 32 }]} showsVerticalScrollIndicator={false}>

                    {/* ── Hero Kart ── */}
                    <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {/* Avatar + isim + cihaz */}
                        <View style={styles.heroTop}>
                            <View style={[styles.heroAvatar, { backgroundColor: badge.color + '18' }]}>
                                <MaterialCommunityIcons name="account-outline" size={22} color={badge.color} />
                            </View>
                            <View style={styles.heroInfo}>
                                <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
                                    {service.customer_full_name || 'Müşteri'}
                                </Text>
                                {deviceDesc ? (
                                    <Text style={[styles.heroDevice, { color: colors.textSecondary }]} numberOfLines={1}>{deviceDesc}</Text>
                                ) : null}
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: badge.color + '18' }]}>
                                <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                                <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
                            </View>
                        </View>

                        {/* Tarih + Adres */}
                        {service.scheduled_date ? (
                            <View style={styles.heroMeta}>
                                <MaterialCommunityIcons name="calendar-outline" size={13} color={colors.textSecondary} />
                                <Text style={[styles.heroMetaText, { color: colors.textSecondary }]}>
                                    {dayjs(service.scheduled_date).format('DD MMMM YYYY · HH:mm')}
                                </Text>
                            </View>
                        ) : null}
                        {service.customer_address ? (
                            <View style={styles.heroMeta}>
                                <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.textSecondary} />
                                <Text style={[styles.heroMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {service.customer_address}
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* ── Hızlı Aksiyonlar ── */}
                    <View style={styles.actionRow}>
                        <ActionBtn icon="whatsapp" color="#25D366" label="WhatsApp" onPress={handleWhatsApp} colors={colors} />
                        <ActionBtn icon="phone-outline" color="#3B82F6" label="Ara" onPress={handleCall} colors={colors} />
                        <ActionBtn icon="navigation-variant-outline" color="#8B5CF6" label="Harita" onPress={handleMap} colors={colors} />
                        <ActionBtn icon="wrench-outline" color="#2563EB" label={'\u0130\u015flem'} onPress={openCreateOperationSheet} colors={colors} />
                        <ActionBtn icon="cash-plus" color="#16A34A" label={'\u00d6deme'} onPress={openCreatePaymentSheet} colors={colors} />
                        {isAdmin && (
                            <>
                                <ActionBtn icon="file-pdf-box" color="#EF4444" label="PDF" onPress={handlePdf} colors={colors} />
                                <ActionBtn icon="shield-check-outline" color="#F59E0B" label="Belge" onPress={() => setShowDocumentSheet(true)} colors={colors} />
                            </>
                        )}
                        <ActionBtn icon="circle-edit-outline" color="#0EA5E9" label="Durum" onPress={() => statusSheetRef.current?.present()} colors={colors} />
                    </View>

                    {/* ── Tab Bar ── */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll} style={[styles.tabBar, { borderBottomColor: colors.border }]}>
                        {TABS.map(tab => (
                            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tabItem}>
                                <Text style={[styles.tabLabel, {
                                    color: activeTab === tab.key ? '#2563EB' : colors.textSecondary,
                                    fontWeight: activeTab === tab.key ? '800' : '500',
                                }]}>{tab.label}</Text>
                                {activeTab === tab.key && <View style={styles.tabUnderline} />}
                            </Pressable>
                        ))}
                    </ScrollView>

                    {/* ── Tab İçerikleri ── */}
                    <View style={styles.tabContent}>
                        {activeTab === 'genel' && <GenelTab service={service} items={items} colors={colors} isDark={isDark} onCall={handleCall} onMap={handleMap} />}
                        {activeTab === 'islemler' && <IslemlerTab items={items} colors={colors} isDark={isDark} onAdd={openCreateOperationSheet} onEdit={openEditOperationSheet} />}
                        {activeTab === 'odeme' && <OdemeTab service={service} payments={payments} colors={colors} isDark={isDark} onAdd={openCreatePaymentSheet} onEdit={openEditPaymentSheet} onCollectRemaining={handleCollectRemainingPayment} />}
                        {activeTab === 'imza' && <ImzaTab service={service} fetchService={fetchService} signatureData={service?.signatures?.[0]} colors={colors} isDark={isDark} />}
                        {activeTab === 'zaman' && <ZamanTab timeline={timeline} colors={colors} isDark={isDark} />}
                    </View>

                </ScrollView>
            </View>

            <ServiceOperationSheet
                visible={showOperationSheet}
                onClose={() => { setShowOperationSheet(false); setEditingOperation(null); }}
                service={service}
                templates={operationTemplates}
                templatesLoading={operationTemplatesLoading}
                products={products}
                productsLoading={productsLoading}
                operation={editingOperation}
                onSubmit={handleOperationSubmit}
                onDelete={handleOperationDelete}
                onSaveTemplate={handleSaveOperationTemplate}
            />

            <ServicePaymentSheet
                visible={showPaymentSheet}
                onClose={() => { setShowPaymentSheet(false); setEditingPayment(null); }}
                service={service}
                paymentMethods={paymentMethods}
                paymentMethodsLoading={paymentMethodsLoading}
                payment={editingPayment}
                onSubmit={handlePaymentSubmit}
                onDelete={handlePaymentDelete}
            />

            <StatusPickerSheet
                ref={statusSheetRef}
                statuses={statusOptions}
                loading={statusUpdateLoading}
                selectedStatusKey={String(service?.service_status || '').trim().toLowerCase()}
                onSelect={handleStatusSelect}
            />

            <TechnicianPickerSheet
                ref={technicianSheetRef}
                technicians={technicians}
                loading={techniciansLoading}
                selectedTechnicianId={service?.technician}
                onSelect={handleTechnicianSelect}
            />

            <AppBottomSheet
                visible={showDocumentSheet}
                onClose={() => setShowDocumentSheet(false)}
                snapPoints={['78%']}
                wrapContent={false}
            >
                <BottomSheetScrollView
                    style={styles.documentSheetScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.documentSheetScrollContent}
                >
                    <View style={styles.documentSheet}>
                        <View style={styles.documentSheetHeader}>
                            <View style={styles.documentSheetHeaderText}>
                                <Text style={[styles.documentSheetTitle, { color: colors.text }]}>{'Belge İşlemleri'}</Text>
                                <Text style={[styles.documentSheetSubtitle, { color: colors.textSecondary }]}>{'Servis formu ve garanti belgesi işlemlerini buradan yönetebilirsiniz.'}</Text>
                            </View>
                            <Pressable
                                onPress={() => setShowDocumentSheet(false)}
                                style={({ pressed }) => [
                                    styles.documentCloseButton,
                                    { backgroundColor: colors.background, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                                ]}
                            >
                                <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                            </Pressable>
                        </View>

                        <Text style={[styles.documentSectionTitle, { color: colors.textSecondary }]}>{'Servis Formu'}</Text>

                        <Pressable
                            onPress={handlePdf}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#22C55E1A' }]}>
                                <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Servis formu gönder'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF olarak WhatsApp üzerinden müşteriye ilet.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={handleServiceFormPrint}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#F59E0B1A' }]}>
                                <MaterialCommunityIcons name="printer-outline" size={20} color="#D97706" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Servis formu yazdır'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF dosyasını yazdırma ekranında aç.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={handleServiceFormShow}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#2563EB1A' }]}>
                                <MaterialCommunityIcons name="eye-outline" size={20} color="#2563EB" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Servis formu göster'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF dosyasını cihazda görüntüle.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={handleServiceFormShare}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#7C3AED1A' }]}>
                                <MaterialCommunityIcons name="file-download-outline" size={20} color="#7C3AED" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Servis formu paylaş'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF dosyasını cihaz paylaşım seçenekleriyle gönder.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Text style={[styles.documentSectionTitle, { color: colors.textSecondary }]}>{'Garanti Belgesi'}</Text>

                        <View style={styles.warrantyMonthCard}>
                            <Text style={[styles.warrantyMonthTitle, { color: colors.text }]}>{'Garanti S\u00fcresi'}</Text>
                            <Text style={[styles.warrantyMonthSubtitle, { color: colors.textSecondary }]}>{'Belge olu\u015fturmadan \u00f6nce ay se\u00e7in.'}</Text>
                            <View style={styles.warrantyMonthRow}>
                                {WARRANTY_MONTH_OPTIONS.map((month) => {
                                    const selected = selectedWarrantyMonths === month;
                                    return (
                                        <Pressable
                                            key={month}
                                            onPress={() => setSelectedWarrantyMonths(month)}
                                            style={({ pressed }) => [
                                                styles.warrantyMonthChip,
                                                {
                                                    backgroundColor: selected ? '#2563EB' : colors.background,
                                                    borderColor: selected ? '#2563EB' : colors.border,
                                                    opacity: pressed ? 0.85 : 1,
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.warrantyMonthChipText,
                                                    { color: selected ? '#FFFFFF' : colors.text },
                                                ]}
                                            >
                                                {month}{' Ay'}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </View>

                        <Pressable
                            onPress={handleWarrantyPdfWhatsApp}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#22C55E1A' }]}>
                                <MaterialCommunityIcons name="whatsapp" size={20} color="#16A34A" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Garanti belgesi gönder'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF olarak WhatsApp üzerinden müşteriye ilet.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={handleWarrantyPdfPrint}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#F59E0B1A' }]}>
                                <MaterialCommunityIcons name="printer-outline" size={20} color="#D97706" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Garanti belgesi yazd\u0131r'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF dosyas\u0131n\u0131 yazd\u0131rma ekran\u0131nda a\u00e7.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={handleWarrantyPdfShow}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#2563EB1A' }]}>
                                <MaterialCommunityIcons name="eye-outline" size={20} color="#2563EB" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Garanti belgesi g\u00f6ster'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF dosyas\u0131n\u0131 cihazda g\u00f6r\u00fcnt\u00fcle.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>

                        <Pressable
                            onPress={handleWarrantyPdfShare}
                            style={({ pressed }) => [
                                styles.documentOption,
                                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                            ]}
                        >
                            <View style={[styles.documentOptionIcon, { backgroundColor: '#2563EB1A' }]}>
                                <MaterialCommunityIcons name="file-download-outline" size={20} color="#2563EB" />
                            </View>
                            <View style={styles.documentOptionBody}>
                                <Text style={[styles.documentOptionTitle, { color: colors.text }]}>{'Garanti belgesi PDF paylaş'}</Text>
                                <Text style={[styles.documentOptionText, { color: colors.textSecondary }]}>{'PDF dosyasını cihaz paylaşım seçenekleriyle gönder.'}</Text>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>
                </BottomSheetScrollView>
            </AppBottomSheet>

            <AppBottomSheet
                visible={showMapModal}
                onClose={() => {
                    setShowMapModal(false);
                    setRoutePoints([]);
                    setRouteDistance('');
                    setRouteDuration('');
                    setUserCoords(null);
                }}
                snapPoints={['90%']}
                wrapContent={false}
            >
                <View style={styles.mapModalContainer}>
                    <View style={styles.mapModalHeader}>
                        <View>
                            <Text style={[styles.mapModalTitle, { color: colors.text }]}>Yol Tarifi ve Rota</Text>
                            {(routeDistance || routeDuration) ? (
                                <Text style={[styles.mapModalSubtitle, { color: '#2563EB' }]}>
                                    Mesafe: {routeDistance} • Süre: {routeDuration}
                                </Text>
                            ) : null}
                        </View>
                        <Pressable onPress={() => setShowMapModal(false)} style={styles.mapModalCloseBtn}>
                            <MaterialCommunityIcons name="close" size={20} color={colors.textSecondary} />
                        </Pressable>
                    </View>

                    <View style={styles.mapWrap}>
                        {mapCoords && (
                            <MapView
                                ref={mapRef}
                                style={StyleSheet.absoluteFill}
                                provider={getMapProvider()}
                                initialRegion={mapCoords}
                            >
                                <Marker
                                    coordinate={{
                                        latitude: mapCoords.latitude,
                                        longitude: mapCoords.longitude
                                    }}
                                    title={service?.customer_full_name}
                                    description={service?.customer_address}
                                    pinColor="#EF4444"
                                />

                                {userCoords && (
                                    <Marker
                                        coordinate={userCoords}
                                        title="Konumunuz"
                                        pinColor="#3B82F6"
                                    />
                                )}

                                {routePoints.length >= 2 && (
                                    <Polyline
                                        coordinates={routePoints}
                                        strokeColor="#2563EB"
                                        strokeWidth={4}
                                    />
                                )}
                            </MapView>
                        )}
                    </View>

                    <View style={styles.mapModalFooter}>
                        <Text style={[styles.mapAddressText, { color: colors.textSecondary }]} numberOfLines={2}>
                            {service?.customer_address}
                        </Text>
                        <Pressable
                            onPress={handleExternalNavigation}
                            style={({ pressed }) => [
                                styles.mapNavBtn,
                                { backgroundColor: '#2563EB', opacity: pressed ? 0.9 : 1 }
                            ]}
                        >
                            <MaterialCommunityIcons name="navigation-variant-outline" size={18} color="#fff" />
                            <Text style={styles.mapNavBtnText}>Haritada Aç (Yol Tarifi)</Text>
                        </Pressable>
                    </View>
                </View>
            </AppBottomSheet>
        </WrapperContainer>
    );
}

// ─── Hızlı Aksiyon Butonu ──────────────────────────────────────────────────────

const ActionBtn = ({ icon, color, label, onPress, colors }) => (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionBtn, { backgroundColor: color + '14', opacity: pressed ? 0.7 : 1 }]}>
        <MaterialCommunityIcons name={icon} size={22} color={color} />
        <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
);

// ─── Satır Bileşeni ────────────────────────────────────────────────────────────

const InfoRow = ({ label, value, onPress, multiline, colors }) => {
    if (!value) return null;
    return (
        <Pressable disabled={!onPress} onPress={onPress} style={[styles.infoRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.infoValueWrap}>
                <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={multiline ? 4 : 1}>{value}</Text>
                {onPress ? <MaterialCommunityIcons name={label === 'Telefon' ? 'phone-outline' : 'map-marker-outline'} size={16} color={colors.textSecondary} /> : null}
            </View>
        </Pressable>
    );
};

// ─── Kart Sarıcı ──────────────────────────────────────────────────────────────

const Card = ({ title, icon, children, colors, isDark, rightAction }) => (
    <View style={[styles.card, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
        {title ? (
            <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
                <View style={styles.cardHeaderLeft}>
                    <MaterialCommunityIcons name={icon} size={15} color='#2563EB' />
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
                </View>
                {rightAction ? <View>{rightAction}</View> : null}
            </View>
        ) : null}
        <View style={styles.cardBody}>{children}</View>
    </View>
);

// ─── GENEL TAB ─────────────────────────────────────────────────────────────────

const GenelTab = ({ service, items, colors, isDark, onCall, onMap }) => {
    const totalPrice = parseFloat(service.total_price) || 0;
    const totalPaid = parseFloat(service.total_paid) || 0;
    const remaining = parseFloat(service.remaining_balance) || (totalPrice - totalPaid);
    const warrantyMonths = service.warranty_certificate ? 24 : null;

    return (
        <View style={styles.tabSection}>
            {/* Arıza Açıklaması */}
            {service.fault_description ? (
                <Card title="Arıza Açıklaması" icon="alert-circle-outline" colors={colors} isDark={isDark}>
                    <Text style={[styles.faultText, { color: colors.text }]}>{service.fault_description}</Text>
                </Card>
            ) : null}

            {/* Özet İstatistikler */}
            <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="tools" size={18} color="#2563EB" />
                    <Text style={[styles.statValue, { color: colors.text }]}>{items.length} adet</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Yapılan İşlem</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="calculator" size={18} color="#2563EB" />
                    <Text style={[styles.statValue, { color: colors.text }]}>
                        {formatCurrency(totalPrice)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Toplam Tutar</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
                    <MaterialCommunityIcons name="currency-try" size={18} color={remaining > 0 ? '#EF4444' : '#16A34A'} />
                    <Text style={[styles.statValue, { color: remaining > 0 ? '#EF4444' : colors.text }]}>
                        {formatCurrency(remaining)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Kalan Ödeme</Text>
                </View>
                {warrantyMonths ? (
                    <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#fff', borderColor: colors.border }]}>
                        <MaterialCommunityIcons name="shield-check-outline" size={18} color="#16A34A" />
                        <Text style={[styles.statValue, { color: colors.text }]}>{warrantyMonths} Ay</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Garanti</Text>
                    </View>
                ) : null}
            </View>

            {/* Müşteri Bilgileri */}
            <Card title="Müşteri Bilgileri" icon="account-outline" colors={colors} isDark={isDark}>
                <InfoRow label="Ad Soyad" value={service.customer_full_name} colors={colors} />
                <InfoRow label="Telefon" value={service.customer_phone} onPress={onCall} colors={colors} />
                <InfoRow label="Adres" value={service.customer_address} onPress={onMap} colors={colors} multiline />
            </Card>

            {/* Cihaz Bilgileri */}
            <Card title="Cihaz Bilgileri" icon="cellphone-link" colors={colors} isDark={isDark}>
                <InfoRow label="Tür" value={service.device_type_name} colors={colors} />
                <InfoRow label="Marka" value={service.device_brand_name} colors={colors} />
                <InfoRow label="Model" value={service.device_model_name} colors={colors} />
                {service.warranty_certificate ? (
                    <InfoRow label="Garanti" value="24 Ay" colors={colors} />
                ) : null}
            </Card>

            {/* Teknisyen Bilgisi */}
            {service.technician_name ? (
                <Card title="Atanan Teknisyen" icon="account-hard-hat-outline" colors={colors} isDark={isDark}>
                    <InfoRow label="Teknisyen" value={service.technician_name} colors={colors} />
                </Card>
            ) : null}
        </View>
    );
};

// ─── İŞLEMLER TAB ─────────────────────────────────────────────────────────────

const IslemlerTab = ({ items, colors, isDark, onAdd, onEdit }) => (
    <View style={styles.tabSection}>
        <Card
            title={'Yapılan İşlemler'}
            icon="tools"
            colors={colors}
            isDark={isDark}
            rightAction={
                <Pressable
                    onPress={onAdd}
                    style={({ pressed }) => [
                        styles.inlineHeaderAction,
                        { backgroundColor: '#2563EB14', borderColor: '#2563EB33', opacity: pressed ? 0.75 : 1 },
                    ]}
                >
                    <MaterialCommunityIcons name="plus" size={16} color="#2563EB" />
                    <Text style={styles.inlineHeaderActionText}>{'\u0130\u015flem Ekle'}</Text>
                </Pressable>
            }
        >
            {items.length === 0 ? (
                <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>{'Hen\u00fcz i\u015flem eklenmemi\u015f.'}</Text>
            ) : items.map((item, i) => (
                <View key={String(item.id || i)} style={[styles.itemRow, { borderBottomColor: colors.border }, i === items.length - 1 && { borderBottomWidth: 0 }]}>
                    <View style={styles.itemRowLeft}>
                        <View style={[styles.itemCheck, { backgroundColor: '#2563EB18' }]}>
                            <MaterialCommunityIcons name="check" size={13} color="#2563EB" />
                        </View>
                        <View style={styles.itemInfo}>
                            <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={1}>{item.name || item.operation_name || 'İşlem'}</Text>
                            <Text style={[styles.itemQty, { color: colors.textSecondary }]}>{(item.quantity || 1) + ' adet'}</Text>
                        </View>
                    </View>
                    <View style={styles.itemRowRight}>
                        <Text style={[styles.itemPrice, { color: colors.text }]}>{formatCurrency(item.total_price ?? item.price ?? 0)}</Text>
                        <Pressable onPress={() => onEdit?.(item)} style={({ pressed }) => [styles.rowIconButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                            <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textSecondary} />
                        </Pressable>
                    </View>
                </View>
            ))}
        </Card>
    </View>
);

const OdemeTab = ({ service, payments, colors, isDark, onAdd, onEdit, onCollectRemaining }) => {
    const totalPrice = parseFloat(service.total_price) || 0;
    const totalPaid = parseFloat(service.total_paid) || 0;
    const remaining = parseFloat(service.remaining_balance) || (totalPrice - totalPaid);

    return (
        <View style={styles.tabSection}>
            <Card
                title={'\u00d6deme \u00d6zeti'}
                icon="cash-multiple"
                colors={colors}
                isDark={isDark}
                rightAction={
                    <View style={styles.inlineHeaderActions}>
                        <Pressable
                            onPress={onCollectRemaining}
                            style={({ pressed }) => [
                                styles.inlineHeaderAction,
                                { backgroundColor: '#16A34A14', borderColor: '#16A34A33', opacity: pressed ? 0.75 : 1 },
                            ]}
                        >
                            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#16A34A" />
                            <Text style={[styles.inlineHeaderActionText, { color: '#15803D' }]}>{'Tamam\u0131n\u0131 Al'}</Text>
                        </Pressable>
                        <Pressable
                            onPress={onAdd}
                            style={({ pressed }) => [
                                styles.inlineHeaderAction,
                                { backgroundColor: '#2563EB14', borderColor: '#2563EB33', opacity: pressed ? 0.75 : 1 },
                            ]}
                        >
                            <MaterialCommunityIcons name="plus" size={16} color="#2563EB" />
                            <Text style={styles.inlineHeaderActionText}>{'\u00d6deme Ekle'}</Text>
                        </Pressable>
                    </View>
                }
            >
                <View style={styles.payRow}>
                    <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Toplam</Text>
                    <Text style={[styles.payValue, { color: colors.text }]}>{formatCurrency(totalPrice)}</Text>
                </View>
                <View style={styles.payRow}>
                    <Text style={[styles.payLabel, { color: colors.textSecondary }]}>{'\u00d6denen'}</Text>
                    <Text style={[styles.payValue, { color: '#16A34A' }]}>{formatCurrency(totalPaid)}</Text>
                </View>
                <View style={[styles.payRow, styles.payRowLast, { borderTopColor: colors.border }]}>
                    <Text style={[styles.payLabel, { color: colors.textSecondary }]}>Kalan</Text>
                    <Text style={[styles.payValue, { color: remaining > 0 ? '#EF4444' : '#16A34A', fontWeight: '800' }]}>{formatCurrency(remaining)}</Text>
                </View>
            </Card>

            <Card title={'\u00d6deme Ge\u00e7mi\u015fi'} icon="history" colors={colors} isDark={isDark}>
                {payments.length > 0 ? payments.map((p, i) => (
                    <View key={String(p.id || i)} style={[styles.payHistoryRow, { borderBottomColor: colors.border }, i === payments.length - 1 && { borderBottomWidth: 0 }]}>
                        <View style={styles.payHistoryInfo}>
                            <Text style={[styles.payLabel, { color: colors.text }]}>{p.payment_method_name || 'Ödeme'}</Text>
                            {p.created_at ? <Text style={[styles.payDate, { color: colors.textSecondary }]}>{dayjs(p.created_at).format('DD MMM YYYY')}</Text> : null}
                            {p.note ? <Text style={[styles.payNote, { color: colors.textSecondary }]} numberOfLines={2}>{p.note}</Text> : null}
                        </View>
                        <View style={styles.payHistoryActions}>
                            <Text style={[styles.payValue, { color: '#16A34A' }]}>{formatCurrency(p.amount)}</Text>
                            <Pressable onPress={() => onEdit?.(p)} style={({ pressed }) => [styles.rowIconButton, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
                                <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.textSecondary} />
                            </Pressable>
                        </View>
                    </View>
                )) : (
                    <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>{'Hen\u00fcz \u00f6deme eklenmemi\u015f.'}</Text>
                )}
            </Card>
        </View>
    );
};

const TIMELINE_COLORS = {
    created: '#2563EB',
    assigned: '#F59E0B',
    status_change: '#F59E0B',
    completed: '#16A34A',
    cancelled: '#EF4444',
    default: '#8B5CF6',
};

const ZamanTab = ({ timeline, colors, isDark }) => (
    <View style={styles.tabSection}>
        <Card title="Zaman Çizelgesi" icon="timeline-outline" colors={colors} isDark={isDark}>
            {timeline.length === 0 ? (
                <Text style={[styles.emptyTabText, { color: colors.textSecondary }]}>Henüz kayıt yok.</Text>
            ) : timeline.map((event, i) => {
                const dotColor = event.new_status_color || '#8B5CF6';
                const isCreation = !event.old_status || event.old_status === event.new_status || event.old_status === 'new';

                let title = `Durum "${event.new_status_name || event.new_status}" olarak güncellendi.`;
                if (i === timeline.length - 1 && isCreation) {
                    title = `Servis kaydı "${event.new_status_name || event.new_status}" durumu ile oluşturuldu.`;
                }

                return (
                    <View key={String(event.id || i)} style={styles.timelineRow}>
                        <View style={styles.timelineLine}>
                            <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                            {i < timeline.length - 1 && <View style={[styles.timelineConnector, { backgroundColor: colors.border }]} />}
                        </View>
                        <View style={styles.timelineContent}>
                            <Text style={[styles.timelineTitle, { color: colors.text }]} numberOfLines={2}>
                                {title}
                            </Text>
                            {event.timestamp ? (
                                <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>
                                    {dayjs(event.timestamp).format('DD MMMM YYYY · HH:mm')}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                );
            })}
        </Card>
    </View>
);

const ImzaTab = ({ service, signatureData, fetchService, colors, isDark }) => {
    const { showToast } = useToast();
    const [aktifImzalayan, setAktifImzalayan] = useState(null);
    const [acilmaSayaci, setAcilmaSayaci] = useState(0);
    const [modalHazir, setModalHazir] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const modalRef = useRef();

    const imzaWebStyle = `
      .m-signature-pad { box-shadow: none; border: none; }
      .m-signature-pad--body { border: none; }
      .m-signature-pad--footer { display: none; margin: 0; }
      body,html { background-color: #fff; }
    `;

    const teknisyenImza = signatureData?.technician_signature;
    const musteriImza = signatureData?.customer_signature;

    const modalAc = (kisi) => {
        setAcilmaSayaci((n) => n + 1);
        setModalHazir(false);
        setAktifImzalayan(kisi);
    };

    const modalKapat = () => {
        setAktifImzalayan(null);
        setModalHazir(false);
    };

    const handleImzaSonucu = async (base64) => {
        setIsSaving(true);
        try {
            const payload = {
                service: service.id,
            };
            if (aktifImzalayan === 'teknisyen') {
                payload.technician_signature_base64 = base64;
            } else if (aktifImzalayan === 'musteri') {
                payload.customer_signature_base64 = base64;
            }

            await serviceService.saveServiceSignature(payload);
            showToast('success', 'İmza', 'İmza başarıyla kaydedildi.');
            await fetchService();
            modalKapat();
        } catch (error) {
            showToast('error', 'Hata', 'İmza kaydedilirken bir hata oluştu.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <View style={styles.tabSection}>
            <Card title="İmzalar" icon="draw" colors={colors} isDark={isDark}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary, marginBottom: 8 }]}>Teknisyen İmzası</Text>
                <Pressable
                    style={[styles.imzaKutu, { borderColor: colors.border, backgroundColor: isDark ? colors.background : '#fafafa' }]}
                    onPress={() => modalAc("teknisyen")}
                >
                    {teknisyenImza ? (
                        <Image source={{ uri: teknisyenImza }} style={styles.imzaResim} />
                    ) : (
                        <Text style={[styles.imzaPlaceholder, { color: colors.textTertiary }]}>Dokunup imza atmak için tıklayın</Text>
                    )}
                </Pressable>

                <Text style={[styles.infoLabel, { color: colors.textSecondary, marginTop: 24, marginBottom: 8 }]}>Müşteri İmzası</Text>
                <Pressable
                    style={[styles.imzaKutu, { borderColor: colors.border, backgroundColor: isDark ? colors.background : '#fafafa' }]}
                    onPress={() => modalAc("musteri")}
                >
                    {musteriImza ? (
                        <Image source={{ uri: musteriImza }} style={styles.imzaResim} />
                    ) : (
                        <Text style={[styles.imzaPlaceholder, { color: colors.textTertiary }]}>Dokunup imza atmak için tıklayın</Text>
                    )}
                </Pressable>
            </Card>

            <Modal
                visible={aktifImzalayan !== null}
                animationType="slide"
                onShow={() => setModalHazir(true)}
                onRequestClose={modalKapat}
            >
                <SafeAreaView style={[styles.modalSafe, { backgroundColor: isDark ? colors.surface : '#fff' }]}>
                    <Text style={[styles.modalBaslik, { color: colors.text }]}>
                        {aktifImzalayan === "teknisyen" ? "Teknisyen İmzası" : "Müşteri İmzası"}
                    </Text>
                    <Text style={[styles.modalAciklama, { color: colors.textSecondary }]}>
                        Lütfen aşağıdaki alana parmağınızla imzanızı atın.
                    </Text>

                    <View style={[styles.modalCanvasKutu, { borderColor: colors.border }]}>
                        {modalHazir && (
                            <SignatureScreen
                                key={acilmaSayaci}
                                ref={modalRef}
                                onOK={handleImzaSonucu}
                                onEmpty={() => showToast('warning', 'Uyarı', 'İmza boş, tekrar deneyin.')}
                                webStyle={imzaWebStyle}
                                autoClear={false}
                                descriptionText=""
                                penColor="#000000"
                                backgroundColor="#ffffff"
                            />
                        )}
                    </View>

                    <View style={styles.modalButonSatiri}>
                        <Pressable style={[styles.imzaBtn, { backgroundColor: isDark ? colors.background : '#f1f1f1' }]} onPress={() => modalRef.current?.clearSignature()}>
                            <Text style={[styles.imzaBtnText, { color: colors.text }]}>Temizle</Text>
                        </Pressable>
                        <Pressable style={[styles.imzaBtn, { backgroundColor: isDark ? colors.background : '#f1f1f1' }]} onPress={modalKapat}>
                            <Text style={[styles.imzaBtnText, { color: colors.text }]}>Vazgeç</Text>
                        </Pressable>
                        <Pressable style={[styles.imzaBtn, { backgroundColor: '#2563eb', flex: 1.4 }]} onPress={() => modalRef.current?.readSignature()} disabled={isSaving}>
                            {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.imzaBtnText, { color: '#fff' }]}>Onayla</Text>}
                        </Pressable>
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
};

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: sp(12) },
    loadingText: { fontSize: fs(14), fontWeight: '500' },
    emptyText: { fontSize: fs(14), fontWeight: '500' },
    container: { paddingHorizontal: spacing.gutter, paddingTop: spacing.m, gap: spacing.m },

    // Hero kart
    heroCard: { borderRadius: sp(18), borderWidth: 1, padding: spacing.l, gap: sp(8) },
    heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.s },
    heroAvatar: { width: sp(42), height: sp(42), borderRadius: sp(14), alignItems: 'center', justifyContent: 'center' },
    heroInfo: { flex: 1 },
    heroName: { fontSize: fs(16), fontWeight: '800' },
    heroDevice: { fontSize: fs(12), fontWeight: '500', marginTop: sp(2) },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: sp(5), paddingHorizontal: sp(10), paddingVertical: sp(5), borderRadius: sp(999) },
    statusDot: { width: sp(6), height: sp(6), borderRadius: sp(3) },
    statusText: { fontSize: fs(10), fontWeight: '800' },
    heroMeta: { flexDirection: 'row', alignItems: 'center', gap: sp(6) },
    heroMetaText: { fontSize: fs(12), fontWeight: '500', flex: 1 },

    // Aksiyonlar
    actionRow: { flexDirection: 'row', gap: spacing.s, flexWrap: 'wrap' },
    actionBtn: { flex: 1, flexBasis: '18%', minWidth: sp(60), alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.m, borderRadius: sp(14), gap: sp(4) },
    actionLabel: { fontSize: fs(10), fontWeight: '700' },

    // Tab bar
    tabBar: { borderBottomWidth: 1 },
    tabScroll: { paddingHorizontal: spacing.gutter, gap: 0 },
    tabItem: { paddingHorizontal: spacing.s + 4, paddingBottom: spacing.s, alignItems: 'center', marginRight: spacing.xs },
    tabLabel: { fontSize: fs(13) },
    tabUnderline: { height: 2, width: '100%', backgroundColor: '#2563EB', borderRadius: 2, marginTop: sp(4) },
    tabContent: { marginTop: spacing.s },

    // Kart
    card: { borderRadius: sp(16), borderWidth: 1, overflow: 'hidden', marginBottom: spacing.m },
    cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sp(8), paddingHorizontal: spacing.l, paddingVertical: spacing.s + 4, borderBottomWidth: 1 },
    cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: sp(8), flex: 1 },
    cardTitle: { fontSize: fs(13), fontWeight: '800' },
    cardBody: { paddingHorizontal: spacing.l, paddingVertical: spacing.s },

    // Satır
    infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.s + 2, borderBottomWidth: StyleSheet.hairlineWidth },
    infoLabel: { fontSize: fs(12), fontWeight: '500', minWidth: sp(70) },
    infoValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: sp(6) },
    infoValue: { fontSize: fs(13), fontWeight: '700', textAlign: 'right', flex: 1 },

    // Özet istatistik kartları
    tabSection: { paddingBottom: sp(40) },
    statsRow: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
    statCard: { flex: 1, borderRadius: sp(14), borderWidth: 1, paddingVertical: spacing.m, alignItems: 'center', gap: sp(4) },
    statValue: { fontSize: fs(14), fontWeight: '800' },
    statLabel: { fontSize: fs(10), fontWeight: '600', textAlign: 'center' },

    faultText: { fontSize: fs(13), lineHeight: sp(20), fontWeight: '400' },

    // İşlem satırı
    itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.s + 2, borderBottomWidth: StyleSheet.hairlineWidth },
    itemRowLeft: { flexDirection: 'row', alignItems: 'center', gap: sp(10), flex: 1 },
    itemCheck: { width: sp(26), height: sp(26), borderRadius: sp(8), alignItems: 'center', justifyContent: 'center' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: fs(13), fontWeight: '700' },
    itemQty: { fontSize: fs(11), fontWeight: '500' },
    itemPrice: { fontSize: fs(13), fontWeight: '700', marginLeft: sp(8) },
    itemRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: spacing.s },
    rowIconButton: { width: sp(32), height: sp(32), borderRadius: sp(10), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    inlineHeaderActions: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
    inlineHeaderAction: { flexDirection: 'row', alignItems: 'center', gap: sp(4), borderWidth: 1, borderRadius: sp(999), paddingHorizontal: spacing.s, paddingVertical: sp(6) },
    inlineHeaderActionText: { color: '#2563EB', fontSize: fs(11), fontWeight: '800' },

    // Ödeme
    payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.s + 2 },
    payRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
    payRowLast: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.xs, paddingTop: spacing.s + 2 },
    payLabel: { fontSize: fs(13), fontWeight: '500' },
    payValue: { fontSize: fs(14), fontWeight: '700' },
    payDate: { fontSize: fs(11), fontWeight: '400', marginTop: sp(2) },
    payNote: { fontSize: fs(11), fontWeight: '500', marginTop: sp(3), lineHeight: sp(16) },
    payHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.s + 2, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.s },
    payHistoryInfo: { flex: 1 },
    payHistoryActions: { alignItems: 'flex-end', gap: spacing.xs },

    // Zaman çizelgesi
    timelineRow: { flexDirection: 'row', gap: spacing.s, paddingVertical: spacing.xs },
    timelineLine: { alignItems: 'center', width: sp(16) },
    timelineDot: { width: sp(10), height: sp(10), borderRadius: sp(5), marginTop: sp(3) },
    timelineConnector: { flex: 1, width: 2, marginTop: sp(4) },
    timelineContent: { flex: 1, paddingBottom: spacing.s },
    timelineTitle: { fontSize: fs(13), fontWeight: '600', lineHeight: sp(18) },
    timelineDate: { fontSize: fs(11), fontWeight: '400', marginTop: sp(3) },

    emptyTabText: { fontSize: fs(13), fontWeight: '500', paddingVertical: spacing.m, textAlign: 'center' },

    // Harita Modalı Stilleri
    mapModalContainer: { flex: 1, paddingHorizontal: spacing.gutter, paddingTop: spacing.s },
    mapModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m },
    mapModalTitle: { fontSize: 16, fontWeight: '800' },
    mapModalSubtitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
    mapModalCloseBtn: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    mapWrap: { flex: 1, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
    mapModalFooter: { paddingVertical: spacing.m, gap: spacing.s, paddingBottom: 100 },
    mapAddressText: { fontSize: fs(12), fontWeight: '500', lineHeight: sp(18), textAlign: 'center' },
    mapNavBtn: { minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.s },
    mapNavBtnText: { color: '#fff', fontSize: fs(14), fontWeight: '700' },

    documentSheetScroll: { flex: 1 },
    documentSheetScrollContent: { paddingHorizontal: spacing.s, paddingBottom: spacing.xl + spacing.l },
    documentSheet: { gap: spacing.s, paddingHorizontal: spacing.s, paddingBottom: spacing.m },
    documentSheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.s, marginBottom: spacing.s, paddingLeft: sp(4) },
    documentSheetHeaderText: { flex: 1, gap: spacing.xs },
    documentCloseButton: { width: sp(38), height: sp(38), borderRadius: sp(14), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    documentSheetTitle: { fontSize: fs(16), fontWeight: '800' },
    documentSheetSubtitle: { fontSize: fs(12), fontWeight: '500', lineHeight: sp(18) },
    documentSectionTitle: { fontSize: fs(11), fontWeight: '700', marginTop: spacing.s, marginBottom: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.4, paddingLeft: sp(4) },
    documentOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, borderWidth: 1, borderRadius: sp(16), paddingHorizontal: spacing.m, paddingVertical: spacing.m + 2 },
    documentOptionIcon: { width: sp(42), height: sp(42), borderRadius: sp(14), alignItems: 'center', justifyContent: 'center' },
    documentOptionBody: { flex: 1, gap: sp(2), paddingRight: spacing.xs },
    documentOptionTitle: { fontSize: fs(13), fontWeight: '700' },
    documentOptionText: { fontSize: fs(11), fontWeight: '500', lineHeight: sp(16) },
    warrantyMonthCard: { borderRadius: sp(16), paddingHorizontal: spacing.m, paddingVertical: spacing.m, backgroundColor: 'rgba(37,99,235,0.06)', gap: spacing.xs },
    warrantyMonthTitle: { fontSize: fs(13), fontWeight: '700' },
    warrantyMonthSubtitle: { fontSize: fs(11), fontWeight: '500', lineHeight: sp(16) },
    warrantyMonthRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
    warrantyMonthChip: { minWidth: sp(72), paddingHorizontal: spacing.m, paddingVertical: spacing.s, borderRadius: sp(999), borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    warrantyMonthChipText: { fontSize: fs(12), fontWeight: '700' },

    // İmza
    imzaKutu: { height: 140, borderWidth: 1, borderRadius: 12, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    imzaResim: { width: '100%', height: '100%', resizeMode: 'contain' },
    imzaPlaceholder: { fontSize: fs(13), fontWeight: '500' },
    modalSafe: { flex: 1, padding: spacing.m, paddingTop: spacing.xl },
    modalBaslik: { fontSize: fs(20), fontWeight: '800', marginBottom: sp(4) },
    modalAciklama: { fontSize: fs(14), fontWeight: '500', marginBottom: spacing.m },
    modalCanvasKutu: { height: 350, borderWidth: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff' },
    modalButonSatiri: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.m },
    imzaBtn: { flex: 1, paddingVertical: spacing.m, borderRadius: sp(12), alignItems: 'center', justifyContent: 'center' },
    imzaBtnText: { fontSize: fs(14), fontWeight: '700' },
});