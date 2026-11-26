// Dar telefon ekranında da kaydırılabilsin diye sınırlar kampüsten geniş tutulur
let kampusSinirlari = L.latLngBounds([39.450, 29.850], [39.515, 29.935]);

var map = L.map('harita', {
    maxBounds: kampusSinirlari,
    maxBoundsViscosity: 0.3,   // kenarda sert direnç hissi olmasın
    minZoom: 14,
    // Binalar ve rota tek bir tuvale çizilir: kaydırma çok daha akıcı olur
    renderer: L.canvas({ padding: 0.5 }),
    preferCanvas: true
}).setView([39.482, 29.891], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap',
    updateWhenIdle: false,   // telefonda harita parçaları kaydırırken de yüklensin
    keepBuffer: 4            // ekran dışındaki parçalar hazırda tutulsun
}).addTo(map);

// Rotanın dış kenarı koyu temada kısılır
function rotaKenarRengi() {
    return document.documentElement.classList.contains('koyu') ? "#8f98aa" : "#ffffff";
}

// Binalar da temaya göre boyanır
let binaKatmani = null;
function binaStili() {
    let koyu = document.documentElement.classList.contains('koyu');
    return { color: koyu ? "#3b352f" : "#8d8176", weight: 1.5,
             fillColor: koyu ? "#5a534b" : "#c4b9ad", fillOpacity: 0.75 };
}

fetch('/static/data/kampus_binalar.geojson')
    .then(cevap => cevap.json())
    .then(veri => {
        binaKatmani = L.geoJSON(veri, { style: binaStili() }).addTo(map);
    });

let rotaKatmani = null;
let baslangicInput = document.getElementById('baslangic-secim');
let bitisInput = document.getElementById('bitis-secim');
let basListe = document.getElementById('baslangic-liste');
let bitListe = document.getElementById('bitis-liste');

// isim -> koordinat listesi (aynı isimde birden fazla nokta olabilir)
let koordinatRehberi = {};
let noktalar = ["Mevcut Konumum"];
// Haritadan pine tıklanarak seçilen kutular için o pinin koordinatı
let pinSecimi = new Map();

// --- Telefon paneli ---
const mobilEkran = window.matchMedia('(max-width: 768px)');
let panel = document.getElementById('kontrol-paneli');
let tutamac = document.getElementById('panel-tutamac');

// Ekran boyutuna göre harita üstündeki araçları yerleştirir
function araclariYerlestir() {
    let etiket = document.getElementById('yaya-etiketi');
    let tema = document.getElementById('tema-dugmesi');
    if (mobilEkran.matches) {
        // Alttaki panel kaynak yazısını kapatmasın; yakınlaştırma iki parmakla yapılır
        map.attributionControl.setPosition('topright');
        map.zoomControl.remove();
        document.body.prepend(etiket, tema);
    } else {
        // Masaüstünde etiket ve tema düğmesi panel başlığında durur
        map.attributionControl.setPosition('bottomright');
        map.zoomControl.setPosition('bottomright').addTo(map);
        panel.querySelector('header').append(etiket, tema);
    }
}
araclariYerlestir();
mobilEkran.addEventListener('change', araclariYerlestir);

let durumKutusu = document.getElementById('durum');
let yerKarti = document.getElementById('yer-karti');

// Panel kapanınca ne kadar aşağı kayacak: yalnızca tutamaç ve sonuç görünür kalır
function kaymayiHesapla() {
    if (!mobilEkran.matches || panel.classList.contains('yaziyor')) return;
    // Rota varsa "Paylaş" düğmesi de görünür kalır. Sade ekranda sonuç satırı
    // gizliyse arama kutusu görünür kalır
    let paylas = document.getElementById('paylas');
    let sonOge = paylas.hidden ? durumKutusu : paylas;
    if (sonOge.offsetHeight === 0) sonOge = bitisInput.closest('.girdi-grubu');
    let gorunen = sonOge.offsetTop + sonOge.offsetHeight + 12;
    panel.style.setProperty('--kayma', Math.max(0, panel.offsetHeight - gorunen) + 'px');
}

function paneliKapat(kapali) {
    if (kapali) panel.scrollTop = 0;
    kaymayiHesapla();
    panel.classList.toggle('kapali', kapali);
    tutamac.setAttribute('aria-expanded', String(!kapali));
}

let boyutIzleyici = new ResizeObserver(kaymayiHesapla);
boyutIzleyici.observe(panel);
boyutIzleyici.observe(durumKutusu);

// Değişen öğeyi kısa süre parlatır ki kullanıcı fark etsin
function vurgula(oge) {
    oge.classList.remove('vurgu');
    void oge.offsetWidth;          // animasyon baştan başlasın
    oge.classList.add('vurgu');
}

// Alttaki bir sayfayı parmakla birlikte hareket ettirir.
// sinir(): en fazla kayma (px), baslangic(): şu anki kayma, birak(): karar
function suruklenebilirYap(sayfa, tutulan, { sinir, baslangic, birak }) {
    sayfa.addEventListener('pointerdown', e => {
        if (!mobilEkran.matches || !e.target.closest(tutulan)) return;
        if (sayfa.classList.contains('yaziyor')) return;

        let y0 = e.clientY, t0 = e.timeStamp, ilk = baslangic(), enFazla = sinir();
        let konum = ilk, surukleniyor = false;

        function hareket(olay) {
            let fark = olay.clientY - y0;
            if (!surukleniyor && Math.abs(fark) < 6) return;
            surukleniyor = true;
            konum = Math.min(Math.max(ilk + fark, 0), enFazla);
            sayfa.classList.add('suruklenen');
            sayfa.style.transform = `translateY(${konum}px)`;
        }

        function bitti(olay) {
            window.removeEventListener('pointermove', hareket);
            window.removeEventListener('pointerup', bitti);
            window.removeEventListener('pointercancel', bitti);
            if (!surukleniyor) return;       // düz dokunuş: click olayı çalışır
            sayfa.classList.remove('suruklenen');
            sayfa.style.transform = "";
            // Hızlı fırlatmada yöne, yavaş sürüklemede yakın uca gidilir
            let hiz = (olay.clientY - y0) / Math.max(olay.timeStamp - t0, 1);
            birak(Math.abs(hiz) > 0.4 ? hiz > 0 : konum > enFazla / 2);
            // Sürüklemenin ardından gelen tıklama yok sayılsın
            sayfa.addEventListener('click', yut, { capture: true, once: true });
            setTimeout(() => sayfa.removeEventListener('click', yut, { capture: true }), 60);
        }

        function yut(olay) { olay.stopPropagation(); }

        window.addEventListener('pointermove', hareket);
        window.addEventListener('pointerup', bitti);
        window.addEventListener('pointercancel', bitti);
    });
}

