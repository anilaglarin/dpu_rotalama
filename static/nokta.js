// Haritada kullanıcının işaretlediği noktalar: etkinlik, buluşma ve "Buradayım".
// Bilginin tamamı linkin içinde taşınır; sunucuda hiçbir şey saklanmaz.
// app.js ve paylas.js'ten sonra yüklenir.

const AD_SINIRI = 60;
let ozelNokta = null;      // { anahtar, ad, koordinat, tur, tarih, saat, bitis, isaretci }
let noktaModu = false;     // true: haritaya sıradaki dokunuş noktayı işaretler
let taslak = null;         // formu açık olan noktanın bilgisi

let formPenceresi = document.getElementById('nokta-penceresi');
let form = document.getElementById('nokta-formu');
let formHata = document.getElementById('nokta-hata');

// --- Zaman bilgisi ---
function tarihYazisi(nokta) {
    if (!nokta.tarih) return "";
    let [yil, ay, gun] = nokta.tarih.split("-");
    let saat = nokta.saat ? ` ${nokta.saat}` : "";
    let bitis = nokta.saat && nokta.bitis ? `–${nokta.bitis}` : "";
    return `${gun}.${ay}.${yil}${saat}${bitis}`;
}

// Etkinlik bitiş saatinden (yoksa gün sonundan) sonra "sona erdi" sayılır
function sonaErdiMi(nokta) {
    if (nokta.tur === "konum" || !nokta.tarih) return false;
    return new Date(`${nokta.tarih}T${nokta.bitis || "23:59"}`) < new Date();
}

// Rota sonucunun altına yazılan açıklama (app.js çağırır)
function ozelNotu(isim) {
    if (!ozelNokta || isim !== ozelNokta.anahtar) return "";
    let zaman = tarihYazisi(ozelNokta);
    if (ozelNokta.tur === "konum") return zaman ? `Konum paylaşım zamanı: ${zaman}` : "";
    return (zaman ? `🗓️ ${zaman} · ` : "") + "Kullanıcı tarafından işaretlendi";
}

// --- Haritadaki işaret ve kartı ---
function ozelNoktayiSil() {
    noktaModunuKapat();
    if (!ozelNokta) return;
    map.removeLayer(ozelNokta.isaretci);
    delete koordinatRehberi[ozelNokta.anahtar];
    noktalar = noktalar.filter(n => n !== ozelNokta.anahtar);
    [baslangicInput, bitisInput].forEach(input => {
        if (input.value === ozelNokta.anahtar) {
            input.value = "";
            pinSecimi.delete(input);
            rotayiSil();
        }
    });
    ozelNokta = null;
}

function ozelNoktaKur(bilgi) {
    ozelNoktayiSil();
    // Öndeki simge, gerçek yer adlarıyla karışmasını önler
    let anahtar = (bilgi.tur === "konum" ? "🙋 " : "📌 ") + bilgi.ad;
    let isaretci = L.marker([bilgi.koordinat[1], bilgi.koordinat[0]], {
        icon: L.divIcon({
            className: 'ozel-isaret',
            html: `<span>${bilgi.tur === "konum" ? "🙋" : "📌"}</span>`,
            iconSize: [44, 44],
            iconAnchor: [22, 42]
        }),
        title: bilgi.ad,
        zIndexOffset: 900
    }).addTo(map);

    ozelNokta = { ...bilgi, anahtar, isaretci };
    koordinatRehberi[anahtar] = [bilgi.koordinat];
    noktalar.push(anahtar);
    isaretci.on('click', () => kartGoster(noktaKarti(), isaretci));
}

function kartDugmesi(yazi, sinif, tikla) {
    let dugme = document.createElement('button');
    dugme.type = "button";
    dugme.innerText = yazi;
    if (sinif) dugme.className = sinif;
    dugme.addEventListener('click', () => tikla(dugme));
    return dugme;
}

