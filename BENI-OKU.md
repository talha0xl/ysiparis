# YSipariş — Kurulum

Garsonlar telefondan sipariş girer, kasadaki laptopa bağlı USB fiş yazıcısından fiş otomatik çıkar.

## 1. Veritabanı (bir kere, 2 dakika)

1. Supabase'te menü sitesinin projesini aç (ya da yeni proje).
2. Soldan **SQL Editor → New query**.
3. `kurulum.sql` dosyasının **tamamını** yapıştır, **Run**'a bas. "Success" görmen yeterli.

**Her yeni sürümde bu dosyayı tekrar çalıştır**; yeni özellikleri ekler, verileri silmez. Bütün tablolar `ads_` ile başlar, menü sitesinin tablolarına dokunmaz. Dosyayı tekrar çalıştırmak güvenlidir, veriyi silmez.

## 2. Bağlantı bilgisi

`config.js` dosyasını Not Defteri ile aç, iki satırı doldur:

- `SUPABASE_URL` → Supabase **Project Settings → API** sayfasındaki *Project URL*
- `SUPABASE_KEY` → aynı sayfadaki *anon / public* key

(Menü sitesinde kullandığın bilgilerin aynısı.)

## 3. Yayınlama

Menü sitesinde yaptığın gibi: Vercel'de **Add New → Project**, `adisyon` klasörünü sürükle bırak. Çıkan adresi not et (örn. `yavuzturk-adisyon.vercel.app`).

## 4. İlk giriş

- Kullanıcı adı: **admin** — Şifre: **1234**
- Girer girmez **☰ → Yönetim → Garsonlar**'dan kendi hesabını aç, adını ve şifreni değiştir.
- **Garsonlar**: her garsona kullanıcı adı + şifre aç.
- **Menü**: "Toplu Ekle"ye her satıra `Kategori ; Ürün ; Fiyat` yaz. Her hafta menü değişince "Mevcut menüyü sil" kutusunu işaretleyip yeni listeyi yapıştırman yeterli. Biten ürünün "Satışta" kutusunu kapat.
- **Masalar**: ekle, sil, adını değiştir (kutuya yaz, dışarı dokun). Masa ekranındaki ✏️ ile de değişir.
- **Ayarlar**: fiş genişliği **58 / 80 mm**, iptal yetkisi, fiş alt yazısı.

## 5. Kasa laptopu ve yazıcı

1. Yazıcının sürücüsünü kur, yazıcıyı USB ile tak.
2. Windows **Ayarlar → Yazıcılar**: fiş yazıcısını **varsayılan yazıcı** yap. "Windows varsayılan yazıcımı yönetsin" seçeneğini kapat.
3. Yazıcının **Yazdırma tercihleri**'nde kâğıt boyutunu rulo genişliğine göre (58 veya 80 mm) seç.
4. `Adisyon Kasa.bat` dosyasını Not Defteri ile aç, `SITE=` satırına site adresini yaz, kaydet. Masaüstüne koy.
5. Etkinlikte bu dosyaya çift tıkla → admin ile giriş yap → **▶ Başlat** → **Deneme Fişi**.

Bu dosyayla açılan Chrome, fişleri **onay penceresi çıkmadan** direkt basar. Normal Chrome'dan açarsan her fişte yazdırma penceresi çıkar.

**Dikkat:**
- Kasa penceresini kapatma, simge durumuna küçültme, laptopu uykuya alma (Güç ayarlarından uykuyu kapat).
- İnternet giderse siparişler kaybolmaz; bağlantı gelince sıradaki fişler basılır.
- Fiş kaçarsa kasa ekranındaki "Son fişler" listesinden **Tekrar bas**.

## 6. Garsonlar

Site adresini telefonda açıp **Ana ekrana ekle** yapsınlar, uygulama gibi açılır.

Masa seç → ürünlere dokun → **Sepete Git** → gerekirse not ekle → **Siparişi Geç** → fiş kasadan çıkar.

**Hesap** sekmesi: ödeme al (nakit / kart / ikram / indirim, ½ ⅓ ¼ veya kişiye bölme, para üstü), hesap fişi, masa taşı/birleştir, hesabı kapat. Ürüne dokunarak iptal (yetki ayarına göre).

## 7. Paket, personel ve garson ikramı