// --- Telefonda alttan kayan yer kartı ---
let kartNo = 0;
let seciliPin = null;

function kartiKapat() {
    yerKarti.classList.remove('acik');
    panel.classList.remove('kart-acik');
    if (seciliPin) seciliPin.classList.remove('secili-pin');
    seciliPin = null;
}

function kartiAc(icerik, isaretci) {
    kartiKapat();
    yazmaModunuKapat();
    kartNo++;

    let tutma = document.createElement('div');
    tutma.className = 'kart-tutamac';
    let kapat = document.createElement('button');
    kapat.type = "button";
    kapat.className = 'kart-kapat';
    kapat.innerText = "✕";
    kapat.setAttribute('aria-label', "Kartı kapat");
    kapat.addEventListener('click', kartiKapat);

    yerKarti.replaceChildren(tutma, kapat, icerik);
    yerKarti.classList.add('acik');
    panel.classList.add('kart-acik');

    seciliPin = isaretci.getElement() || null;
    if (seciliPin) seciliPin.classList.add('secili-pin');
    // Seçilen pin kartın altında kalmasın
    map.panInside(isaretci.getLatLng(), {
        paddingTopLeft: [40, 80],
        paddingBottomRight: [40, yerKarti.offsetHeight + 30]
    });
}

// Telefonda alttan kayan kart, masaüstünde işaretin üstünde balon
function kartGoster(icerik, isaretci) {
    if (mobilEkran.matches) {
        map.closePopup();
        kartiAc(icerik, isaretci);
    } else {
        kartNo++;
        L.popup({ minWidth: 210, offset: [0, -28], autoPanPaddingTopLeft: [50, 40] })
            .setLatLng(isaretci.getLatLng())
            .setContent(icerik)
            .openOn(map);
    }
}

suruklenebilirYap(yerKarti, '.kart-tutamac, strong, small', {
    sinir: () => yerKarti.offsetHeight,
    baslangic: () => 0,
    birak: kapansin => { if (kapansin) kartiKapat(); }
});

map.on('click', kartiKapat);

function yazmaModunuAc(input) {
    yazmaModunuKapat();
    kartiKapat();
    paneliKapat(false);
    panel.classList.add('yaziyor');
    input.closest('.girdi-grubu').classList.add('aktif');
}

function yazmaModunuKapat() {
    panel.classList.remove('yaziyor');
    panel.querySelectorAll('.aktif').forEach(grup => grup.classList.remove('aktif'));
    if (typeof sadeGuncelle === "function") sadeGuncelle();
}

// Tutamaca veya sonuç satırına dokununca ya da sürükleyince panel açılır/kapanır
tutamac.addEventListener('click', () => paneliKapat(!panel.classList.contains('kapali')));
durumKutusu.addEventListener('click', () => {
    if (panel.classList.contains('kapali')) paneliKapat(false);
});
suruklenebilirYap(panel, '#panel-tutamac, #durum', {
    sinir: () => { kaymayiHesapla(); return parseFloat(panel.style.getPropertyValue('--kayma')) || 0; },
    baslangic: () => panel.classList.contains('kapali')
        ? parseFloat(panel.style.getPropertyValue('--kayma')) || 0 : 0,
    birak: paneliKapat
});

// Türkçe harflere duyarlı arama: "iibf" yazınca "İİBF" bulunur
function aramaIcinSadelestir(metin) {
    return metin.toLocaleLowerCase('tr').replace(/ı/g, 'i').trim();
}

// Telefonda kullanıcıyı boğmamak için listede aynı anda en fazla bu kadar yer gösterilir
const MOBIL_SONUC = 5;
const MOBIL_ONERI = 3;
const ONERILEN_YERLER = ["Kütüphane", "Ekol Kafe", "İİBF"];   // konum bilinmiyorsa

// Boş aramada telefonda gösterilen kısa öneri listesi: konum varsa en yakın yerler
function kisaOneriler(input) {
    let konum = koordinatRehberi["Mevcut Konumum"];
    let isimler = ONERILEN_YERLER;
    if (konum && kampusSinirlari.contains([konum[0][1], konum[0][0]])) {
        let uzaklik = h => map.distance([konum[0][1], konum[0][0]], [h.koordinat[1], h.koordinat[0]]);
        isimler = [...new Set([...hedefler].sort((a, b) => uzaklik(a) - uzaklik(b)).map(h => h.isim))];
    }
    isimler = isimler.filter(n => noktalar.includes(n)).slice(0, MOBIL_ONERI);
    // Mevcut konum yalnızca başlangıç olarak anlamlıdır
    return input === baslangicInput ? ["Mevcut Konumum", ...isimler] : isimler;
}

function listeyiDoldur(input, listeDiv, tumunuGoster = false, tumYerler = false) {
    listeDiv.innerHTML = "";
    let deger = tumunuGoster ? "" : aramaIcinSadelestir(input.value);
    let filtrelenmis = noktalar.filter(n => aramaIcinSadelestir(n).includes(deger));
    let kisa = mobilEkran.matches && !deger && !tumYerler;
    if (kisa) filtrelenmis = kisaOneriler(input);
    else if (mobilEkran.matches && deger) filtrelenmis = filtrelenmis.slice(0, MOBIL_SONUC);

    function satirEkle(yazi, tikla, sinif, kap = listeDiv) {
        let div = document.createElement('div');
        div.innerText = yazi;
        if (sinif) div.className = sinif;
        div.onclick = tikla;
        kap.appendChild(div);
    }

    filtrelenmis.forEach(isim => satirEkle(isim, () => listedenSec(input, listeDiv, isim)));
    if (filtrelenmis.length === 0) satirEkle("Bu adla bir yer bulunamadı", null, 'liste-bos');

    if (kisa) {
        satirEkle("Tüm yerleri göster", olay => {
            olay.stopPropagation();     // liste yenilenirken pencere kapanmasın
            listeyiDoldur(input, listeDiv, true, true);
        }, 'liste-tumu');

        // Boş hedef aramasında nokta eylemleri yan yana sunulur
        if (input === bitisInput) {
            let kap = document.createElement('div');
            kap.className = 'liste-eylemler';
            [["📌 Nokta işaretle", 'nokta-isaretle'], ["🙋 Buradayım", 'buradayim']].forEach(([yazi, kimlik]) => {
                satirEkle(yazi, () => {
                    listeDiv.style.display = "none";
                    input.blur();
                    yazmaModunuKapat();
                    document.getElementById(kimlik).click();
                }, 'liste-eylem', kap);
            });
            listeDiv.appendChild(kap);
        }
    }

    listeDiv.style.display = "block";
}

