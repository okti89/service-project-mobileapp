import React, { useState } from "react";
import {
    SafeAreaView,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    Image,
} from "react-native";
import Share from "react-native-share";

/**
 * HIZLI TEST İÇİN: Projenizin köküne (App.js ile aynı klasöre)
 * "test.pdf" adında bir dosya koyduysanız, bu fonksiyon o dosyayı
 * uygulamaya gömülü bir "asset" olarak çözüp base64 içeriğini
 * döndürür.
 *
 * ÖNKOŞUL: Aynı klasördeki metro.config.js dosyasını projenizin
 * köküne kopyalayın (pdf uzantısını assetExts'e ekler), yoksa
 * require("./test.pdf") hata verir. Bu önkoşul, expo-asset
 * kullanmasak da AYNEN geçerli — Image.resolveAssetSource de
 * Metro'nun asset registry'sine bağımlı.
 *
 * NOT: Android'de react-native-share'e ham "file://" yolu vermek
 * çoğu zaman WhatsApp'ın dosyayı okuyamamasına ve onun yerine
 * dosya yolunu düz metin olarak yapıştırmasına yol açıyor. Bunun
 * yerine base64 + useInternalStorage:true kombinasyonu kullanmak
 * güvenilir çözüm.
 */
async function testPdfOlustur() {
    // "./test.pdf" -> App.js ile AYNI klasördeki dosyayı işaret eder.
    // Dosyanız farklı bir klasördeyse (örn. assets/test.pdf) yolu
    // ona göre güncelleyin: require("./assets/test.pdf")
    const source = Image.resolveAssetSource(require("./test.pdf"));

    if (!source || !source.uri) {
        throw new Error(
            "test.pdf çözülemedi. Dosyanın App.js ile aynı klasörde olduğundan " +
            "ve metro.config.js'de pdf'in assetExts listesine eklendiğinden emin olun."
        );
    }

    // Dev modda source.uri, Metro packager'ın localhost adresine
    // (http://192.168.x.x:8081/assets/...) işaret eder. Release build'de
    // Android'de "asset:/..." , iOS'ta ise bundle içindeki dosya yoluna
    // işaret eder. fetch() her ikisini de native olarak destekler.
    const response = await fetch(source.uri);
    const blob = await response.blob();

    const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader(); // RN'nin kendi built-in FileReader'ı
        reader.onerror = () => reject(new Error("PDF okunamadı"));
        reader.onload = () => {
            // reader.result -> "data:application/pdf;base64,AAAA..." formatında
            const dataUrl = reader.result;
            resolve(dataUrl.split(",")[1]); // sadece base64 kısmını al
        };
        reader.readAsDataURL(blob);
    });

    return base64;
}

/**
 * ÖNEMLİ NOTLAR
 * -------------
 * 1) react-native-share, native (yerel) kod içerir. Expo Go'da
 *    ÇALIŞMAZ. Projenizi bir "development build" olarak derlemeniz
 *    gerekir:
 *      npx expo install react-native-share
 *      npx expo prebuild
 *      npx expo run:android   (veya)   eas build --profile development
 *
 *    Ayrıca test.pdf'i kullanabilmek için projenizin köküne
 *    metro.config.js dosyasını eklemeniz gerekiyor (ayrı dosya
 *    olarak verildi).
 *
 * 2) ANDROID: whatsAppNumber + dosya (url/type) birlikte verildiğinde
 *    WhatsApp doğrudan o numaranın sohbetini, PDF EKLİ şekilde açar.
 *    Kullanıcı sadece "Gönder" tuşuna basar. Bu senaryoda gerçekten
 *    "otomatik dolu" davranış elde edilir.
 *
 * 3) iOS: Aynı davranış GÜVENİLİR ÇALIŞMIYOR. WhatsApp'ın iOS
 *    paylaşım uzantısı, "belirli numara" ile "dosya eki"ni aynı anda
 *    desteklemiyor. Genelde ya genel paylaşım ekranı açılır ya da
 *    dosya yerine bir metin (dosya yolu) mesaj kutusuna düşer.
 *    iOS'ta tam otomasyon için resmi WhatsApp Business API (sunucu
 *    taraflı) gerekir; bu, uygulama içinden client-side yapılamaz.
 *
 * 4) Numara formatı: ülke koduyla birlikte, boşluksuz, "+" olmadan
 *    veya olarak da kabul edilebilir ama en güvenlisi sadece rakam:
 *    "905551112233" gibi (başında + olmadan, ülke kodu + numara).
 */

// Telefon numarasını WhatsApp'ın beklediği formata getirir:
// sadece rakamlar, ülke kodu dahil, başında + veya 0 olmadan.
function numarayiTemizle(girilenNumara, varsayilanUlkeKodu = "90") {
    let rakamlar = girilenNumara.replace(/[^0-9]/g, "");

    // Kullanıcı "0555..." yazdıysa baştaki 0'ı atıp ülke kodunu ekle
    if (rakamlar.startsWith("0")) {
        rakamlar = varsayilanUlkeKodu + rakamlar.slice(1);
    }
    // Kullanıcı ülke kodunu hiç yazmadıysa (örn. "555...") ekle
    if (!rakamlar.startsWith(varsayilanUlkeKodu) && rakamlar.length === 10) {
        rakamlar = varsayilanUlkeKodu + rakamlar;
    }
    return rakamlar;
}

