---
description: Haritaya yeni bir yer ekler
argument-hint: "[yer adı, kategori, koordinat]"
disable-model-invocation: true
---

Kampüs haritasına yeni bir yer ekle. Verilen bilgi: $ARGUMENTS

1. Yer adı, kategori veya koordinat eksikse sor. Koordinat uydurma.
2. Kategori şunlardan biri olmalı: fakulte, yemek, yurt, spor, hizmet, gezi.
3. Dosyada sıra [boylam, enlem] olmalı (boylam yaklaşık 29.9, enlem yaklaşık 39.48).
   Google Maps tersini verir, gerekirse çevir ve bunu söyle.
4. static/data/kampus_hedefler.geojson içinde aynı adda veya çok yakında kayıt var mı bak.
5. Ekleyeceğin satırı göster ve onay iste.
6. Onaydan sonra ekle, dosyanın geçerli JSON olduğunu kontrol et.
   Noktanın yol ağına 150 metreden yakın olduğunu main.py'deki mantıkla doğrula.
7. Commit yapma.