function listedenSec(input, listeDiv, isim) {
    input.value = isim;
    pinSecimi.delete(input);
    listeDiv.style.display = "none";
    input.blur();

    // Hedef seçildi ve başlangıç boşsa mevcut konumdan başlanır
    if (input === bitisInput && !baslangicInput.value && isim !== "Mevcut Konumum" &&
        koordinatRehberi["Mevcut Konumum"]) {
        baslangicInput.value = "Mevcut Konumum";
    }
    yazmaModunuKapat();

    if (baslangicInput.value && bitisInput.value) {
        rotaCiz();
    } else {
        let eksik = bitisInput.value ? baslangicInput : bitisInput;
        durumKutusu.innerText = eksik === baslangicInput
            ? "Hedef seçildi. Şimdi başlangıcı seçin."
            : "Başlangıç seçildi. Şimdi hedefi seçin.";
        paneliKapat(false);
        vurgula(eksik);
    }
}

function aramaKutusunuBagla(input, listeDiv) {
    input.addEventListener('focus', () => {
        // Seçimi silme; metni seçili yap ki yazınca yerine geçsin
        setTimeout(() => input.select(), 0);
        listeyiDoldur(input, listeDiv, true);
    });
    // 'focus' yerine 'click': panel yer değiştirirken dokunuş boşa düşmesin
    input.addEventListener('click', () => {
        yazmaModunuAc(input);
        listeyiDoldur(input, listeDiv, true);
    });
    input.addEventListener('input', () => {
        yazmaModunuAc(input);
        pinSecimi.delete(input);
        listeyiDoldur(input, listeDiv);
    });
}

aramaKutusunuBagla(baslangicInput, basListe);
aramaKutusunuBagla(bitisInput, bitListe);

document.addEventListener('click', function(e) {
    if (e.target !== baslangicInput) basListe.style.display = "none";
    if (e.target !== bitisInput) bitListe.style.display = "none";
    if (e.target !== baslangicInput && e.target !== bitisInput && !e.target.closest('.acilir-liste')) {
        yazmaModunuKapat();
    }
});

// Haritadaki bir noktaya tıklanınca kutuları doldurur
function noktaSec(isim, koordinat) {
    function kutuyaYaz(input) {
        input.value = isim;
        if (koordinat) pinSecimi.set(input, koordinat);
        else pinSecimi.delete(input);
    }

    if (!baslangicInput.value) {
        kutuyaYaz(baslangicInput);
        document.getElementById('durum').innerText = "Bitiş noktasını arayın...";
    } else if (!bitisInput.value && baslangicInput.value !== isim) {
        kutuyaYaz(bitisInput);
        rotaCiz();
    } else {
        kutuyaYaz(baslangicInput);
        bitisInput.value = "";
        pinSecimi.delete(bitisInput);
        document.getElementById('durum').innerText = "Bitiş noktasını arayın...";
    }
}

let konumIsaretcisi = null;
let pusulaYonu = null;   // telefonun baktığı yön (derece, 0 = kuzey)
let hareketYonu = null;  // yürüyüş yönü (pusula yoksa kullanılır)

let gpsIcon = L.divIcon({
    className: 'gps-isaretci',
    html: '<div class="gps-yon"></div><div class="gps-noktasi"></div>',
    iconSize: [44, 44],
    iconAnchor: [22, 22]
});

let cizilenYon = null;      // ekrandaki okun açısı
let okBekliyor = false;

function yonOkunuCiz() {
    okBekliyor = false;
    if (!konumIsaretcisi) return;
    let ok = konumIsaretcisi.getElement().querySelector('.gps-yon');
    let yon = pusulaYonu !== null ? pusulaYonu : hareketYonu;
    if (yon === null) {
        ok.style.display = "none";
        cizilenYon = null;
        return;
    }
    // 3 dereceden küçük titremeler için yeniden çizilmez
    if (cizilenYon !== null && Math.abs(((yon - cizilenYon + 540) % 360) - 180) < 3) return;
    cizilenYon = yon;
    ok.style.display = "block";
    ok.style.transform = `rotate(${yon}deg)`;
}

// Pusula saniyede onlarca veri gönderir; ok en fazla saniyede 8 kez güncellenir
function yonOkunuGuncelle() {
    if (okBekliyor) return;
    okBekliyor = true;
    setTimeout(yonOkunuCiz, 120);
}

function pusulaOku(e) {
    let yon = null;
    if (typeof e.webkitCompassHeading === 'number') {
        yon = e.webkitCompassHeading;      // iPhone / iPad
    } else if (e.absolute && e.alpha !== null) {
        yon = 360 - e.alpha;               // Android
    }
    if (yon === null) return;

    // Ekran yan çevrildiyse açıyı düzelt
    let ekranAcisi = (screen.orientation && screen.orientation.angle) || 0;
    pusulaYonu = (yon + ekranAcisi) % 360;
    yonOkunuGuncelle();
}

function pusulayiBaslat() {
    if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', pusulaOku);
    } else {
        window.addEventListener('deviceorientation', pusulaOku);
    }
}

if (window.DeviceOrientationEvent) {
    // İzin gerektirmeyen tarayıcılarda dinleyici hemen çalışır
    pusulayiBaslat();

    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // iOS pusula iznini yalnızca kullanıcı dokunuşuyla sorar
        document.addEventListener('click', () => {
            DeviceOrientationEvent.requestPermission().catch(() => {});
        }, { once: true, capture: true });
    }
}

map.on('locationfound', function(e) {
    document.getElementById('gps-uyari').innerText = "";
    koordinatRehberi["Mevcut Konumum"] = [[e.latlng.lng, e.latlng.lat]];

    // Dururken GPS yönü güvenilmez; sadece yürürken güncelle
    if (e.speed > 0.5 && Number.isFinite(e.heading)) hareketYonu = e.heading;

    if (!konumIsaretcisi) {
        konumIsaretcisi = L.marker(e.latlng, { icon: gpsIcon }).addTo(map).bindPopup("Mevcut Konumunuz");
        konumIsaretcisi.on('click', () => noktaSec("Mevcut Konumum"));
    } else {
        konumIsaretcisi.setLatLng(e.latlng);
    }
    yonOkunuGuncelle();
});

