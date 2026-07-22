var map = L.map('harita').setView([39.482, 29.891], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);

fetch('./data/kampus_binalar.geojson')
    .then(cevap => cevap.json())
    .then(veri => {
        L.geoJSON(veri, { style: { color: "#2c3e50", weight: 2, fillOpacity: 0.4 } }).addTo(map);
    });

let rotaKatmani = null;
let baslangicInput = document.getElementById('baslangic-secim');
let bitisInput = document.getElementById('bitis-secim');
let veriListesi = document.getElementById('noktalar-listesi');

let koordinatRehberi = {};

fetch('./data/kampus_hedefler.geojson')
    .then(cevap => cevap.json())
    .then(veri => {
        L.geoJSON(veri, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, { radius: 8, fillColor: "#e67e22", color: "#fff", weight: 2, fillOpacity: 1 });
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.name) {
                    let isim = feature.properties.name;
                    let koordinat = feature.geometry.coordinates[0] + "," + feature.geometry.coordinates[1];
                    
                    koordinatRehberi[isim] = koordinat;
                    
                    let secenek = document.createElement('option');
                    secenek.value = isim;
                    veriListesi.appendChild(secenek);
                    
                    layer.bindPopup("" + isim + "");
                    
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
        document.getElementById('durum').innerText = "Lütfen listeden geçerli bir yer seçin!";
        return;
    }

    let basKoor = koordinatRehberi[basIsim].split(',').map(Number);
    let bitKoor = koordinatRehberi[bitIsim].split(',').map(Number);

    document.getElementById('durum').innerText = "Rota hesaplanıyor... ⏳";

    fetch('http://127.0.0.1:5000/api/rota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baslangic: basKoor, bitis: bitKoor })
    })
    .then(res => res.json())
    .then(data => {
        if(data.durum === "basarili") {
            document.getElementById('durum').innerText = "Rota başarıyla çizildi! ✅";
            
            if (rotaKatmani) map.removeLayer(rotaKatmani);
            
            let latLngs = data.koordinatlar.map(koor => [koor[1], koor[0]]);
            rotaKatmani = L.polyline(latLngs, { color: '#3498db', weight: 6, opacity: 0.8 }).addTo(map);
            
            map.fitBounds(rotaKatmani.getBounds(), { padding: [50, 50] });
        } else {
            document.getElementById('durum').innerText = "Yol bulunamadı! ❌";
        }
    })
    .catch(err => {
        document.getElementById('durum').innerText = "Sunucuya bağlanılamadı!";
    });
}