# DPÜ Rotalama

Kampüs içi rota uygulaması. Genel bilgi README.md'de.

## Amacım
Yalnızca proje çıkarmak değil, Claude Code'u iyi kullanmayı öğrenmek.

## Komutlar
- Kurulum: `pip install -r requirements.txt`
- Çalıştırma: `python -X utf8 main.py` → http://127.0.0.1:5000
- Otomatik test yok.

## Mimari
- `main.py`: Flask. Açılışta `kampus_yollar.geojson` dosyasından NetworkX grafiği kurar,
  `POST /api/rota` en kısa yolu döndürür. Yol verisi değişirse sunucu yeniden başlatılır.
- `templates/index.html` + `static/`: düz HTML/CSS/JS ve Leaflet, derleme adımı yok.
- JS yükleme sırası önemli: `app.js` (harita, rota) → `paylas.js` (link, QR) → `nokta.js` (nokta işaretleme).

## Kurallar
- Koordinat sırası her yerde [boylam, enlem].
- Arayüz metinleri Türkçe. Değişiklikler telefon görünümünde de çalışmalı.
- Yeni özellik veya API değişikliğinde README.md güncellenir.

## Çalışma şekli
- Önce planı göster, onaylamadan kod yazma. Büyük işi küçük görevlere böl.
- Değişiklikten sonra farkı (diff) ve neden bu yolu seçtiğini anlat; alternatifini de söyle.
- Anladığımı görmek için bana kısa bir kontrol sorusu sor.
- Sunucu davranışı değişirse test yaz veya öner ve çalıştır; sonucu olduğu gibi bildir.
- Her küçük görevden sonra commit öner. Konuşma çok uzadıysa yeni oturum öner.

## Git ve yayın
- Çalışma `güncelleme` branch'inde yapılır. `main` Render'da canlıya gider.
- `main`'e dokunma. Commit ve push yalnızca ben isteyince yapılır.
- PowerShell'de `git` yok; GitHub Desktop içindeki git.exe kullanılır.
- `.claude/launch.json` commit'e eklenmez.
- Commit'lik bir iş bitince veya commit istendiğinde Türkçe, kısa ve ne yapıldığını anlatan bir
  commit başlığı öner (geri alırken ne yaptığımı görmek istiyorum).

## Öğrenme oturumları
- Claude Code öğrenmeye devam ederken önce OGRENME-NOTLARI.md dosyasını oku (yalnızca yerelde).