map.on('locationerror', function(e) {
    document.getElementById('gps-uyari').innerText = e.code === 1
        ? "Konum izni verilmedi. \"Mevcut Konumum\" için tarayıcıdan izin verin."
        : "Konum alınamıyor. GPS'in açık olduğundan emin olun.";
});

map.locate({setView: false, watch: true, enableHighAccuracy: true});

// Kategoriler: pin rengi, simgesi ve (varsa) "en yakın" düğmesinin yazısı
const KATEGORILER = {
    fakulte: { ad: "Fakülte", simge: "🎓", renk: "#1d3c8c" },
    yemek:   { ad: "Yemek",   simge: "🍴", renk: "#c63f2d", enYakin: "En yakın yemek yerine git" },
    yurt:    { ad: "Yurt",    simge: "🛏️", renk: "#6b4f9c" },
    spor:    { ad: "Spor",    simge: "⚽", renk: "#117f7b", enYakin: "En yakın spor alanına git" },
    hizmet:  { ad: "Hizmet",  simge: "ℹ️", renk: "#3d6fb5" },
    gezi:    { ad: "Gezi",    simge: "🌳", renk: "#a3426c" }
};

// Pin üstündeki çizim simgeleri (24x24, beyaz çizgi)
const SIMGELER = {
    fakulte: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5M22 9v6"/>',
    yemek:   '<path d="M7 3v18M4 3v5a3 3 0 0 0 6 0V3M18 21V3c-3 2-4.5 6-3.5 11H18"/>',
    yurt:    '<path d="M3 19V5M3 15h18v4M21 15v-3a3 3 0 0 0-3-3h-7v6"/><circle cx="7" cy="11" r="1.6"/>',
    spor:    '<circle cx="12" cy="12" r="9"/><path d="M12 8l3.8 2.8-1.4 4.5H9.600l-1.4-4.5zM12 3v5M15.800 10.800l4.800-1.600M14.400 15.300l2.900 4M9.600 15.300l-2.900 4M8.200 10.800L3.400 9.200"/>',
    hizmet:  '<path d="M12 11v8M12 5.5v1"/>',
    gezi:    '<path d="M12 3l5 7h-2.500L19 16H5l4.500-6H7zM12 16v5"/>',
    hastane: '<path d="M12 5v14M5 12h14"/>',
    cami:    '<path d="M16 4a8.500 8.500 0 1 0 4 13 7 7 0 0 1-4-13z"/>',
    kitap:   '<path d="M12 6C10 4.500 7 4 3 4.500V19c4-.5 7 0 9 1.500 2-1.500 5-2 9-1.500V4.500c-4-.5-7 0-9 1.500v14"/>',
    otobus:  '<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M5 11h14M8 18v3M16 18v3M8.500 14.500h.5M15 14.500h.5"/>'
};

function simgeSvg(ad) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SIMGELER[ad]}</svg>`;
}

let hedefler = [];            // { isim, koordinat, kategoriler, simge, isaretci }
let seciliKategori = null;    // null = tümü
let enYakinDugmesi = document.getElementById('en-yakin');

// Süzme açıkken pin, seçili kategorinin renk ve simgesini alır
function pinIkonu(hedef) {
    let kategori = hedef.kategoriler.includes(seciliKategori) ? seciliKategori : hedef.kategoriler[0];
    let simge = kategori === hedef.kategoriler[0] && hedef.simge ? hedef.simge : kategori;
    return L.divIcon({
        className: 'hedef-pin',
        html: `<div class="hedef-pin-sekil" style="background-color:${KATEGORILER[kategori].renk}"><span>${simgeSvg(simge)}</span></div>`,
        iconSize: [36, 36],       // dokunma alanı; görünen boyut CSS'te
        iconAnchor: [18, 36],
        popupAnchor: [0, -28]
    });
}

// Bu yakınlıktan itibaren her yer ayrı pin; daha uzakta yakın yerler tek dairede toplanır
const AYRI_PIN_YAKINLIGI = 17;
const KUME_MESAFESI = 48;     // ekranda birbirine bu kadar yakın pinler toplanır (px)
let kumeKatmani = L.layerGroup().addTo(map);

function pinleriGuncelle() {
    let yakinlik = map.getZoom();
    let gruplar = [];

    hedefler.forEach(h => {
        if (seciliKategori && !h.kategoriler.includes(seciliKategori)) {
            map.removeLayer(h.isaretci);
            return;
        }
        let konum = map.project(h.isaretci.getLatLng(), yakinlik);
        let grup = yakinlik < AYRI_PIN_YAKINLIGI &&
            gruplar.find(g => g.merkez.distanceTo(konum) < KUME_MESAFESI);
        if (grup) grup.uyeler.push(h);
        else gruplar.push({ merkez: konum, uyeler: [h] });
    });

    kumeKatmani.clearLayers();
    gruplar.forEach(({ uyeler }) => {
        if (uyeler.length === 1) {
            pinGoster(uyeler[0]);
        } else {
            uyeler.forEach(h => map.removeLayer(h.isaretci));
            kumeEkle(uyeler);
        }
    });
}

function pinGoster(hedef) {
    // Simge yalnızca süzgeç değiştiyse yeniden oluşturulur
    if (hedef.ikonKategori !== seciliKategori) {
        hedef.isaretci.setIcon(pinIkonu(hedef));
        hedef.ikonKategori = seciliKategori;
    }
    if (!map.hasLayer(hedef.isaretci)) hedef.isaretci.addTo(map);
}

// Birkaç yeri temsil eden sayılı daire; dokununca yakınlaşır
function kumeEkle(uyeler) {
    let sinirlar = L.latLngBounds(uyeler.map(h => h.isaretci.getLatLng()));
    let renk = seciliKategori ? KATEGORILER[seciliKategori].renk : "#1d3c8c";
    L.marker(sinirlar.getCenter(), {
        icon: L.divIcon({
            className: 'kume',
            html: `<span style="background:${renk}"><b>${uyeler.length}</b></span>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        }),
        title: `${uyeler.length} yer`
    }).on('click', () => {
        let hedefYakinlik = Math.max(map.getBoundsZoom(sinirlar.pad(0.4)), map.getZoom() + 1);
        map.setView(sinirlar.getCenter(), Math.min(hedefYakinlik, 18));
    }).addTo(kumeKatmani);
}

map.on('zoomend', pinleriGuncelle);

