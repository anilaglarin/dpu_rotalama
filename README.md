# DPÜ Kampüs İçi Rotalama ve Ağ Optimizasyonu 

Bu proje, Kütahya Dumlupınar Üniversitesi (DPÜ) kampüsü içindeki fiziksel konumları birer ağ düğümü (node) ve bağlantı yollarını veri iletim hattı (edge) olarak modelleyen Web tabanlı bir Coğrafi Bilgi Sistemi (WebGIS) uygulamasıdır.

Projenin temel amacı; gerçek harita koordinatları üzerinden alınan fiziksel saha verilerini dijital bir ağ topolojisine dönüştürmek ve iki nokta arasındaki en uygun güzergâhı **Dijkstra Algoritması** kullanarak optimize etmektir.

---

## 🚀 Kullanılan Teknolojiler

Bu sistem, donanım haberleşmesi ve ağ mantığının yazılım dünyasındaki karşılığını simüle etmek amacıyla aşağıdaki teknolojilerle geliştirilmiştir:

- **Backend:** Python, Flask, Flask-CORS
- **Graf ve Rota Hesaplama:** NetworkX (Dijkstra Algoritması)
- **Coğrafi Veri İşleme:** GeoPandas
- **Frontend ve Harita Arayüzü:** HTML/CSS/JS, Leaflet.js
- **Coğrafi Veri Kaynağı (CBS):** QGIS, JOSM, GeoJSON

---

## ⚙️ Sistem Mimarisi ve Çalışma Mantığı

Proje, sadece bir harita üzerinde çizgi çekmekten ziyade, donanımsal bir ağ mimarisinin yazılımla modellenmesi prensibine dayanır:

1. **Veri Toplama ve Düğüm (Node) Modellemesi:** Kampüs içerisindeki yollar ve önemli konumlar QGIS ve JOSM gibi CBS araçları kullanılarak vektörel verilere dönüştürülmüştür. Her bir lokasyon sistemde bir "düğüm", aralarındaki yollar ise fiziksel bir bağlantı (edge) olarak tanımlanmıştır.
2. **Arka Plan (Backend) Haberleşmesi:** Flask tabanlı yerel geliştirme sunucusu, haritadan (istemciden) gelen başlangıç ve bitiş koordinatlarını REST mimarisiyle alır.
3. **Rota Optimizasyonu:** Sunucu tarafında çalışan NetworkX kütüphanesi, gelen konum verilerini graf modellemesi üzerinde işler. Düğümler arası en kısa mesafe Dijkstra algoritması ile hesaplanır.
4. **Görselleştirme:** Hesaplanan en uygun rota, JSON formatında tekrar Leaflet.js arayüzüne iletilir ve kullanıcıya harita üzerinde kesintisiz bir çizgi (güzergâh) olarak gösterilir.

---

## 📁 Proje Yapısı

```
dpu_rotalama/
├── static/
│   ├── data/
│   │   └── kampus_yollar.geojson   # Kampüs yol ağı verisi
│   └── ...                          # CSS, JS ve diğer statik dosyalar
├── templates/
│   └── index.html                   # Leaflet.js harita arayüzü
└── main.py                          # Flask sunucusu ve rota hesaplama API'si
```

---

## 🛠️ Kurulum ve Çalıştırma

Projeyi kendi yerel ortamınızda (localhost) çalıştırmak için aşağıdaki adımları sırasıyla izleyin.

### 1. Gereksinimler

- Python 3.8 veya üzeri
- pip

### 2. Repoyu Klonlayın

Terminalinizi açın ve projeyi bilgisayarınıza indirin:

```bash
git clone https://github.com/anilaglarin/dpu_rotalama.git
```

Proje klasörünün içine girin:

```bash
cd dpu_rotalama
```

### 3. Sanal Ortam Oluşturun (Önerilir)

```bash
python -m venv venv
```

Sanal ortamı etkinleştirin:

**Windows:**
```bash
venv\Scripts\activate
```

**macOS / Linux:**
```bash
source venv/bin/activate
```

### 4. Gerekli Kütüphaneleri Yükleyin

Projenin çalışması için gerekli olan Python paketlerini kurun:

```bash
pip install flask flask-cors geopandas networkx
```

> 💡 `geopandas` kurulumu bazı sistemlerde ek bağımlılıklar (GDAL, Fiona vb.) gerektirebilir. Kurulumda sorun yaşarsanız `conda install geopandas` kullanmanız önerilir.

### 5. Uygulamayı Başlatın

Sistem hazır olduğunda terminal üzerinden sunucuyu ayağa kaldırın:

```bash
python main.py
```

Sunucu başarıyla başladığında terminalde aşağıdaki gibi bir çıktı görürsünüz:

```
🚀 API Sunucusu Çalışıyor! http://127.0.0.1:5000
```

### 6. Uygulamaya Erişin

Tarayıcınızdan aşağıdaki adrese giderek harita arayüzünü açabilirsiniz:

```
http://127.0.0.1:5000
```

---

## 💡 Kullanım

1. Harita üzerinde bir **başlangıç noktası** seçin.
2. Ardından bir **bitiş noktası** seçin.
3. Sistem, `/api/rota` uç noktası üzerinden Dijkstra algoritmasıyla en kısa güzergâhı hesaplar ve harita üzerinde çizer.

---

## 🔌 API

**POST** `/api/rota`

**İstek gövdesi:**
```json
{
  "baslangic": [enlem, boylam],
  "bitis": [enlem, boylam]
}
```

**Başarılı yanıt:**
```json
{
  "durum": "basarili",
  "koordinatlar": [[x1, y1], [x2, y2], "..."]
}
```
