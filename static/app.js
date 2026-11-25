let kampusSinirlari = L.latLngBounds([39.465, 29.870], [39.500, 29.915]);

var map = L.map('harita', {
    maxBounds: kampusSinirlari,
    maxBoundsViscosity: 1.0, 
    minZoom: 14 
}).setView([39.482, 29.891], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

fetch('/static/data/kampus_binalar.geojson')
    .then(cevap => cevap.json())
    .then(veri => {
        L.geoJSON(veri, { style: { color: "#2c3e50", weight: 2, fillOpacity: 0.4 } }).addTo(map);
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

// Türkçe harflere duyarlı arama: "iibf" yazınca "İİBF" bulunur
function aramaIcinSadelestir(metin) {
    return metin.toLocaleLowerCase('tr').replace(/ı/g, 'i').trim();
}

function listeyiDoldur(input, listeDiv, tumunuGoster = false) {
    listeDiv.innerHTML = "";
    let deger = tumunuGoster ? "" : aramaIcinSadelestir(input.value);
    let filtrelenmis = noktalar.filter(n => aramaIcinSadelestir(n).includes(deger));

    filtrelenmis.forEach(isim => {
        let div = document.createElement('div');
        div.innerText = isim;
        div.onclick = function() {
            input.value = isim;
            pinSecimi.delete(input);
            listeDiv.style.display = "none";
            if(baslangicInput.value && bitisInput.value) rotaCiz();
        };
        listeDiv.appendChild(div);
    });
    
    listeDiv.style.display = filtrelenmis.length > 0 ? "block" : "none";
}

function aramaKutusunuBagla(input, listeDiv) {
    input.addEventListener('focus', () => {
        // Seçimi silme; metni seçili yap ki yazınca yerine geçsin
        setTimeout(() => input.select(), 0);
        listeyiDoldur(input, listeDiv, true);
    });
    input.addEventListener('input', () => {
        pinSecimi.delete(input);
        listeyiDoldur(input, listeDiv);
    });
}

aramaKutusunuBagla(baslangicInput, basListe);
aramaKutusunuBagla(bitisInput, bitListe);

document.addEventListener('click', function(e) {
    if (e.target !== baslangicInput) basListe.style.display = "none";
    if (e.target !== bitisInput) bitListe.style.display = "none";
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

function yonOkunuGuncelle() {
    if (!konumIsaretcisi) return;
    let ok = konumIsaretcisi.getElement().querySelector('.gps-yon');
    let yon = pusulaYonu !== null ? pusulaYonu : hareketYonu;
    if (yon === null) {
        ok.style.display = "none";
        return;
    }
    ok.style.display = "block";
    ok.style.transform = `rotate(${yon}deg)`;
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

let hedefIcon = L.divIcon({
    className: 'hedef-pin',
    iconSize: [20, 20],
    iconAnchor: [10, 20] 
});

fetch('/static/data/kampus_hedefler.geojson')
    .then(cevap => cevap.json())
    .then(veri => {
        L.geoJSON(veri, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, { icon: hedefIcon });
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.name) {
                    let isim = feature.properties.name;
                    let koordinat = feature.geometry.coordinates.slice(0, 2);

                    if (!koordinatRehberi[isim]) koordinatRehberi[isim] = [];
                    koordinatRehberi[isim].push(koordinat);
                    if (!noktalar.includes(isim)) noktalar.push(isim);
                    
                    layer.bindPopup("<b>" + isim + "</b>");
                    
                    layer.on('click', () => noktaSec(isim, koordinat));
                }
            }
        }).addTo(map);
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

function rotaCiz() {
    let basIsim = baslangicInput.value;
    let bitIsim = bitisInput.value;

    if (!koordinatRehberi[basIsim] || !koordinatRehberi[bitIsim]) {
        document.getElementById('durum').innerText = "Geçerli bir yer seçin veya GPS bağlantısı bekleyin!";
        return;
    }

    let basAdaylar = pinSecimi.has(baslangicInput) ? [pinSecimi.get(baslangicInput)] : koordinatRehberi[basIsim];
    let bitAdaylar = pinSecimi.has(bitisInput) ? [pinSecimi.get(bitisInput)] : koordinatRehberi[bitIsim];
    let [basKoor, bitKoor] = enYakinCift(basAdaylar, bitAdaylar);

    document.getElementById('durum').innerText = "Rota hesaplanıyor... ⏳";

    fetch('/api/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baslangic: basKoor, bitis: bitKoor })
    })
    .then(res => res.json())
    .then(data => {
        if(data.durum === "basarili") {
            if (rotaKatmani) map.removeLayer(rotaKatmani);
            
            let latLngs = data.koordinatlar.map(koor => [koor[1], koor[0]]);
            rotaKatmani = L.polyline(latLngs, { color: '#3498db', weight: 6, opacity: 0.8 }).addTo(map);
            
            let toplamMesafe = 0;
            for (let i = 0; i < latLngs.length - 1; i++) {
                toplamMesafe += map.distance(latLngs[i], latLngs[i+1]);
            }
            
            let mesafeMetre = Math.round(toplamMesafe);
            let sureDk = Math.ceil(mesafeMetre / 80);
            
            document.getElementById('durum').innerHTML = `Rota Çizildi! ✅ <br> 📏 Mesafe: ${mesafeMetre} m <br> 🚶 Süre: ~${sureDk} dk`;
            
            map.fitBounds(rotaKatmani.getBounds(), { padding: [50, 50] });
        } else {
            // Önceki rota ekranda kalıp yanıltmasın
            if (rotaKatmani) map.removeLayer(rotaKatmani);
            document.getElementById('durum').innerText = (data.mesaj || "Yol bulunamadı") + " ❌";
        }
    })
    .catch(err => {
        document.getElementById('durum').innerText = "Sunucuya bağlanılamadı!";
    });
}