function kategoriSec(kategori) {
    seciliKategori = kategori;
    pinleriGuncelle();
    document.querySelectorAll('#kategoriler button, #kisayollar button[data-kategori]').forEach(d => {
        let secili = d.dataset.kategori === (kategori || "");
        d.classList.toggle('secili', secili);
        d.setAttribute('aria-pressed', String(secili));
    });
    let yazi = kategori && KATEGORILER[kategori].enYakin;
    enYakinDugmesi.hidden = !yazi;
    if (yazi) enYakinDugmesi.innerText = "📍 " + yazi;
}

// Süzme düğmelerini oluştur
[["", { ad: "Tümü" }], ...Object.entries(KATEGORILER)].forEach(([anahtar, k]) => {
    let dugme = document.createElement('button');
    dugme.type = "button";
    dugme.dataset.kategori = anahtar;
    dugme.innerHTML = (anahtar ? simgeSvg(anahtar) : "") + `<span>${k.ad}</span>`;
    if (k.renk) dugme.style.setProperty('--renk', k.renk);
    dugme.addEventListener('click', () => kategoriSec(anahtar || null));
    document.getElementById('kategoriler').appendChild(dugme);
});
kategoriSec(null);

// Yürüme yolu uzunluğu (metre)
function yolUzunlugu(koordinatlar) {
    let toplam = 0;
    for (let i = 0; i < koordinatlar.length - 1; i++) {
        toplam += map.distance([koordinatlar[i][1], koordinatlar[i][0]],
                               [koordinatlar[i + 1][1], koordinatlar[i + 1][0]]);
    }
    return toplam;
}

// Seçili kategoride yürüyerek en yakın yeri bulup rotasını çizer
async function enYakinaGit() {
    let durum = document.getElementById('durum');
    let basIsim = baslangicInput.value || "Mevcut Konumum";
    if (!koordinatRehberi[basIsim]) {
        durum.innerText = "Önce \"Nereden\" kutusunu seçin veya konum izni verin";
        return;
    }
    let baslangiclar = pinSecimi.has(baslangicInput) ? [pinSecimi.get(baslangicInput)] : koordinatRehberi[basIsim];
    let adaylar = hedefler.filter(h => h.kategoriler.includes(seciliKategori) && h.isim !== basIsim);
    durum.innerText = "En yakın yer aranıyor... ⏳";

    try {
        let sonuclar = await Promise.all(adaylar.map(async hedef => {
            let [bas, bit] = enYakinCift(baslangiclar, [hedef.koordinat]);
            let cevap = await fetch('/api/rota', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baslangic: bas, bitis: bit })
            });
            let veri = await cevap.json();
            return veri.durum === "basarili"
                ? { hedef, uzunluk: yolUzunlugu(veri.koordinatlar) }
                : { mesaj: veri.mesaj };
        }));

        let bulunan = sonuclar.filter(s => s.hedef).sort((a, b) => a.uzunluk - b.uzunluk)[0];
        if (!bulunan) {
            durum.innerText = ((sonuclar[0] && sonuclar[0].mesaj) || "Yer bulunamadı") + " ❌";
            return;
        }
        baslangicInput.value = basIsim;
        bitisInput.value = bulunan.hedef.isim;
        pinSecimi.set(bitisInput, bulunan.hedef.koordinat);
        rotaCiz();
    } catch (err) {
        durum.innerText = "Sunucuya bağlanılamadı!";
    }
}

enYakinDugmesi.addEventListener('click', enYakinaGit);

// paylas.js, linkteki rotayı yerler yüklendikten sonra açmak için bunu bekler
const hedeflerHazir = fetch('/static/data/kampus_hedefler.geojson')
    .then(cevap => cevap.json())
    .then(veri => {
        veri.features.forEach(feature => {
            let bilgi = feature.properties || {};
            if (!bilgi.name) return;

            let isim = bilgi.name;
            let koordinat = feature.geometry.coordinates.slice(0, 2);
            let kategoriler = [bilgi.kategori, bilgi.ek_kategori].filter(k => KATEGORILER[k]);
            if (kategoriler.length === 0) kategoriler = ["hizmet"];

            if (!koordinatRehberi[isim]) koordinatRehberi[isim] = [];
            koordinatRehberi[isim].push(koordinat);
            if (!noktalar.includes(isim)) noktalar.push(isim);

            let hedef = { isim, koordinat, kategoriler, simge: SIMGELER[bilgi.simge] ? bilgi.simge : null };
            hedef.isaretci = L.marker([koordinat[1], koordinat[0]], { icon: pinIkonu(hedef), title: isim });
            hedef.isaretci.on('click', () => kartGoster(bilgiKarti(hedef), hedef.isaretci));
            hedefler.push(hedef);
        });
        pinleriGuncelle();
    });

// Pine dokununca açılan bilgi kartı
function bilgiKarti(hedef) {
    let kart = document.createElement('div');
    kart.className = 'bilgi-karti';

    let baslik = document.createElement('strong');
    baslik.innerText = hedef.isim;
    let tur = document.createElement('small');
    tur.innerText = hedef.kategoriler.map(k => KATEGORILER[k].ad).join(" · ");

    let dugmeler = document.createElement('div');
    [["🚶 Yürü", true], ["Buradan başla", false]].forEach(([yazi, hedefMi]) => {
        let dugme = document.createElement('button');
        dugme.type = "button";
        dugme.innerText = yazi;
        if (hedefMi) dugme.className = 'ana';
        dugme.addEventListener('click', () => karttanSec(hedef, hedefMi, dugme));
        dugmeler.appendChild(dugme);
    });

    let paylas = document.createElement('button');
    paylas.type = "button";
    paylas.innerText = "Paylaş";
    paylas.addEventListener('click', () => yeriPaylas(hedef));
    dugmeler.appendChild(paylas);

    kart.append(baslik, tur, dugmeler);
    yurumeSuresiEkle(tur, hedef.koordinat);
    return kart;
}

// Konum biliniyorsa kartta oraya kaç dakikada yürüneceği yazar
async function yurumeSuresiEkle(satir, koordinat) {
    let konum = koordinatRehberi["Mevcut Konumum"];
    if (!konum) return;
    try {
        let cevap = await fetch('/api/rota', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baslangic: konum[0], bitis: koordinat })
        });
        let veri = await cevap.json();
        if (veri.durum !== "basarili") return;      // kampüs dışındaysa süre yazılmaz
        let dakika = Math.max(1, Math.ceil(yolUzunlugu(veri.koordinatlar) / 80));
        // textContent: kart henüz kayarken görünmez olsa da mevcut yazı korunur
        satir.textContent += `, 🚶 ${dakika} dk yürüme`;
    } catch (err) {
        // Süre yalnızca ek bilgi: alınamazsa kart olduğu gibi kalır
    }
}

