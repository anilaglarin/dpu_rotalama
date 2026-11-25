// Rota paylaşımı: link, QR kod ve linkten rotayı açma.
// app.js'ten sonra yüklenir ve oradaki değişkenleri kullanır.

let pencere = document.getElementById('paylas-penceresi');
let linkKutusu = document.getElementById('paylas-link');
let konumdanSecimi = document.getElementById('paylas-konumdan');
let qrTuvali = document.getElementById('paylas-qr');
let paylasBilgi = document.getElementById('paylas-bilgi');

// Çizili rota için paylaşılacak adres.
// konumdan=true ise başlangıç yazılmaz: linki açan kendi konumundan başlar.
function paylasimLinki(rota, konumdan) {
    let adres = new URL(window.location.origin + window.location.pathname);

    function ekle(anahtar, koordinatAnahtari, isim, koordinat) {
        if (isim === "Mevcut Konumum") return;   // kişinin konumu linke konmaz
        adres.searchParams.set(anahtar, isim);
        // Aynı isimli noktalar varsa hangisi olduğu da belirtilir
        if (koordinatRehberi[isim].length > 1) {
            adres.searchParams.set(koordinatAnahtari, koordinat.map(s => s.toFixed(6)).join(","));
        }
    }

    if (!konumdan) ekle("nereden", "a", rota.basIsim, rota.basKoor);
    ekle("nereye", "b", rota.bitIsim, rota.bitKoor);
    return adres.toString();
}

function qrCiz(metin) {
    if (typeof qrcode !== "function") return false;   // kütüphane yüklenemedi
    let qr = qrcode(0, 'M');
    qr.addData(metin);
    qr.make();

    let kare = 8, kenar = 4;                          // kare boyu ve beyaz çerçeve
    let adet = qr.getModuleCount();
    qrTuvali.width = qrTuvali.height = (adet + kenar * 2) * kare;
    let cizim = qrTuvali.getContext('2d');
    cizim.fillStyle = "#ffffff";
    cizim.fillRect(0, 0, qrTuvali.width, qrTuvali.height);
    cizim.fillStyle = "#000000";
    for (let satir = 0; satir < adet; satir++) {
        for (let sutun = 0; sutun < adet; sutun++) {
            if (qr.isDark(satir, sutun)) {
                cizim.fillRect((sutun + kenar) * kare, (satir + kenar) * kare, kare, kare);
            }
        }
    }
    return true;
}

// Link ve QR'ı pencereye yerleştirir (rota, tek yer veya işaretli nokta için ortak)
function pencereyiDoldur(link, aciklama) {
    linkKutusu.value = link;
    document.getElementById('paylas-rota').innerText = aciklama;

    let qrVar = qrCiz(link);
    qrTuvali.hidden = !qrVar;
    document.getElementById('paylas-indir').hidden = !qrVar;

    let yerel = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    paylasBilgi.innerText = !qrVar ? "QR kod oluşturulamadı, linki kopyalayabilirsiniz."
        : yerel ? "Deneme ortamı: bu link yalnızca bu bilgisayarda açılır."
        : "";
}

function pencereyiGuncelle() {
    let konumdan = konumdanSecimi.checked;
    let baslangic = konumdan || sonRota.basIsim === "Mevcut Konumum" ? "Açanın konumu" : sonRota.basIsim;
    pencereyiDoldur(paylasimLinki(sonRota, konumdan), `${baslangic} → ${sonRota.bitIsim}`);
}

// Rota dışındaki paylaşımlar: "başlangıç" seçeneği gösterilmez
function paylasimPenceresiniAc({ baslik, aciklama, link }) {
    document.getElementById('paylas-baslik').innerText = baslik;
    konumdanSecimi.closest('label').hidden = true;
    pencereyiDoldur(link, aciklama);
    if (!pencere.open) pencere.showModal();
}

// Rota çizmeden tek bir yeri paylaşır: açan kişi kendi konumundan oraya gider
function yeriPaylas(hedef) {
    let rota = { basIsim: "Mevcut Konumum", bitIsim: hedef.isim, bitKoor: hedef.koordinat };
    paylasimPenceresiniAc({
        baslik: "Yeri paylaş",
        aciklama: hedef.isim,
        link: paylasimLinki(rota, true)
    });
}

