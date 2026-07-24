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

let koordinatRehberi = {};
let noktalar = ["Mevcut Konumum"]; 

function listeyiDoldur(input, listeDiv) {
    listeDiv.innerHTML = "";
    let deger = input.value.toLowerCase();
    let filtrelenmis = noktalar.filter(n => n.toLowerCase().includes(deger));
    
    filtrelenmis.forEach(isim => {
        let div = document.createElement('div');
        div.innerText = isim;
        div.onclick = function() {
            input.value = isim;
            listeDiv.style.display = "none";
            if(baslangicInput.value && bitisInput.value) rotaCiz();
        };
        listeDiv.appendChild(div);
    });
    
    listeDiv.style.display = filtrelenmis.length > 0 ? "block" : "none";
}

baslangicInput.addEventListener('focus', () => {
    baslangicInput.value = "";
    listeyiDoldur(baslangicInput, basListe);
});
baslangicInput.addEventListener('input', () => listeyiDoldur(baslangicInput, basListe));

bitisInput.addEventListener('focus', () => {
    bitisInput.value = "";
    listeyiDoldur(bitisInput, bitListe);
});
bitisInput.addEventListener('input', () => listeyiDoldur(bitisInput, bitListe));

document.addEventListener('click', function(e) {
    if (e.target !== baslangicInput) basListe.style.display = "none";
    if (e.target !== bitisInput) bitListe.style.display = "none";
});

let konumIsaretcisi = null;
map.locate({setView: false, watch: true, enableHighAccuracy: true});

let gpsIcon = L.divIcon({
    className: 'gps-noktasi',
    iconSize: [16, 16],
    iconAnchor: [8, 8] 
});

map.on('locationfound', function(e) {
    koordinatRehberi["Mevcut Konumum"] = e.latlng.lng + "," + e.latlng.lat;

    if (!konumIsaretcisi) {
        konumIsaretcisi = L.marker(e.latlng, { icon: gpsIcon }).addTo(map).bindPopup("Mevcut Konumunuz");
        
        konumIsaretcisi.on('click', function() {
            let isim = "Mevcut Konumum";
            if (!baslangicInput.value) {
                baslangicInput.value = isim;
                document.getElementById('durum').innerText = "Bitiş noktasını arayın...";
            } else if (!bitisInput.value && baslangicInput.value !== isim) {
                bitisInput.value = isim;
                rotaCiz();
            } else {
                baslangicInput.value = isim;
                bitisInput.value = "";
                document.getElementById('durum').innerText = "Bitiş noktasını arayın...";
            }
        });

    } else {
        konumIsaretcisi.setLatLng(e.latlng);
    }
});

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
                    let koordinat = feature.geometry.coordinates[0] + "," + feature.geometry.coordinates[1];
                    
                    koordinatRehberi[isim] = koordinat;
                    if (!noktalar.includes(isim)) noktalar.push(isim);
                    
                    layer.bindPopup("<b>" + isim + "</b>");
                    
                    layer.on('click', function(e) {
                        if (!baslangicInput.value) {
                            baslangicInput.value = isim;
                            document.getElementById('durum').innerText = "Bitiş noktasını arayın...";
                        } else if (!bitisInput.value && baslangicInput.value !== isim) {
                            bitisInput.value = isim;
                            rotaCiz();
                        } else {
                            baslangicInput.value = isim;
                            bitisInput.value = "";
                            document.getElementById('durum').innerText = "Bitiş noktasını arayın...";
                        }
                    });
                }
            }
        }).addTo(map);
    });

function rotaCiz() {
    let basIsim = baslangicInput.value;
    let bitIsim = bitisInput.value;

    if (!koordinatRehberi[basIsim] || !koordinatRehberi[bitIsim]) {
        document.getElementById('durum').innerText = "Geçerli bir yer seçin veya GPS bağlantısı bekleyin!";
        return;
    }

    let basKoor = koordinatRehberi[basIsim].split(',').map(Number);
    let bitKoor = koordinatRehberi[bitIsim].split(',').map(Number);

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
            document.getElementById('durum').innerText = "Yol bulunamadı! ❌";
        }
    })
    .catch(err => {
        document.getElementById('durum').innerText = "Sunucuya bağlanılamadı!";
    });
}