function karttanSec(hedef, hedefMi, dugme) {
    let secilen = hedefMi ? bitisInput : baslangicInput;
    let diger = hedefMi ? baslangicInput : bitisInput;

    // Kart hemen kaybolmasın: önce neyin seçildiği düğmede görünür
    dugme.parentElement.querySelectorAll('button').forEach(d => { d.disabled = true; });
    dugme.classList.add('onay');
    dugme.innerText = hedefMi ? "✓ Hedef seçildi" : "✓ Başlangıç seçildi";

    secilen.value = hedef.isim;
    pinSecimi.set(secilen, hedef.koordinat);

    // "Buraya git" denip başlangıç boşsa mevcut konum kullanılır
    if (hedefMi && !diger.value && koordinatRehberi["Mevcut Konumum"]) {
        diger.value = "Mevcut Konumum";
    }
    // Aynı pin iki kutuya birden yazıldıysa diğerini boşalt
    if (pinSecimi.get(diger) === hedef.koordinat) {
        diger.value = "";
        pinSecimi.delete(diger);
    }

    let buKart = kartNo;
    setTimeout(() => {
        if (buKart === kartNo) {
            kartiKapat();
            map.closePopup();
        }
        if (diger.value) {
            rotaCiz();
        } else {
            rotayiSil();
            durumKutusu.innerText = hedefMi
                ? "Hedef seçildi. Şimdi başlangıcı seçin."
                : "Başlangıç seçildi. Şimdi hedefi seçin.";
            paneliKapat(false);
            vurgula(secilen);
        }
    }, 400);
}

// --- Rota çizgisi ve A/B işaretleri ---
let ucIsaretleri = L.layerGroup().addTo(map);

let sonRota = null;   // ekrandaki rota: paylaşım için
let paylasDugmesi = document.getElementById('paylas');
boyutIzleyici.observe(paylasDugmesi);

function rotayiSil() {
    if (rotaKatmani) map.removeLayer(rotaKatmani);
    rotaKatmani = null;
    sonRota = null;
    paylasDugmesi.hidden = true;
    ucIsaretleri.clearLayers();
}

function ucIsareti(koordinat, harf) {
    L.marker([koordinat[1], koordinat[0]], {
        icon: L.divIcon({
            className: `uc-isareti uc-${harf}`,
            html: harf,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        }),
        interactive: false,     // alttaki pine dokunulabilsin
        zIndexOffset: 1000
    }).addTo(ucIsaretleri);
}

// Rota görünümündeki küçük ⇅ düğmesi aynı işi yapar; panel inik kalır
document.getElementById('hizli-degistir').addEventListener('click', () => yonuDegistir(true));
document.getElementById('yer-degistir').addEventListener('click', () => yonuDegistir(false));

function yonuDegistir(paneliIndir) {
    let eskiBas = { isim: baslangicInput.value, pin: pinSecimi.get(baslangicInput) };
    let eskiBit = { isim: bitisInput.value, pin: pinSecimi.get(bitisInput) };
    [[baslangicInput, eskiBit], [bitisInput, eskiBas]].forEach(([input, eski]) => {
        input.value = eski.isim;
        if (eski.pin) pinSecimi.set(input, eski.pin);
        else pinSecimi.delete(input);
    });
    if (!baslangicInput.value && !bitisInput.value) {
        durumKutusu.innerText = "Değiştirmek için önce bir yer seçin";
        vurgula(durumKutusu);
        return;
    }

    // Yazılar birbirinin yerine kayarak geçer
    let fark = bitisInput.getBoundingClientRect().top - baslangicInput.getBoundingClientRect().top;
    [[baslangicInput, fark], [bitisInput, -fark]].forEach(([input, mesafe]) => {
        input.animate(
            [{ transform: `translateY(${mesafe}px)` }, { transform: "none" }],
            { duration: 550, easing: "cubic-bezier(.22,1,.36,1)" });
        vurgula(input);
    });
    document.getElementById('yer-degistir').animate(
        [{ transform: "rotate(0deg)" }, { transform: "rotate(180deg)" }], { duration: 400 });

    if (baslangicInput.value && bitisInput.value) {
        // Alttaki düğmeden gelindiyse panel açık kalsın ki kutuların değiştiği görülsün
        rotaCiz({ paneliIndir, not: "⇅ Yön değişti" });
    } else {
        rotayiSil();
        durumKutusu.innerText = "⇅ Yer değiştirildi";
    }
}

document.getElementById('temizle').addEventListener('click', () => {
    baslangicInput.value = "";
    bitisInput.value = "";
    pinSecimi.clear();
    rotayiSil();
    map.closePopup();
    kartiKapat();
    kategoriSec(null);
    if (typeof ozelNoktayiSil === "function") ozelNoktayiSil();
    document.getElementById('durum').innerText = "Hedeflerinizi arayın veya seçin";
});

// Aynı isimli noktalar varsa birbirine en yakın (kuş uçuşu) çifti seçer
function enYakinCift(baslangiclar, bitisler) {
    let enIyi = null;
    let enKisa = Infinity;
    baslangiclar.forEach(a => {
        bitisler.forEach(b => {
            let mesafe = map.distance([a[1], a[0]], [b[1], b[0]]);
            if (mesafe < enKisa) {
                enKisa = mesafe;
                enIyi = [a, b];
            }
        });
    });
    return enIyi;
}

function htmlKacis(metin) {
    let kutu = document.createElement('div');
    kutu.textContent = metin;
    return kutu.innerHTML;
}