document.getElementById('paylas').addEventListener('click', () => {
    if (!sonRota) return;
    if (sonRota.bitIsim === "Mevcut Konumum") {
        durumKutusu.innerText = "Hedef kendi konumunuzken rota paylaşılamaz";
        vurgula(durumKutusu);
        return;
    }
    // Hedef işaretlenmiş bir noktaysa o noktanın linki paylaşılır
    if (ozelNokta && sonRota.bitIsim === ozelNokta.anahtar) {
        noktayiPaylas();
        return;
    }
    document.getElementById('paylas-baslik').innerText = "Rotayı paylaş";
    konumdanSecimi.closest('label').hidden = false;
    // Başlangıç zaten mevcut konumsa (veya işaretli noktaysa) seçenek anlamsız
    let konumdanBasliyor = sonRota.basIsim === "Mevcut Konumum" ||
        Boolean(ozelNokta && sonRota.basIsim === ozelNokta.anahtar);
    konumdanSecimi.checked = konumdanBasliyor;
    konumdanSecimi.disabled = konumdanBasliyor;
    pencereyiGuncelle();
    pencere.showModal();
});

konumdanSecimi.addEventListener('change', pencereyiGuncelle);
document.getElementById('paylas-kapat').addEventListener('click', () => pencere.close());
// Pencerenin dışına dokununca kapanır
pencere.addEventListener('click', e => { if (e.target === pencere) pencere.close(); });

document.getElementById('paylas-kopyala').addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(linkKutusu.value);
        paylasBilgi.innerText = "✓ Link kopyalandı";
    } catch (err) {
        linkKutusu.select();
        paylasBilgi.innerText = "Link seçildi, kopyalayabilirsiniz.";
    }
    vurgula(paylasBilgi);
});

// Telefonun paylaşım menüsü (WhatsApp vb.) yalnızca destekleniyorsa gösterilir
let menuDugmesi = document.getElementById('paylas-menu');
menuDugmesi.hidden = !navigator.share;
menuDugmesi.addEventListener('click', () => {
    navigator.share({ title: "DPÜ Kampüs Rotası", url: linkKutusu.value }).catch(() => {});
});

document.getElementById('paylas-indir').addEventListener('click', () => {
    let baglanti = document.createElement('a');
    baglanti.download = "dpu-rota-qr.png";
    baglanti.href = qrTuvali.toDataURL("image/png");
    baglanti.click();
});

// --- Linkten açma: ?nereden=...&nereye=... ---
function linktekiHedef(isim, koordinatYazisi) {
    if (!isim) return null;
    // Yalnızca haritadaki gerçek yerler kabul edilir
    let ayni = hedefler.filter(h => aramaIcinSadelestir(h.isim) === aramaIcinSadelestir(isim));
    if (ayni.length === 0) return null;

    let [boylam, enlem] = (koordinatYazisi || "").split(",").map(Number);
    if (!Number.isFinite(boylam) || !Number.isFinite(enlem)) {
        return { isim: ayni[0].isim, koordinat: null };
    }
    let uzaklik = h => map.distance([enlem, boylam], [h.koordinat[1], h.koordinat[0]]);
    let enYakin = ayni.sort((x, y) => uzaklik(x) - uzaklik(y))[0];
    return { isim: enYakin.isim, koordinat: enYakin.koordinat };
}

function kutuyuDoldur(input, secim) {
    input.value = secim.isim;
    if (secim.koordinat) pinSecimi.set(input, secim.koordinat);
}

function linktenAc() {
    let parametreler = new URLSearchParams(window.location.search);
    let nereden = parametreler.get("nereden");
    let nereye = parametreler.get("nereye");
    if (!nereden && !nereye) return;

    let bas = linktekiHedef(nereden, parametreler.get("a"));
    let bit = linktekiHedef(nereye, parametreler.get("b"));
    if ((nereden && !bas) || (nereye && !bit)) {
        durumKutusu.innerText = "Linkteki yer bulunamadı. Lütfen listeden seçin.";
    }
    if (bas) kutuyuDoldur(baslangicInput, bas);
    if (bit) kutuyuDoldur(bitisInput, bit);

    if (bas && bit) {
        rotaCiz();
    } else if (bit && !nereden) {
        // Yalnızca hedef verilmiş: açanın konumundan başla
        if (koordinatRehberi["Mevcut Konumum"]) {
            baslangicInput.value = "Mevcut Konumum";
            rotaCiz();
        } else {
            konumBekleyenHedef = bit.isim;
            durumKutusu.innerText = `Hedef: ${bit.isim}. Konum bekleniyor; isterseniz başlangıcı seçin.`;
        }
    } else if (bas && !nereye) {
        durumKutusu.innerText = `Buradasınız: ${bas.isim}. Şimdi hedefi seçin.`;
    }
}

// Konum sonradan gelirse bekleyen rota çizilir
let konumBekleyenHedef = null;
map.on('locationfound', () => {
    if (!konumBekleyenHedef) return;
    let hedef = konumBekleyenHedef;
    konumBekleyenHedef = null;
    // Kullanıcı bu arada başka seçim yaptıysa dokunma
    if (!baslangicInput.value && bitisInput.value === hedef) {
        baslangicInput.value = "Mevcut Konumum";
        rotaCiz();
    }
});

hedeflerHazir.then(linktenAc);
