---
description: main'e almadan önce yayın kontrolü yapar (hiçbir şeyi değiştirmez)
---

main branch'i Render'da canlıya gidiyor. güncelleme branch'ini kontrol et.
Hiçbir dosyayı değiştirme, commit, merge veya push yapma.

git PATH'te yoksa %LOCALAPPDATA%\GitHubDesktop\app-*\resources\app\git\cmd\git.exe
yolundaki en yeni sürümü kullan.

1. Commit'lenmemiş değişiklikleri ve main'de olmayan commit'leri listele.
2. Üç GeoJSON dosyasının geçerli olduğunu kontrol et.
3. Flask test istemcisiyle (dosya yazmadan) ana sayfayı, örnek bir rotayı
   ve boş isteğin 400 döndürdüğünü dene.
4. Yeni özellik veya API değişikliği README.md'ye yansımış mı bak.
5. .claude/launch.json dosyasının commit'e girmediğini kontrol et.

Sonucu Türkçe ve kısa ver: "Yayına hazır" veya "Hazır değil", nedenleriyle.