// paneliIndir: telefonda rota çizilince panel iner; not: sonucun başına eklenen açıklama
// sessiz: yoldan sapınca yapılan yenileme; harita ve panel yerinden oynamaz
function rotaCiz({ paneliIndir = true, not = "", sessiz = false } = {}) {
    let basIsim = baslangicInput.value;
    let bitIsim = bitisInput.value;

    if (!koordinatRehberi[basIsim] || !koordinatRehberi[bitIsim]) {
        document.getElementById('durum').innerText = "Geçerli bir yer seçin veya GPS bağlantısı bekleyin!";
        return;
    }

    let basAdaylar = pinSecimi.has(baslangicInput) ? [pinSecimi.get(baslangicInput)] : koordinatRehberi[basIsim];
    let bitAdaylar = pinSecimi.has(bitisInput) ? [pinSecimi.get(bitisInput)] : koordinatRehberi[bitIsim];
    let [basKoor, bitKoor] = enYakinCift(basAdaylar, bitAdaylar);

    if (!sessiz) document.getElementById('durum').innerText = "Rota hesaplanıyor... ⏳";
    let yenilenen = sonRota;     // sessiz yenilemede beklerken rota değişti mi

    fetch('/api/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baslangic: basKoor, bitis: bitKoor })
    })
    .then(res => res.json())
    .then(data => {
        // Kullanıcı bu arada rotayı sildiyse veya değiştirdiyse yenileme uygulanmaz
        if (sessiz && sonRota !== yenilenen) return;

        if(data.durum === "basarili") {
            rotayiSil();

            let latLngs = data.koordinatlar.map(koor => [koor[1], koor[0]]);
            // Beyaz kenarlı mercan hat: haritadaki yollardan kolayca ayrılır
            rotaKatmani = L.layerGroup([
                L.polyline(latLngs, { color: rotaKenarRengi(), weight: 11, opacity: 0.95 }),
                L.polyline(latLngs, { color: '#c63f2d', weight: 6, opacity: 1 })
            ]).addTo(map);
            
            let toplamMesafe = 0;
            for (let i = 0; i < latLngs.length - 1; i++) {
                toplamMesafe += map.distance(latLngs[i], latLngs[i+1]);
            }
            
            let mesafeMetre = Math.round(toplamMesafe);
            let sureDk = Math.ceil(mesafeMetre / 80);
            
            // İsimler kullanıcıdan gelebilir (işaretlenen noktalar): HTML'e kaçışlanarak yazılır
            let ek = typeof ozelNotu === "function" ? ozelNotu(bitIsim) : "";
            // Sonuç, iki durak arasındaki bir hat gibi gösterilir
            document.getElementById('durum').innerHTML = `
                <span class="hat">
                    ${not ? `<span class="hat-not">${htmlKacis(not)}</span>` : ""}
                    <span class="hat-ust"><b>🚶 ${sureDk} dk</b><span>${mesafeMetre} m</span></span>
                    <span class="hat-durak">${htmlKacis(basIsim)}</span>
                    <span class="hat-yol">yürüyerek</span>
                    <span class="hat-durak son">${htmlKacis(bitIsim)}</span>
                    ${ek ? `<span class="hat-not">${htmlKacis(ek)}</span>` : ""}
                </span>`;
            vurgula(durumKutusu);
            sonRota = { basIsim, bitIsim, basKoor, bitKoor, yol: latLngs };
            paylasDugmesi.hidden = false;

            // Mevcut konum zaten mavi noktayla gösterildiği için A konmaz
            if (basIsim !== "Mevcut Konumum") ucIsareti(basKoor, "A");
            if (bitIsim !== "Mevcut Konumum") ucIsareti(bitKoor, "B");

            let sinirlar = L.latLngBounds(latLngs)
                .extend([basKoor[1], basKoor[0]])
                .extend([bitKoor[1], bitKoor[0]]);

            if (sessiz) return;
            map.closePopup();
            if (mobilEkran.matches) {
                // Paneli indir ve rotayı panelin üstünde kalan alana ortala
                yazmaModunuKapat();
                kartiKapat();
                paneliKapat(paneliIndir);
                let kayma = paneliIndir ? parseFloat(panel.style.getPropertyValue('--kayma')) || 0 : 0;
                map.fitBounds(sinirlar, {
                    paddingTopLeft: [30, 50],
                    paddingBottomRight: [30, panel.offsetHeight - kayma + 20]
                });
            } else {
                // Soldaki panelin genişliği kadar boşluk bırak
                map.fitBounds(sinirlar, {
                    paddingTopLeft: [panel.offsetWidth + 50, 50],
                    paddingBottomRight: [50, 50]
                });
            }
        } else if (!sessiz) {
            // Önceki rota ekranda kalıp yanıltmasın
            rotayiSil();
            document.getElementById('durum').innerText = (data.mesaj || "Yol bulunamadı") + " ❌";
        }
    })
    .catch(err => {
        // Sessiz yenileme başarısızsa eldeki rota ekranda kalır
        if (!sessiz) document.getElementById('durum').innerText = "Sunucuya bağlanılamadı!";
    });
}

// --- Telefonda sade açılış ekranı ---
// Hiçbir şey seçilmemişken yalnızca arama kutusu ve kısayollar görünür.
const VARSAYILAN_DURUM = "Hedeflerinizi arayın veya seçin";
let digerAcik = false;        // "Diğer" ile tüm seçenekler açıldı mı

function sadeGuncelle() {
    let sade = !baslangicInput.value && !bitisInput.value && !rotaKatmani && !digerAcik;
    // Yazarken ekran düzeni değişmesin
    if (panel.classList.contains('yaziyor')) sade = panel.classList.contains('sade');

    panel.classList.toggle('sade', sade);
    panel.classList.toggle('bos-durum', durumKutusu.innerText.trim() === VARSAYILAN_DURUM);
    bitisInput.placeholder = sade && mobilEkran.matches
        ? "Nereye yürüyorsun?" : "Bina adı yazın veya seçin...";
    kaymayiHesapla();
}

document.querySelectorAll('#kisayollar button[data-kategori]').forEach(dugme => {
    let kategori = dugme.dataset.kategori;
    // Seçili kısayola yeniden dokunmak süzgeci kaldırır
    dugme.addEventListener('click', () =>
        kategoriSec(seciliKategori === kategori ? null : kategori));
});

document.getElementById('diger').addEventListener('click', () => {
    digerAcik = true;
    paneliKapat(false);
    sadeGuncelle();
});

document.getElementById('temizle').addEventListener('click', () => {
    digerAcik = false;
    sadeGuncelle();
});

// Sonuç satırı her değiştiğinde ekran durumu yeniden belirlenir
new MutationObserver(sadeGuncelle)
    .observe(durumKutusu, { childList: true, characterData: true, subtree: true });
mobilEkran.addEventListener('change', sadeGuncelle);
sadeGuncelle();

// --- Açık / koyu panel ---
// Yalnızca panel, kart ve pencereler değişir; harita aynı kalır.
let temaDugmesi = document.getElementById('tema-dugmesi');