function noktaKarti() {
    let nokta = ozelNokta;
    let kart = document.createElement('div');
    kart.className = 'bilgi-karti';

    let baslik = document.createElement('strong');
    baslik.innerText = nokta.ad;
    let aciklama = document.createElement('small');
    aciklama.innerText = [
        sonaErdiMi(nokta) ? "⚠️ Bu etkinlik sona erdi" : "",
        tarihYazisi(nokta),
        nokta.tur === "konum" ? "Paylaşılan anlık konum (canlı takip değil)" : "Kullanıcı tarafından işaretlendi"
    ].filter(Boolean).join(" · ");

    let dugmeler = document.createElement('div');
    dugmeler.append(
        kartDugmesi("🚶 Yürü", "ana", dugme =>
            karttanSec({ isim: nokta.anahtar, koordinat: nokta.koordinat }, true, dugme)),
        kartDugmesi("Paylaş / QR", "", () => noktayiPaylas())
    );

    let kaldir = kartDugmesi("Bu işareti kaldır", "", () => {
        map.closePopup();
        kartiKapat();
        ozelNoktayiSil();
        durumKutusu.innerText = "İşaret kaldırıldı";
    });

    dugmeler.appendChild(kaldir);
    kart.append(baslik, aciklama, dugmeler);
    yurumeSuresiEkle(aciklama, nokta.koordinat);
    return kart;
}

// --- Link ve paylaşım ---
function noktaLinki(nokta) {
    let adres = new URL(window.location.origin + window.location.pathname);
    adres.searchParams.set("nokta", nokta.koordinat.map(s => s.toFixed(6)).join(","));
    adres.searchParams.set("ad", nokta.ad);
    if (nokta.tur === "konum") adres.searchParams.set("tur", "konum");
    ["tarih", "saat", "bitis"].forEach(alan => {
        if (nokta[alan]) adres.searchParams.set(alan, nokta[alan]);
    });
    return adres.toString();
}

function noktayiPaylas() {
    let zaman = tarihYazisi(ozelNokta);
    paylasimPenceresiniAc({
        baslik: ozelNokta.tur === "konum" ? "Konumunu paylaş" : "Noktayı paylaş",
        aciklama: ozelNokta.ad + (zaman ? ` · ${zaman}` : ""),
        link: noktaLinki(ozelNokta)
    });
}

// Sunucu yol ağından uzak noktaları reddeder; aynı kontrol burada kullanılır
async function kampusIcindeMi(koordinat) {
    let cevap = await fetch('/api/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baslangic: koordinat, bitis: koordinat })
    });
    return cevap.status !== 422;
}

// --- Form ---
function formuAc(koordinat, tur) {
    noktaModunuKapat();
    map.closePopup();
    kartiKapat();
    yazmaModunuKapat();
    taslak = { koordinat, tur };
    form.reset();
    formHata.innerText = "";

    let konumMu = tur === "konum";
    document.getElementById('nokta-baslik').innerText = konumMu ? "Buradayım" : "Noktayı işaretle";
    document.getElementById('nokta-uyari').innerText = konumMu
        ? "Şu anki konumun linke yazılacak ve linki alan herkes görecek. Canlı takip değildir."
        : "Bu nokta yalnızca linki veya QR kodu alan kişilere görünür.";
    document.getElementById('nokta-zaman').hidden = konumMu;
    form.elements.ad.value = konumMu ? "Buradayım" : "";
    formPenceresi.showModal();
}

form.addEventListener('submit', async olay => {
    olay.preventDefault();
    let ad = form.elements.ad.value.trim().slice(0, AD_SINIRI);
    let { tarih, saat, bitis } = Object.fromEntries(new FormData(form));

    if (!ad) { formHata.innerText = "Bir ad yazın."; return; }
    if ((saat || bitis) && !tarih) { formHata.innerText = "Saat için tarih de seçin."; return; }
    if (bitis && !saat) { formHata.innerText = "Bitiş için başlangıç saati de seçin."; return; }
    if (bitis && bitis <= saat) { formHata.innerText = "Bitiş saati başlangıçtan sonra olmalı."; return; }

    let bilgi = { ...taslak, ad, tarih, saat, bitis };
    if (bilgi.tur === "konum") {
        // Alıcı ne zamanki konum olduğunu görsün
        let simdi = new Date();
        let iki = s => String(s).padStart(2, "0");
        bilgi.tarih = `${simdi.getFullYear()}-${iki(simdi.getMonth() + 1)}-${iki(simdi.getDate())}`;
        bilgi.saat = `${iki(simdi.getHours())}:${iki(simdi.getMinutes())}`;
        bilgi.bitis = "";
    } else if (sonaErdiMi(bilgi)) {
        formHata.innerText = "Bu tarih geçmişte kalıyor.";
        return;
    }

    formHata.innerText = "Kontrol ediliyor...";
    try {
        if (!await kampusIcindeMi(bilgi.koordinat)) {
            formHata.innerText = "Bu nokta kampüs yollarından çok uzakta.";
            return;
        }
    } catch (err) {
        formHata.innerText = "Sunucuya bağlanılamadı!";
        return;
    }
    if (!formPenceresi.open) return;     // kullanıcı bu arada vazgeçti

    formPenceresi.close();
    ozelNoktaKur(bilgi);
    durumKutusu.innerText = `${ozelNokta.anahtar} işaretlendi`;
    noktayiPaylas();
});

