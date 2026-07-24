import os
import math
import geopandas as gpd
import networkx as nx
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

print("--- DPÜ Rotalama Motoru Başlatılıyor ---")

# Flask standart klasör yapısı
app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data")

# 1. VERİLERİ OKUMA VE AĞ KURULUMU
def ag_olustur() -> nx.Graph:
    ag = nx.Graph()
    try:
        yol_dosyasi = os.path.join(DATA_DIR, "kampus_yollar.geojson")
        yollar = gpd.read_file(yol_dosyasi)
        for _, row in yollar.iterrows():
            geometri = row['geometry']
            if not geometri:
                continue
            
            if geometri.geom_type == 'MultiLineString':
                cizgiler = list(geometri.geoms)
            elif geometri.geom_type == 'LineString':
                cizgiler = [geometri]
            else:
                continue
                
            for cizgi in cizgiler:
                koordinatlar = list(cizgi.coords)
                for i in range(len(koordinatlar) - 1):
                    mesafe = math.dist(koordinatlar[i], koordinatlar[i+1])
                    ag.add_edge(koordinatlar[i], koordinatlar[i+1], weight=mesafe)
                    
        print(f"--- Harita Ağı Hazır! Toplam Kavşak: {ag.number_of_nodes()} ---")
    except Exception as e:
        print(f"Ağ oluşturulurken hata: {e}")
    
    return ag

G = ag_olustur()

def en_yakin_kavsagi_bul(hedef_x: float, hedef_y: float, ag: nx.Graph):
    en_kisa_mesafe = float('inf')
    en_yakin_dugum = None
    for dugum in ag.nodes():
        mesafe = math.dist((hedef_x, hedef_y), dugum)
        if mesafe < en_kisa_mesafe:
            en_kisa_mesafe = mesafe
            en_yakin_dugum = dugum
    return en_yakin_dugum

# 2. WEB SAYFASI ROTA TANIMI
@app.route('/')
def ana_sayfa():
    return render_template('index.html')

# 3. ROTA HESAPLAMA API
@app.route('/api/rota', methods=['POST'])
def rota_hesapla():
    try:
        gelen_veri = request.get_json()
        if not gelen_veri or 'baslangic' not in gelen_veri or 'bitis' not in gelen_veri:
            return jsonify({"durum": "hata", "mesaj": "Eksik veri gönderildi"}), 400

        baslangic = gelen_veri['baslangic'] 
        bitis = gelen_veri['bitis']         
        
        baslangic_kavsagi = en_yakin_kavsagi_bul(baslangic[0], baslangic[1], G)
        bitis_kavsagi = en_yakin_kavsagi_bul(bitis[0], bitis[1], G)
        
        if not baslangic_kavsagi or not bitis_kavsagi:
            return jsonify({"durum": "hata", "mesaj": "Geçerli kavşak noktası bulunamadı"}), 404

        rota = nx.shortest_path(G, source=baslangic_kavsagi, target=bitis_kavsagi, weight='weight')
        return jsonify({"durum": "basarili", "koordinatlar": rota})
        
    except nx.NetworkXNoPath:
        return jsonify({"durum": "hata", "mesaj": "Yol bulunamadı"}), 404
    except Exception as e:
        return jsonify({"durum": "hata", "mesaj": str(e)}), 500

if __name__ == '__main__':
    print("🚀 API Sunucusu Çalışıyor! http://127.0.0.1:5000")
    app.run(port=5000)