function temaDugmesiniGuncelle() {
    let koyu = document.documentElement.classList.contains('koyu');
    temaDugmesi.innerText = koyu ? "☀️" : "🌙";
    let yazi = koyu ? "Açık temaya geç" : "Koyu temaya geç";
    temaDugmesi.setAttribute('aria-label', yazi);
    temaDugmesi.title = yazi;
}

temaDugmesi.addEventListener('click', () => {
    let koyu = document.documentElement.classList.toggle('koyu');
    try {
        localStorage.setItem('tema', koyu ? "koyu" : "acik");
    } catch (err) { /* seçim yalnızca bu açılışta geçerli olur */ }
    temaDugmesiniGuncelle();
    if (binaKatmani) binaKatmani.setStyle(binaStili());
    if (rotaKatmani) rotaKatmani.getLayers()[0].setStyle({ color: rotaKenarRengi() });
});
temaDugmesiniGuncelle();

// --- "Konumuma git" ve telefonda açılış görünümü ---
// Noktayı panelin üstünde kalan alanın ortasına getirir
function gorunurAlanaGetir(sinirlar, enYakin, canlandir = true) {
    let altBosluk = mobilEkran.matches ? panel.offsetHeight + 20 : 40;
    map.fitBounds(sinirlar, {
        animate: canlandir,
        maxZoom: enYakin,
        paddingTopLeft: mobilEkran.matches ? [20, 60] : [panel.offsetWidth + 40, 40],
        paddingBottomRight: [20, altBosluk]
    });
}

document.getElementById('konum-dugmesi').addEventListener('click', () => {
    let konum = konumIsaretcisi && konumIsaretcisi.getLatLng();
    if (!konum || !kampusSinirlari.contains(konum)) {
        durumKutusu.innerText = konum
            ? "Konumun kampüs haritasının dışında görünüyor."
            : "Konumun henüz alınamadı. Konum iznini kontrol et.";
        paneliKapat(false);
        vurgula(durumKutusu);
        return;
    }
    kartiKapat();
    gorunurAlanaGetir(L.latLngBounds([konum, konum]), 17);
});

// Telefonda tüm yerler panelin üstünde kalacak şekilde açılır (linkle gelinmediyse)
hedeflerHazir.then(() => {
    if (!mobilEkran.matches || window.location.search.match(/nere|nokta/)) return;
    // Açılışta canlandırma yok: hemen yapılan dokunuşlarla çakışmasın
    gorunurAlanaGetir(L.latLngBounds(hedefler.map(h => h.isaretci.getLatLng())), 16, false);
});

// --- Yürürken takip ---
// Rota "Mevcut Konumum"dan başlıyorsa kalan yol, süre ve mesafe canlı güncellenir.
const VARIS_MESAFESI = 20;     // yolun sonuna bu kadar kala varılmış sayılır (m)
const SAPMA_MESAFESI = 30;     // rotadan bu kadar uzaklaşınca sapma sayılır (m)
const SAPMA_SAYISI = 3;        // art arda bu kadar sapmalı konumda rota yenilenir

// Konumun rota üzerindeki en yakın noktasını ve oradan sonraki yolu bulur
function yoldakiYer(konum, yol) {
    const Z = 18;
    let p = map.project(konum, Z);
    let enIyi = null;
    for (let i = 0; i < yol.length - 1; i++) {
        let a = map.project(yol[i], Z), b = map.project(yol[i + 1], Z);
        let nokta = map.unproject(L.LineUtil.closestPointOnSegment(p, L.point(a), L.point(b)), Z);
        let uzaklik = map.distance(konum, nokta);
        if (!enIyi || uzaklik < enIyi.uzaklik) enIyi = { uzaklik, kalanYol: [nokta, ...yol.slice(i + 1)] };
    }
    return enIyi;
}

function takipEt(olay) {
    let rota = sonRota;
    if (!rota || rota.vardi || rota.basIsim !== "Mevcut Konumum" || rota.bitIsim === "Mevcut Konumum") return;
    if (rota.yol.length < 2) return;
    let hassasiyet = olay.accuracy || 0;
    if (hassasiyet > 60) return;     // konum çok belirsizse karar verilmez

    let yer = yoldakiYer(olay.latlng, rota.yol);

    // Yoldan sapma: tek bir hatalı ölçüm rotayı değiştirmesin
    if (yer.uzaklik > Math.max(SAPMA_MESAFESI, hassasiyet)) {
        rota.sapma = (rota.sapma || 0) + 1;
        if (rota.sapma >= SAPMA_SAYISI) {
            rota.sapma = 0;
            rotaCiz({ sessiz: true, not: "Rota yenilendi" });
        }
        return;
    }
    rota.sapma = 0;

    let kalan = yer.uzaklik;
    for (let i = 0; i < yer.kalanYol.length - 1; i++) {
        kalan += map.distance(yer.kalanYol[i], yer.kalanYol[i + 1]);
    }
    // Geçilen kısım haritadan silinir
    rotaKatmani.getLayers().forEach(cizgi => cizgi.setLatLngs(yer.kalanYol));

    let ust = durumKutusu.querySelector('.hat-ust');
    if (!ust) return;
    if (kalan <= VARIS_MESAFESI) {
        rota.vardi = true;
        // Yol bazı binalarda kapıdan önce bitiyor: kalan kuş uçuşu mesafe söylenir
        let hedefe = Math.round(map.distance(olay.latlng, [rota.bitKoor[1], rota.bitKoor[0]]));
        ust.querySelector('b').textContent = "🎉 Vardın";
        ust.querySelector('span').textContent = hedefe > 25 ? `hedef yaklaşık ${hedefe} m ileride` : "";
        vurgula(durumKutusu);
        return;
    }
    ust.querySelector('b').textContent = `🚶 ${Math.ceil(kalan / 80)} dk`;
    ust.querySelector('span').textContent = `${Math.round(kalan)} m kaldı`;
}

map.on('locationfound', takipEt);

// --- Telefon klavyesi ---
// Klavye açılınca yazma paneli onun üstünde kalsın diye klavye yüksekliği ölçülür
if (window.visualViewport) {
    const gorunum = window.visualViewport;
    const klavyeyiOlc = () => {
        let klavye = Math.max(0, window.innerHeight - gorunum.height - gorunum.offsetTop);
        document.documentElement.style.setProperty('--klavye', klavye + 'px');
        document.documentElement.style.setProperty('--gorunen', gorunum.height + 'px');
    };
    gorunum.addEventListener('resize', klavyeyiOlc);
    gorunum.addEventListener('scroll', klavyeyiOlc);
    klavyeyiOlc();
}
