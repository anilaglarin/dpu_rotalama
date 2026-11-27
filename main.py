import os
import math
import geopandas as gpd
import networkx as nx
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS

print("--- DPÜ Rotalama Motoru Başlatılıyor ---")

# Seçilen konum yol ağına bundan uzaksa kampüs dışı sayılır (metre)
MAKS_UZAKLIK_M = 150

# Flask standart klasör yapısı
app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "static", "data")

def metre_mesafe(a, b) -> float:
    """İki [boylam, enlem] noktası arasındaki yaklaşık mesafe (metre)."""
    ort_enlem = math.radians((a[1] + b[1]) / 2)
    dx = (a[0] - b[0]) * 111320 * math.cos(ort_enlem)
    dy = (a[1] - b[1]) * 110540
    return math.hypot(dx, dy)

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
                    mesafe = metre_mesafe(koordinatlar[i], koordinatlar[i+1])
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
        mesafe = metre_mesafe((hedef_x, hedef_y), dugum)
        if mesafe < en_kisa_mesafe:
            en_kisa_mesafe = mesafe
            en_yakin_dugum = dugum
    return en_yakin_dugum

def koordinat_gecerli_mi(deger) -> bool:
    """Değer [boylam, enlem] biçiminde iki geçerli sayı mı?"""
    if not isinstance(deger, list) or len(deger) != 2:
        return False
    if any(isinstance(s, bool) or not isinstance(s, (int, float)) for s in deger):
        return False
    boylam, enlem = deger
    # NaN ve sonsuz değerler de bu aralık kontrolünden geçemez
    return -180 <= boylam <= 180 and -90 <= enlem <= 90

def hata(mesaj: str, kod: int):
    return jsonify({"durum": "hata", "mesaj": mesaj}), kod

# 2. WEB SAYFASI ROTA TANIMI
@app.route('/')
def ana_sayfa():
    return render_template('index.html')

# 3. ROTA HESAPLAMA API
@app.route('/api/rota', methods=['POST'])
def rota_hesapla():
    try:
        gelen_veri = request.get_json(silent=True)
        if not isinstance(gelen_veri, dict) or 'baslangic' not in gelen_veri or 'bitis' not in gelen_veri:
            return hata("Eksik veri gönderildi", 400)

        baslangic = gelen_veri['baslangic']
        bitis = gelen_veri['bitis']

        if not koordinat_gecerli_mi(baslangic) or not koordinat_gecerli_mi(bitis):
            return hata("Koordinatlar [boylam, enlem] biçiminde iki sayı olmalı", 400)

        baslangic_kavsagi = en_yakin_kavsagi_bul(baslangic[0], baslangic[1], G)
        bitis_kavsagi = en_yakin_kavsagi_bul(bitis[0], bitis[1], G)

        if baslangic_kavsagi is None or bitis_kavsagi is None:
            return hata("Geçerli kavşak noktası bulunamadı", 404)

        for ad, nokta, kavsak in (("Başlangıç", baslangic, baslangic_kavsagi),
                                  ("Bitiş", bitis, bitis_kavsagi)):
            if metre_mesafe(nokta, kavsak) > MAKS_UZAKLIK_M:
                return hata(f"{ad} noktası kampüs yol ağının dışında", 422)

        rota = nx.shortest_path(G, source=baslangic_kavsagi, target=bitis_kavsagi, weight='weight')
        return jsonify({"durum": "basarili", "koordinatlar": rota})
        
    except nx.NetworkXNoPath:
        return hata("Yol bulunamadı", 404)
    except Exception:
        app.logger.exception("Rota hesaplanırken beklenmeyen hata")
        return hata("Sunucuda bir hata oluştu", 500)

if __name__ == '__main__':
    print("🚀 API Sunucusu Çalışıyor! http://127.0.0.1:5000")
    app.run(port=5000)