export default function WhatsappPdfOrnegi() {
    const [numara, setNumara] = useState("");
    const [gonderiliyor, setGonderiliyor] = useState(false);

    // Gerçek projede bu değişken, sizin oluşturduğunuz PDF'in yerel
    // dosya yoludur (örn. expo-print'in printToFileAsync() döndürdüğü uri,
    // ya da expo-file-system ile diske yazdığınız bir .pdf).
    // Şimdilik hızlı test için testPdfOlustur() ile anlık üretiyoruz.

    const whatsappaGonder = async () => {
        if (!numara.trim()) {
            Alert.alert("Eksik bilgi", "Lütfen müşteri telefon numarasını girin.");
            return;
        }

        const temizNumara = numarayiTemizle(numara);

        setGonderiliyor(true);
        try {
            // Önce WhatsApp yüklü mü kontrol edelim (yalnızca Android'de
            // güvenilir çalışır; iOS'ta Linking.canOpenURL('whatsapp://')
            // tercih edilir).
            if (Platform.OS === "android") {
                const { isInstalled } = await Share.isPackageInstalled(
                    "com.whatsapp"
                );
                if (!isInstalled) {
                    Alert.alert("WhatsApp bulunamadı", "Cihazda WhatsApp yüklü değil.");
                    setGonderiliyor(false);
                    return;
                }
            }

            // Hızlı test için PDF'i şimdi, anlık üretiyoruz.
            // Gerçek projede burayı kendi PDF üretim fonksiyonunuzla değiştirin.
            const pdfBase64 = await testPdfOlustur();

            await Share.shareSingle({
                social: Share.Social.WHATSAPP,
                whatsAppNumber: temizNumara, // örn: "905551112233"
                url: `data:application/pdf;base64,${pdfBase64}`,
                type: "application/pdf",
                filename: "is-emri.pdf", // base64 kullanırken ZORUNLU (Android)
                useInternalStorage: true, // Android'de dosyanın WhatsApp'a doğru aktarılması için
                message: "İş emriniz ektedir, iyi günler dileriz.",
            });

            // Not: shareSingle, kullanıcı WhatsApp'ta "Gönder"e basmadan
            // önce (yani sadece uygulama açıldığında) resolve olabilir.
            // Gerçek gönderim WhatsApp tarafında gerçekleşir, kod bunu
            // takip edemez.
        } catch (hata) {
            // Kullanıcı paylaşım ekranını iptal ederse de buraya düşer,
            // bu yüzden her zaman "hata" gösterip kullanıcıyı korkutmayın.
            console.log("WhatsApp paylaşım hatası:", hata);
            if (Platform.OS === "ios") {
                Alert.alert(
                    "iOS Uyarısı",
                    "iOS'ta WhatsApp'a belirli bir numarayla dosya göndermek güvenilir çalışmaz. WhatsApp açıldıysa dosyayı elle eklemeniz gerekebilir."
                );
            }
        } finally {
            setGonderiliyor(false);
        }
    };

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.container}>
                <Text style={styles.baslik}>PDF'i WhatsApp'tan Gönder</Text>

                <Text style={styles.etiket}>Müşteri Telefon Numarası</Text>
                <TextInput
                    style={styles.input}
                    value={numara}
                    onChangeText={setNumara}
                    placeholder="Örn: 0555 111 22 33"
                    keyboardType="phone-pad"
                />

                <TouchableOpacity
                    style={[styles.buton, gonderiliyor && { opacity: 0.6 }]}
                    onPress={whatsappaGonder}
                    disabled={gonderiliyor}
                >
                    <Text style={styles.butonText}>
                        {gonderiliyor ? "Açılıyor..." : "WhatsApp'tan PDF Gönder"}
                    </Text>
                </TouchableOpacity>

                <Text style={styles.not}>
                    Not: Bu buton Android'de WhatsApp'ı doğrudan girilen numaranın
                    sohbetinde, PDF ekli şekilde açar. iOS'ta bu davranış WhatsApp'ın
                    kısıtlaması nedeniyle güvenilir çalışmaz.
                </Text>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: "#fff" },
    container: { padding: 20 },
    baslik: { fontSize: 20, fontWeight: "700", marginBottom: 20 },
    etiket: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 6 },
    input: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 10,
        padding: 12,
        marginBottom: 16,
        fontSize: 15,
    },
    buton: {
        backgroundColor: "#25D366", // WhatsApp yeşili
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    butonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    not: { marginTop: 16, fontSize: 12, color: "#888", lineHeight: 18 },
});