import React, { useRef, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Modal,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system";
import SignatureScreen from "react-native-signature-canvas";

// İmza pad'inin içindeki gereksiz buton/gölgeleri gizlemek için
const imzaWebStyle = `
  .m-signature-pad { box-shadow: none; border: none; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body,html { background-color: #fff; }
`;

// react-native-signature-canvas base64'ü "data:image/png;base64,AAAA..."
// formatında döndürür (varsayılan imageType zaten PNG'dir).
// Bu fonksiyon o base64'ü gerçek bir .png dosyasına yazıp
// dosya yolunu (uri) döndürür, böylece backend'e normal bir
// resim dosyası gibi (multipart/form-data ile) yükleyebiliriz.
async function imzayiPngDosyasinaKaydet(base64DataUri, dosyaAdi) {
  const sadeceBase64 = base64DataUri.split(",")[1]; // "data:image/png;base64," kısmını at
  const dosyaYolu = FileSystem.cacheDirectory + dosyaAdi;
  await FileSystem.writeAsStringAsync(dosyaYolu, sadeceBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return dosyaYolu;
}

export default function App() {
  // Form bilgileri
  const [musteriAdi, setMusteriAdi] = useState("");
  const [teknisyenAdi, setTeknisyenAdi] = useState("");
  const [yapilanIs, setYapilanIs] = useState("");

  // İmza sonuçları
  const [teknisyenImza, setTeknisyenImza] = useState(null);
  const [musteriImza, setMusteriImza] = useState(null);

  // ÖNEMLİ: Aynı ekranda iki WebView (imza kutusu) birden aktif
  // olursa Android'de dokunuş olayları karışabiliyor, çizim
  // çalışmayabiliyor. Bunu kökten çözmek için imza her zaman tam
  // ekran bir Modal içinde, TEK bir WebView olarak açılıyor.
  // "aktifImzalayan" hangi modalın açık olduğunu tutar: null | 'teknisyen' | 'musteri'
  const [aktifImzalayan, setAktifImzalayan] = useState(null);
  const modalRef = useRef();

  // Her modal açılışında SignatureScreen'i BAMBAŞKA bir bileşen gibi
  // yeniden kurmak için artan bir sayaç kullanıyoruz (key olarak).
  // Bu, "bir kere çiziyor, ikinci sefer çizmiyor" sorununu çözer:
  // React, aynı bileşeni güncellemek yerine WebView'ı sıfırdan oluşturur.
  const [acilmaSayaci, setAcilmaSayaci] = useState(0);

  // WebView'ı modal tamamen ekranda göründükten SONRA mount ediyoruz.
  // Modal'ın kayma animasyonu bitmeden WebView yüklenirse, canvas
  // yanlış boyut ölçüp dokunuşları doğru işlemeyebiliyor.
  const [modalHazir, setModalHazir] = useState(false);

  const modalAc = (kisi) => {
    setAcilmaSayaci((n) => n + 1);
    setModalHazir(false);
    setAktifImzalayan(kisi);
  };

  const modalKapat = () => {
    setAktifImzalayan(null);
    setModalHazir(false);
  };

  const modalKaydet = () => {
    modalRef.current.readSignature();
  };

  const modalTemizle = () => {
    modalRef.current.clearSignature();
  };

  // Modal içindeki tek canvas'tan gelen sonucu, hangi kişi için
  // açıldıysa onun state'ine yazar ve modalı kapatır.
  const handleImzaSonucu = (base64) => {
    if (aktifImzalayan === "teknisyen") setTeknisyenImza(base64);
    if (aktifImzalayan === "musteri") setMusteriImza(base64);
    modalKapat();
  };

  const [gonderiliyor, setGonderiliyor] = useState(false);

  const kaydetVeGonder = async () => {
    if (!musteriAdi.trim() || !teknisyenAdi.trim() || !yapilanIs.trim()) {
      Alert.alert("Eksik bilgi", "Lütfen tüm alanları doldurun.");
      return;
    }
    if (!teknisyenImza) {
      Alert.alert("Eksik imza", "Teknisyen imzası eksik.");
      return;
    }
    if (!musteriImza) {
      Alert.alert("Eksik imza", "Müşteri imzası eksik.");
      return;
    }

    setGonderiliyor(true);
    try {
      // 1) base64 imzaları gerçek .png dosyalarına çeviriyoruz
      const teknisyenDosyaYolu = await imzayiPngDosyasinaKaydet(
        teknisyenImza,
        "teknisyen-imza.png"
      );
      const musteriDosyaYolu = await imzayiPngDosyasinaKaydet(
        musteriImza,
        "musteri-imza.png"
      );

      // 2) multipart/form-data ile backend'e yolluyoruz.
      // Kendi API adresinizi buraya yazın.
      const formData = new FormData();
      formData.append("musteriAdi", musteriAdi);
      formData.append("teknisyenAdi", teknisyenAdi);
      formData.append("yapilanIs", yapilanIs);
      formData.append("tarih", new Date().toISOString());
      formData.append("teknisyenImza", {
        uri: teknisyenDosyaYolu,
        name: "teknisyen-imza.png",
        type: "image/png",
      });
      formData.append("musteriImza", {
        uri: musteriDosyaYolu,
        name: "musteri-imza.png",
        type: "image/png",
      });

      // NOT: Bu URL'yi kendi backend adresinizle değiştirin.
      // fetch, FormData kullanırken Content-Type header'ını kendisi
      // (boundary ile birlikte) ayarlar; elle "multipart/form-data"
      // yazmayın, aksi halde boundary eksik kalır ve istek bozulur.
      const yanit = await fetch("https://api.senin-servisin.com/is-emirleri", {
        method: "POST",
        body: formData,
      });

      if (!yanit.ok) {
        throw new Error(`Sunucu hatası: ${yanit.status}`);
      }

      Alert.alert("Başarılı", "İş emri her iki imza ile kaydedildi.");
    } catch (hata) {
      console.log("Gönderim hatası:", hata);
      Alert.alert(
        "Gönderilemedi",
        "İş emri backend'e gönderilirken bir sorun oluştu. (Örnek URL gerçek bir sunucu değil, kendi API adresinizle değiştirmeniz gerekiyor.)"
      );
    } finally {
      setGonderiliyor(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.baslik}>Servis İş Emri</Text>

        <Text style={styles.etiket}>Müşteri Adı Soyadı</Text>
        <TextInput
          style={styles.input}
          value={musteriAdi}
          onChangeText={setMusteriAdi}
          placeholder="Örn: Ahmet Yılmaz"
        />

        <Text style={styles.etiket}>Teknisyen Adı Soyadı</Text>
        <TextInput
          style={styles.input}
          value={teknisyenAdi}
          onChangeText={setTeknisyenAdi}
          placeholder="Örn: Mehmet Demir"
        />

        <Text style={styles.etiket}>Yapılan İş</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={yapilanIs}
          onChangeText={setYapilanIs}
          placeholder="Yapılan işin kısa açıklaması"
          multiline
        />

        {/* ---- TEKNİSYEN İMZA ALANI ---- */}
        <Text style={styles.altBaslik}>Teknisyen İmzası</Text>
        <TouchableOpacity
          style={styles.imzaKutu}
          onPress={() => modalAc("teknisyen")}
        >
          {teknisyenImza ? (
            <Image source={{ uri: teknisyenImza }} style={styles.imzaResim} />
          ) : (
            <Text style={styles.imzaPlaceholder}>
              Dokunup imza atmak için tıklayın
            </Text>
          )}
        </TouchableOpacity>
        {teknisyenImza && (
          <TouchableOpacity
            onPress={() => modalAc("teknisyen")}
            style={styles.degistirBtn}
          >
            <Text style={styles.degistirBtnText}>İmzayı Değiştir</Text>
          </TouchableOpacity>
        )}

        {/* ---- MÜŞTERİ İMZA ALANI ---- */}
        <Text style={styles.altBaslik}>Müşteri İmzası</Text>
        <TouchableOpacity
          style={styles.imzaKutu}
          onPress={() => modalAc("musteri")}
        >
          {musteriImza ? (
            <Image source={{ uri: musteriImza }} style={styles.imzaResim} />
          ) : (
            <Text style={styles.imzaPlaceholder}>
              Dokunup imza atmak için tıklayın
            </Text>
          )}
        </TouchableOpacity>
        {musteriImza && (
          <TouchableOpacity
            onPress={() => modalAc("musteri")}
            style={styles.degistirBtn}
          >
            <Text style={styles.degistirBtnText}>İmzayı Değiştir</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.gonderBtn, gonderiliyor && { opacity: 0.6 }]}
          onPress={kaydetVeGonder}
          disabled={gonderiliyor}
        >
          <Text style={styles.gonderBtnText}>
            {gonderiliyor ? "Gönderiliyor..." : "Kaydet ve Gönder"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ---- TEK, TAM EKRAN İMZA MODALI (her zaman aynı anda tek WebView açık) ---- */}
      <Modal
        visible={aktifImzalayan !== null}
        animationType="slide"
        onShow={() => setModalHazir(true)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <Text style={styles.modalBaslik}>
            {aktifImzalayan === "teknisyen"
              ? "Teknisyen İmzası"
              : "Müşteri İmzası"}
          </Text>
          <Text style={styles.modalAciklama}>
            Lütfen aşağıdaki alana parmağınızla imzanızı atın.
          </Text>

          <View style={styles.modalCanvasKutu}>
            {modalHazir && (
              <SignatureScreen
                key={acilmaSayaci}
                ref={modalRef}
                onOK={handleImzaSonucu}
                onEmpty={() => Alert.alert("Uyarı", "İmza boş, tekrar deneyin.")}
                webStyle={imzaWebStyle}
                autoClear={false}
                descriptionText=""
                penColor="#000000"
                backgroundColor="#ffffff"
              />
            )}
          </View>

          <View style={styles.modalButonSatiri}>
            <TouchableOpacity style={styles.temizleBtn} onPress={modalTemizle}>
              <Text style={styles.temizleBtnText}>Temizle</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iptalBtn}
              onPress={() => modalKapat()}
            >
              <Text style={styles.iptalBtnText}>Vazgeç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.onaylaBtn} onPress={modalKaydet}>
              <Text style={styles.onaylaBtnText}>Onayla</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20, paddingBottom: 40 },
  baslik: { fontSize: 24, fontWeight: "700", marginBottom: 20 },
  altBaslik: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 8,
  },
  etiket: { fontSize: 14, fontWeight: "600", color: "#333", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 15,
  },
  textArea: { minHeight: 70, textAlignVertical: "top" },

  imzaKutu: {
    height: 140,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    backgroundColor: "#fafafa",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  imzaResim: { width: "100%", height: "100%", resizeMode: "contain" },
  imzaPlaceholder: { color: "#999", fontSize: 14 },
  degistirBtn: { alignSelf: "flex-end", marginTop: 6 },
  degistirBtnText: { color: "#2563eb", fontWeight: "600", fontSize: 13 },

  gonderBtn: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: "#16a34a",
    alignItems: "center",
  },
  gonderBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Modal stilleri
  modalSafe: { flex: 1, backgroundColor: "#fff", padding: 16 },
  modalBaslik: { fontSize: 20, fontWeight: "700", marginBottom: 4 },
  modalAciklama: { fontSize: 14, color: "#666", marginBottom: 12 },
  modalCanvasKutu: {
    height: 350,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  modalButonSatiri: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  temizleBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
  },
  temizleBtnText: { color: "#333", fontWeight: "600" },
  iptalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#f1f1f1",
    alignItems: "center",
  },
  iptalBtnText: { color: "#333", fontWeight: "600" },
  onaylaBtn: {
    flex: 1.4,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
  },
  onaylaBtnText: { color: "#fff", fontWeight: "700" },
});
