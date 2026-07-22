import os
import geopandas as gpd
import networkx as nx
import math
from flask import Flask, request, jsonify
from flask_cors import CORS

print("--- DPÜ Rotalama Motoru Başlatılıyor ---")

# Dosyaların bulunduğu klasör yolunu doğrudan frontend/data olarak gösteriyoruz
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "../frontend/data")

# 1. VERİLERİ OKUMA VE AĞ KURULUMU
yollar = gpd.read_file(os.path.join(DATA_DIR, "kampus_yollar.geojson"))
hedefler = gpd.read_file(os.path.join(DATA_DIR, "kampus_hedefler.geojson"))
binalar = gpd.read_file(os.path.join(DATA_DIR, "kampus_binalar.geojson"))

G = nx.Graph()
for index, row in yollar.iterrows():
    geometri = row['geometry']
    if geometri is None: continue
    
    if geometri.geom_type == 'MultiLineString':
        cizgiler = list(geometri.geoms)
    elif geometri.geom_type == 'LineString':
        cizgiler = [geometri]
    else: continue
        
    for cizgi in cizgiler:
        koordinatlar = list(cizgi.coords)
        for i in range(len(koordinatlar) - 1):
            G.add_edge(koordinatlar[i], koordinatlar[i+1], weight=math.dist(koordinatlar[i], koordinatlar[i+1]))

print(f"Harita Ağı Hazır! Toplam Kavşak: {G.number_of_nodes()}")

def en_yakin_kavsagi_bul(hedef_x, hedef_y, ag):
    en_kisa_mesafe = float('inf')
    en_yakin_dugum = None
    for dugum in ag.nodes():
        mesafe = math.dist((hedef_x, hedef_y), dugum)
        if mesafe < en_kisa_mesafe:
            en_kisa_mesafe = mesafe
            en_yakin_dugum = dugum
    return en_yakin_dugum

# 2. API SUNUCUSU KURULUMU
app = Flask(__name__)
CORS(app)

@app.route('/api/rota', methods=['POST'])
def rota_hesapla():
    gelen_veri = request.json
    baslangic = gelen_veri['baslangic'] 
    bitis = gelen_veri['bitis']         
    
    baslangic_kavsagi = en_yakin_kavsagi_bul(baslangic[0], baslangic[1], G)
    bitis_kavsagi = en_yakin_kavsagi_bul(bitis[0], bitis[1], G)
    
    try:
        rota = nx.shortest_path(G, source=baslangic_kavsagi, target=bitis_kavsagi, weight='weight')
        return jsonify({"durum": "basarili", "koordinatlar": rota})
    except nx.NetworkXNoPath:
        return jsonify({"durum": "hata", "mesaj": "Yol bulunamadı"}), 404

if __name__ == '__main__':
    print("🚀 API Sunucusu Çalışıyor! Frontend bağlantısı bekleniyor...")
    app.run(port=5000)