- **Paket:** Masalar ekranında üstteki **📦 Paket** ya da alttaki **+ Yeni Paket**. Müşteri adını/telefonunu yaz, masa gibi sipariş gir. Fişin başında ve sonunda kocaman **PAKET** yazar. Hesap kapanınca paket listeden kalkar.
- **Notlar:** Sepette her ürünün altında **+ Not ekle** (Acısız, Soğansız gibi hazır seçenekler var; 2 adetten sadece 1'ine de yazılabilir). Ayrıca **Bütün siparişe not** eklenebilir. Notlar fişte çerçeve içinde, kalın ve büyük çıkar.
- **Personel hesabı:** Hesap sekmesinde **👤 Personel hesabı** butonu. Basınca hesap 0,67 ile çarpılır (%33). Oranı Ayarlar'dan değiştirebilirsin.
- **Garson hediye ikramı:** Yönetim › Garsonlar › garsonu aç › **Hediye ikram hakkı** (örn. 400). Garson yediği hesabı öderken ödeme türü **Garson ikramı** seçilir, kimin hakkından düşüleceği seçilir. Hakkı biten garsondan fazlası düşülmez. Yeni etkinlikte "Herkesin hediye hakkını yenile" ile sıfırla.

## 8. Bölümler (reyon)

Yönetim › Masalar'da her masanın yanındaki **Bölüm** kutusuna "Aile", "Bahçe" gibi yaz. Sonra Yönetim › Garsonlar'da garsonu açıp hangi bölümlere bakacağını seç. Garson sadece o bölümün masalarını görür, başka bölüme sipariş de giremez. Bölüm seçilmeyen garson ve yöneticiler bütün masaları görür. Paketleri herkes görür.

## 9. Fiş bölme

Yönetim › Ayarlar › **Sipariş fişi nasıl çıksın?**
- **Hepsi tek fişte:** 3 fish finger + 1 helva = 1 fiş
- **Her ürün ayrı fiş:** = 2 fiş (3 fish finger bir fişte, helva ayrı fişte)
- **Her adet ayrı fiş:** = 4 fiş

Bölünmüş fişlerde "SİPARİŞ #12 (2/4)" yazar, hangi siparişin kaçıncı fişi olduğu belli olur.

## 10. Karanlık mod

☰ menüsünde **🌙 Karanlık mod / ☀️ Aydınlık mod**. Her telefon kendi seçimini hatırlar; seçilmezse telefonun ayarına uyar.

## 11. Gün sonu ve Excel

**☰ → Gün Sonu**: tarih aralığı seç (Bugün / Dün / Son 7 gün / Bu ay ya da elle). Satış, nakit/kart, ikram, personel indirimi, garson ikramları, paketler, iptaller, ürün ve garson dağılımı. Garsona dokununca hangi üründen kaç tane sattığı açılır.

Gece yarısını geçen satışlar o geceye sayılır (gün sabah 05:00'te başlar), Çarşamba gecesi bölünmez.

**📊 Excel indir** şu sayfaları içeren bir dosya verir: Özet, Ürünler, Garsonlar, Garson-Ürün, Hesaplar, Satış Detayı (her satır tek tek), İptaller. **🖨️ Fiş bas** ile rapor fişi alınır.

**Gün sonu düzeltme:** "Kapanan hesaplar" listesinde hesaba dokun:
- Ürünün yanındaki **İptal** ile yanlış girilen ürünü (ya da birkaç adedini) iptal et. Tutar o hesabın ödemelerinden düşülür, rapor kendiliğinden düzelir.
- **Hesabı tamamen iptal et:** bütün hesap rapordan çıkar.
- **Masaya geri aç:** yanlışlıkla kapatılan hesabı tekrar açar.
Bu işlemlerde fiş basılmaz, sadece yönetici yapabilir.

## 12. Haftalık karşılaştırma

**☰ → 📈 Haftalık Karşılaştırma**: son 4 / 8 / 12 / 26 etkinlik gecesi yan yana. Her gecenin satışı çubuk grafikle, bir önceki geceye göre % artış/azalış, en iyi gece, ortalama gece. Altında gece gece özet tablo, ürünlerin ve garsonların hafta hafta adet/tutar tablosu (yeşil = o satırın en iyi gecesi). **📊 Excel** ile hepsini indirebilirsin.

## 13. Detaylı döküm (her şeyin kaydı)

**☰ → 🔎 Detaylı Döküm.** Sistemde yapılan her işlem saniyesiyle kayıtlıdır: kim giriş yaptı, kim hangi masaya hangi ürünü kaçta girdi, kim neyi kaçta iptal etti (siparişi kimin girdiği ve siparişten kaç dakika sonra iptal edildiği dahil), ödemeler, silinen ödemeler, masa taşıma, personel indirimi, hesap açma/kapama, gün sonu düzeltmeleri.

- **🕑 Hareketler:** Zaman sırasıyla liste. Türe (Sipariş / İptal / Ödeme / Hesap / Giriş), garsona, bölüme, masaya, ürüne göre filtrele ya da ara. Satıra dokununca bütün ayrıntıları açılır; "Bu hesabın bütün hareketleri" ile bir masanın hikâyesini baştan sona görürsün.
- **▦ Çapraz tablo:** Uygulama içinde pivot. Satır, sütun ve değeri sen seçersin (örn. Garson × Ürün adet, Saat × Ürün, Bölüm × Garson ₺, İptaller, Kim ne yaptı). "Bu tabloyu Excel'e" ile o tabloyu indirirsin.

## 14. Dışa aktarma formatları

Gün Sonu ya da Detaylı Döküm'de **📥 Excel / CSV**:
- **📘 Yönetici raporu:** Biçimli, yazdırmaya hazır Excel. Özet, Ürünler, Garsonlar (açtığı hesap, net satış, aldığı ödeme, iptaller, ilk/son sipariş saati), Garson × Ürün, Bölüm × Garson, Saatlik, Hesaplar, İptaller (kim / ne zaman / neden / siparişi giren), Ödemeler.
- **🧮 Ham veri + PivotTable:** Gerçek Excel PivotTable (alanları sürükleyip istediğin raporu kurarsın), satır satır satış verisi ve bütün hareketlerin tam listesi (Excel Tablosu, filtreli).
- **📦 İkisi bir arada:** hepsi tek dosyada.
- **📄 CSV:** Her hareket bir satır; Excel, Google Sheets, Power BI vb. için.

Excel PivotTable'ı açınca uyarı verirse: "Tüm Hareketler" sayfasında tabloya tıkla › Ekle › PivotTable ile 3 tıkta kendin kurabilirsin.

## 15. Stok

Yönetim › Menü'de her ürünün yanında **Stok** kutusu var. Boş bırakırsan stok takip edilmez. Sayı yazarsan:
- Her siparişte düşer, iptal edilince geri eklenir.
- Garsonların ekranında ürünün altında "Stok: 7" yazar; Ayarlar'daki sınırın (varsayılan 10) ve altındaysa **kırmızı** görünür.
- 0 olunca ürün listede kalır ama "STOK BİTTİ" yazar ve sipariş girilemez. Aynı anda iki garson son ürünü almaya çalışırsa sistem sadece birine izin verir.
- **Tükendi** kutusu: stok sayısına bakmadan ürünü hemen kapatır, ürün "TÜKENDİ" yazısıyla görünür.
Garson ekranları değişikliği kendiliğinden, sayfayı yenilemeden görür.

Toplu eklemede stok da yazılabilir: `Tatlı ; Helva ; 60 ; 40`

## 16. Gün sonu: otomatik / manuel

Ayarlar › **Gün sonu**:
- **⏱ Otomatik:** Gün her gün seçtiğin saatte (öneri 05:00) kendiliğinden kapanır. Gün Sonu sayfasındaki **🖨️ Gün Sonu Fişi** ile o günün raporu tek tuşla kasadan çıkar.
- **🔒 Manuel:** Gün, Gün Sonu sayfasındaki **Gün Sonunu Al** tuşuna basana kadar sürer. Basınca: gün kapanır, gün sonu fişi kasadan çıkar (istersen Excel de iner), yeni gün başlar. Açık masa varsa uyarır; o hesaplar kapandıkları güne yazılır. Önceki gün sonları sayfanın üstünde listelenir, birine dokununca o günün raporu açılır.

## 17. Garson hediye ikramı kuralı

Ayarlar › **Garson hediye ikramı**:
- **Herkes sadece kendi hakkını kullanabilir** (varsayılan): ödeme ekranında sadece giriş yapan kişinin hakkı çıkar; başkasınınki seçilemez (sunucu da engeller).
- **Yönetici herkesinkini seçebilir:** garsonlar yine sadece kendi hakkını, yönetici istediğini seçer.
- "Hediye hakları her yeni günde yenilensin" açıksa haklar her gün (manuelde her gün sonunda) baştan başlar.

## 18. Otomatik yedek (Google Drive + e-posta)

Her gün kapanınca (otomatik modda ayarlanan saatte, manuelde "Gün Sonunu Al"dan sonra) en geç 15 dakika içinde:
- Google Drive'da **Yavuztürk Adisyon Yedekleri** klasörüne o günün tablosu kaydedilir (Özet, Ürünler, Garsonlar, İptaller, Ödemeler, Tüm Hareketler).
- E-postana özet (kasa, en çok satanlar, garsonlar, iptaller) + **Excel eki** gelir.

**Kurulum (bir kere, ~3 dk, bilgisayardan):**
1. Uygulamada Yönetim › Ayarlar › en alttaki **☁️ Otomatik yedek** › **Otomatik yedeği kur**.
2. E-postanı yaz › **Kodu hazırla** › **📋 Kodu kopyala**.
3. **script.google.com** › **Yeni proje** › oradaki kodu sil, yapıştır › **💾 Kaydet**.
4. Üstte **kurulum** seçiliyken **▶ Çalıştır** › izin ver (Gelişmiş › "… projesine git" › İzin ver).
5. "Otomatik yedek kuruldu" maili gelir. Hemen örnek görmek istersen **simdiDene**'yi çalıştır.

Ayarlar'daki kartta son yedekler ve Drive bağlantıları görünür. Bir günün yedeği gecikirse orada uyarı çıkar. Kodun içinde gizli bir anahtar var; kodu yeniden alırsan eskisi çalışmaz. Google bu işi ücretsiz yapar (günde 100 e-posta sınırı var, bize günde 1 yeter).

## 19. Kapasite

20+ garson aynı anda sorunsuz kullanabilir. Siparişler, stok düşümü ve masa açma sunucuda kilitli yapılır; iki garson aynı masaya ya da son ürüne aynı anda basarsa çakışma olmaz. Ekranlar değişiklikleri anlık alır (Supabase Realtime); bağlantı koparsa birkaç saniyede bir kendini yeniler.

## 20. Menü / kategori yönetimi

Yönetim › **Menü** artık kategori kategori düzenli. Her kategorinin kendi bloğu var:

- **+ Kategori Ekle:** ad ver, sırasını ve yazıcı istasyonunu seç. Boş kategori de açabilirsin, ürünü sonra eklersin.
- **+ (kategori) kategorisine ürün ekle:** ürünü doğrudan o kategorinin altına ekler. Ürün penceresinde kategoriyi değiştirebilir, "**+ Yeni kategori…**" ile oracıkta yeni kategori de açabilirsin.
- **⚙︎ (dişli):** kategoriyi düzenle — adını değiştir (ürünler otomatik taşınır), istasyonunu değiştir, **gizle/göster**, ya da **sil** (silerken ürünler "Genel"e taşınır, kaybolmaz).
- **↑ ↓:** kategori sırasını değiştir. Garson ekranında ve müşteri menüsünde bu sırayla görünür.
- **Kategori gizleme:** bir kategoriyi gizlersen (örn. "Balıklar") hem garson ekranından hem müşteri menüsünden kalkar, **ürünler silinmez** — tekrar göster deyince geri gelir.

"Toplu Ekle" eskisi gibi çalışır; yazdığın kategoriler yoksa otomatik oluşturulur.

## 21. Yazıcılar / istasyonlar (sade anlatım)

**İstasyon = fişin çıkacağı yer.** Örn. Balık Mutfağı, Tatlı, Bar, Izgara. İstediğin kadar ekleyebilirsin (Yönetim › Ayarlar › Yazıcılar › **+ Yazıcı istasyonu ekle**; × ile silinir).

Mantık üç adım:
1. **İstasyonları yaz** (Ayarlar). Mesela Mutfak, Tatlı, Bar.
2. **Her kategoriyi bir istasyona bağla** (Menü › kategorinin ⚙︎'ü › "Hangi yazıcıdan çıksın?"). Orada "+ Yeni istasyon ekle…" ile anında yenisini de açabilirsin.
3. Sipariş gelince sistem ürünleri **istasyonlarına göre ayırır**, her istasyonun fişi ayrı çıkar. Fişin başında `» BALIK MUTFAĞI «` yazar.

**Kaç yazıcı kuracağına göre:**
- **Tek yazıcı:** hiçbir şeyi değiştirme. Bütün fişler o yazıcıdan çıkar, başındaki istasyon adından kimin alacağı belli olur.
- **Her tezgâhta ayrı yazıcı:** her yazıcıya bir bilgisayar/laptop bağla, `Adisyon Kasa.bat` ile aç. Kasa ekranında **"Bu kasa basıyor: … › Değiştir"** ile o bilgisayarın istasyonunu seç (örn. sadece Tatlı). O kasa sadece kendi fişlerini basar. (Bir bilgisayar birden fazla istasyona da bakabilir.)

Not: Chrome'un sessiz yazdırması bir bilgisayardan sadece **varsayılan yazıcıya** basabilir. O yüzden "4 farklı yazıcıdan çıksın" için 4 bilgisayar/laptop gerekir; her birinde kendi yazıcısı varsayılan olur.

Hesap fişi, rapor ve deneme fişi istasyona bakmaz, her kasadan çıkar. İptal fişi, iptal edilen ürünün istasyonuna gider. Silinen istasyonun kategorileri otomatik olarak ilk istasyona taşınır.

## 22. Müşteri QR menüsü (ayrı sayfa, sipariş yok)

Masaya koyduğun QR'ı müşteri okutunca **ayrı bir menü sayfası** açılır; sadece görür, **sipariş veremez**. Aynı Supabase'i kullanır, ayrı veri girişi yok: sen Yönetim › Menü'den bir ürünü/kategoriyi kapatınca müşteri menüsünden de anında (en geç 30 sn) kalkar, stok bitince "Tükendi" yazar.

`menu.html` ve `qrcode.min.js` **yeni dosyalar** — zip'in içinde var, Vercel'e `adisyon` klasörünü tekrar yükleyince ikisi de gider. Menü adresi senin siten + `/menu.html` olur.

**QR oluşturma:** Uygulamada **☰ → 🔳 Müşteri Menüsü / QR**:
- Tek QR'ı ekrandan gösterir, **adresi kopyala** ya da **Önizle**.
- **🖨️ Masalar için QR kartları yazdır:** her masa için üstünde masa adı yazan ayrı birer QR kartı çıkar. Kes, masalara koy. Hepsi aynı menüyü açar; masa adı sadece görüntü içindir (müşteri sipariş veremediği için masa seçmesine gerek yok).

Menü sayfası telefona göre tasarlı, karanlık modu destekler, kategori şeridi yukarıda sabit durur, altında "Sipariş için lütfen garsonu çağırın." yazar.

## 23. Fiş tasarımı (fişi özelleştir)

**☰ → 🧾 Fiş Tasarımı** (ya da Ayarlar'daki "Fişi özelleştir" tuşu). Solda seçenekler, sağda **canlı önizleme**: bir şeyi değiştirdiğin an fiş değişir. Sipariş / Hesap / İptal fişi ayrı ayrı görünür.

- **Genel:** yazı boyutu (küçük → çok büyük), yazı tipi (daktilo / düz), ayırıcı çizgi (kesik, düz, yıldızlı, çizgisiz).
- **Sipariş fişi:** en üste/en alta ek yazı, masa adı ve ürün boyutu; istasyon adı, sipariş no, garson, saat, tarih göster/gizle.
- **Hesap fişi:** işletme adı, başlık altına 3 satıra kadar adres/telefon, birim fiyat, garson, tarih, ödeme satırları, alt yazı, ikinci alt yazı (örn. Instagram), en alttaki küçük not ("Mali değeri yoktur" istersen silebilirsin).
- **İptal fişi:** garson ve neden göster/gizle.

**Kaydet**'e basınca bütün kasalar en geç yarım dakikada yeni tasarımı alır. **Bu cihazın yazıcısından dene** tuşu üç örnek fişi o bilgisayarın yazıcısından basar. **Varsayılana dön** ilk haline getirir. Yeni sürümde `kurulum.sql`'i tekrar çalıştırmayı unutma (tasarım için bir sütun ekler).

## 24. Genel Panel (grafikler)

Sağ üstteki **📊 Panel** tuşu (☰ menüsünde de var). Bugün / Dün / Son 7 gün / Bu ay seçip tek bakışta:
- Satış, tahsilat, ortalama hesap, en yoğun saat, iptal kutuları.
- **⏱ Günün yoğunluğu:** hangi saatte kaç sipariş var. Üstten **Sipariş sayısı / Satış tutarı / Ürün adedi** ve **Saatlik / 30 dk** seçilir. Çubuğun üstüne gelince (telefonda dokununca) tam değer çıkar; en yoğun saat vurgulanır ve yazıyla da söylenir ("En yoğun 21:00–22:00"). Garson sayını yoğun saate göre ayarlamak için ideal.
- **Ödeme dağılımı** (nakit / kart / ikram…), **en çok satanlar**, **garsonlar**.
Aynı grafikler **Gün Sonu / Rapor** sayfasında da var. Panel 1 dakikada bir kendini yeniler.

## 25. Yeni görünüm

Bütün site sakin ve sade bir temaya geçti: sıcak krem zemin, deniz yeşili vurgu, yumuşak gölgeler ve geçişler. Karanlık mod da yeni renklere uyar (☰ → Karanlık mod). Müşteri menüsü (QR) yeniden tasarlandı: renkli karşılama, kategori şeridi, **arama**, noktalı fiyat satırları, "Tükendi" rozeti; başlığın altındaki yazıyı ☰ → Müşteri Menüsü / QR sayfasından değiştirebilirsin.

---
Hazırlayan: M. Talha Erbil

## 26. İptalde ürün notu otomatik yazılır
Bir ürüne not eklediysen (örn. "Acılı") ve onu iptal edersen, iptal fişinde ve kayıtlarda (Detaylı Döküm, Gün Sonu, Excel) ürün adının altında **Not: Acılı** otomatik görünür. Hangi ürünün iptal edildiğini elle yazmana gerek yok. Not ekleme özelliği aynen duruyor. **kurulum.sql'i yeniden çalıştır.**

## 27. Sesler (🔊)
☰ menü › **Sesler** (ya da Kasa ekranında "🎵 Ses ayarı", Yönetim › Ayarlar'da "Kasa sesleri").
- Üç olay için ayrı ses seç: yeni sipariş, iptal, hesap/rapor fişi.
- Hazır sesler: Zil, Ding, Servis zili, Melodi, Kasa, Gong, Bip, Çift bip, Alarm, Sessiz.
- **Kendi sesini yükle**: MP3/WAV/OGG, en fazla 500 KB. Yükleyince listeye girer, ▶ ile dinlersin, Sil ile kaldırırsın.
- Ses seviyesi çubuğu vardır; seçtiğin an kaydolur. Sesler Kasa ekranı açık olan bilgisayarda çalar. Kasa ekranındaki "🔔 Ses açık/kapalı" tuşu o bilgisayarı tamamen susturur.
- **kurulum.sql'i yeniden çalıştır** (yeni `ads_sesler` tablosu).

## 28. Stoğu biten ürün müşteri menüsünden gizlenir
Bir ürünün stoğu 0 olunca (ya da Yönetim › Menü'de "tükendi" işaretlenince) QR menüden kendiliğinden kalkar; kategorideki bütün ürünler bitmişse kategori de kalkar. Stok yeniden girilince geri gelir. Menü 30 sn'de bir yenilenir.
Ürünü gizlemek yerine çizili "Tükendi" yazıp göstermek istersen: ☰ › Müşteri Menüsü / QR › "Stoğu biten ürün menüden gizlensin" tuşunu kapat. **kurulum.sql'i yeniden çalıştır.**

## 29. Destek düğmesi
Giriş ekranında "🛟 Giriş yapamıyor musun? Destek" ve ☰ menüde "🛟 Destek" vardır. WhatsApp'a basınca WhatsApp, Gmail'e basınca Gmail hazır mesajla ("Merhaba, yönetici hesabında problem yaşıyorum, yardımcı olur musunuz?" + kullanıcı adı, sayfa, zaman) açılır; göndermeyi kullanıcı yapar. Şifre mesaja yazılmaz. Numara/e-posta: app.js içinde `DESTEK` satırı.

## 30. Yazıcıyı otomatik düzelt (yazici-araclari klasörü)
Kasa bilgisayarında yazıcı fiş basmıyorsa ya da yazıcıyı yeni kurduysan: **`Yazici Duzelt.bat`** dosyasına çift tıkla, "Evet" de (yönetici izni ister). Betik sırayla:
1. Yazdırma servisini yeniler, takılı işleri temizler.
2. "Windows varsayılan yazıcıyı yönetsin" ayarını kapatır.
3. USB'li yazıcıları bulur, çevrimdışı işaretini kaldırır.
4. Birden fazla kopya varsa her birine test sayfası basar, sen "çıktı mı?" diye cevaplarsın.
5. Kağıdı çıkaranı varsayılan yapar, çalışmayan kopyaları (istersen) siler.
Yazıcının USB kablosunu hep aynı girişe tak; başka girişe takarsan Windows yeni kopya açar, bu dosyayı tekrar çalıştır.
İsteğe bağlı: `Adisyon Kasa.bat` içinde `start` satırından önce şu satırı eklersen kasa her açıldığında seçili yazıcı varsayılan yapılır:
`if exist "%LocalAppData%\AdisyonKasa\yazici.txt" for /f "usebackq delims=" %%P in ("%LocalAppData%\AdisyonKasa\yazici.txt") do rundll32 printui.dll,PrintUIEntry /y /n "%%P"`

## 31. Roller ve yetkiler (kim neyi görür / yapar)
Yönetim › **Garsonlar** sekmesi:
- Kişi eklerken/düzenlerken **Rol** seçersin: *Yönetici* (her şeyi yapar), *Garson* (hazır), senin eklediğin roller (örn. Kasiyer, Müdür) ya da **Özel — tek tek seç** (o kişiye yetkileri teker teker verirsin).
- Aşağıdaki **Roller** bölümünden bir role tıklayıp yetkilerini açıp kapatırsın. **Garson** rolünde bir yetkiyi kapatırsan bütün garsonlar o şeyi görmez/yapamaz. **+ Yeni rol ekle** ile kendi hazır rolünü yaparsın. Yönetici rolü değiştirilemez, Garson rolü silinemez.
- Yetkiler: sipariş, paket, masa taşı, hesap/ödeme, indirim-ikram, ürün iptal, hesabı iptal, kapanmış hesap düzeltme, stok, menü, masalar, kasa/yazıcı, rapor, genel panel, gün sonu, ayarlar. Kapalı olanın düğmesi/menüsü o kişiye hiç çıkmaz ve sunucu da engeller (telefondan numara kurcalasa da).
- Hesap ve rol yönetimi sadece Yönetici'dedir, devredilemez.
- Eskiden "İptal yetkisi: bütün garsonlar" seçiliyse yine geçerlidir; artık iptali Garson rolünden de açabilirsin.
- **kurulum.sql'i yeniden çalıştır** (roller tablosu). Mevcut garsonlar otomatik "Garson", yönetici "Yönetici" rolüne bağlanır; hiçbir şey değişmez. Rol değişince kişi sayfayı yenileyince yeni menüsünü görür.

## 32) Temalar 🎨

☰ menüsünden **🎨 Tema** ile açılır. 7 seçenek: Açık, Koyu, **Gül** (gül desenli, pembe-bordo), Orman, Kahve, Yüksek kontrast, Gece.
- **Otomatik (cihazı izle):** telefonun/bilgisayarın açık-koyu ayarına uyar.
- **Gece/gündüz:** 19:00–06:30 arası koyu, gündüz açık.
- Her kişi kendi temasını seçer; seçim o cihazda o kişi için saklanır. Giriş ekranı cihazın varsayılan temasını kullanır.
- Veritabanı değişikliği yok: `kurulum.sql` çalıştırmaya gerek yok, dosyaları Vercel'e yüklemek yeterli.

## 33) Fiş fontları ve logo

Yönetim › Fiş Tasarımı:
- **Yazı tipi:** 11 seçenek (Courier, Arial, Verdana, Tahoma, Trebuchet, Segoe UI, Calibri, Consolas, Georgia, Times, Impact). Fontlar fişi basan bilgisayarda yüklü olmalı; Windows'ta hepsi hazır gelir.
- **Logo:** resmi yükle, otomatik siyah-beyaza çevrilir. Boyut seç, "Koyuluk" çubuğuyla netleştir. Hesap / sipariş / iptal fişinde ayrı ayrı aç-kapa. Basit, kalın çizgili logolar en iyi çıkar.
- Veritabanı değişikliği yok; sadece dosyaları Vercel'e yükle.

## 34) Ürün fotoğrafı, logo, titreşim, ürüne göre ödeme

**Önce Supabase'te `kurulum.sql`'i bir kez çalıştır** (yeni tablo ve alan ekler), sonra dosyaları Vercel'e yükle.

- **Ürün fotoğrafı:** Yönetim › Menü › ürüne dokun › "Fotoğraf seç". Kare kırpılıp küçültülür. Müşteri QR menüsünde ürünün solunda görünür. Fotoğrafsız ürünler eskisi gibi.
- **Logo:** Yönetim › Fiş Tasarımı › Logo. Bir kez yükle; fişte siyah-beyaz, giriş ekranında ve QR menünün başında renkli görünür.
- **Titreşim:** dokununca kısa, başarıda çift, hatada uzun titreşim. ☰ › 🎨 Tema'dan kapatılır. Sadece Android'de çalışır (iPhone desteklemez), cihaza özeldir.
- **Ürüne göre ödeme:** Ödeme Al › "🍽 Ürüne göre": kimin ne yediğini seç, tutar otomatik yazılır. Sonraki ödemede ödenen ürünler "✓ ödendi" görünür (bu bilgi o cihazda tutulur).

## 35) Yavuztürk Süleymaniye logosu (hazır gömülü)

Logo siteyle birlikte gelir: `logo.png` (renkli, giriş ekranı ve QR menü) ve `logo-fis.png` (siyah-beyaz, hesap fişi). Yüklemen gerekmez. Başka logo kullanmak istersen Yönetim › Fiş Tasarımı › Logo'dan yüklersin, o öncelik alır. Fişte logo varken "İşletme adı başlıkta görünsün" kutusunu kapatırsan isim iki kez yazılmaz.

## 36) YSipariş adı, menü yazıları, yumuşak geçişler

- Uygulamanın adı **YSipariş** oldu (giriş ekranı: "YSipariş'e hoş geldiniz", sekme başlığı). Yedek klasörünün adı (Google Drive) bozulmasın diye aynı kaldı.
- **Menü yazıları:** Yönetim › QR Menü › "Menünün üstündeki yazılar". Küçük başlık (örn. "Çarşamba Balık Akşamı") ve alt yazı (örn. "Bu akşam tavuk günü") istediğin zaman değişir; müşteri menüsünde anında güncellenir. **Supabase'te `kurulum.sql`'i bir kez çalıştır** (yeni alan ekler).
- Sayfa geçişlerinde içerik ve kartlar yumuşakça süzülerek gelir.

- **Menüde işletme adı:** Yönetim › QR Menü › "İşletme adı" alanı. Sadece müşteri menüsü ve QR kartlarında görünen adı değiştirir; boşsa fişteki işletme adı kullanılır. `kurulum.sql`'i yine bir kez çalıştır.

## 37) Yeni ☰ menü ve kontrol turu düzeltmeleri

- ☰ artık sağdan açılan bir çekmece: üstte adın ve rolün, altta **Servis / Raporlar / Ayarlar** grupları kare düğmeler hâlinde, en altta Tema, Destek, Çıkış. Bulunduğun sayfa vurgulu. Boşluğa dokununca ya da Esc ile kapanır. Herkes sadece yetkisi olanları görür.
- Ürüne göre ödemede aynı ürünler tek satırda toplanır ("5 Fish Finger"), "Hepsi" düğmesi var.
- Fişte logo, yazdırmadan önce yüklenmesi beklenerek basılır (ilk fişte boş çıkmaz).
- Yönetim › Menü'de dar ekranda ürün adı ile stok kutusu artık üst üste binmez.
- Küçük telefonlarda (320 px) Yönetim sekmeleri ve Fiş Tasarımı sayfası taşmaz.
- Koyu temada dolu masaların yazısı daha okunaklı; "Ses seviyesi %80" yazımı düzeldi; hesap kapanınca bölme notu temizlenir.

## 38) Menü şablonları ve bağlantı uyarısı

**Supabase'te `kurulum.sql`'i bir kez çalıştır** (şablon tablosu ekler).

- **Menü şablonları:** Yönetim › Menü › "📋 Menü şablonları". Menüyü o haftaya göre hazırla (ürünleri aç/kapat, fiyatları gir, QR menü yazılarını yaz), bir ad verip kaydet ("Balık günü"). Sonraki hafta "Uygula" de: o ürünler satışa açılır, fiyatlar ve QR menü yazıları geri gelir, şablonda olmayan ürünler satıştan kalkar (silinmez). Stok sayıları değişmez, "tükendi" işaretleri sıfırlanır. ↻ ile bir şablonu menünün şu anki hâliyle güncellersin.
- **Bağlantı uyarısı:** internet giderse ekranın üstünde ince kırmızı bir şerit çıkar ve telefon titrer; üst düğmeler kapanmaz. Sepet kaybolmaz. Bağlantı gelince şerit yeşile döner ve kaybolur.

- ☰ menü ve pencereler açılırken kasma giderildi: arkadaki buzlu cam bulanıklığı (telefonu en çok yoran şey) kaldırıldı, menü daha hafif animasyonla açılıyor.

## 39) Düzeltmeler (21 Ekim)

**Supabase'te `kurulum.sql`'i bir kez çalıştır** (şablon fonksiyonları güncellendi).

- **Menü şablonu silinen ürünleri geri getirir:** şablon artık ürünün kategorisini ve sırasını da saklıyor. "Uygula" dediğinde silmiş olduğun ürünler ve kategoriler geri eklenir. Eski şablonlarda kategori bilgisi yoktu; onlardan geri gelen ürünler "Genel" kategorisine eklenir. Şablonun yanındaki ↻ ile güncellersen kategorileri de saklanır.
- **Destek mesajı:** artık "yönetici hesabı" demez. Giriş ekranından açılırsa "giriş yapamıyorum + kullanıcı adı", giriş yapılmışsa "hesap: ad (rol)" yazar. Ayrıca "Sorunun ne?" kutusuna yazdığın not mesaja eklenir.
- **QR menüde kategori çubuğu:** kaydırırken üstte vurgulanan kategori, ekranda en üstte gördüğün kategoriyle uyumlu; sayfanın en altında son kategori seçilir.

## 40. Haftalık karşılaştırma: gecelere ad ver + iki geceyi karşılaştır
- **Yönetim › ☰ › Haftalar** sayfasında artık geceleri adlandırabilirsin ("Balık günü", "Tantuni günü"). Gece çubuğundaki yazıya ya da ✏️ düğmesine bas.
- **İki geceyi karşılaştır** kartı: A ve B geceyi seç; satış, hesap sayısı, ortalama hesap, satılan ürün ve paket ile kategori/ürün farkları görünür. Sadece birinde satılan ürünler "sadece A / sadece B" diye işaretlenir. Adet/Tutar düğmesiyle değişir.
- Yalnızca hesabı kapanmış geceler karşılaştırılır.
- **Güncelleme:** `kurulum.sql`'i Supabase'de yeniden çalıştır (yeni tablo: `ads_gece_etiket`), sonra dosyaları Vercel'e yükle.

## 41. Hediye ikram hakkına son kullanma süresi
- Yönetim › Garsonlar › kişiyi aç › **⏳ Hediye hakkı son kullanma**: tarih ve saat seç (İstanbul saati). Boş bırakırsan süresizdir.
- Süre dolunca hak kullanılamaz (ödeme penceresinde "süresi doldu" yazar, sunucu da reddeder). Listede "⏳ süresi doldu" görünür.
- Tarihi ileri bir zamana alırsan hak yeniden açılır. "Hakkı yenile" kullanılan tutarı sıfırlar, süreyi değiştirmez.
- **Güncelleme:** `kurulum.sql`'i Supabase'de yeniden çalıştır, sonra dosyaları Vercel'e yükle.

## 42. QR adresi (alan adı)
- `config.js` içindeki `MENU_TABAN` QR kodlarının adresini belirler (şu an `https://www.ysiparis.com.tr/`). Siteyi hangi adresten açarsan aç QR hep bunu gösterir. Alan adı değişirse sadece bunu değiştir; boş bırakırsan açık olan adres kullanılır.