document.getElementById('nokta-vazgec').addEventListener('click', () => formPenceresi.close());

// --- İşaretleme yolları ---
function noktaModunuKapat() {
    noktaModu = false;
    document.body.classList.remove('nokta-modu');
}

document.getElementById('nokta-isaretle').addEventListener('click', olay => {
    olay.stopPropagation();
    noktaModu = true;
    document.body.classList.add('nokta-modu');
    rotayiSil();
    durumKutusu.innerText = "Haritada işaretlemek istediğin yere dokun";
    if (mobilEkran.matches) paneliKapat(true);
    vurgula(durumKutusu);
});

map.on('click', olay => {
    if (noktaModu) formuAc([olay.latlng.lng, olay.latlng.lat], "etkinlik");
});

// Haritaya basılı tutmak (masaüstünde sağ tık) da noktayı işaretler
map.on('contextmenu', olay => formuAc([olay.latlng.lng, olay.latlng.lat], "etkinlik"));

document.getElementById('buradayim').addEventListener('click', () => {
    let konum = koordinatRehberi["Mevcut Konumum"];
    if (!konum) {
        durumKutusu.innerText = "Konumun henüz alınamadı. Konum iznini kontrol et.";
        vurgula(durumKutusu);
        return;
    }
    formuAc(konum[0], "konum");
});

// --- Linkten açma: ?nokta=boylam,enlem&ad=... ---
function noktaLinkiniAc() {
    let p = new URLSearchParams(window.location.search);
    if (!p.get("nokta")) return;

    let koordinat = p.get("nokta").split(",").map(Number);
    // Yalnızca harita sınırları içindeki geçerli koordinatlar kabul edilir
    if (koordinat.length !== 2 || !koordinat.every(Number.isFinite) ||
        !kampusSinirlari.contains([koordinat[1], koordinat[0]])) {
        durumKutusu.innerText = "Linkteki nokta geçersiz veya kampüs dışında.";
        return;
    }
    let gecerli = (alan, kalip) => (kalip.test(p.get(alan) || "") ? p.get(alan) : "");
    ozelNoktaKur({
        koordinat,
        ad: (p.get("ad") || "").trim().slice(0, AD_SINIRI) || "İşaretli nokta",
        tur: p.get("tur") === "konum" ? "konum" : "etkinlik",
        tarih: gecerli("tarih", /^\d{4}-\d{2}-\d{2}$/),
        saat: gecerli("saat", /^\d{2}:\d{2}$/),
        bitis: gecerli("bitis", /^\d{2}:\d{2}$/)
    });
    map.setView([koordinat[1], koordinat[0]], 17);

    if (sonaErdiMi(ozelNokta)) {
        durumKutusu.innerText = `${ozelNokta.anahtar}: bu etkinlik sona erdi`;
        kartGoster(noktaKarti(), ozelNokta.isaretci);
        return;
    }
    kutuyuDoldur(bitisInput, { isim: ozelNokta.anahtar, koordinat });
    if (koordinatRehberi["Mevcut Konumum"]) {
        baslangicInput.value = "Mevcut Konumum";
        rotaCiz();
    } else {
        konumBekleyenHedef = ozelNokta.anahtar;
        durumKutusu.innerText = `Hedef: ${ozelNokta.anahtar}. Konum bekleniyor; isterseniz başlangıcı seçin.`;
        kartGoster(noktaKarti(), ozelNokta.isaretci);
    }
}

hedeflerHazir.then(noktaLinkiniAc);
