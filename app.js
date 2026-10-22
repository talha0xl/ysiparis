/* =================================================================
   Yavuztürk Adisyon
   Hazırlayan: M. Talha Erbil
   ================================================================= */
(function () {
  'use strict';

  // ---------------------------------------------------------------
  // TEMEL
  // ---------------------------------------------------------------
  const AYAR = window.ADISYON_AYAR || {};
  const $app = document.getElementById('uygulama');
  const $fis = document.getElementById('fis-alani');
  const $fisStil = document.getElementById('fis-sayfa');

  const LS = {
    al(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    yaz(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yok say */ } },
    sil(k) { try { localStorage.removeItem(k); } catch (e) { /* yok say */ } }
  };

  // ---------- tema: her kişi kendi temasını seçer (cihazda kişiye özel saklanır) ----------
  // [kod, ad, zemin rengi, vurgu rengi, karanlık mı]
  const TEMALAR = [
    ['acik', 'Aydınlık', '#f6f5f1', '#0f766e', false], ['koyu', 'Karanlık', '#0e1514', '#2fa597', true], ['gul', 'Gül', '#fdf2f4', '#c01d4a', false],
    ['orman', 'Orman', '#f1f5ee', '#3f7d4a', false], ['kahve', 'Kahve', '#f7f1ea', '#8a4b22', false], ['gece', 'Gece mavisi', '#0b1220', '#3f86e8', true],
    ['kontrast', 'Yüksek kontrast', '#ffffff', '#0033cc', false]
  ];
  const temaSorgu = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const temaKisi = () => { const k = LS.al('ads_ben', null); return k && k.id ? 'ads_tema_' + k.id : null; };
  // 'otomatik' = telefonun/bilgisayarın ayarına göre, 'saat' = 19:00-06:30 arası karanlık, aksi halde tema kodu
  function temaSecimi() { const a = temaKisi(); const v = a ? LS.al(a, null) : null; return v || LS.al('ads_tema', 'otomatik'); }
  function temaCoz(sec) {
    if (sec === 'otomatik') return temaSorgu && temaSorgu.matches ? 'koyu' : 'acik';
    if (sec === 'saat') { const d = new Date(); const s = d.getHours() + d.getMinutes() / 60; return (s >= 19 || s < 6.5) ? 'koyu' : 'acik'; }
    return TEMALAR.some((t) => t[0] === sec) ? sec : 'acik';
  }
  function temaUygula() {
    const id = temaCoz(temaSecimi()); const t = TEMALAR.find((x) => x[0] === id) || TEMALAR[0];
    document.documentElement.dataset.tema = id;
    if (t[4]) document.documentElement.dataset.koyu = '1'; else delete document.documentElement.dataset.koyu;
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t[2];
    return t[4];
  }
  function temaKaydet(sec) { const a = temaKisi(); if (a) LS.yaz(a, sec); LS.yaz('ads_tema', sec); temaUygula(); }
  temaUygula();
  if (temaSorgu && temaSorgu.addEventListener) temaSorgu.addEventListener('change', temaUygula);
  setInterval(() => { if (temaSecimi() === 'saat') temaUygula(); }, 60000);
  function temaPenceresi() {
    const html = () => { const s = temaSecimi();
      return '<button class="kapat-x" data-e="kapat">×</button><h2>🎨 Tema</h2>' +
      '<p class="aciklama" style="margin-top:0">Seçtiğin tema sadece senin hesabına ait; başkası girince kendi temasını görür.</p>' +
      '<div class="tema-izgara">' + TEMALAR.map((t) => '<button class="tema-kart' + (s === t[0] ? ' aktif' : '') + '" data-e="temaSec" data-t="' + t[0] + '">' +
        '<span class="tema-onizle" style="background:' + t[2] + '"><b style="background:' + (t[4] ? '#fff' : '#000') + '"></b><i style="background:' + t[3] + '"></i></span>' + t[1] + '</button>').join('') + '</div>' +
      '<button class="tema-satir' + (s === 'otomatik' ? ' aktif' : '') + '" data-e="temaSec" data-t="otomatik"><span>🌗 Otomatik<small>Telefonun / bilgisayarın aydınlık-karanlık ayarına uyar</small></span></button>' +
      '<button class="tema-satir' + (s === 'saat' ? ' aktif' : '') + '" data-e="temaSec" data-t="saat"><span>🌇 Gece / gündüz<small>Akşam 19:00\'dan sabah 06:30\'a kadar karanlık, gün içinde aydınlık</small></span></button>' +
      '<button class="tema-satir' + (titresimAcik() ? ' aktif' : '') + '" data-e="titresimDegis"><span>📳 Dokununca titreşim<small>' + (titresimAcik() ? 'Açık' : 'Kapalı') + ' · sadece Android telefonlarda çalışır, bu cihaza özeldir</small></span></button>' +
      '<div class="eylemler"><button class="btn ana" data-e="kapat">Tamam</button></div>'; };
    const w = pencere(html(), {
      temaSec: (el) => { temaKaydet(el.dataset.t); w.p.innerHTML = html(); },
      titresimDegis: () => { LS.yaz('ads_titresim', !titresimAcik()); titre([30]); w.p.innerHTML = html(); }
    });
  }

  let token = LS.al('ads_token', null);
  let ben = LS.al('ads_ben', null);
  let db = null;

  const S = { masalar: [], paketler: [], urunler: [], kategoriler: [], ayarlar: null, acik: [], gunler: [] };

  // ---------- anlık bildirim kanalı (Supabase Realtime Broadcast) ----------
  // Bir garson sipariş verince / stok değişince diğer ekranlar beklemeden yenilenir.
  // Kanal çalışmazsa sayfalar zaten birkaç saniyede bir kendini yeniler.
  let kanal = null; const kanalDinleyiciler = new Set();
  function kanalKur() {
    if (kanal || AYAR.REALTIME === false || !db || !db.channel || !token) return;
    try {
      kanal = db.channel('ads-canli', { config: { broadcast: { self: false } } });
      kanal.on('broadcast', { event: 'degisti' }, (m) => kanalDinleyiciler.forEach((f) => { try { f((m && m.payload) || {}); } catch (e) { /* */ } }));
      kanal.subscribe();
    } catch (e) { kanal = null; }
  }
  function kanalGonder(neden) { try { if (kanal) kanal.send({ type: 'broadcast', event: 'degisti', payload: { neden: neden } }); } catch (e) { /* */ } }
  function kanalDinle(f) { kanalKur(); kanalDinleyiciler.add(f); return () => kanalDinleyiciler.delete(f); }

  const stokKritik = () => (S.ayarlar && S.ayarlar.stok_kritik != null ? Number(S.ayarlar.stok_kritik) : 10);
  function stokDurum(u, sepetteki) {
    if (u.tukendi) return { bitti: true, yazi: 'Tükendi' };
    if (u.stok === null || u.stok === undefined) return { takipYok: true };
    const st = Number(u.stok);
    if (st <= 0) return { bitti: true, yazi: 'Stok bitti' };
    return { kalan: st, az: st <= stokKritik(), dolu: (sepetteki || 0) >= st };
  }

  function istemciKur() {
    if (kanal) { try { db.removeChannel(kanal); } catch (e) { /* */ } kanal = null; }
    db = window.supabase.createClient(AYAR.SUPABASE_URL, AYAR.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: token ? { 'x-adisyon-token': token } : {} }
    });
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sayi = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const para = (n) => sayi(n).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ₺';
  const para2 = (n) => sayi(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const saat = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const tarihSaat = (t) => new Date(t).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const yeniId = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); });
  const yonetici = () => ben && ben.rol === 'admin';
  // izinler (roller): Yönetici her şeyi yapar; diğerleri rolündeki / kişiye özel izinlerle
  const GARSON_VARSAYILAN_IZIN = ['siparis', 'paket', 'masa_tasi', 'hesap', 'indirim'];
  const izin = (k) => !!ben && (ben.rol === 'admin' || (Array.isArray(ben.izinler) ? ben.izinler : GARSON_VARSAYILAN_IZIN).includes(k));
  const yonetimGirer = () => izin('menu') || izin('stok') || izin('masalar') || izin('ayarlar');
  const IZIN_GRUPLARI = [
    ['Sipariş ve hesap', [['siparis', 'Masa açar, sipariş gönderir'], ['paket', 'Paket siparişi açar'], ['masa_tasi', 'Masa taşır / birleştirir'],
      ['hesap', 'Hesabı görür, ödeme alır, hesabı kapatır'], ['indirim', 'Personel indirimi ve hediye ikram uygular'],
      ['iptal', 'Ürün iptal eder'], ['hesap_iptal', 'Hesabı tamamen iptal eder']]],
    ['Yönetim', [['kapali_duzelt', 'Kapanmış hesapta düzeltme / iptal yapar, hesabı geri açar'], ['stok', 'Stok girer, "tükendi" işaretler'],
      ['menu', 'Menü, kategori, ürün ve fiyat düzenler'], ['masalar', 'Masa ve bölüm ekler / düzenler'], ['kasa', 'Kasa / yazıcı ekranını kullanır'],
      ['rapor', 'Gün sonu, döküm, karşılaştırma ve Excel raporlarını görür'], ['panel', 'Genel paneli (grafikler) görür'], ['gunsonu', 'Gün sonunu alır'],
      ['ayarlar', 'Ayarlar, fiş tasarımı, QR menü, sesler, yedek']]]
  ];
  const IZIN_ADI = {}; IZIN_GRUPLARI.forEach(([, l]) => l.forEach(([k, a]) => { IZIN_ADI[k] = a; }));
  const izinKutulari = (secili, kilitli) => IZIN_GRUPLARI.map(([b, l]) => '<div class="ayar-bolum">' + b + '</div>' +
    l.map(([k, a]) => '<label class="anahtar izin"><span>' + esc(a) + '</span><input type="checkbox" data-izin="' + k + '"' + (secili.includes(k) ? ' checked' : '') + (kilitli ? ' disabled' : '') + '></label>').join('')).join('');
  const izinOku = (kok) => Array.from(kok.querySelectorAll('[data-izin]:checked')).map((x) => x.dataset.izin);
  const ODEME_TUR = { nakit: 'Nakit', kart: 'Kart', ikram: 'İkram', indirim: 'İndirim', garson_ikram: 'Garson ikramı' };

  const odemeAdi = (o) => (ODEME_TUR[o.tur] || o.tur) + ((o.ikram_garson_ad || o.garson) && o.tur === 'garson_ikram' ? ' (' + (o.ikram_garson_ad || o.garson) + ')' : '');

  function sure(t) {
    const dk = Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 60000));
    if (dk < 60) return dk + ' dk';
    return Math.floor(dk / 60) + ' sa ' + (dk % 60) + ' dk';
  }

  // ---------- dokununca titreşim (Android; iPhone Safari desteklemez) ----------
  const titresimAcik = () => LS.al('ads_titresim', true) !== false;
    function ikramBitisYazi(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    function ikramBitisInput(iso) {
      if (!iso) return '';
      const d = new Date(new Date(iso).getTime() + 3 * 3600 * 1000); // İstanbul = UTC+3
      return d.toISOString().slice(0, 16);
    }

  function titre(p) { try { if (titresimAcik() && navigator.vibrate) navigator.vibrate(p); } catch (e) { /* */ } }
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('button, a, select, label.anahtar, .masa, .secenek, [data-e]')) titre(10); }, true);

  function bildir(mesaj, tur) {
    if (tur === 'basari') titre([16, 50, 16]); else if (tur === 'hata') titre([90, 40, 90]);
    const el = document.createElement('div');
    el.className = 'bildirim ' + (tur || '');
    el.textContent = mesaj;
    document.getElementById('bildirimler').appendChild(el);
    setTimeout(() => el.remove(), tur === 'hata' ? 4500 : 2600);
  }

  function hataMetni(err) {
    let m = (err && (err.message || err.error_description || err.details)) || String(err || 'Bilinmeyen hata');
    if (/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'İnternet bağlantısı yok gibi. Tekrar dene.';
    if (m.startsWith('STOK:')) return m.replace('STOK:', '').trim();
    if (m.startsWith('OTURUM:')) {
      setTimeout(cikisYap, 50);
      return m.replace('OTURUM:', '').trim();
    }
    return m;
  }
  function hata(err) { console.error(err); if (baglantiYok && agHatasi(err)) return; bildir(hataMetni(err), 'hata'); }   // bağlantı yokken üstteki şerit yeter

  // ---------- bağlantı kopunca üstte uyarı şeridi ----------
  const agHatasi = (e) => /Failed to fetch|NetworkError|Load failed|network|fetch failed|ERR_INTERNET/i.test(String((e && (e.message || e.details)) || e || ''));
  let baglantiYok = false; let baglantiDenet = null;
  function baglantiDurum(var_) {
    const yok = !var_;
    if (yok === baglantiYok) return;
    baglantiYok = yok;
    let el = document.getElementById('baglanti-serit');
    if (yok) {
      if (!el) { el = document.createElement('div'); el.id = 'baglanti-serit'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
      el.className = 'yok'; el.innerHTML = '<b>📡 İnternet yok</b><span>&nbsp;· sipariş gönderilemez, sepetin duruyor</span>'; document.documentElement.classList.add('baglanti-yok');
      titre([120, 60, 120]);
      clearInterval(baglantiDenet);
      baglantiDenet = setInterval(() => {
        fetch(location.pathname + '?ping=' + Date.now(), { method: 'HEAD', cache: 'no-store' }).then(() => baglantiDurum(true)).catch(() => {});
      }, 4000);
    } else {
      clearInterval(baglantiDenet); baglantiDenet = null;
      if (el) { el.className = 'geldi'; el.innerHTML = '<b>✓ Bağlantı geri geldi</b>'; setTimeout(() => { if (!baglantiYok && el.parentNode) { el.remove(); document.documentElement.classList.remove('baglanti-yok'); } }, 2200); }
    }
  }
  window.addEventListener('offline', () => baglantiDurum(false));
  window.addEventListener('online', () => {
    fetch(location.pathname + '?ping=' + Date.now(), { method: 'HEAD', cache: 'no-store' }).then(() => baglantiDurum(true)).catch(() => {});
  });

  async function rpc(ad, arg) {
    let sonuc;
    try { sonuc = await db.rpc(ad, arg || {}); } catch (e) { if (agHatasi(e)) baglantiDurum(false); throw e; }
    const { data, error } = sonuc;
    if (error) { if (agHatasi(error)) baglantiDurum(false); throw error; }
    baglantiDurum(true);
    return data;
  }
  async function q(sorgu) {
    let sonuc;
    try { sonuc = await sorgu; } catch (e) { if (agHatasi(e)) baglantiDurum(false); throw e; }
    const { data, error } = sonuc;
    if (error) { if (agHatasi(error)) baglantiDurum(false); throw error; }
    baglantiDurum(true);
    return data;
  }

  // ---------- resim yardımcıları (ürün fotoğrafı, logo) ----------
  function resimAc(kaynak) {
    return new Promise((coz, red) => {
      const im = new Image(); let url = null;
      im.onload = () => { if (url) URL.revokeObjectURL(url); coz(im); };
      im.onerror = () => { if (url) URL.revokeObjectURL(url); red(new Error('Resim okunamadı')); };
      if (typeof kaynak === 'string') im.src = kaynak; else { url = URL.createObjectURL(kaynak); im.src = url; }
    });
  }
  function kareFoto(im, boy) {
    const k = Math.min(im.naturalWidth, im.naturalHeight);
    const c = document.createElement('canvas'); c.width = c.height = boy;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, boy, boy);
    x.drawImage(im, (im.naturalWidth - k) / 2, (im.naturalHeight - k) / 2, k, k, 0, 0, boy, boy);
    return c.toDataURL('image/jpeg', 0.72);
  }
  function logoTuval(im, enFazla) {
    const o = Math.min(1, enFazla / im.naturalWidth);
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.naturalWidth * o)); c.height = Math.max(1, Math.round(im.naturalHeight * o));
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
    return c;
  }

  // ---------------------------------------------------------------
  // VERİ
  // ---------------------------------------------------------------
  async function masalariYukle() {
    const hepsi = await q(db.from('ads_masalar').select('*').eq('aktif', true).order('sira').order('ad'));
    S.masalar = hepsi.filter((m) => (m.tur || 'masa') === 'masa');
    S.paketler = hepsi.filter((m) => m.tur === 'paket');
    return S.masalar;
  }
  async function urunleriYukle() {
    const [u, k] = await Promise.all([
      q(db.from('ads_urunler').select('*').order('sira').order('ad')),
      q(db.from('ads_kategoriler').select('*').order('sira').order('ad'))
    ]);
    S.urunler = u; S.kategoriler = k;
    return S.urunler;
  }
  // kategori adı -> kayıt (sıra, aktif, istasyon)
  function katBul(ad) { return S.kategoriler.find((c) => (c.ad || '').toLocaleLowerCase('tr') === (ad || '').toLocaleLowerCase('tr')); }
  function katGizli(ad) { const c = katBul(ad); return c ? !c.aktif : false; }
  // kategorileri kayıtlı sıraya göre sırala (kayıtta olmayan = sona)
  function katSirala(adlar) {
    return adlar.slice().sort((a, b) => {
      const ca = katBul(a); const cb = katBul(b);
      return (ca ? ca.sira : 9999) - (cb ? cb.sira : 9999) || a.localeCompare(b, 'tr');
    });
  }
  const istIdler = () => Object.keys((S.ayarlar && S.ayarlar.istasyon_adlari) || {}).map(Number).filter((n) => n > 0).sort((x, y) => x - y);
  async function istasyonEkle(ad) {
    const a = Object.assign({}, (S.ayarlar && S.ayarlar.istasyon_adlari) || {});
    const id = Math.max(1, ...Object.keys(a).map(Number)) + 1;
    a[id] = ad;
    await q(db.from('ads_ayarlar').update({ istasyon_adlari: a }).eq('id', 1));
    S.ayarlar.istasyon_adlari = a;
    return id;
  }
  const istAdi = (n) => { const a = (S.ayarlar && S.ayarlar.istasyon_adlari) || {}; return Number(n) === 0 ? 'Kasa' : (a[n] || a[String(n)] || ('İstasyon ' + n)); };
  async function ayarlariYukle() {
    const r = await q(db.from('ads_ayarlar').select('*').eq('id', 1).maybeSingle());
    S.ayarlar = r || { isletme_adi: 'Yavuztürk Süleymaniye', fis_genislik: 80, fis_alt_yazi: '', iptal_yetkisi: 'admin', hesap_fisi_otomatik: true };
    S.ayarlar._kayitliMod = S.ayarlar.gun_sonu_modu || 'otomatik';
    _donemOnbellek = null;
    return S.ayarlar;
  }
  async function gunleriYukle() {
    S.gunler = await q(db.from('ads_gunler').select('id, baslangic, bitis, kapatan, ozet').order('bitis').limit(1000));
    return S.gunler;
  }
  // rapor sayfaları her açılışta güncel ayar + gün sonu listesiyle çalışsın
  async function raporHazirla() { await Promise.all([ayarlariYukle(), gunleriYukle()]); }
  async function acikHesaplariYukle() {
    S.acik = await q(db.from('ads_adisyonlar')
      .select('id, masa_id, acilis, indirim_oran, ads_kalemler(fiyat, adet, durum), ads_odemeler(tutar)')
      .eq('durum', 'acik'));
    return S.acik;
  }
  function hesapToplam(a) {
    const toplam = (a.ads_kalemler || []).filter((k) => k.durum === 'aktif').reduce((t, k) => t + k.fiyat * k.adet, 0);
    const odenen = (a.ads_odemeler || []).reduce((t, o) => t + Number(o.tutar), 0);
    const oran = Number(a.indirim_oran) || 0;
    const net = sayi(toplam * (100 - oran) / 100);
    return { toplam: sayi(toplam), oran, indirim: sayi(toplam - net), net, odenen: sayi(odenen), kalan: sayi(net - odenen) };
  }
  function kategoriler(urunler) {
    const sira = [];
    urunler.forEach((u) => { if (!sira.includes(u.kategori)) sira.push(u.kategori); });
    return sira;
  }

  // ---------------------------------------------------------------
  // YÖNLENDİRME
  // ---------------------------------------------------------------
  let sayfaTemizle = null;
  let pencereSayisi = 0;

  function git(yol) { if (location.hash !== '#' + yol) location.hash = yol; else yonlendir(); }

  function yonlendir() {
    if (sayfaTemizle) { try { sayfaTemizle(); } catch (e) { /* */ } sayfaTemizle = null; }
    document.querySelectorAll('.perde').forEach((p) => p.remove());
    pencereSayisi = 0;
    $app.onclick = null; $app.onchange = null; $app.oninput = null; $app.onsubmit = null;
    window.scrollTo(0, 0);
    $app.classList.remove('gecis'); void $app.offsetWidth; $app.classList.add('gecis'); clearTimeout(yonlendir._t); yonlendir._t = setTimeout(() => $app.classList.remove('gecis'), 600);

    if (!AYAR.SUPABASE_URL || /PROJE-KODUN/.test(AYAR.SUPABASE_URL) || /BURAYA/.test(AYAR.SUPABASE_KEY || '')) return kurulumUyari();
    if (!token) return girisSayfa();

    const yol = (location.hash || '').replace(/^#/, '') || '/masalar';
    const p = yol.split('/').filter(Boolean);
    if (p[0] === 'masa' && p[1]) return masaSayfa(p[1]);
    if (p[0] === 'kasa' && izin('kasa')) return kasaSayfa();
    if (p[0] === 'yonetim' && (yonetici() || yonetimGirer())) return yonetimSayfa();
    if (p[0] === 'rapor' && izin('rapor')) return raporSayfa();
    if (p[0] === 'karsilastirma' && izin('rapor')) return karsilastirmaSayfa();
    if (p[0] === 'dokum' && izin('rapor')) return dokumSayfa();
    if (p[0] === 'qrmenu' && izin('ayarlar')) return qrMenuSayfa();
    if (p[0] === 'fistasarim' && izin('ayarlar')) return fisTasarimSayfa();
    if (p[0] === 'panel' && izin('panel')) return panelSayfa();
    if (p[0] === 'sesler' && izin('ayarlar')) return seslerSayfa();
    return masalarSayfa();
  }
  window.addEventListener('hashchange', yonlendir);

  function eylemBagla(eylemler) {
    $app.onclick = (e) => {
      const el = e.target.closest('[data-e]');
      if (!el || !$app.contains(el)) return;
      const f = eylemler[el.dataset.e];
      if (f) { e.preventDefault(); f(el, e); }
    };
  }

  // düzenli yenileme; arka planda bekler, öne gelince hemen yeniler
  function yenileyici(fn, ms) {
    let dur = false; let calisiyor = false;
    const tik = async () => {
      if (dur || calisiyor || document.hidden || pencereSayisi > 0) return;
      const odak = document.activeElement;
      if (odak && /INPUT|TEXTAREA|SELECT/.test(odak.tagName) && $app.contains(odak)) return;
      calisiyor = true;
      try { await fn(); } catch (e) { /* sessiz; bir sonraki turda tekrar */ } finally { calisiyor = false; }
    };
    const id = setInterval(tik, ms);
    const gorunur = () => { if (!document.hidden) tik(); };
    document.addEventListener('visibilitychange', gorunur);
    return () => { dur = true; clearInterval(id); document.removeEventListener('visibilitychange', gorunur); };
  }

  // ---------------------------------------------------------------
  // PENCERE (modal)
  // ---------------------------------------------------------------
  function pencere(html, eylemler, acilinca, kapaninca) {
    const perde = document.createElement('div');
    perde.className = 'perde';
    perde.innerHTML = '<div class="pencere" role="dialog">' + html + '</div>';
    document.body.appendChild(perde);
    pencereSayisi++;
    const p = perde.firstChild;
    let kapandi = false;
    const kapat = () => {
      if (kapandi) return;
      kapandi = true; perde.remove(); pencereSayisi = Math.max(0, pencereSayisi - 1);
      if (kapaninca) try { kapaninca(); } catch (e) { console.error(e); }
    };
    perde.addEventListener('click', (e) => {
      if (e.target === perde) return kapat();
      const el = e.target.closest('[data-e]');
      if (!el) return;
      if (el.dataset.e === 'kapat') return kapat();
      const f = eylemler && eylemler[el.dataset.e];
      if (f) { e.preventDefault(); f(el, e, p, kapat); }
    });
    p.addEventListener('submit', (e) => { e.preventDefault(); const f = eylemler && eylemler.gonder; if (f) f(e.target, e, p, kapat); });
    if (acilinca) acilinca(p, kapat);
    return { p, kapat };
  }

  function onayla(baslik, metin, butonYazi, tehlike) {
    return new Promise((coz) => {
      let sonuc = false;
      pencere(
        '<button class="kapat-x" data-e="kapat">×</button><h2>' + esc(baslik) + '</h2>' +
        (metin ? '<p class="aciklama" style="font-size:15px">' + esc(metin) + '</p>' : '') +
        '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button>' +
        '<button class="btn ' + (tehlike ? 'tehlike dolu' : 'ana') + '" data-e="evet">' + esc(butonYazi || 'Tamam') + '</button></div>',
        { evet: (el, e, p, kapat) => { sonuc = true; kapat(); } },
        null,
        () => coz(sonuc)
      );
    });
  }

  const HIZLI_NOTLAR = ['Acısız', 'Acılı', 'Az pişmiş', 'İyi pişmiş', 'Soğansız', 'Sossuz', 'Ekmeksiz', 'Limonlu', 'Ayrı tabak', 'Çocuk porsiyonu'];
  function notPenceresi(baslik, mevcut, kaydet, adet) {
    let sadeceBir = false;
    pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + esc(baslik) + '</h2>' +
      (adet > 1 && !mevcut ? '<div class="secenekler" style="margin:10px 0"><button type="button" class="secenek aktif" data-e="kac" data-b="0">' + adet + ' adetin hepsine</button>' +
        '<button type="button" class="secenek" data-e="kac" data-b="1">Sadece 1 tanesine</button></div>' : '') +
      '<form><textarea id="n-y" rows="2" maxlength="140" placeholder="Hazırlayan kişinin göreceği not">' + esc(mevcut || '') + '</textarea>' +
      '<div class="btn-satir" style="margin-top:8px">' + HIZLI_NOTLAR.map((n) => '<button type="button" class="btn kucuk" style="flex:none" data-e="ekle" data-n="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>' +
      '<div class="eylemler"><button type="button" class="btn tehlike" data-e="temizle">Notu sil</button><button class="btn ana" type="submit">Kaydet</button></div></form>', {
      kac: (el, e, p) => { sadeceBir = el.dataset.b === '1'; p.querySelectorAll('[data-e="kac"]').forEach((b) => b.classList.toggle('aktif', b === el)); },
      ekle: (el, e, p) => { const t = p.querySelector('#n-y'); t.value = (t.value.trim() ? t.value.trim() + ', ' : '') + el.dataset.n; },
      temizle: (el, e, p, kapat) => { kapat(); kaydet('', false); },
      gonder: (form, e, p, kapat) => { const v = p.querySelector('#n-y').value.trim().slice(0, 140); kapat(); kaydet(v, sadeceBir); }
    }, (p) => p.querySelector('#n-y').focus());
  }

  async function bekle(btn, fn) {
    if (btn.disabled) return;
    const eski = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = 'Bekle…';
    try { return await fn(); } finally { if (document.body.contains(btn)) { btn.disabled = false; btn.innerHTML = eski; } }
  }

  // ---------------------------------------------------------------
  // KURULUM UYARISI / GİRİŞ
  // ---------------------------------------------------------------
  function kurulumUyari() {
    $app.innerHTML = '<div class="giris-sayfa"><div class="giris-kutu"><div class="marka-serit"></div>' +
      '<h1>Kurulum eksik</h1><p>config.js dosyasına Supabase adresini ve anon key bilgisini yazman gerekiyor. ' +
      'Ayrıntılar BENİ OKU dosyasında.</p></div></div>';
  }

  // ---------- Destek: Gmail / WhatsApp hazır mesajla açılır, gönderme kullanıcıda ----------
  const DESTEK = { ad: 'M. Talha Erbil', mail: 'm.talhaerbil34@gmail.com', tel: '905423699897', telYazi: '0542 369 98 97' };
  function destekPenceresi(kullanici) {
    const girisYok = !ben;
    const kim = kullanici || (ben && ben.kullanici) || (ben && ben.ad) || '';
    const rol = ben ? (ben.rol_ad || (ben.rol === 'admin' ? 'Yönetici' : 'Garson')) : '';
    const konu = girisYok ? 'YSipariş - giriş yapamıyorum' : 'YSipariş - destek isteği (' + (ben.ad || '') + ')';
    const govde = (not) => (girisYok ? 'Merhaba, YSipariş\'e giriş yapamıyorum, yardımcı olur musunuz?' : 'Merhaba, YSipariş\'te bir sorun yaşıyorum, yardımcı olur musunuz?') +
      (not ? '\n\nSorun: ' + not : '') +
      (girisYok ? (kim ? '\n\nKullanıcı adı: ' + kim : '') : '\n\nHesap: ' + (ben.ad || '') + (rol ? ' (' + rol + ')' : '') + (ben.kullanici ? ' · kullanıcı adı: ' + ben.kullanici : '')) +
      '\nSayfa: ' + location.origin + '\nZaman: ' + new Date().toLocaleString('tr-TR');
    const linkler = (not) => {
      const m = govde(not);
      return {
        gmail: 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(DESTEK.mail) + '&su=' + encodeURIComponent(konu) + '&body=' + encodeURIComponent(m),
        mailto: 'mailto:' + DESTEK.mail + '?subject=' + encodeURIComponent(konu) + '&body=' + encodeURIComponent(m),
        wp: 'https://wa.me/' + DESTEK.tel + '?text=' + encodeURIComponent(m)
      };
    };
    const l0 = linkler('');
    pencere('<button class="kapat-x" data-e="kapat">×</button><h2>🛟 Destek</h2>' +
      '<p class="aciklama" style="font-size:15px">Sorun yaşıyorsan aşağıdan yaz. Mesaj hazır gelir, sadece <b>gönder</b> tuşuna basman yeterli.</p>' +
      '<div class="kart dolgulu" style="margin:10px 0"><b>' + esc(DESTEK.ad) + '</b><div class="aciklama" style="margin:2px 0 0">' + esc(DESTEK.mail) + ' · ' + esc(DESTEK.telYazi) + '</div></div>' +
      '<label for="d-not">Sorunun ne? (isteğe bağlı, mesaja eklenir)</label><textarea id="d-not" rows="2" maxlength="300" placeholder="' + (girisYok ? 'Örn. şifremi unuttum' : 'Örn. fiş çıkmıyor, Masa 4 hesabı açılmıyor') + '"></textarea>' +
      '<a id="d-wp" class="btn ana tam buyuk" style="text-decoration:none;display:block;text-align:center;margin:10px 0 8px" target="_blank" rel="noopener" href="' + esc(l0.wp) + '">💬 WhatsApp ile yaz</a>' +
      '<a id="d-gm" class="btn tam buyuk" style="text-decoration:none;display:block;text-align:center" target="_blank" rel="noopener" href="' + esc(l0.gmail) + '">✉️ Gmail ile yaz</a>' +
      '<p class="aciklama" style="margin-top:10px">Gmail açılmazsa <a id="d-mt" href="' + esc(l0.mailto) + '">buraya dokun</a> (telefonun e-posta uygulaması açılır).</p>' +
      '<div class="eylemler"><button class="btn" data-e="kapat">Kapat</button></div>', {}, (p) => {
      p.querySelector('#d-not').addEventListener('input', (e) => {
        const l = linkler(e.target.value.trim());
        p.querySelector('#d-wp').href = l.wp; p.querySelector('#d-gm').href = l.gmail; p.querySelector('#d-mt').href = l.mailto;
      });
    });
  }

  function girisSayfa() {
    $app.innerHTML =
      '<div class="giris-sayfa"><div style="width:100%;max-width:380px">' +
      '<form class="giris-kutu" id="giris-form" autocomplete="on">' +
      '<div id="g-logo" class="giris-logo"></div>' +
      '<div class="marka-serit"></div>' +
      '<h1>YSipariş\'e hoş geldiniz</h1><p>Garson / yönetici girişi</p>' +
      '<label for="g-k">Kullanıcı adı</label><input id="g-k" name="username" autocapitalize="none" autocorrect="off" spellcheck="false" required value="' + esc(LS.al('ads_son_kullanici', '')) + '">' +
      '<label for="g-s">Şifre</label><input id="g-s" name="password" type="password" required>' +
      '<button class="btn ana tam buyuk" style="margin-top:18px" type="submit">Giriş Yap</button>' +
      '<div style="text-align:center;margin-top:12px"><button type="button" class="btn kucuk" id="g-destek">🛟 Giriş yapamıyor musun? Destek</button></div>' +
      '</form><div class="imza">Hazırlayan: M. Talha Erbil</div></div></div>';
    const form = document.getElementById('giris-form');
    const logoYaz = (l) => { const e = document.getElementById('g-logo'); if (e) e.innerHTML = l && /^(data:image\/|logo\.png$)/.test(l) ? '<img alt="" src="' + l + '">' : ''; };
    logoYaz(LS.al('ads_logo', '') || 'logo.png');
    if (db) rpc('ads_logo_public').then((l) => { LS.yaz('ads_logo', l || ''); logoYaz(l || 'logo.png'); }).catch(() => {});
    document.getElementById('g-destek').onclick = () => destekPenceresi(document.getElementById('g-k').value.trim());
    const k = document.getElementById('g-k'); const s = document.getElementById('g-s');
    (k.value ? s : k).focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = form.querySelector('button');
      await bekle(btn, async () => {
        try {
          istemciKur();
          const r = await rpc('ads_giris', { p_kullanici: k.value.trim(), p_pin: s.value });
          token = r.token; ben = r.garson;
          LS.yaz('ads_token', token); LS.yaz('ads_ben', ben); LS.yaz('ads_son_kullanici', k.value.trim()); temaUygula();
          istemciKur();
          bildir('Hoş geldin ' + ben.ad, 'basari');
          git('/masalar');
        } catch (err) { hata(err); s.select(); }
      });
    };
  }

  async function cikisYap() {
    try { if (token) await rpc('ads_cikis'); } catch (e) { /* */ }
    token = null; ben = null; LS.sil('ads_token'); LS.sil('ads_ben'); temaUygula();
    istemciKur();
    git('/giris');
  }

  // ---------------------------------------------------------------
  // ÜST BAR + MENÜ
  // ---------------------------------------------------------------
  function ustBar(baslik, alt, sol, sag) {
    return '<header class="ust">' + (sol || '') +
      '<h1>' + esc(baslik) + (alt ? '<span class="alt-baslik">' + esc(alt) + '</span>' : '') + '</h1>' +
      ((sag && izin('panel') && sag.indexOf('data-e="menu"') >= 0 ? '<button class="ust-btn panel" data-e="git" data-hedef="/panel" aria-label="Genel panel" title="Genel panel">📊<span class="panel-yazi"> Panel</span></button>' : '') + (sag || '')) + '</header>';
  }
  const geriBtn = (hedef) => '<button class="ust-btn geri" data-e="git" data-hedef="' + hedef + '" aria-label="Geri">‹</button>';

  function anaMenuAc() {
    const var_ = document.querySelector('.menu-perde');
    if (var_) { var_.remove(); return; }
    const simdi = '/' + ((location.hash || '').replace(/^#\/?/, '').split('/')[0] || 'masalar');
    const kare = (hedef, ikon, ad, alt) => '<button class="menu-kare' + (simdi === hedef ? ' aktif' : '') + '" data-e="git" data-hedef="' + hedef + '"><span class="ikon">' + ikon + '</span><b>' + ad + '</b>' + (alt ? '<small>' + alt + '</small>' : '') + '</button>';
    const grup = (baslik, ic) => ic ? '<div class="menu-grup"><div class="menu-grup-ad">' + baslik + '</div><div class="menu-izgara">' + ic + '</div></div>' : '';
    const rolAd = ben && (ben.rol_ad || (ben.rol === 'admin' ? 'Yönetici' : 'Garson'));
    const p = document.createElement('div');
    p.className = 'menu-perde';
    p.innerHTML = '<aside class="menu-cekmece" role="dialog" aria-label="Menü">' +
      '<div class="menu-ust"><div class="menu-kisi"><span class="menu-avatar">' + esc(((ben && ben.ad) || '?').trim().charAt(0).toLocaleUpperCase('tr-TR')) + '</span>' +
        '<span><b>' + esc(ben ? ben.ad : '') + '</b><small>' + esc(rolAd || '') + '</small></span></div>' +
        '<button class="menu-kapat" data-e="menuKapat" aria-label="Kapat">×</button></div>' +
      '<div class="menu-govde">' +
      grup('Servis', kare('/masalar', '🍽', 'Masalar') +
        (izin('kasa') ? kare('/kasa', '🖨️', 'Kasa', 'Yazıcı') : '') +
        (izin('panel') ? kare('/panel', '📊', 'Panel') : '')) +
      grup('Raporlar', izin('rapor') ? kare('/rapor', '🧾', 'Gün Sonu') + kare('/karsilastirma', '📈', 'Haftalar') + kare('/dokum', '🔎', 'Döküm') : '') +
      grup('Ayarlar', ((yonetici() || yonetimGirer()) ? kare('/yonetim', '⚙️', 'Yönetim', 'Menü · masa') : '') +
        (izin('ayarlar') ? kare('/qrmenu', '🔳', 'QR Menü') + kare('/fistasarim', '🧾', 'Fiş') + kare('/sesler', '🔊', 'Sesler') : '')) +
      '<div class="menu-alt">' +
        '<button class="menu-satir" data-e="tema"><span>🎨</span>Tema ve titreşim</button>' +
        '<button class="menu-satir" data-e="destek"><span>🛟</span>Destek</button>' +
        '<button class="menu-satir cikis" data-e="cikis"><span>↩︎</span>Çıkış yap</button>' +
      '</div></div></aside>';
    document.body.appendChild(p);
    const kapat = () => { p.classList.add('kapaniyor'); setTimeout(() => p.remove(), 220); document.removeEventListener('keydown', tus); };
    const tus = (e) => { if (e.key === 'Escape') kapat(); };
    document.addEventListener('keydown', tus);
    p.addEventListener('click', (e) => {
      if (e.target === p) return kapat();
      const el = e.target.closest('[data-e]'); if (!el) return;
      const f = ortakEylemler[el.dataset.e];
      kapat();
      if (f && el.dataset.e !== 'menuKapat') f(el);
    });
  }

  const ortakEylemler = {
    git: (el) => git(el.dataset.hedef),
    menu: () => anaMenuAc(),
    menuKapat: () => {},
    tema: () => temaPenceresi(),
    destek: () => destekPenceresi(),
    cikis: async () => { if (await onayla('Çıkış yapılsın mı?', '', 'Çıkış Yap')) cikisYap(); }
  };

  // ---------------------------------------------------------------
  // MASALAR
  // ---------------------------------------------------------------
  function paketPenceresi() {
    pencere('<button class="kapat-x" data-e="kapat">×</button><h2>📦 Yeni paket sipariş</h2>' +
      '<p class="aciklama">Masa doluyken de paket alınabilir. Paket hesabı kapanınca listeden kalkar.</p>' +
      '<form><label for="p-m">Müşteri adı / telefon (isteğe bağlı)</label><input id="p-m" maxlength="40" placeholder="Örn. Ahmet 0532…">' +
      '<div class="eylemler"><button type="button" class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" type="submit">Paketi Aç</button></div></form>', {
      gonder: async (form, e, p, kapat) => {
        const btn = form.querySelector('[type=submit]');
        await bekle(btn, async () => {
          try {
            const id = await rpc('ads_paket_ac', { p_musteri: p.querySelector('#p-m').value });
            kapat(); kanalGonder('masa'); LS.yaz('ads_sekme_' + id, 'menu'); git('/masa/' + id);
          } catch (err) { hata(err); }
        });
      }
    }, (p) => p.querySelector('#p-m').focus());
  }

  async function masalarSayfa() {
    let sonCizim = '';
    const ciz = () => {
      const acikHarita = {};
      S.acik.forEach((a) => { acikHarita[a.masa_id] = a; });
      let doluSay = 0; let acikToplam = 0;
      const kart = (m, paket) => {
        const a = acikHarita[m.id];
        if (!a) {
          return '<button class="masa' + (paket ? ' paket' : '') + '" data-e="masa" data-id="' + m.id + '"><span class="ad">' + esc(m.ad) + '</span><span class="durum">' + (paket ? 'Sipariş girilmedi' : 'Boş') + '</span></button>';
        }
        const t = hesapToplam(a); if (!paket) doluSay++; acikToplam += t.kalan;
        const odemeli = t.odenen > 0 && t.kalan > 0;
        return '<button class="masa ' + (paket ? 'paket-dolu' : odemeli ? 'odemeli' : 'dolu') + '" data-e="masa" data-id="' + m.id + '">' +
          '<span class="ad">' + esc(m.ad) + (t.oran ? ' <span class="etiket">Personel</span>' : '') + '</span>' +
          '<span><span class="tutar">' + para(t.net) + '</span><br><span class="durum">' + sure(a.acilis) +
          (odemeli ? ' · kalan ' + para(t.kalan) : '') + '</span></span></button>';
      };
      const bolumAdlari = [];
      S.masalar.forEach((m) => { const b = (m.bolum || '').trim(); if (!bolumAdlari.includes(b)) bolumAdlari.push(b); });
      const bolumlu = bolumAdlari.some((b) => b);
      const kartlar = bolumlu
        ? bolumAdlari.map((b) => '<div class="bolum-baslik" style="grid-column:1/-1;margin:' + (b === bolumAdlari[0] ? '0' : '14px') + ' 2px 0">' + esc(b || 'Diğer masalar') + '</div>' +
            S.masalar.filter((m) => (m.bolum || '').trim() === b).map((m) => kart(m, false)).join('')).join('')
        : S.masalar.map((m) => kart(m, false)).join('');
      const paketKartlar = S.paketler.map((m) => kart(m, true)).join('');
      const html =
        ustBar('Masalar', ben.ad + (ben.rol_ad && ben.rol_ad !== 'Garson' ? ' · ' + ben.rol_ad : (yonetici() ? ' · Yönetici' : '')), '',
          (izin('paket') ? '<button class="ust-btn" data-e="paketAc">📦 Paket</button>' : '') + '<button class="ust-btn" data-e="yenile" aria-label="Yenile">⟳</button><button class="ust-btn" data-e="menu">☰</button>') +
        '<main class="icerik">' +
        '<div class="ozet-serit"><div class="parca">Dolu masa<b>' + doluSay + ' / ' + S.masalar.length + '</b></div>' +
        '<div class="parca">Açık hesaplar<b>' + para(acikToplam) + '</b></div></div>' +
        (S.masalar.length ? '<div class="masa-izgara">' + kartlar + '</div>'
          : '<div class="bos">Henüz masa yok.' + (izin('masalar') ? '<br><br><button class="btn ana" data-e="git" data-hedef="/yonetim">Masa ekle</button>' : '') + '</div>') +
        '<div class="bolum-baslik" style="margin-top:22px"><span>📦 Paket siparişler</span></div>' +
        '<div class="masa-izgara">' + paketKartlar +
        (izin('paket') ? '<button class="masa yeni-paket" data-e="paketAc"><span class="ad">+ Yeni Paket</span><span class="durum">Masa gerekmez</span></button>' : '') + '</div>' +
        '<div class="imza">Hazırlayan: M. Talha Erbil · <a href="#" data-e="destek">🛟 Destek</a></div></main>';
      if (html !== sonCizim) { $app.innerHTML = html; sonCizim = html; }
    };
    const yukle = async () => { await Promise.all([masalariYukle(), acikHesaplariYukle()]); ciz(); };

    $app.innerHTML = ustBar('Masalar', ben.ad) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    eylemBagla(Object.assign({}, ortakEylemler, {
      masa: (el) => git('/masa/' + el.dataset.id),
      paketAc: () => paketPenceresi(),
      yenile: async () => { try { await yukle(); bildir('Güncellendi'); } catch (e) { hata(e); } }
    }));
    try {
      // zayıf Wi-Fi'da ilk deneme düşebilir: kullanıcıya hata göstermeden birkaç kez kendimiz tekrar deneriz
      for (let deneme = 0; ; deneme++) {
        try { await Promise.all([yukle(), S.ayarlar ? null : ayarlariYukle()]); break; }
        catch (e) { if (deneme >= 4 || !agHatasi(e)) throw e; await new Promise((r) => setTimeout(r, 900 * (deneme + 1))); }
      }
      // dakika göstergeleri de güncellensin
      const durdur = yenileyici(yukle, 4000);
      let bk = null;
      const birak = kanalDinle(() => { clearTimeout(bk); bk = setTimeout(() => { if (pencereSayisi === 0) yukle().catch(() => {}); }, 200); });
      sayfaTemizle = () => { durdur(); birak(); clearTimeout(bk); };
    } catch (e) {
      hata(e);
      $app.querySelector('main').innerHTML = '<div class="bos">Bağlanılamadı.<br><br><button class="btn" data-e="yenile">Tekrar dene</button></div>';
      sayfaTemizle = yenileyici(yukle, 5000);
    }
  }

  // ---------------------------------------------------------------
  // MASA (sipariş + hesap)
  // ---------------------------------------------------------------
  async function masaSayfa(masaId) {
    const SK = 'ads_sepet_' + masaId; const IK = 'ads_istek_' + masaId;
    let sepet = LS.al(SK, []);
    const NK = 'ads_not_' + masaId;
    let genelNot = LS.al(NK, '');
    let istekId = LS.al(IK, null);
    let sekme = LS.al('ads_sekme_' + masaId, 'menu');
    let kategori = 'Tümü';
    let arama = '';
    let masa = null; let hesap = null; // hesap: açık adisyon + kalemler + ödemeler
    let sonVeri = '';

    const sepetKaydet = () => { LS.yaz(SK, sepet); istekId = null; LS.sil(IK); };
    const sepetAdet = () => sepet.reduce((t, s) => t + s.adet, 0);
    const sepetToplam = () => sayi(sepet.reduce((t, s) => t + s.fiyat * s.adet, 0));

    async function hesabiYukle() {
      const r = await q(db.from('ads_adisyonlar')
        .select('id, masa_id, acilis, acan_ad, indirim_oran, ads_kalemler(*), ads_odemeler(*)')
        .eq('masa_id', masaId).eq('durum', 'acik').maybeSingle());
      hesap = r;
      if (hesap) {
        hesap.ads_kalemler.sort((a, b) => new Date(a.olusturma) - new Date(b.olusturma) || String(a.ad).localeCompare(b.ad));
        hesap.ads_odemeler.sort((a, b) => new Date(a.olusturma) - new Date(b.olusturma));
      }
      return hesap;
    }
    async function masaYukle() {
      masa = await q(db.from('ads_masalar').select('*').eq('id', masaId).maybeSingle());
      return masa;
    }

    function menuHtml() {
      const aktifUrunler = S.urunler.filter((u) => u.aktif && !katGizli(u.kategori));
      const kats = katSirala(kategoriler(aktifUrunler));
      if (!kats.includes(kategori)) kategori = 'Tümü';
      const adetHarita = {};
      sepet.forEach((s) => { adetHarita[s.urun_id] = (adetHarita[s.urun_id] || 0) + s.adet; });
      const ara = arama.trim().toLocaleLowerCase('tr');
      const gos = aktifUrunler.filter((u) => (kategori === 'Tümü' || u.kategori === kategori) && (!ara || u.ad.toLocaleLowerCase('tr').includes(ara)));
      const gruplar = kategoriler(gos).map((k) =>
        (kategori === 'Tümü' ? '<div class="kategori-baslik">' + esc(k) + '</div>' : '') +
        '<div class="urun-liste">' + gos.filter((u) => u.kategori === k).map((u) => {
          const n = adetHarita[u.id] || 0; const sd = stokDurum(u, n);
          if (sd.bitti) {
            return '<button class="urun bitti" data-e="ekle" data-id="' + u.id + '" aria-disabled="true">' +
              '<span class="ad">' + esc(u.ad) + '<span class="stok-yazi bitti">' + sd.yazi + '</span></span><span class="fiyat">' + para(u.fiyat) + '</span><span class="arti">✕</span></button>';
          }
          return '<button class="urun' + (n ? ' secili' : '') + (sd.dolu ? ' dolu' : '') + '" data-e="ekle" data-id="' + u.id + '">' +
            (n ? '<span class="rozet">' + n + '</span>' : '') +
            '<span class="ad">' + esc(u.ad) + (sd.takipYok ? '' : '<span class="stok-yazi' + (sd.az ? ' az' : '') + '">Stok: ' + sd.kalan + (n ? ' · sepette ' + n : '') + '</span>') + '</span>' +
            '<span class="fiyat">' + para(u.fiyat) + '</span><span class="arti">+</span></button>';
        }).join('') + '</div>').join('');
      return '<input type="search" id="urun-ara" placeholder="Ürün ara…" value="' + esc(arama) + '" style="margin-bottom:10px">' +
        (kats.length > 1 ? '<div class="kategori-bar">' + ['Tümü'].concat(kats).map((k) =>
          '<button class="cip' + (k === kategori ? ' aktif' : '') + '" data-e="kategori" data-k="' + esc(k) + '">' + esc(k) + '</button>').join('') + '</div>' : '') +
        (gos.length ? gruplar : '<div class="bos">' + (aktifUrunler.length ? 'Ürün bulunamadı.' : 'Menüde ürün yok.' + (izin('menu') ? '<br><br><button class="btn ana" data-e="git" data-hedef="/yonetim">Menüye ürün ekle</button>' : '')) + '</div>');
    }

    function hesapHtml() {
      if (!hesap) return '<div class="bos">' + (paketMi() ? 'Bu pakete henüz sipariş girilmedi.' : 'Bu masada açık hesap yok.') + '<br>Menüden ürün ekleyip sipariş geçince hesap açılır.</div>' +
        (paketMi() ? '<button class="btn tehlike tam" data-e="paketSil">Paketi sil</button>' : '');
      const aktif = hesap.ads_kalemler.filter((k) => k.durum === 'aktif');
      const iptal = hesap.ads_kalemler.filter((k) => k.durum === 'iptal');
      const t = hesapToplam(hesap);
      const satir = (k) => '<div class="satir' + (k.durum === 'iptal' ? ' iptal' : ' tiklanir') + '"' + (k.durum === 'aktif' ? ' data-e="kalem" data-id="' + k.id + '"' : '') + '>' +
        '<div class="sol"><div class="ad">' + k.adet + ' × ' + esc(k.ad) + '</div>' +
        (k.notu ? '<div class="not">» ' + esc(k.notu) + '</div>' : '') +
        '<div class="kucuk">' + esc(k.garson_ad || '') + ' · ' + saat(k.olusturma) + (k.siparis_no ? ' · #' + k.siparis_no : '') +
        (k.durum === 'iptal' ? ' · iptal: ' + esc(k.iptal_eden || '') + (k.iptal_neden ? ' (' + esc(k.iptal_neden) + ')' : '') : '') + '</div></div>' +
        '<div class="sag">' + para(k.fiyat * k.adet) + '</div></div>';
      return '<div class="kucuk aciklama" style="margin:0 2px 8px">Açılış ' + saat(hesap.acilis) + ' · ' + sure(hesap.acilis) + ' · ' + esc(hesap.acan_ad || '') + '. İptal için ürüne dokun.</div>' +
        '<div class="kart">' + (aktif.length ? aktif.map(satir).join('') : '<div class="bos">Hesapta ürün kalmadı.</div>') + '</div>' +
        '<div class="kart dolgulu">' +
        (t.oran ? '<div class="toplam-satir"><span>Ara toplam</span><span>' + para(t.toplam) + '</span></div>' +
          '<div class="toplam-satir ustu"><span>Personel indirimi %' + t.oran + '</span><span>− ' + para(t.indirim) + '</span></div>' +
          '<div class="toplam-satir buyuk"><span>Ödenecek</span><span>' + para(t.net) + '</span></div>'
          : '<div class="toplam-satir buyuk"><span>Toplam</span><span>' + para(t.toplam) + '</span></div>') +
        hesap.ads_odemeler.map((o) => '<div class="toplam-satir"><span>' + odemeAdi(o) + ' <span class="kucuk aciklama">' + saat(o.olusturma) + '</span></span>' +
          '<span>− ' + para(o.tutar) + ' <button class="btn kucuk tehlike" style="min-height:28px;padding:2px 8px;margin-left:6px" data-e="odemeSil" data-id="' + o.id + '">×</button></span></div>').join('') +
        (t.kalan > 0.009 ? '<div class="toplam-satir kalan"><span>Kalan</span><span>' + para(t.kalan) + '</span></div>'
          : t.kalan < -0.009 ? '<div class="toplam-satir ustu"><span>Fazla ödeme</span><span>' + para(-t.kalan) + '</span></div>'
            : (t.net > 0 ? '<div class="toplam-satir ustu"><span>Ödendi ✓</span><span></span></div>' : '')) +
        '</div>' +
        (izin('indirim') ? '<button class="btn tam' + (t.oran ? ' ana' : '') + '" style="margin-bottom:8px" data-e="personel">' +
        (t.oran ? '👤 Personel hesabı açık (%' + t.oran + ') — kapat' : '👤 Personel hesabı (%' + personelOran() + ' indirim)') + '</button>' : '') +
        '<div class="btn-satir" style="margin-bottom:8px"><button class="btn ana buyuk" data-e="odeme">💳 Ödeme Al</button>' +
        '<button class="btn buyuk" data-e="hesapFisi">🧾 Hesap Fişi</button></div>' +
        (izin('masa_tasi') ? '<div class="btn-satir" style="margin-bottom:8px"><button class="btn" data-e="tasi">⇄ Masa Taşı / Birleştir</button></div>' : '') +
        '<button class="btn koyu tam buyuk" data-e="kapat">✓ Hesabı Kapat</button>' +
        (izin('hesap_iptal') ? '<button class="btn tehlike tam" style="margin-top:8px" data-e="hesapIptal">Hesabı Tamamen İptal Et</button>' : '') +
        (iptal.length ? '<div class="bolum-baslik">İptal edilenler</div><div class="kart">' + iptal.map(satir).join('') + '</div>' : '');
    }

    function ciz() {
      if (!masa) { $app.innerHTML = ustBar('Masa', '', geriBtn('/masalar')) + '<main class="icerik"><div class="bos">Masa bulunamadı.</div></main>'; return; }
      const t = hesap ? hesapToplam(hesap) : null;
      const yScroll = window.scrollY;
      const aramaOdakta = document.activeElement && document.activeElement.id === 'urun-ara';
      $app.innerHTML =
        ustBar((paketMi() ? '📦 ' : '') + masa.ad, hesap ? 'Açık hesap · ' + para(t.net) : (paketMi() ? 'Paket sipariş' : 'Boş masa'), geriBtn('/masalar'),
          izin('masalar') ? '<button class="ust-btn" data-e="adDegistir" aria-label="Adını değiştir">✏️</button>' : '') +
        '<main class="icerik">' +
        '<div class="sekmeler"><button class="sekme' + (sekme === 'menu' ? ' aktif' : '') + '" data-e="sekme" data-s="menu">Menü</button>' +
        (izin('hesap') ? '<button class="sekme' + (sekme === 'hesap' ? ' aktif' : '') + '" data-e="sekme" data-s="hesap">Hesap' + (t ? ' · ' + para(t.net) : '') + '</button>' : '') + '</div>' +
        (sekme === 'menu' || !izin('hesap') ? menuHtml() : hesapHtml()) + '</main>' +
        (sepet.length ? '<div class="alt-bar"><button class="btn ana buyuk sepet-btn" data-e="sepet"><span>🛒 Sepete Git <span class="sayi">' + sepetAdet() + '</span></span><span>' + para(sepetToplam()) + '</span></button></div>' : '');
      window.scrollTo(0, yScroll);
      const ara = document.getElementById('urun-ara');
      if (ara) {
        ara.oninput = () => { arama = ara.value; const pos = ara.selectionStart; ciz(); const y = document.getElementById('urun-ara'); y.focus(); try { y.setSelectionRange(pos, pos); } catch (e) { /* */ } };
        if (aramaOdakta) ara.focus();
      }
    }

    function paketMi() { return masa && masa.tur === 'paket'; }
    function personelOran() { return (S.ayarlar && S.ayarlar.personel_oran != null) ? S.ayarlar.personel_oran : 33; }

    function sepeteEkle(urunId) {
      const u = S.urunler.find((x) => x.id === urunId);
      if (!u) return;
      const sepetteki = sepet.filter((x) => x.urun_id === urunId).reduce((t, x) => t + x.adet, 0);
      if (!izin('siparis')) return bildir('Sipariş verme yetkin yok.', 'hata');
      const sd = stokDurum(u, sepetteki);
      if (sd.bitti) return bildir(u.ad + ': ' + sd.yazi.toLocaleLowerCase('tr'), 'hata');
      if (sd.dolu) return bildir(u.ad + ' için stokta ' + sd.kalan + ' adet var, hepsi sepette.', 'hata');
      const var_ = sepet.find((s) => s.urun_id === urunId && !s.not);
      if (var_) var_.adet++; else sepet.push({ anahtar: yeniId(), urun_id: u.id, ad: u.ad, fiyat: Number(u.fiyat), adet: 1, not: '' });
      sepetKaydet();
      if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* */ }
      ciz();
    }

    // ---------- sepet penceresi ----------
    function sepetAc() {
      const icerik = () => {
        if (!sepet.length) return '<button class="kapat-x" data-e="kapat">×</button><h2>Sepet</h2><div class="bos">Sepet boş.</div>';
        return '<button class="kapat-x" data-e="kapat">×</button><h2>Sepet · ' + esc(masa.ad) + '</h2>' +
          (paketMi() ? '<div class="paket-serit">📦 PAKET — fişte büyük yazacak</div>' : '') +
          '<div style="margin-top:8px">' + sepet.map((s) =>
            '<div class="satir"><div class="sol"><div class="ad">' + esc(s.ad) + '</div>' +
            '<div class="kucuk">' + para(s.fiyat) + ' · <b>' + para(s.fiyat * s.adet) + '</b></div>' +
            (s.not ? '<div class="not">📝 ' + esc(s.not) + '</div>' : '') +
            '<button class="not-btn" data-e="not" data-a="' + s.anahtar + '">' + (s.not ? '✎ Notu değiştir' : '+ Not ekle') + '</button></div>' +
            '<div class="adet-kutu"><button data-e="azalt" data-a="' + s.anahtar + '">−</button><span>' + s.adet + '</span><button data-e="arttir" data-a="' + s.anahtar + '">+</button></div></div>'
          ).join('') + '</div>' +
          '<div class="toplam-satir buyuk"><span>Toplam</span><span>' + para(sepetToplam()) + '</span></div>' +
          '<button class="genel-not' + (genelNot ? ' dolu' : '') + '" data-e="genelNot">' +
          (genelNot ? '<b>📝 Sipariş notu:</b> ' + esc(genelNot) : '📝 Bütün siparişe not ekle (örn. önce çorbalar, kapıya bırak)') + '</button>' +
          '<button class="btn ana tam buyuk" style="margin-top:14px" data-e="gec">Siparişi Geç</button>' +
          '<button class="btn tehlike tam kucuk" style="margin-top:10px" data-e="bosalt">Sepeti boşalt</button>';
      };
      const yenidenCiz = (p) => { p.innerHTML = icerik(); };
      const bul = (el) => sepet.find((s) => s.anahtar === el.dataset.a);
      pencere(icerik(), {
        arttir: (el, e, p) => {
          const s = bul(el); if (!s) return;
          const u = S.urunler.find((x) => x.id === s.urun_id);
          const sd = u ? stokDurum(u, sepet.filter((x) => x.urun_id === s.urun_id).reduce((t, x) => t + x.adet, 0)) : {};
          if (sd.bitti || sd.dolu) return bildir(s.ad + ': stokta ' + (sd.kalan || 0) + ' adet var.', 'hata');
          s.adet++; sepetKaydet(); yenidenCiz(p);
        },
        azalt: (el, e, p) => { const s = bul(el); if (!s) return; s.adet--; if (s.adet <= 0) sepet = sepet.filter((x) => x !== s); sepetKaydet(); yenidenCiz(p); },
        not: (el, e, p) => {
          const s = bul(el); if (!s) return;
          // birden fazla adetse, not sadece 1 tanesine mi?
          notPenceresi(s.ad + ' için not', s.not, (n, sadeceBir) => {
            if (s.adet > 1 && n && sadeceBir) {
              s.adet--; sepet.splice(sepet.indexOf(s) + 1, 0, { anahtar: yeniId(), urun_id: s.urun_id, ad: s.ad, fiyat: s.fiyat, adet: 1, not: n });
            } else {
              s.not = n;
              const ayni = sepet.find((x) => x !== s && x.urun_id === s.urun_id && (x.not || '') === s.not);
              if (ayni) { ayni.adet += s.adet; sepet = sepet.filter((x) => x !== s); }
            }
            sepetKaydet(); yenidenCiz(p);
          }, s.adet);
        },
        genelNot: (el, e, p) => notPenceresi('Bütün siparişin notu', genelNot, (n) => { genelNot = n; LS.yaz(NK, n); istekId = null; LS.sil(IK); yenidenCiz(p); }),
        bosalt: async (el, e, p, kapat) => { kapat(); if (await onayla('Sepet boşaltılsın mı?', '', 'Boşalt', true)) { sepet = []; sepetKaydet(); ciz(); } },
        gec: (el, e, p, kapat) => bekle(el, async () => {
          if (!sepet.length) return;
          if (!istekId) { istekId = yeniId(); LS.yaz(IK, istekId); }
          try {
            const r = await rpc('ads_siparis_gec', {
              p_masa: masaId,
              p_kalemler: sepet.map((s) => ({ urun_id: s.urun_id, adet: s.adet, not: s.not || null })),
              p_istek: istekId,
              p_not: genelNot || null
            });
            sepet = []; LS.sil(SK); istekId = null; LS.sil(IK); genelNot = ''; LS.sil(NK);
            kapat();
            bildir('Sipariş gönderildi ✓  #' + r.siparis_no, 'basari');
            kanalGonder('siparis');
            await Promise.all([hesabiYukle(), urunleriYukle()]).catch(() => {});
            ciz();
          } catch (err) {
            hata(err);
            if (/Menüde olmayan|stok|tükendi|satışta değil/i.test(hataMetni(err))) urunleriYukle().then(() => ciz()).catch(() => {});
          }
        })
      }, null, () => ciz());
    }

    // ---------- ödeme ----------
    async function odemeAc() {
      if (!hesap) return;
      const t = hesapToplam(hesap);
      let tur = 'nakit'; let ikramGarson = null;
      let ikramlar = [];
      try { ikramlar = await rpc('ads_ikram_durum'); } catch (e) { /* hediye listesi gelmezse diğer türler yine çalışır */ }
      const kalan = Math.max(0, t.kalan);
      // ürüne göre bölme: kim hangi ürünü ödedi cihazda not edilir, sonraki ödemede kalanlar gösterilir
      const bolAnahtar = 'ads_bol_' + hesap.id; const odenmis = LS.al(bolAnahtar, {}) || {};
      const aktifKalem = (hesap.ads_kalemler || []).filter((k) => k.durum === 'aktif');
      const faktor = t.toplam > 0 ? t.net / t.toplam : 1;
      let secim = {}; let urunModu = false;
      const kalanAdet = (k) => Math.max(0, k.adet - (odenmis[k.id] || 0));
      // aynı ürün + aynı fiyat tek satırda toplanır (3 ayrı siparişteki çay = "3 çay")
      const gruplar = [];
      aktifKalem.forEach((k) => {
        const anahtar = k.ad + '|' + k.fiyat; let g = gruplar.find((x) => x.a === anahtar);
        if (!g) { g = { a: anahtar, ad: k.ad, fiyat: Number(k.fiyat), kalemler: [] }; gruplar.push(g); }
        g.kalemler.push(k);
      });
      const gKalan = (g) => g.kalemler.reduce((t, k) => t + kalanAdet(k), 0);
      const gToplam = (g) => g.kalemler.reduce((t, k) => t + k.adet, 0);
      const urunHtml = () => '<div class="bol-liste">' + gruplar.map((g, i) => {
        const ka = gKalan(g); const sc = secim[i] || 0;
        if (!ka) return '<div class="bol-satir odendi"><span class="bol-ad">' + gToplam(g) + ' × ' + esc(g.ad) + '</span><span>✓ ödendi</span></div>';
        return '<div class="bol-satir"><span class="bol-ad">' + esc(g.ad) + '<small>' + para(g.fiyat * faktor) + ' · kalan ' + ka + (gToplam(g) !== ka ? ' / ' + gToplam(g) : '') + ' adet</small></span>' +
          '<span class="bol-say"><button type="button" class="btn kucuk" data-e="bolEksi" data-i="' + i + '" aria-label="Azalt">−</button><b>' + sc + '</b><button type="button" class="btn kucuk" data-e="bolArti" data-i="' + i + '" aria-label="Artır">+</button>' +
          (ka > 1 ? '<button type="button" class="btn kucuk" data-e="bolHepsi" data-i="' + i + '">Hepsi</button>' : '') + '</span></div>';
      }).join('') + '</div><p class="aciklama" style="margin:6px 0 0">Kişinin yediklerini seç, tutar otomatik yazılsın. Sonraki ödemede kalan ürünler gösterilir.</p>';
      const secimTutar = () => {
        const hepsi = gruplar.every((g, i) => (secim[i] || 0) >= gKalan(g));
        if (hepsi && gruplar.some((g) => gKalan(g) > 0)) return kalan;
        return Math.min(kalan, sayi(gruplar.reduce((a, g, i) => a + (secim[i] || 0) * g.fiyat * faktor, 0)));
      };
      const html = '<button class="kapat-x" data-e="kapat">×</button><h2>Ödeme Al</h2>' +
        '<p class="aciklama" style="font-size:15px">' + (t.oran ? 'Ödenecek (personel %' + t.oran + ') ' : 'Toplam ') + para(t.net) + ' · Kalan <b style="color:var(--kirmizi)">' + para(kalan) + '</b></p>' +
        '<label>Ödeme türü</label><div class="secenekler">' + Object.keys(ODEME_TUR).filter((k) => k !== 'garson_ikram' || ikramlar.length).map((k) =>
          '<button class="secenek' + (k === tur ? ' aktif' : '') + '" data-e="tur" data-t="' + k + '">' + ODEME_TUR[k] + '</button>').join('') + '</div>' +
        '<div id="o-ikram" style="display:none">' + (ikramlar.length === 1
          ? '<div class="kart dolgulu" style="margin:10px 0 0;box-shadow:none;background:var(--yesil-acik)"><b>🎁 ' + esc(ikramlar[0].ad) + (ikramlar[0].kendisi ? ' (sen)' : '') + '</b> hediye hakkından düşülecek · kalan <b>' + para(ikramlar[0].kalan) + '</b>' + (ikramlar[0].bitti ? ' · <b style="color:var(--kirmizi)">süresi doldu</b>' : (ikramlar[0].bitis ? ' · ⏳ ' + ikramBitisYazi(ikramlar[0].bitis) + '\'e kadar' : '')) + '</div>'
          : '<label>Kimin hediye hakkından düşülsün?</label><div class="secenekler">' +
            ikramlar.map((g) => '<button class="secenek" data-e="ikramSec" data-id="' + g.id + '"' + (g.kalan <= 0 ? ' disabled style="opacity:.45"' : '') + '>' + esc(g.ad) + (g.kendisi ? ' (sen)' : '') +
              '<br><span class="kucuk aciklama" style="margin:0">' + (g.bitti ? 'süresi doldu' : 'kalan ' + para(g.kalan) + (g.bitis ? ' · ⏳ ' + ikramBitisYazi(g.bitis) : '')) + '</span></button>').join('') + '</div>') + '</div>' +
        '<label for="o-t">Tutar (₺)</label><input id="o-t" class="para-input" inputmode="decimal" value="' + (kalan ? String(kalan).replace('.', ',') : '') + '">' +
        '<div class="btn-satir" style="margin-top:8px"><button class="btn kucuk" data-e="bol" data-n="1">Tamamı</button><button class="btn kucuk" data-e="bol" data-n="2">½</button>' +
        '<button class="btn kucuk" data-e="bol" data-n="3">⅓</button><button class="btn kucuk" data-e="bol" data-n="4">¼</button><button class="btn kucuk" data-e="kisi">Kişiye böl…</button><button class="btn kucuk" data-e="urunBol">🍽 Ürüne göre</button></div>' +
        '<div id="o-urun-alan" style="display:none"></div>' +
        '<div id="o-nakit"><label for="o-a">Müşteriden alınan (para üstü için, isteğe bağlı)</label><input id="o-a" inputmode="decimal" placeholder="Örn. 500">' +
        '<div id="o-ustu" class="toplam-satir ustu" style="display:none"></div></div>' +
        '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" data-e="kaydet">Ödemeyi Kaydet</button></div>';
      const oku = (v) => sayi(parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')));
      const okuGevsek = (v) => { const s = String(v || '').trim(); return /,/.test(s) ? oku(s) : sayi(parseFloat(s)); };
      const ustuGuncelle = (p) => {
        const tutar = okuGevsek(p.querySelector('#o-t').value); const alinan = okuGevsek(p.querySelector('#o-a').value);
        const el = p.querySelector('#o-ustu');
        if (tur === 'nakit' && alinan > 0 && tutar > 0) { el.style.display = 'flex'; el.innerHTML = '<span>Para üstü</span><span>' + para(alinan - tutar) + '</span>'; } else el.style.display = 'none';
      };
      const bolDegis = (p, i, d) => {
        const g = gruplar[i]; if (!g) return;
        secim[i] = Math.max(0, Math.min(gKalan(g), (secim[i] || 0) + d));
        p.querySelector('#o-urun-alan').innerHTML = urunHtml();
        p.querySelector('#o-t').value = String(secimTutar()).replace('.', ','); ustuGuncelle(p);
      };
      pencere(html, {
        tur: (el, e, p) => {
          tur = el.dataset.t;
          p.querySelectorAll('[data-e="tur"]').forEach((b) => b.classList.toggle('aktif', b === el));
          p.querySelector('#o-nakit').style.display = tur === 'nakit' ? '' : 'none';
          p.querySelector('#o-ikram').style.display = tur === 'garson_ikram' ? '' : 'none';
          if (tur !== 'garson_ikram') ikramGarson = null;
          else if (ikramlar.length === 1) {
            ikramGarson = ikramlar[0];
            if (ikramGarson.kalan <= 0) bildir(ikramGarson.bitti ? 'Hediye ikram hakkının süresi dolmuş.' : 'Hediye ikram hakkın bitti.', 'hata');
            p.querySelector('#o-t').value = String(sayi(Math.min(kalan, ikramGarson.kalan))).replace('.', ',');
          }
          ustuGuncelle(p);
        },
        ikramSec: (el, e, p) => {
          const g = ikramlar.find((x) => x.id === el.dataset.id); if (!g || g.kalan <= 0) return;
          ikramGarson = g;
          p.querySelectorAll('[data-e="ikramSec"]').forEach((b) => b.classList.toggle('aktif', b === el));
          p.querySelector('#o-t').value = String(sayi(Math.min(kalan, g.kalan))).replace('.', ',');
        },
        urunBol: (el, e, p) => {
          urunModu = !urunModu; const a = p.querySelector('#o-urun-alan'); a.style.display = urunModu ? '' : 'none';
          if (urunModu) { secim = {}; a.innerHTML = urunHtml(); }
        },
        bolArti: (el, e, p) => bolDegis(p, Number(el.dataset.i), 1),
        bolEksi: (el, e, p) => bolDegis(p, Number(el.dataset.i), -1),
        bolHepsi: (el, e, p) => bolDegis(p, Number(el.dataset.i), 999),
        bol: (el, e, p) => { const n = Number(el.dataset.n); p.querySelector('#o-t').value = String(sayi(kalan / n)).replace('.', ','); ustuGuncelle(p); },
        kisi: (el, e, p) => {
          const n = parseInt(prompt('Hesap kaç kişiye bölünecek?', '2'), 10);
          if (n > 0) { p.querySelector('#o-t').value = String(sayi(kalan / n)).replace('.', ','); ustuGuncelle(p); }
        },
        kaydet: (el, e, p, kapat) => bekle(el, async () => {
          const tutar = okuGevsek(p.querySelector('#o-t').value);
          if (!(tutar > 0)) return bildir('Tutar gir.', 'hata');
          if (tur === 'garson_ikram' && !ikramGarson) return bildir('Hangi garsonun hakkından düşüleceğini seç.', 'hata');
          try {
            await rpc('ads_odeme_ekle', { p_adisyon: hesap.id, p_tur: tur, p_tutar: tutar, p_ikram_garson: ikramGarson ? ikramGarson.id : null });
            if (urunModu) {
              gruplar.forEach((g, i) => { let n = secim[i] || 0; g.kalemler.forEach((k) => { const al = Math.min(n, kalanAdet(k)); if (al > 0) { odenmis[k.id] = (odenmis[k.id] || 0) + al; n -= al; } }); });
              LS.yaz(bolAnahtar, odenmis);
            }
            kapat();
            bildir(ODEME_TUR[tur] + (ikramGarson ? ' (' + ikramGarson.ad + ')' : '') + ' ' + para(tutar) + ' kaydedildi', 'basari');
            await hesabiYukle();
            ciz();
            if (hesap && hesapToplam(hesap).kalan <= 0.009) kapatAc();
          } catch (err) { hata(err); }
        })
      }, (p) => {
        p.querySelector('#o-t').addEventListener('input', () => ustuGuncelle(p));
        p.querySelector('#o-a').addEventListener('input', () => ustuGuncelle(p));
      });
    }

    function kapatAc() {
      if (!hesap) return;
      const t = hesapToplam(hesap);
      const otomatik = S.ayarlar ? S.ayarlar.hesap_fisi_otomatik : true;
      const borc = t.kalan > 0.009;
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>Hesabı Kapat · ' + esc(masa.ad) + '</h2>' +
        (t.oran ? '<div class="toplam-satir"><span>Personel indirimi %' + t.oran + '</span><span>− ' + para(t.indirim) + '</span></div>' : '') +
        '<div class="toplam-satir buyuk"><span>' + (t.oran ? 'Ödenecek' : 'Toplam') + '</span><span>' + para(t.net) + '</span></div>' +
        '<div class="toplam-satir"><span>Ödenen</span><span>' + para(t.odenen) + '</span></div>' +
        (borc ? '<div class="toplam-satir kalan"><span>Kalan</span><span>' + para(t.kalan) + '</span></div>' +
          '<p class="aciklama" style="color:var(--kirmizi);font-size:14px">Kalan tutar ödenmeden hesap kapanamaz.</p>' +
          '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" data-e="odemeye">Ödeme Al</button></div>'
          : '<label class="anahtar"><span>Hesap fişi yazdırılsın</span><input type="checkbox" id="k-f"' + (otomatik ? ' checked' : '') + '></label>' +
          '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn koyu" data-e="evet">Hesabı Kapat</button></div>'), {
        odemeye: (el, e, p, kapat) => { kapat(); odemeAc(); },
        evet: (el, e, p, kapat) => bekle(el, async () => {
          try {
            await rpc('ads_hesap_kapat', { p_adisyon: hesap.id, p_yazdir: p.querySelector('#k-f').checked });
            kapat();
            LS.sil('ads_sekme_' + masaId); LS.sil('ads_bol_' + hesap.id);
            bildir(masa.ad + ' kapatıldı ✓', 'basari'); kanalGonder('fis');
            git('/masalar');
          } catch (err) { hata(err); }
        })
      });
    }

    function kalemAc(kalemId) {
      const k = hesap && hesap.ads_kalemler.find((x) => x.id === kalemId);
      if (!k) return;
      const yetkili = izin('iptal') || (S.ayarlar && S.ayarlar.iptal_yetkisi === 'herkes');
      let adet = k.adet;
      const nedenler = ['Yanlış sipariş', 'Müşteri vazgeçti', 'Ürün kalmadı', 'İkram edildi'];
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + k.adet + ' × ' + esc(k.ad) + '</h2>' +
        '<p class="aciklama">' + para(k.fiyat) + ' · ' + esc(k.garson_ad || '') + ' · ' + saat(k.olusturma) + '</p>' +
        (k.notu ? '<div class="kalem-not-kutu">📝 Not: <b>' + esc(k.notu) + '</b><span>Hangi ürünü iptal ettiğin fişe ve kayda bu notla otomatik yazılır.</span></div>' : '') +
        (yetkili ?
          (k.adet > 1 ? '<label>Kaç adet iptal edilecek?</label><div class="adet-kutu"><button data-e="az">−</button><span id="i-a">' + adet + '</span><button data-e="cok">+</button></div>' : '') +
          '<label for="i-n">İptal nedeni</label><input id="i-n" placeholder="İsteğe bağlı">' +
          '<div class="btn-satir" style="margin-top:8px">' + nedenler.map((n) => '<button class="btn kucuk" data-e="neden" data-n="' + esc(n) + '">' + esc(n) + '</button>').join('') + '</div>' +
          '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn tehlike dolu" data-e="iptal">İptal Et</button></div>'
          : '<p style="margin-top:14px">İptal işlemini sadece yönetici yapabilir. Yöneticiye haber ver.</p><div class="eylemler"><button class="btn" data-e="kapat">Tamam</button></div>'), {
        az: (el, e, p) => { adet = Math.max(1, adet - 1); p.querySelector('#i-a').textContent = adet; },
        cok: (el, e, p) => { adet = Math.min(k.adet, adet + 1); p.querySelector('#i-a').textContent = adet; },
        neden: (el, e, p) => { p.querySelector('#i-n').value = el.dataset.n; },
        iptal: (el, e, p, kapat) => bekle(el, async () => {
          try {
            await rpc('ads_kalem_iptal', { p_kalem: k.id, p_adet: adet, p_neden: p.querySelector('#i-n').value });
            kapat();
            bildir(adet + ' × ' + k.ad + ' iptal edildi', 'basari'); kanalGonder('iptal');
            await hesabiYukle(); ciz();
          } catch (err) { hata(err); }
        })
      });
    }

    async function tasiAc() {
      if (!hesap) return;
      try { await Promise.all([masalariYukle(), acikHesaplariYukle()]); } catch (e) { return hata(e); }
      const dolu = new Set(S.acik.map((a) => a.masa_id));
      const digerleri = S.masalar.filter((m) => m.id !== masaId);
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>Hangi masaya taşınsın?</h2>' +
        '<p class="aciklama">Dolu bir masa seçersen iki hesap birleşir.</p><div class="secenekler" style="margin-top:12px">' +
        digerleri.map((m) => '<button class="secenek" data-e="sec" data-id="' + m.id + '">' + esc(m.ad) + (dolu.has(m.id) ? '<br><span class="etiket yesil">dolu</span>' : '') + '</button>').join('') +
        '</div>', {
        sec: async (el, e, p, kapat) => {
          const hedef = S.masalar.find((m) => m.id === el.dataset.id);
          kapat();
          if (!await onayla(masa.ad + ' → ' + hedef.ad, dolu.has(hedef.id) ? 'İki masanın hesabı birleştirilecek.' : 'Hesap bu masaya taşınacak.', dolu.has(hedef.id) ? 'Birleştir' : 'Taşı')) return;
          try {
            await rpc('ads_masa_tasi', { p_adisyon: hesap.id, p_hedef_masa: hedef.id });
            bildir('Taşındı → ' + hedef.ad, 'basari'); kanalGonder('masa');
            LS.yaz('ads_sekme_' + hedef.id, 'hesap');
            git('/masa/' + hedef.id);
          } catch (err) { hata(err); }
        }
      });
    }

    function adDegistirAc() {
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>Masa adını değiştir</h2>' +
        '<form><input id="m-ad" value="' + esc(masa.ad) + '" maxlength="40" required>' +
        '<div class="eylemler"><button type="button" class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" type="submit">Kaydet</button></div></form>', {
        gonder: async (form, e, p, kapat) => {
          const ad = p.querySelector('#m-ad').value.trim(); if (!ad) return;
          try { await q(db.from('ads_masalar').update({ ad }).eq('id', masaId)); masa.ad = ad; kapat(); ciz(); bildir('Kaydedildi', 'basari'); } catch (err) { hata(err); }
        }
      }, (p) => { const i = p.querySelector('#m-ad'); i.focus(); i.select(); });
    }

    eylemBagla(Object.assign({}, ortakEylemler, {
      sekme: (el) => { sekme = el.dataset.s; LS.yaz('ads_sekme_' + masaId, sekme); window.scrollTo(0, 0); ciz(); },
      kategori: (el) => { kategori = el.dataset.k; ciz(); },
      ekle: (el) => sepeteEkle(el.dataset.id),
      sepet: () => sepetAc(),
      kalem: (el) => kalemAc(el.dataset.id),
      odeme: () => odemeAc(),
      kapat: () => kapatAc(),
      tasi: () => tasiAc(),
      adDegistir: () => adDegistirAc(),
      personel: async (el) => {
        if (!hesap) return;
        const acik = !(Number(hesap.indirim_oran) > 0);
        if (acik && hesap.ads_odemeler.length) bildir('Ödeme alınmış; kalan tutar yeniden hesaplandı.');
        await bekle(el, async () => {
          try {
            await rpc('ads_personel_hesap', { p_adisyon: hesap.id, p_acik: acik });
            await hesabiYukle(); ciz();
            bildir(acik ? 'Personel indirimi uygulandı (%' + personelOran() + ')' : 'Personel indirimi kaldırıldı', 'basari');
          } catch (err) { hata(err); }
        });
      },
      paketSil: async () => {
        if (!await onayla('Paket silinsin mi?', '', 'Sil', true)) return;
        try { await rpc('ads_paket_sil', { p_masa: masaId }); git('/masalar'); } catch (err) { hata(err); }
      },
      odemeSil: async (el) => {
        if (!await onayla('Bu ödeme silinsin mi?', 'Yanlış girilen ödemeyi geri almak için.', 'Sil', true)) return;
        try { await rpc('ads_odeme_sil', { p_odeme: el.dataset.id }); await hesabiYukle(); ciz(); } catch (err) { hata(err); }
      },
      hesapFisi: (el) => bekle(el, async () => {
        try { await rpc('ads_hesap_fisi', { p_adisyon: hesap.id }); bildir('Hesap fişi yazıcıya gönderildi 🧾', 'basari'); kanalGonder('fis'); } catch (err) { hata(err); }
      }),
      hesapIptal: async () => {
        const neden = prompt('Hesap tamamen iptal edilecek. Neden? (isteğe bağlı)', '');
        if (neden === null) return;
        if (!await onayla('Hesap iptal edilsin mi?', 'Bütün ürünler iptal edilir, ödemeler silinir. Geri alınamaz.', 'Hesabı İptal Et', true)) return;
        try { await rpc('ads_adisyon_iptal', { p_adisyon: hesap.id, p_neden: neden }); bildir('Hesap iptal edildi', 'basari'); kanalGonder('iptal'); git('/masalar'); } catch (err) { hata(err); }
      }
    }));

    $app.innerHTML = ustBar('…', '', geriBtn('/masalar')) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try {
      await Promise.all([masaYukle(), hesabiYukle(), urunleriYukle(), S.ayarlar ? null : ayarlariYukle()]);
      sonVeri = JSON.stringify(hesap);
      ciz();
    } catch (e) {
      hata(e);
      $app.querySelector('main').innerHTML = '<div class="bos">Yüklenemedi.<br><br><button class="btn" data-e="git" data-hedef="/masa/' + esc(masaId) + '">Tekrar dene</button></div>';
      return;
    }
    let tur = 0;
    // menü sekmesinde stok her turda, hesap sekmesinde hesap her turda tazelenir (20 garsonda sunucuyu yormaz)
    const tazele = async (hepsi) => {
      tur++;
      const isler = [];
      if (hepsi || sekme === 'hesap' || tur % 3 === 0) isler.push(hesabiYukle());
      if (hepsi || sekme === 'menu' || tur % 5 === 0) isler.push(urunleriYukle());
      await Promise.all(isler);
      const v = JSON.stringify(hesap) + JSON.stringify(S.urunler.map((u) => [u.id, u.stok, u.tukendi, u.aktif, u.fiyat, u.ad]));
      if (v !== sonVeri) { sonVeri = v; ciz(); }
    };
    const durdur = yenileyici(() => tazele(false), 3000);
    let bekleyen = null;
    const birak = kanalDinle(() => {
      clearTimeout(bekleyen);
      bekleyen = setTimeout(() => {
        if (pencereSayisi > 0) return;
        const odak = document.activeElement; if (odak && /INPUT|TEXTAREA/.test(odak.tagName)) return;
        tazele(true).catch(() => {});
      }, 150);
    });
    sayfaTemizle = () => { durdur(); birak(); clearTimeout(bekleyen); };
  }

  // ---------------------------------------------------------------
  // FİŞ ÇIKTISI
  // ---------------------------------------------------------------
  function fisStiliAyarla() {
    const g = (S.ayarlar && Number(S.ayarlar.fis_genislik)) || 80;
    const icGenislik = g === 58 ? 48 : 72;
    $fisStil.textContent = '@page { margin: 0; } ' +
      '#fis-alani .fis { width: ' + icGenislik + 'mm; padding: 2mm ' + (g === 58 ? 1 : 2) + 'mm 6mm; font-size: calc(' + (g === 58 ? 11 : 12.5) + 'px * var(--o, 1)); }';
  }

  // ---- Fiş şablonu (Yönetim › Fiş Tasarımı). Eksik alanlar varsayılanla tamamlanır.
  const FIS_VARSAYILAN = {
    yazi: 'normal', font: 'mono', cizgi: 'kesik',
    ust: ['', '', ''],
    siparis: { masa: 'cok', kalem: 'buyuk', no: true, garson: true, saat: true, tarih: true, istasyon: true, ust: '', alt: '' },
    hesap: { isletme: true, garson: true, tarih: true, birim: true, odemeler: true, mali: 'Mali değeri yoktur', alt2: '' },
    iptal: { garson: true, neden: true },
    logo: { veri: '', boyut: 'orta', hesap: true, siparis: false, iptal: false }
  };
  const FIS_FONTLAR = [
    ['mono', 'Daktilo (Courier New)'], ['sans', 'Düz (Arial)'], ['verdana', 'Geniş ve okunaklı (Verdana)'],
    ['tahoma', 'Dar ve net (Tahoma)'], ['trebuchet', 'Yumuşak (Trebuchet)'], ['segoe', 'Modern (Segoe UI)'],
    ['calibri', 'Sade (Calibri)'], ['konsol', 'Kod yazısı (Consolas)'], ['georgia', 'Klasik, tırnaklı (Georgia)'],
    ['times', 'Gazete (Times New Roman)'], ['impact', 'Kalın başlık (Impact)']
  ];
  const FIS_OLCEK = { kucuk: 0.85, normal: 1, buyuk: 1.2, cokbuyuk: 1.4 };
  let varsayilanFisLogo = '';
  fetch('logo-fis.png').then((r) => (r.ok ? r.blob() : null)).then((b) => { if (!b) return; const fr = new FileReader(); fr.onload = () => { varsayilanFisLogo = 'data:image/png;base64,' + String(fr.result || '').split(',')[1]; }; fr.readAsDataURL(b); }).catch(() => {});
  function fisSablon(ay) {
    const k = (ay && ay.fis_sablon) || {}; const v = FIS_VARSAYILAN;
    return {
      yazi: k.yazi || v.yazi, font: k.font || v.font, cizgi: k.cizgi || v.cizgi,
      ust: [0, 1, 2].map((i) => (Array.isArray(k.ust) && k.ust[i]) || ''),
      siparis: Object.assign({}, v.siparis, k.siparis || {}),
      hesap: Object.assign({}, v.hesap, k.hesap || {}),
      iptal: Object.assign({}, v.iptal, k.iptal || {}),
      logo: (() => { const l = Object.assign({}, v.logo, k.logo || {}); if (!l.veri && !l.kapali && varsayilanFisLogo) { l.veri = varsayilanFisLogo; l.boyut = (k.logo && k.logo.boyut) || 'buyuk'; } return l; })()
    };
  }

  function fisHtml(f, ayGecici) {
    const v = f.veri || {};
    const ay = ayGecici || S.ayarlar || {};
    const t = fisSablon(ay);
    const zaman = v.zaman || f.olusturma;
    const sar = (ic) => '<div class="fis cz-' + t.cizgi + ' ft-' + t.font + '" style="--o:' + (FIS_OLCEK[t.yazi] || 1) + '">' + ic + '</div>';
    const lg = t.logo;
    const logoHtml = (tur) => (lg.veri && lg[tur] && /^data:image\/png;base64,[A-Za-z0-9+\/=]+$/.test(lg.veri)) ? '<div class="orta fis-logo l-' + esc(lg.boyut) + '"><img src="' + lg.veri + '" alt=""></div>' : '';
    const iki = (sol, sag) => (sol || sag) ? '<div class="s"><span>' + (sol || '') + '</span><span>' + (sag || '') + '</span></div>' : '';
    if (f.tur === 'siparis') {
      const s = t.siparis;
      const masaSinif = s.masa === 'cok' ? 'cok-buyuk' : s.masa === 'buyuk' ? 'buyuk' : 'b';
      return sar(
        logoHtml('siparis') +
        (v.paket ? '<div class="paket-baslik">PAKET</div>' : '') +
        (s.ust ? '<div class="orta b">' + esc(s.ust) + '</div>' : '') +
        '<div class="orta ' + masaSinif + '">' + esc(v.masa) + '</div>' +
        (s.istasyon && v.istasyon_ad ? '<div class="orta istasyon-fis">» ' + esc(v.istasyon_ad) + ' «</div>' : '') +
        (s.no ? '<div class="orta b">SİPARİŞ #' + esc(v.no) + (v.parca_say > 1 ? '  (' + v.parca + '/' + v.parca_say + ')' : '') + '</div>' : '') +
        iki(s.garson ? esc(v.garson) : '', s.saat ? saat(zaman) : '') +
        (v.not ? '<div class="genel-not-fis">NOT: ' + esc(v.not) + '</div>' : '') +
        '<div class="cift-cizgi"></div>' +
        (v.kalemler || []).map((k) => '<div class="kalem' + (s.kalem === 'buyuk' ? '' : ' n') + '">' + k.adet + ' x ' + esc(k.ad) + '</div>' + (k.not ? '<div class="not">&gt;&gt; ' + esc(k.not) + '</div>' : '')).join('') +
        (v.paket ? '<div class="paket-baslik" style="margin-top:6px">PAKET</div>' : '') +
        '<div class="cizgi"></div>' +
        (s.alt ? '<div class="orta b">' + esc(s.alt) + '</div>' : '') +
        (s.tarih ? '<div class="orta">' + tarihSaat(zaman) + '</div>' : ''));
    }
    if (f.tur === 'iptal') {
      const i = t.iptal;
      return sar(
        logoHtml('iptal') +
        '<div class="orta buyuk ters">*** İPTAL ***</div>' +
        '<div class="orta cok-buyuk">' + esc(v.masa) + '</div>' +
        iki(i.garson ? esc(v.garson) : '', saat(zaman)) +
        '<div class="cift-cizgi"></div>' +
        (v.kalemler || []).map((k) => '<div class="kalem">-' + k.adet + ' x ' + esc(k.ad) + '</div>' + (k.not ? '<div class="not">&gt;&gt; ' + esc(k.not) + '</div>' : '')).join('') +
        (i.neden && v.neden ? '<div class="cizgi"></div><div>Neden: ' + esc(v.neden) + '</div>' : '') +
        '<div class="cizgi"></div><div class="orta">' + tarihSaat(zaman) + '</div>');
    }
    if (f.tur === 'hesap') {
      const h = t.hesap;
      const toplam = Number(v.toplam) || 0; const odenen = Number(v.odenen) || 0;
      const net = v.net != null ? Number(v.net) : toplam;
      return sar(
        logoHtml('hesap') +
        (h.isletme ? '<div class="orta buyuk">' + esc(ay.isletme_adi || 'Yavuztürk Süleymaniye') + '</div>' : '') +
        t.ust.filter(Boolean).map((x) => '<div class="orta">' + esc(x) + '</div>').join('') +
        '<div class="orta b">' + (v.ara ? 'ARA HESAP' : 'HESAP') + (v.paket ? ' · PAKET' : '') + '</div>' +
        '<div class="cizgi"></div>' +
        '<div class="s b"><span>Masa: ' + esc(v.masa) + '</span><span>' + saat(zaman) + '</span></div>' +
        iki(h.tarih ? tarihSaat(zaman).split(' ')[0] : '', h.garson ? esc(v.garson || '') : '') +
        '<div class="cizgi"></div>' +
        (v.kalemler || []).map((k) => h.birim
          ? '<div class="b">' + esc(k.ad) + '</div><div class="s"><span>&nbsp;' + k.adet + ' x ' + para2(k.fiyat) + '</span><span>' + para2(k.tutar) + '</span></div>'
          : '<div class="s"><span>' + k.adet + ' x ' + esc(k.ad) + '</span><span>' + para2(k.tutar) + '</span></div>').join('') +
        '<div class="cift-cizgi"></div>' +
        (Number(v.indirim_oran) > 0
          ? '<div class="s"><span>Ara toplam</span><span>' + para2(toplam) + '</span></div>' +
            '<div class="s"><span>Personel ind. %' + v.indirim_oran + '</span><span>-' + para2(toplam - Number(v.net)) + '</span></div>' +
            '<div class="s toplam"><span>TOPLAM</span><span>' + para2(v.net) + ' TL</span></div>'
          : '<div class="s toplam"><span>TOPLAM</span><span>' + para2(toplam) + ' TL</span></div>') +
        (h.odemeler && (v.odemeler || []).length ? '<div class="cizgi"></div>' + v.odemeler.map((o) => '<div class="s"><span>' + odemeAdi(o) + '</span><span>' + para2(o.tutar) + '</span></div>').join('') : '') +
        (v.ara && net - odenen > 0.009 ? '<div class="s b"><span>KALAN</span><span>' + para2(net - odenen) + ' TL</span></div>' : '') +
        '<div class="cizgi"></div>' +
        (ay.fis_alt_yazi ? '<div class="orta b">' + esc(ay.fis_alt_yazi) + '</div>' : '') +
        (h.alt2 ? '<div class="orta">' + esc(h.alt2) + '</div>' : '') +
        (h.mali ? '<div class="orta mali">' + esc(h.mali) + '</div>' : ''));
    }
    if (f.tur === 'rapor') return v.html;
    return '<div class="fis"><div class="orta buyuk">DENEME FİŞİ</div><div class="cizgi"></div>' +
      '<div>Yazıcı çalışıyor ✓</div><div>Genişlik: ' + (ay.fis_genislik || 80) + ' mm</div><div>Gönderen: ' + esc(v.garson || '') + '</div>' +
      '<div class="cizgi"></div><div class="orta">' + tarihSaat(zaman) + '</div></div>';
  }

  // Yazdırma: Chrome art arda gelen print() çağrılarını (önceki iş bitmeden) yok sayar.
  // Bu yüzden aynı anda gelen fişler TEK yazdırma işinde, her biri ayrı sayfa (ayrı kesilen fiş)
  // olarak basılır; iki yazdırma arasında yazıcının bitirmesi beklenir.
  let sonBaski = 0; let baskiZinciri = Promise.resolve();
  const uyu = (ms) => new Promise((r) => setTimeout(r, ms));
  function yazdirToplu(liste) {
    const is = baskiZinciri.then(async () => {
      if (!liste.length) return;
      const bekle = sonBaski + 2500 - Date.now();
      if (bekle > 0) await uyu(bekle);
      fisStiliAyarla();
      $fis.innerHTML = liste.map((f) => fisHtml(f)).join('');
      await resimleriBekle($fis);
      await new Promise((coz) => {
        let bitti = false;
        const son = () => { if (bitti) return; bitti = true; window.removeEventListener('afterprint', son); coz(); };
        window.addEventListener('afterprint', son);
        try { window.print(); } catch (e) { /* */ }
        setTimeout(son, 8000); // afterprint gelmezse en fazla 8 sn bekle
      });
      sonBaski = Date.now();
      await uyu(400);
    });
    baskiZinciri = is.catch(() => {});
    return is;
  }
  function yazdir(f) { return yazdirToplu([f]); }
  // logo gibi resimler yüklenmeden print() çağrılırsa fişte boş çıkar: önce yüklenmelerini bekle
  function resimleriBekle(kok, ms) {
    const r = Array.from(kok.querySelectorAll('img')).map((im) => (im.complete && im.naturalWidth ? Promise.resolve() : (im.decode ? im.decode().catch(() => {}) : Promise.resolve())));
    return Promise.race([Promise.all(r), uyu(ms || 1500)]);
  }

  // ---------------------------------------------------------------
  // KASA (yazıcı ekranı)
  // ---------------------------------------------------------------
  async function kasaSayfa() {
    let basladi = false;
    let sesAcik = LS.al('ads_kasa_ses', true);
    let sonKontrol = null; let baglantiHata = false;
    let son = [];
    let isci = null; let kilit = null;
    let calisiyor = false; let tur = 0; let kasaKanal = null;
    // bu kasa hangi istasyonların fişini bassın (cihaza özel). null/boş = hepsi
    let istasyonlar = LS.al('ads_kasa_istasyon', null); // null = hepsi, yoksa [0,1,...]
    const istHepsi = () => !istasyonlar || !istasyonlar.length;
    const istBasar = (f) => istHepsi() || istasyonlar.includes(Number(f.istasyon != null ? f.istasyon : (f.veri && f.veri.istasyon) || 0));
    function istDurumYazi() {
      if (istHepsi()) return 'Bütün istasyonlar';
      return istasyonlar.map((n) => istAdi(n)).join(', ');
    }

    function bip() {
      if (!sesAcik) return;
      const a = sesAyari('siparis'); sesCal(a.ses, a.vol);
    }

    function ciz() {
      const etiket = { siparis: '<span class="etiket yesil">Sipariş</span>', iptal: '<span class="etiket kirmizi">İptal</span>', hesap: '<span class="etiket">Hesap</span>', test: '<span class="etiket">Deneme</span>', rapor: '<span class="etiket">Rapor</span>' };
      $app.innerHTML = ustBar('Kasa / Yazıcı', 'Bu sayfa açık kalmalı', geriBtn('/masalar'), '<button class="ust-btn" data-e="menu">☰</button>') +
        '<main class="icerik">' +
        (!basladi
          ? '<div class="kart dolgulu"><h2 style="margin:0 0 6px">Yazıcı modunu başlat</h2>' +
            '<p class="aciklama" style="font-size:15px">Garsonların gönderdiği siparişler bu bilgisayardaki yazıcıdan otomatik basılır. Başlattıktan sonra bu sekmeyi kapatma ve önde tut.</p>' +
            '<button class="btn ana tam buyuk" style="margin-top:14px" data-e="basla">▶ Başlat</button></div>'
          : '<div class="kasa-durum' + (baglantiHata ? ' hata' : '') + '"><span class="nokta"></span><div><b>' + (baglantiHata ? 'Bağlantı yok — tekrar deneniyor' : 'Yazıcı modu açık') + '</b>' +
            '<span style="opacity:.85;font-size:14px">' + (sonKontrol ? 'Son kontrol ' + sonKontrol.toLocaleTimeString('tr-TR') : 'Bağlanıyor…') + '</span></div></div>') +
        '<div class="kart dolgulu" style="margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">' +
        '<div><b>🖨 Bu kasa basıyor:</b> ' + esc(istDurumYazi()) + '</div><button class="btn kucuk" data-e="istSec">Değiştir</button></div>' +
        '<div class="btn-satir" style="margin-bottom:12px"><button class="btn" data-e="test">🧾 Deneme Fişi</button>' +
        '<button class="btn" data-e="ses">' + (sesAcik ? '🔔 Ses açık' : '🔕 Ses kapalı') + '</button>' +
        '<button class="btn" data-e="git" data-hedef="/sesler">🎵 Ses ayarı</button></div>' +
        '<div class="kart dolgulu" style="font-size:14px"><b>Onay penceresi çıkmadan basması için</b>' +
        '<p class="aciklama" style="font-size:14px">Chrome\'u masaüstündeki <b>"Adisyon Kasa"</b> kısayoluyla aç (kurulumu BENİ OKU dosyasında). Normal Chrome\'da her fişte yazdırma penceresi çıkar, Enter\'a basman gerekir. Fiş genişliği şu an <b>' + ((S.ayarlar && S.ayarlar.fis_genislik) || 80) + ' mm</b> (Yönetim › Ayarlar).</p></div>' +
        '<div class="bolum-baslik">Son fişler</div>' +
        '<div class="kart">' + (son.length ? son.map((f) => '<div class="satir"><div class="sol"><div class="ad">' + (etiket[f.tur] || '') + ' ' + esc((f.veri && f.veri.masa) || '') +
          (f.tur === 'siparis' && f.veri ? ' · #' + esc(f.veri.no) : '') + '</div><div class="kucuk">' + saat(f.olusturma) + ' · ' + esc((f.veri && f.veri.garson) || '') +
          (f.basildi ? ' · basıldı' : ' · <b style="color:var(--turuncu)">bekliyor</b>') + '</div></div>' +
          '<button class="btn kucuk" data-e="tekrar" data-id="' + f.id + '">Tekrar bas</button></div>').join('') : '<div class="bos">Henüz fiş yok.</div>') + '</div>' +
        '</main>';
    }

    function istasyonSecPenceresi() {
      const adlar = (S.ayarlar && S.ayarlar.istasyon_adlari) || {};
      const kullanilan = Array.from(new Set(S.kategoriler.map((c) => Number(c.istasyon)))).filter((n) => n > 0);
      const liste = Array.from(new Set([0].concat(kullanilan, Object.keys(adlar).map(Number)))).sort((a, b) => a - b);
      let sec = istHepsi() ? liste.slice() : istasyonlar.slice();
      const html = () => '<button class="kapat-x" data-e="kapat">×</button><h2>Bu kasa hangi fişleri bassın?</h2>' +
        '<p class="aciklama">Her yazıcı/istasyon için ayrı cihaz kullanıyorsan, o cihazda sadece kendi istasyonunu seç (örn. balık yazıcısında sadece Balık). Tek bilgisayardaysan hepsini seçili bırak.</p>' +
        '<label class="anahtar" style="border-bottom:1px solid var(--cizgi)"><span><b>Hepsi</b> (bütün istasyonlar)</span><input type="checkbox" id="is-hepsi"' + (istHepsi() ? ' checked' : '') + '></label>' +
        '<div id="is-liste">' + liste.map((n) => '<label class="anahtar"><span>' + esc(istAdi(n)) + (n === 0 ? ' — hesap, gün sonu fişleri' : '') + '</span><input type="checkbox" data-is="' + n + '"' + (sec.includes(n) ? ' checked' : '') + '></label>').join('') + '</div>' +
        '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" data-e="kaydet">Kaydet</button></div>';
      pencere(html(), {
        kaydet: (el, e, p, kapat) => {
          if (p.querySelector('#is-hepsi').checked) { istasyonlar = null; LS.sil('ads_kasa_istasyon'); }
          else {
            const secili = Array.from(p.querySelectorAll('[data-is]:checked')).map((x) => Number(x.dataset.is));
            if (!secili.length) return bildir('En az bir istasyon seç ya da "Hepsi".', 'hata');
            istasyonlar = secili; LS.yaz('ads_kasa_istasyon', secili);
          }
          kapat(); bildir('Kaydedildi: ' + istDurumYazi(), 'basari'); ciz(); if (basladi) kontrol();
        }
      }, (p) => {
        const hepsi = p.querySelector('#is-hepsi');
        hepsi.addEventListener('change', () => { p.querySelectorAll('[data-is]').forEach((x) => { x.checked = hepsi.checked; }); });
        p.querySelectorAll('[data-is]').forEach((x) => x.addEventListener('change', () => { if (!x.checked) hepsi.checked = false; }));
      });
    }

    async function listeYukle() {
      son = await q(db.from('ads_fis_kuyrugu').select('*').order('id', { ascending: false }).limit(25));
    }

    async function kontrol() {
      if (calisiyor || !basladi) return;
      calisiyor = true;
      try {
        let sorgu = db.from('ads_fis_kuyrugu').select('id, istasyon').eq('basildi', false).order('id').limit(40);
        if (!istHepsi()) sorgu = sorgu.in('istasyon', istasyonlar);
        const bekleyen = await q(sorgu);
        const alinan = [];
        for (const b of bekleyen) {
          const f = await rpc('ads_fis_al', { p_id: b.id, p_tekrar: false });
          if (f) alinan.push(f); // null ise başka kasa ekranı aldı
        }
        const basildi = alinan.length > 0;
        if (basildi) {
          if (sesAcik) fisSesiCal(alinan);
          await yazdirToplu(alinan);
        }
        if (basildi || ++tur % 5 === 0) await listeYukle();
        if (tur % 30 === 0) await ayarlariYukle();
        baglantiHata = false; sonKontrol = new Date();
      } catch (e) {
        baglantiHata = true;
        if (/OTURUM/.test((e && e.message) || '')) hata(e);
      } finally {
        calisiyor = false;
        if (pencereSayisi === 0) ciz();
      }
    }

    async function kilitAl() {
      try { if ('wakeLock' in navigator) kilit = await navigator.wakeLock.request('screen'); } catch (e) { /* */ }
    }
    const gorunurluk = () => { if (!document.hidden && basladi) { kilitAl(); kontrol(); } };

    eylemBagla(Object.assign({}, ortakEylemler, {
      basla: async () => {
        basladi = true;
        sesHazirla(); sesOzelYukle();
        kilitAl();
        // arka planda yavaşlamasın diye zamanlayıcı ayrı iş parçacığında
        try {
          const kod = 'setInterval(function(){postMessage(1)},2000)';
          isci = new Worker(URL.createObjectURL(new Blob([kod], { type: 'text/javascript' })));
          isci.onmessage = () => kontrol();
          kasaKanal = kanalDinle((m) => { if (m.neden === 'siparis' || m.neden === 'iptal' || m.neden === 'fis') setTimeout(kontrol, 300); });
        } catch (e) { isci = { terminate: clearInterval.bind(null, setInterval(kontrol, 2000)) }; }
        ciz(); kontrol();
      },
      test: async (el) => { try { await rpc('ads_fis_test', { p_istasyon: istHepsi() ? 0 : istasyonlar[0] }); bildir('Deneme fişi sıraya eklendi', 'basari'); if (!basladi) bildir('Basılması için önce Başlat\'a bas'); } catch (e) { hata(e); } },
      istSec: () => istasyonSecPenceresi(),
      ses: () => { sesAcik = !sesAcik; LS.yaz('ads_kasa_ses', sesAcik); if (sesAcik) bip(); ciz(); },
      tekrar: async (el) => {
        try { const f = await rpc('ads_fis_al', { p_id: Number(el.dataset.id), p_tekrar: true }); if (f) { bildir('Tekrar basılıyor…'); await yazdir(f); } } catch (e) { hata(e); }
      }
    }));

    document.addEventListener('visibilitychange', gorunurluk);
    const ayrilmaUyari = (e) => { if (basladi) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', ayrilmaUyari);
    sayfaTemizle = () => {
      if (kasaKanal) kasaKanal();
      if (isci) isci.terminate();
      if (kilit) try { kilit.release(); } catch (e) { /* */ }
      if (ses) try { ses.close(); } catch (e) { /* */ }
      document.removeEventListener('visibilitychange', gorunurluk);
      window.removeEventListener('beforeunload', ayrilmaUyari);
    };

    ciz();
    try { await Promise.all([ayarlariYukle(), urunleriYukle(), listeYukle()]); ciz(); } catch (e) { hata(e); }
  }

  // ---------------------------------------------------------------
  // YÖNETİM
  // ---------------------------------------------------------------
  async function yonetimSayfa() {
    let sekme = LS.al('ads_yonetim_sekme', 'masalar');
    let garsonlar = [];

    function bolumListesi() {
      const l = [];
      S.masalar.forEach((m) => { const b = (m.bolum || '').trim(); if (b && !l.includes(b)) l.push(b); });
      return l;
    }

    function masalarHtml() {
      return '<datalist id="bolum-liste">' + bolumListesi().map((b) => '<option value="' + esc(b) + '">').join('') + '</datalist>' +
        '<div class="kart">' + (S.masalar.length ? S.masalar.map((m, i) =>
        '<div class="satir masa-satir"><input value="' + esc(m.ad) + '" data-masa-ad="' + m.id + '" maxlength="40" style="flex:2;min-width:110px">' +
        '<input value="' + esc(m.bolum || '') + '" data-masa-bolum="' + m.id + '" list="bolum-liste" maxlength="30" placeholder="Bölüm" style="flex:1.4;min-width:90px">' +
        '<button class="btn kucuk" data-e="masaYukari" data-i="' + i + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
        '<button class="btn kucuk" data-e="masaAsagi" data-i="' + i + '"' + (i === S.masalar.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<button class="btn kucuk tehlike" data-e="masaSil" data-id="' + m.id + '">Sil</button></div>').join('') : '<div class="bos">Masa yok.</div>') + '</div>' +
        '<div class="btn-satir"><button class="btn ana" data-e="masaEkle">+ Masa Ekle</button><button class="btn" data-e="masaToplu">+ Birden çok ekle</button></div>' +
        '<p class="aciklama">Adı veya bölümü değiştirip kutunun dışına dokununca kaydedilir. Bölüm örn. "Aile", "Bahçe", "Salon". ' +
        'Garsonlara Garsonlar sekmesinden bölüm atarsan sadece o bölümün masalarını görürler. Bölümü boş masaları herkes görür.</p>';
    }

    function urunSatiri(u) {
      const sd = stokDurum(u, 0);
      return '<div class="satir urun-yon"><div class="sol' + (izin('menu') ? ' tiklanir" data-e="urunDuzenle" data-id="' + u.id + '"' : '"') + '><div class="ad"' + (u.aktif ? '' : ' style="opacity:.5"') + '>' + esc(u.ad) + '</div>' +
        '<div class="kucuk">' + para(u.fiyat) + (u.aktif ? '' : ' · <span class="etiket kirmizi">satışta değil</span>') +
        (sd.bitti ? ' · <span class="etiket kirmizi">' + sd.yazi + '</span>' : sd.az ? ' · <span class="etiket kirmizi">az kaldı</span>' : '') + '</div></div>' +
        '<div class="urun-ayar"><label class="stok-kutu' + (sd.az || (sd.bitti && !u.tukendi) ? ' az' : '') + '">Stok<input type="text" inputmode="numeric" data-urun-stok="' + u.id + '" value="' + (u.stok === null || u.stok === undefined ? '' : u.stok) + '" placeholder="—"></label>' +
        '<label class="mini-anahtar' + (u.tukendi ? ' kirmizi' : '') + '"><input type="checkbox" data-urun-tukendi="' + u.id + '"' + (u.tukendi ? ' checked' : '') + '>Tükendi</label>' +
        (izin('menu') ? '<label class="mini-anahtar"><input type="checkbox" data-urun-aktif="' + u.id + '"' + (u.aktif ? ' checked' : '') + '>Satışta</label>' : '') + '</div></div>';
    }

    function menuHtml() {
      // kategori sırasına göre; kayıtta olmayan kategoriler sona
      const kats = katSirala(Array.from(new Set(S.kategoriler.map((c) => c.ad).concat(S.urunler.map((u) => u.kategori)).filter(Boolean))));
      const azlar = S.urunler.filter((u) => u.aktif && (stokDurum(u, 0).az || stokDurum(u, 0).bitti));
      const istVar = S.kategoriler.some((c) => Number(c.istasyon) !== 1) || Object.keys((S.ayarlar && S.ayarlar.istasyon_adlari) || {}).length > 1;
      return (izin('menu') ? '<div class="btn-satir" style="margin-bottom:8px"><button class="btn ana" data-e="katEkle">+ Kategori Ekle</button><button class="btn" data-e="urunToplu">+ Toplu Ürün</button></div>' +
        '<button class="btn tam sablon-btn" style="margin-bottom:10px" data-e="sablonlar">📋 Menü şablonları <span class="aciklama" style="margin:0;font-weight:600">· balık günü, tantuni günü…</span></button>' : '<p class="aciklama" style="margin-top:0">Menüyü sadece görürsün; stok girebilir ve ürünü "tükendi" işaretleyebilirsin.</p>') +
        (azlar.length ? '<div class="kart dolgulu stok-uyari"><b>⚠ Stok uyarısı</b><div>' + azlar.map((u) => { const sd = stokDurum(u, 0); return esc(u.ad) + ': <b>' + (sd.bitti ? sd.yazi : sd.kalan + ' adet') + '</b>'; }).join(' · ') + '</div></div>' : '') +
        (kats.length ? kats.map((k, ki) => {
          const c = katBul(k);
          const urun = S.urunler.filter((u) => u.kategori === k);
          return '<div class="kat-blok' + (c && !c.aktif ? ' gizli' : '') + '">' +
            '<div class="kat-baslik"><div class="kat-ad">' + esc(k) + (c && !c.aktif ? ' <span class="etiket kirmizi">gizli</span>' : '') +
            (c ? ' <span class="kat-ist"' + (izin('menu') ? ' data-e="katDuzenle" data-id="' + c.id + '"' : '') + '>🖨 ' + esc(istAdi(c.istasyon)) + '</span>' : '') + '</div>' +
            '<div class="kat-btn">' +
            (c && izin('menu') ? '<button class="btn kucuk" data-e="katYukari" data-id="' + c.id + '"' + (ki === 0 ? ' disabled' : '') + '>↑</button>' +
              '<button class="btn kucuk" data-e="katAsagi" data-id="' + c.id + '"' + (ki === kats.length - 1 ? ' disabled' : '') + '>↓</button>' +
              '<button class="btn kucuk" data-e="katDuzenle" data-id="' + c.id + '">⚙︎</button>' : '') +
            '</div></div>' +
            '<div class="kart">' + (urun.length ? urun.map(urunSatiri).join('') : '<div class="bos" style="padding:14px">Bu kategoride ürün yok.</div>') + '</div>' +
            (izin('menu') ? '<button class="btn kucuk tam" style="margin:-4px 0 4px" data-e="urunEkle" data-k="' + esc(k) + '">+ ' + esc(k) + ' kategorisine ürün ekle</button>' : '') +
            '</div>';
        }).join('') : '<div class="bos">Menü boş. Önce kategori ekle (örn. Balıklar), sonra altına ürün.</div>') +
        '<p class="aciklama" style="margin:8px 2px 0">Kategoriyi gizlersen garson ve müşteri menüsünde görünmez (ürünler silinmez). ' +
        (istVar ? 'Her kategori bir yazıcı istasyonuna bağlı; balık bir yazıcıdan, tatlı başka yazıcıdan çıkar. ' : '') +
        'Stok kutusu boşsa takip yok; sayı yazarsan siparişte düşer, ' + stokKritik() + ' ve altı kırmızı, 0\'da sipariş girilemez.</p>';
    }

    function kategoriPenceresi(c) {
      const ad = c ? c.ad : '';
      const ists = Array.from(new Set([0].concat(istIdler()))).sort((x, y) => x - y);
      const seciliIst = c && ists.includes(Number(c.istasyon)) ? Number(c.istasyon) : 1; // silinmiş istasyon → Mutfak
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + (c ? 'Kategoriyi düzenle' : 'Yeni kategori') + '</h2><form>' +
        '<label>Kategori adı</label><input id="k-ad" value="' + esc(ad) + '" required maxlength="40" placeholder="Örn. Balıklar">' +
        '<label>Hangi yazıcıdan çıksın? (istasyon)</label><select id="k-ist">' +
        ists.map((n) => '<option value="' + n + '"' + (seciliIst === n ? ' selected' : '') + '>' + esc(istAdi(n)) + (n === 0 ? ' (kasa/hesap)' : '') + '</option>').join('') + '<option value="yeni">+ Yeni istasyon ekle…</option></select>' +
        '<input id="k-yeni-ist" style="display:none;margin-top:8px" maxlength="20" placeholder="Yeni istasyon adı (örn. Izgara)">' +
        '<p class="aciklama">İstasyon = fişin çıkacağı yer (Mutfak, Tatlı, Bar…). Tek yazıcın varsa hepsini aynı bırak.</p>' +
        '<label class="anahtar"><span>Menüde görünsün (kapatırsan gizlenir)</span><input type="checkbox" id="k-ak"' + (!c || c.aktif ? ' checked' : '') + '></label>' +
        '<div class="eylemler">' + (c ? '<button type="button" class="btn tehlike" data-e="sil">Sil</button>' : '<button type="button" class="btn" data-e="kapat">Vazgeç</button>') +
        '<button class="btn ana" type="submit">Kaydet</button></div></form>', {
        gonder: async (form, e, p, kapat) => {
          const nad = p.querySelector('#k-ad').value.trim();
          if (!nad) return;
          try {
            let ist = p.querySelector('#k-ist').value;
            if (ist === 'yeni') {
              const yad = p.querySelector('#k-yeni-ist').value.trim();
              if (!yad) { bildir('Yeni istasyonun adını yaz.', 'hata'); return; }
              ist = await istasyonEkle(yad);
            }
            await rpc('ads_kategori_kaydet', { p_id: c ? c.id : null, p_ad: nad, p_istasyon: Number(ist), p_aktif: p.querySelector('#k-ak').checked });
            kapat(); bildir('Kaydedildi', 'basari'); yenile();
          } catch (err) { hata(err); }
        },
        sil: async (el, e, p, kapat) => {
          kapat();
          const urun = S.urunler.filter((u) => u.kategori === c.ad);
          const digerleri = S.kategoriler.filter((x) => x.id !== c.id).map((x) => x.ad);
          let hedef = digerleri[0] || 'Genel';
          if (urun.length) {
            if (!await onayla(c.ad + ' silinsin mi?', 'İçinde ' + urun.length + ' ürün var. Bu ürünler "' + hedef + '" kategorisine taşınacak (silinmez).', 'Sil ve taşı', true)) return;
          } else if (!await onayla(c.ad + ' silinsin mi?', '', 'Sil', true)) return;
          try { await rpc('ads_kategori_sil', { p_id: c.id, p_hedef: hedef }); bildir('Silindi'); yenile(); } catch (err) { hata(err); }
        }
      }, (p) => {
        if (!c) p.querySelector('#k-ad').focus();
        const sel = p.querySelector('#k-ist'); const yeni = p.querySelector('#k-yeni-ist');
        sel.addEventListener('change', () => { yeni.style.display = sel.value === 'yeni' ? '' : 'none'; if (sel.value === 'yeni') yeni.focus(); });
      });
    }

    async function katSiraDegistir(id, yon) {
      const sirali = katSirala(S.kategoriler.map((c) => c.ad)).map((ad) => katBul(ad)).filter(Boolean);
      const i = sirali.findIndex((c) => c.id === id); const j = i + yon;
      if (i < 0 || j < 0 || j >= sirali.length) return;
      const t = sirali[i]; sirali[i] = sirali[j]; sirali[j] = t;
      try { await rpc('ads_kategori_sirala', { p_sira: sirali.map((c) => c.id) }); await yenile(); } catch (e) { hata(e); }
    }

    function garsonlarHtml() {
      return '<div class="kart">' + garsonlar.map((g) =>
        '<div class="satir tiklanir" data-e="garsonDuzenle" data-id="' + g.id + '"><div class="sol"><div class="ad"' + (g.aktif ? '' : ' style="opacity:.5"') + '>' + esc(g.ad) + '</div>' +
        '<div class="kucuk">Kullanıcı adı: ' + esc(g.kullanici) + ' · ' + (g.rol === 'admin' ? 'bütün masalar' : (g.bolumler && g.bolumler.length ? 'Bölüm: ' + esc(g.bolumler.join(', ')) : 'bütün bölümler')) + '</div>' +
        (Number(g.ikram_limit) > 0 && g.ikram_bitis && new Date(g.ikram_bitis) <= new Date() ? '<div class="kucuk">🎁 Hediye: ' + para(g.ikram_limit) + ' · <span style="color:var(--kirmizi)">⏳ süresi doldu (' + ikramBitisYazi(g.ikram_bitis) + ')</span></div>' : Number(g.ikram_limit) > 0 ? '<div class="kucuk">🎁 Hediye: ' + para(g.ikram_limit - g.ikram_kalan) + ' kullandı · <b>' + para(g.ikram_kalan) + ' kaldı</b> / ' + para(g.ikram_limit) + (g.ikram_bitis ? (new Date(g.ikram_bitis) <= new Date() ? '' : ' · ⏳ ' + ikramBitisYazi(g.ikram_bitis) + '\'e kadar') : '') + '</div>' : '') + '</div>' +
        '<span class="etiket' + (g.rol === 'admin' ? ' yesil' : '') + '">' + esc(g.rol_ad || (g.rol === 'admin' ? 'Yönetici' : 'Garson')) + '</span>' +
        (g.aktif ? '' : '<span class="etiket kirmizi">Kapalı</span>') + '</div>').join('') + '</div>' +
        '<button class="btn ana tam" data-e="garsonEkle">+ Garson Ekle</button>' +
        (garsonlar.some((g) => Number(g.ikram_limit) > 0) ? '<button class="btn tam" style="margin-top:8px" data-e="ikramHepsi">🎁 Herkesin hediye hakkını yenile (yeni etkinlik)</button>' : '') +
        '<p class="aciklama">Garsonlar kendi telefonlarından bu kullanıcı adı ve şifreyle girer. Şifresini değiştirdiğin ya da kapattığın hesabın oturumu hemen kapanır.</p>' +
        '<div class="bolum-baslik" style="margin-top:22px"><span>Roller (hazır yetkiler)</span></div>' +
        '<div class="kart">' + rolData.roller.map((r) => '<div class="satir tiklanir" data-e="rolDuzenle" data-id="' + r.id + '"><div class="sol"><div class="ad">' + esc(r.ad) + '</div>' +
          '<div class="kucuk">' + (r.sistem === 'yonetici' ? 'Her şeyi yapar' : r.izinler.length + ' yetki') + ' · ' + r.kisi + ' kişi</div></div>' +
          (r.sistem ? '<span class="etiket' + (r.sistem === 'yonetici' ? ' yesil' : '') + '">Hazır</span>' : '') + '</div>').join('') + '</div>' +
        '<button class="btn tam" data-e="rolEkle">+ Yeni rol ekle</button>' +
        '<p class="aciklama">Rol = bir kişinin neleri görüp yapabileceği. <b>Garson</b> rolünün yetkilerini değiştirirsen bütün garsonlar etkilenir. Yeni rol ekleyip (örn. Kasiyer, Müdür) kişilere atayabilirsin. Bir kişiye rol yerine "Özel" seçip yetkileri tek tek de verebilirsin. Hesap ve rol yönetimi sadece Yönetici\'dedir.</p>';
    }

    function rolPenceresi(rol) {
      const yon = !!rol && rol.sistem === 'yonetici';
      const baslangic = yon ? rolData.tum : (rol ? rol.izinler : []);
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + (rol ? esc(rol.ad) + ' rolü' : 'Yeni rol') + '</h2><form autocomplete="off">' +
        '<label for="r-ad">Rol adı</label><input id="r-ad" maxlength="30" value="' + esc(rol ? rol.ad : '') + '"' + (rol && rol.sistem ? ' readonly' : ' required') + ' placeholder="Örn. Kasiyer">' +
        (yon ? '<p class="aciklama">Yönetici her şeyi yapabilir; bu rol değiştirilemez.</p>'
          : '<p class="aciklama">Açık olanları bu roldeki kişiler görür ve yapar; kapalı olanlar onlara hiç görünmez.' + (rol && rol.kisi ? ' Değişiklik bu roldeki <b>' + rol.kisi + ' kişiye</b> hemen uygulanır (sayfayı yenileyince menüleri değişir).' : '') + '</p>') +
        izinKutulari(baslangic, yon) +
        '<div class="eylemler">' + (rol && !rol.sistem ? '<button type="button" class="btn tehlike" data-e="rolSil">Sil</button>' : '<button type="button" class="btn" data-e="kapat">' + (yon ? 'Kapat' : 'Vazgeç') + '</button>') +
        (yon ? '' : '<button class="btn ana" type="submit">Kaydet</button>') + '</div></form>', {
        rolSil: async (el, e, p, kapat) => {
          kapat();
          if (!await onayla('"' + rol.ad + '" rolü silinsin mi?', (rol.kisi ? rol.kisi + ' kişi Garson rolüne geçer.' : ''), 'Sil', true)) return;
          try { await rpc('ads_rol_sil', { p_id: rol.id }); bildir('Rol silindi', 'basari'); yenile(); } catch (err) { hata(err); }
        },
        gonder: async (form, e, p, kapat) => {
          try {
            await rpc('ads_rol_kaydet', { p_id: rol ? rol.id : null, p_ad: p.querySelector('#r-ad').value, p_izinler: izinOku(p) });
            kapat(); bildir('Rol kaydedildi', 'basari'); yenile();
          } catch (err) { hata(err); }
        }
      });
    }

    let istTaslak = null; // ayar formunda düzenlenen istasyonlar (kaydedilene kadar)
    function istTaslakAl() {
      if (!istTaslak) { istTaslak = Object.assign({}, (S.ayarlar && S.ayarlar.istasyon_adlari) || {}); if (!Object.keys(istTaslak).length) istTaslak = { 1: 'Mutfak' }; }
      return istTaslak;
    }
    function istasyonSatirlari() {
      const t = istTaslakAl();
      return Object.keys(t).map(Number).sort((x, y) => x - y).map((n) => {
        const kullanan = S.kategoriler.filter((c) => Number(c.istasyon) === n).map((c) => c.ad);
        return '<div class="istasyon-satir"><span class="no">' + n + '</span>' +
          '<input data-ist="' + n + '" value="' + esc(t[n] || '') + '" placeholder="Örn. ' + ['Mutfak', 'Tatlı', 'İçecek', 'Bar', 'Izgara', 'Pide'][(n - 1) % 6] + '" maxlength="20">' +
          (n === 1 ? '<span class="etiket" style="flex:none">Varsayılan</span>' : '<button type="button" class="sil" data-e="istSil" data-n="' + n + '" aria-label="Sil">×</button>') + '</div>' +
          (kullanan.length ? '<div class="aciklama" style="margin:2px 0 0 34px">' + esc(kullanan.join(', ')) + '</div>' : '');
      }).join('');
    }
    function istTaslakOku() {
      document.querySelectorAll('#ayar-form [data-ist]').forEach((i) => { istTaslakAl()[i.dataset.ist] = i.value; });
      // formun geri kalanı da yeniden çizimde kaybolmasın (kaydedilmez, sadece taslak)
      const f = document.getElementById('ayar-form'); if (!f || !S.ayarlar) return;
      ['isletme_adi', 'fis_alt_yazi', 'personel_oran', 'iptal_yetkisi', 'ikram_kural', 'stok_kritik'].forEach((k) => { if (f[k]) S.ayarlar[k] = f[k].value; });
      ['hesap_fisi_otomatik', 'ikram_gunluk'].forEach((k) => { if (f[k]) S.ayarlar[k] = f[k].checked; });
      if (f.gun_basi_saat) S.ayarlar.gun_basi_saat = Number(f.gun_basi_saat.value);
    }

    function ayarlarHtml() {
      const a = S.ayarlar;
      return '<form id="ayar-form" class="kart dolgulu">' +
        '<label>İşletme adı (hesap fişinin başında)</label><input name="isletme_adi" value="' + esc(a.isletme_adi) + '">' +
        '<label>Fiş kâğıdı genişliği</label><div class="secenekler">' +
        [58, 80].map((g) => '<button type="button" class="secenek' + (Number(a.fis_genislik) === g ? ' aktif' : '') + '" data-e="genislik" data-g="' + g + '">' + g + ' mm</button>').join('') + '</div>' +
        '<label>Sipariş fişi nasıl çıksın?</label><div class="secenekler" style="grid-template-columns:1fr">' +
        [['tek', 'Hepsi tek fişte', 'Bir siparişteki bütün ürünler tek fiş'], ['urun', 'Her ürün ayrı fiş', '3 fish finger + 1 helva = 2 fiş (aynı ürünler bir arada)'], ['adet', 'Her adet ayrı fiş', '3 fish finger + 1 helva = 4 fiş']].map(([k, baslik, acik]) =>
          '<button type="button" class="secenek' + ((a.fis_bolme || 'tek') === k ? ' aktif' : '') + '" style="text-align:left" data-e="bolme" data-b="' + k + '">' + baslik + '<br><span class="aciklama" style="font-weight:500">' + acik + '</span></button>').join('') + '</div>' +
        '<p class="aciklama">Bilmiyorsan rulo kâğıdın enini ölç: ~5,7 cm ise 58, ~8 cm ise 80. Deneme fişiyle kontrol edebilirsin.</p>' +
        '<label>Hesap fişinin alt yazısı</label><input name="fis_alt_yazi" value="' + esc(a.fis_alt_yazi) + '">' +
        '<button type="button" class="btn tam" style="margin-top:8px" data-e="git" data-hedef="/fistasarim">🧾 Fişi özelleştir (başlık, yazı boyutu, çizgi, alanlar…)</button>' +
        '<button type="button" class="btn tam" style="margin-top:8px" data-e="git" data-hedef="/sesler">🔊 Kasa sesleri (zil, kendi sesin…)</button>' +
        '<label>Personel hesabı indirimi (%)</label><input name="personel_oran" inputmode="numeric" value="' + esc(a.personel_oran != null ? a.personel_oran : 33) + '">' +
        '<p class="aciklama">%33 = fiyat 0,67 ile çarpılır.</p>' +
        '<label>İptal yetkisi</label><select name="iptal_yetkisi"><option value="admin"' + (a.iptal_yetkisi === 'admin' ? ' selected' : '') + '>Sadece yönetici iptal edebilir</option>' +
        '<option value="herkes"' + (a.iptal_yetkisi === 'herkes' ? ' selected' : '') + '>Bütün garsonlar iptal edebilir</option></select>' +
        '<label class="anahtar"><span>Hesap kapatılırken fiş otomatik işaretli gelsin</span><input type="checkbox" name="hesap_fisi_otomatik"' + (a.hesap_fisi_otomatik ? ' checked' : '') + '></label>' +
        '<div class="ayar-bolum">Yazıcılar (istasyonlar)</div>' +
        '<p class="aciklama" style="margin-top:0">İstasyon = fişin çıkacağı yer. Örn. <b>Mutfak</b> (balık), <b>Tatlı</b>, <b>Bar</b>. Her kategoriyi (Menü › kategori ⚙︎) bir istasyona bağlarsın; sipariş gelince her ürünün fişi kendi istasyonundan çıkar. ' +
        '<b>Tek yazıcın varsa burayı hiç değiştirme</b>, bütün fişler ondan çıkar. İstediğin kadar ekleyebilirsin.</p>' +
        istasyonSatirlari() +
        '<button type="button" class="btn tam" style="margin-top:10px" data-e="istEkle">+ Yazıcı istasyonu ekle</button>' +
        '<div class="ayar-bolum">Stok</div>' +
        '<label>Kaç adet ve altında kırmızı uyarı çıksın?</label><input name="stok_kritik" inputmode="numeric" value="' + esc(a.stok_kritik != null ? a.stok_kritik : 10) + '">' +
        '<div class="ayar-bolum">Gün sonu</div>' +
        '<div class="secenekler" style="grid-template-columns:1fr 1fr">' +
        [['otomatik', '⏱ Otomatik', 'Gün her gün aşağıdaki saatte kendiliğinden kapanır, yeni gün başlar.'], ['manuel', '🔒 Manuel', 'Gün, sen "Gün Sonunu Al" tuşuna basınca kapanır. Basana kadar aynı gün devam eder.']].map(([k, b, acik]) =>
          '<button type="button" class="secenek' + ((a.gun_sonu_modu || 'otomatik') === k ? ' aktif' : '') + '" style="text-align:left" data-e="gunModu" data-m="' + k + '">' + b + '<br><span class="aciklama" style="font-weight:500">' + acik + '</span></button>').join('') + '</div>' +
        '<label>Yeni gün saat kaçta başlasın? (otomatik mod)</label><select name="gun_basi_saat">' +
        Array.from({ length: 13 }, (_, h) => '<option value="' + h + '"' + (Number(a.gun_basi_saat != null ? a.gun_basi_saat : 5) === h ? ' selected' : '') + '>' + ikiHane(h) + ':00' + (h === 0 ? ' (gece yarısı)' : h === 5 ? ' (önerilen)' : '') + '</option>').join('') + '</select>' +
        '<p class="aciklama">Örn. 05:00 seçiliyse gece 01:30\'daki satış hâlâ o akşamın gününe yazılır; Çarşamba gecesi ikiye bölünmez.</p>' +
        '<div class="ayar-bolum">Garson hediye ikramı</div>' +
        '<select name="ikram_kural"><option value="kendi"' + ((a.ikram_kural || 'kendi') === 'kendi' ? ' selected' : '') + '>Herkes sadece kendi hakkını kullanabilir (yönetici dahil)</option>' +
        '<option value="yonetici_secer"' + (a.ikram_kural === 'yonetici_secer' ? ' selected' : '') + '>Garson kendi hakkını; yönetici herkesinkini seçebilir</option></select>' +
        '<label class="anahtar"><span>Hediye hakları her yeni günde yenilensin</span><input type="checkbox" name="ikram_gunluk"' + (a.ikram_gunluk !== false ? ' checked' : '') + '></label>' +
        '<button class="btn ana tam buyuk" type="submit">Kaydet</button></form>' +
        '<div id="yedek-kart" class="kart dolgulu yedek-kart"><div class="aciklama">Otomatik yedek durumu yükleniyor…</div></div>';
    }

    function ciz() {
      const sekmeler = [['masalar', 'Masalar'], ['menu', 'Menü'], ['garsonlar', 'Garsonlar'], ['ayarlar', 'Ayarlar']].filter(([k]) =>
        k === 'masalar' ? izin('masalar') : k === 'menu' ? (izin('menu') || izin('stok')) : k === 'garsonlar' ? yonetici() : izin('ayarlar'));
      if (sekmeler.length && !sekmeler.some(([k]) => k === sekme)) sekme = sekmeler[0][0];
      $app.innerHTML = ustBar('Yönetim', '', geriBtn('/masalar'), '<button class="ust-btn" data-e="menu">☰</button>') +
        '<main class="icerik"><div class="sekmeler">' + sekmeler.map(([k, a]) => '<button class="sekme' + (k === sekme ? ' aktif' : '') + '" data-e="sekme" data-s="' + k + '">' + a + '</button>').join('') + '</div>' +
        (sekme === 'masalar' ? masalarHtml() : sekme === 'menu' ? menuHtml() : sekme === 'garsonlar' ? garsonlarHtml() : ayarlarHtml()) +
        '<div class="imza">Hazırlayan: M. Talha Erbil</div></main>';
      const form = document.getElementById('ayar-form');
      if (form) { form.onsubmit = ayarKaydet; yedekKartYukle(); }
    }

    let rolData = { tum: [], roller: [] };
    async function yukle() {
      const izinli = [['masalar', izin('masalar')], ['menu', izin('menu') || izin('stok')], ['garsonlar', yonetici()], ['ayarlar', izin('ayarlar')]].filter((x) => x[1]).map((x) => x[0]);
      if (izinli.length && !izinli.includes(sekme)) sekme = izinli[0];
      if (sekme === 'masalar') await masalariYukle();
      else if (sekme === 'menu') await urunleriYukle();
      else if (sekme === 'garsonlar') { [garsonlar, rolData] = await Promise.all([rpc('ads_garson_listesi'), rpc('ads_rol_listesi'), masalariYukle()]); }
      else await ayarlariYukle();
    }
    async function yenile() { try { await yukle(); ciz(); } catch (e) { hata(e); } }

    // ---------- otomatik yedek (Google Drive + e-posta) ----------
    async function yedekKartYukle() {
      const kart = document.getElementById('yedek-kart'); if (!kart) return;
      let d;
      try { d = await rpc('ads_yedek_durum'); } catch (err) { kart.innerHTML = '<div class="aciklama">Yedek durumu okunamadı: ' + esc(hataMetni(err)) + '. Supabase\'te güncel kurulum.sql çalıştırıldı mı?</div>'; return; }
      const k = document.getElementById('yedek-kart'); if (!k) return;
      const gecikmis = (d.bekleyen || []).filter((b) => Date.now() - new Date(b.bit) > 45 * 60000);
      k.innerHTML = '<div class="yedek-ust"><div><div class="gs-baslik" style="margin-top:0">☁️ Otomatik yedek</div>' +
        '<div class="aciklama" style="margin:2px 0 0">Her gün kapanınca o günün bütün hareketleri Google Drive\'a tablo olarak kaydedilir ve e-postana özetle birlikte Excel eki olarak gelir.</div></div>' +
        (d.kurulu ? '<span class="etiket yesil">Açık</span>' : '<span class="etiket">Kapalı</span>') + '</div>' +
        (d.kurulu ? '<div class="aciklama" style="margin-top:8px">Gönderilen adres: <b>' + esc(d.eposta || '—') + '</b></div>' : '') +
        (d.kurulu && gecikmis.length ? '<div class="yedek-uyari">⚠ ' + gecikmis.map((b) => trGun(b.etiket) + ' ' + gunAdi(b.etiket)).join(', ') + ' gününün yedeği henüz gelmedi. ' +
          'Google tarafında kurulum tamamlanmamış ya da durmuş olabilir. Aşağıdan kodu tekrar alıp kurulumu yenile.</div>' : '') +
        (d.kurulu && !(d.son || []).length && !gecikmis.length ? '<div class="aciklama" style="margin-top:8px">Henüz yedek yok. İlk yedek, ilk gün kapandıktan sonra gelir.</div>' : '') +
        ((d.son || []).length ? '<div class="bolum-baslik" style="margin-top:12px">Son yedekler</div>' + d.son.map((y) =>
          '<div class="satir"><div class="sol"><div class="ad">' + trGun(y.etiket) + ' ' + gunAdi(y.etiket) + '</div><div class="kucuk">' + tarihSaat(y.zaman) + ' gönderildi · ' + (y.satir || 0) + ' hareket</div></div>' +
          (y.dosya ? '<a class="btn kucuk" href="' + esc(y.dosya) + '" target="_blank" rel="noopener">Drive\'da aç</a>' : '') + '</div>').join('') : '') +
        '<div class="btn-satir" style="margin-top:12px"><button type="button" class="btn ' + (d.kurulu ? '' : 'ana') + '" data-e="yedekKur">' + (d.kurulu ? '🔁 Kurulum kodunu yeniden al' : '☁️ Otomatik yedeği kur') + '</button>' +
        (d.kurulu ? '<button type="button" class="btn tehlike" data-e="yedekKapat">Kapat</button>' : '') + '</div>';
    }

    function yedekKurPenceresi() {
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>☁️ Otomatik yedeği kur</h2>' +
        '<p class="aciklama">Kurulum bir kere yapılır, yaklaşık 3 dakika sürer. Bilgisayardan yapman daha kolay.</p>' +
        '<label for="y-e">Yedekler hangi e-postaya gelsin?</label><input id="y-e" type="email" placeholder="ornek@gmail.com" autocomplete="email">' +
        '<button class="btn ana tam" style="margin-top:10px" data-e="hazirla">Kodu hazırla</button>' +
        '<div id="y-kod" style="display:none">' +
        '<ol class="yedek-adim">' +
        '<li><b>script.google.com</b> adresini aç (yedeklerin gideceği Google hesabıyla) ve <b>Yeni proje</b>\'ye bas.</li>' +
        '<li>Açılan sayfadaki kodun <b>hepsini sil</b>, aşağıdaki kodu yapıştır, <b>💾 Kaydet</b>\'e bas.</li>' +
        '<li>Üstteki fonksiyon kutusunda <b>kurulum</b> seçili olsun, <b>▶ Çalıştır</b>\'a bas.</li>' +
        '<li>İzin penceresi çıkar: hesabını seç → <b>Gelişmiş</b> → <b>"… projesine git"</b> → <b>İzin ver</b>. (Bu uyarı, kod Google\'a senin hesabından eklendiği için çıkar.)</li>' +
        '<li>Bir dakika içinde <b>"Otomatik yedek kuruldu"</b> maili gelir. Hemen örnek rapor görmek istersen fonksiyon kutusundan <b>simdiDene</b>\'yi seçip çalıştır.</li></ol>' +
        '<div class="btn-satir"><button class="btn ana" data-e="kopyala">📋 Kodu kopyala</button><button class="btn" data-e="indir">⬇ Dosya olarak indir</button>' +
        '<a class="btn" href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">↗ script.google.com</a></div>' +
        '<textarea id="y-metin" readonly rows="6" class="kod-kutu"></textarea>' +
        '<p class="aciklama">Kodun içinde bu siteye özel gizli bir anahtar var, kimseyle paylaşma. Kodu yeniden alırsan eski kod çalışmaz.</p></div>', {
        hazirla: (el, e, p) => bekle(el, async () => {
          const eposta = p.querySelector('#y-e').value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) return bildir('Geçerli bir e-posta yaz.', 'hata');
          try {
            const [anahtar, sablon] = await Promise.all([
              rpc('ads_yedek_anahtar_olustur', { p_eposta: eposta }),
              fetch('yedek-google.gs', { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error('yedek-google.gs dosyası bulunamadı; site klasörünü tam yükledin mi?'); return r.text(); })
            ]);
            const kod = sablon.replace('__SUPABASE_URL__', AYAR.SUPABASE_URL).replace('__SUPABASE_KEY__', AYAR.SUPABASE_KEY)
              .replace('__YEDEK_ANAHTAR__', anahtar).replace('__EPOSTA__', eposta.replace(/'/g, ''));
            p.querySelector('#y-metin').value = kod;
            p.querySelector('#y-kod').style.display = '';
            el.style.display = 'none'; p.querySelector('#y-e').disabled = true;
            yedekKartYukle();
          } catch (err) { hata(err); }
        }),
        kopyala: async (el, e, p) => {
          const t = p.querySelector('#y-metin');
          try { await navigator.clipboard.writeText(t.value); } catch (err) { t.select(); try { document.execCommand('copy'); } catch (e2) { /* */ } }
          bildir('Kod kopyalandı ✓ Şimdi script.google.com\'a yapıştır', 'basari');
        },
        indir: (el, e, p) => { dosyaIndir(new Blob([p.querySelector('#y-metin').value], { type: 'text/plain;charset=utf-8' }), 'adisyon-yedek-kodu.gs'); }
      });
    }

    async function ayarKaydet(e) {
      e.preventDefault();
      const f = e.target; const btn = f.querySelector('[type=submit]');
      await bekle(btn, async () => {
        const veri = {
          isletme_adi: f.isletme_adi.value.trim() || 'Yavuztürk Süleymaniye',
          fis_alt_yazi: f.fis_alt_yazi.value.trim(),
          iptal_yetkisi: f.iptal_yetkisi.value,
          hesap_fisi_otomatik: f.hesap_fisi_otomatik.checked,
          fis_genislik: Number(S.ayarlar.fis_genislik),
          fis_bolme: S.ayarlar.fis_bolme || 'tek',
          personel_oran: Math.min(100, Math.max(0, parseInt(f.personel_oran.value, 10) || 0)),
          gun_sonu_modu: S.ayarlar.gun_sonu_modu || 'otomatik',
          gun_basi_saat: parseInt(f.gun_basi_saat.value, 10) || 0,
          ikram_kural: f.ikram_kural.value,
          ikram_gunluk: f.ikram_gunluk.checked,
          stok_kritik: Math.max(0, parseInt(f.stok_kritik.value, 10) || 0),
          istasyon_adlari: (() => { istTaslakOku(); const o = {}; Object.keys(istTaslakAl()).map(Number).sort((x, y) => x - y).forEach((n) => { o[n] = (istTaslakAl()[n] || '').trim() || (n === 1 ? 'Mutfak' : 'İstasyon ' + n); }); if (!o[1]) o[1] = 'Mutfak'; return o; })()
        };
        // manuele geçerken açık gün, bugünün başından başlasın (bugünkü satışlar kaybolmasın)
        if (veri.gun_sonu_modu === 'manuel' && S.ayarlar._kayitliMod !== 'manuel') {
          const eski = Object.assign({}, S.ayarlar, { gun_sonu_modu: 'otomatik', gun_basi_saat: veri.gun_basi_saat });
          const yedek = S.ayarlar; S.ayarlar = eski; _donemOnbellek = null;
          try { await gunleriYukle(); veri.manuel_baslangic = acikGunBaslangic().toISOString(); } finally { S.ayarlar = yedek; _donemOnbellek = null; }
        }
        try {
          // silinen istasyona bağlı kategoriler varsayılana (1) taşınır
          await urunleriYukle(); // kategoriler güncel olsun (menü sekmesi açılmamış olabilir)
          const yetim = S.kategoriler.filter((c) => Number(c.istasyon) > 0 && !(String(c.istasyon) in veri.istasyon_adlari));
          await q(db.from('ads_ayarlar').update(veri).eq('id', 1));
          for (const c of yetim) { await q(db.from('ads_kategoriler').update({ istasyon: 1 }).eq('id', c.id)); c.istasyon = 1; }
          istTaslak = null; Object.assign(S.ayarlar, veri); S.ayarlar._kayitliMod = veri.gun_sonu_modu; _donemOnbellek = null;
          bildir('Ayarlar kaydedildi', 'basari');
        } catch (err) { hata(err); }
      });
    }

    async function siraDegistir(i, j) {
      const a = S.masalar[i]; const b = S.masalar[j];
      // sıralar eşitse önce hepsini sırala
      try {
        if (S.masalar.some((m, k) => m.sira !== k + 1)) {
          await Promise.all(S.masalar.map((m, k) => q(db.from('ads_masalar').update({ sira: k + 1 }).eq('id', m.id))));
          S.masalar.forEach((m, k) => { m.sira = k + 1; });
        }
        await Promise.all([q(db.from('ads_masalar').update({ sira: b.sira }).eq('id', a.id)), q(db.from('ads_masalar').update({ sira: a.sira }).eq('id', b.id))]);
        await yenile();
      } catch (e) { hata(e); }
    }

    async function sablonPenceresi() {
      let liste = [];
      try { liste = await q(db.from('ads_menu_sablonlar').select('id, ad, veri, olusturan, olusturma').order('olusturma', { ascending: false })); } catch (e) { return hata(e); }
      const ozet = (v) => { const u = (v.urunler || []).filter((x) => x.aktif); return u.length + ' ürün açık' + (v.menu_baslik ? ' · "' + esc(v.menu_baslik) + '"' : ''); };
      const html = '<button class="kapat-x" data-e="kapat">×</button><h2>📋 Menü şablonları</h2>' +
        '<p class="aciklama" style="margin-top:0">Her hafta menü değişiyorsa: menüyü bir kere hazırla, şablon olarak kaydet. Sonraki hafta tek dokunuşla o ürünler, fiyatlar ve QR menü yazıları geri gelir. Stok sayıları değişmez, "tükendi" işaretleri sıfırlanır.</p>' +
        (liste.length ? '<div class="sablon-liste">' + liste.map((t) => '<div class="sablon-satir"><div class="sol"><b>' + esc(t.ad) + '</b><small>' + ozet(t.veri || {}) + ' · ' + new Date(t.olusturma).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + '</small></div>' +
          '<div class="sablon-btnler"><button class="btn ana kucuk" data-e="uygula" data-id="' + t.id + '">Uygula</button>' +
          '<button class="btn kucuk" data-e="guncelle" data-id="' + t.id + '" title="Şu anki menüyle güncelle">↻</button>' +
          '<button class="btn kucuk tehlike" data-e="sil" data-id="' + t.id + '" aria-label="Sil">×</button></div></div>').join('') + '</div>'
          : '<div class="bos" style="padding:16px 0">Henüz şablon yok.</div>') +
        '<label for="sb-ad">Şu anki menüyü şablon olarak kaydet</label><div class="sablon-yeni"><input id="sb-ad" maxlength="40" placeholder="Örn. Balık günü"><button class="btn ana" data-e="kaydet">Kaydet</button></div>' +
        '<div class="eylemler"><button class="btn" data-e="kapat">Kapat</button></div>';
      const bul = (id) => liste.find((x) => x.id === id);
      pencere(html, {
        kaydet: (el, e, p, kapat) => bekle(el, async () => {
          const ad = p.querySelector('#sb-ad').value.trim(); if (!ad) { bildir('Şablona bir ad ver.', 'hata'); return; }
          try { await rpc('ads_sablon_kaydet', { p_ad: ad }); kapat(); bildir('"' + ad + '" şablonu kaydedildi', 'basari'); sablonPenceresi(); } catch (err) { hata(err); }
        }),
        guncelle: async (el, e, p, kapat) => {
          const t = bul(el.dataset.id); kapat();
          if (!await onayla('"' + t.ad + '" güncellensin mi?', 'Şablon, menünün şu anki hâliyle (açık ürünler, fiyatlar, QR menü yazıları) değiştirilir.', 'Güncelle')) return sablonPenceresi();
          try { await rpc('ads_sablon_kaydet', { p_ad: t.ad, p_id: t.id }); bildir('Şablon güncellendi', 'basari'); } catch (err) { hata(err); }
          sablonPenceresi();
        },
        uygula: async (el, e, p, kapat) => {
          const t = bul(el.dataset.id); kapat();
          if (!await onayla('"' + t.ad + '" uygulansın mı?', 'Menü bu şablondaki gibi olur: ' + ozet(t.veri || {}).replace(/&quot;/g, '"') + '. Silmiş olduğun ürünler geri eklenir, şablonda olmayanlar satıştan kalkar (silinmez).', 'Uygula')) return;
          try { const r = await rpc('ads_sablon_uygula', { p_id: t.id }); await Promise.all([urunleriYukle(), ayarlariYukle()]).catch(() => {}); kanalGonder('menu'); bildir('"' + t.ad + '" uygulandı · ' + r.acik + ' ürün satışta' + (r.geri_eklenen ? ' · ' + r.geri_eklenen + ' silinmiş ürün geri eklendi' : ''), 'basari'); yenile(); } catch (err) { hata(err); }
        },
        sil: async (el, e, p, kapat) => {
          const t = bul(el.dataset.id); kapat();
          if (!await onayla('"' + t.ad + '" şablonu silinsin mi?', 'Menü değişmez, sadece şablon silinir.', 'Sil', true)) return sablonPenceresi();
          try { await rpc('ads_sablon_sil', { p_id: t.id }); bildir('Şablon silindi'); } catch (err) { hata(err); }
          sablonPenceresi();
        }
      });
    }

    function urunPenceresi(u, onKat) {
      const kats = katSirala(Array.from(new Set(S.kategoriler.map((c) => c.ad).concat(S.urunler.map((x) => x.kategori)).filter(Boolean))));
      const secili = u ? u.kategori : (onKat || kats[0] || '');
      let foto;   // undefined = değişmedi, null = silinecek, metin = yeni fotoğraf
      const fotoGoster = (v) => { const e = document.querySelector('#u-foto-onizle'); if (e) e.innerHTML = v ? '<img alt="" src="' + v + '">' : '📷'; };
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + (u ? 'Ürünü düzenle' : 'Yeni ürün' + (onKat ? ' · ' + esc(onKat) : '')) + '</h2><form>' +
        '<label>Kategori</label><select id="u-k">' + (kats.length ? kats.map((k) => '<option' + (k === secili ? ' selected' : '') + '>' + esc(k) + '</option>').join('') : '<option>Genel</option>') +
        '<option value="__yeni">+ Yeni kategori…</option></select>' +
        '<input id="u-k-yeni" placeholder="Yeni kategori adı" style="display:none;margin-top:6px">' +
        '<label>Ürün adı</label><input id="u-a" value="' + esc(u ? u.ad : '') + '" required maxlength="60">' +
        '<label>Fiyat (₺)</label><input id="u-f" inputmode="decimal" value="' + (u ? String(u.fiyat).replace('.', ',') : '') + '" required>' +
        '<label>Stok (boş = takip yok)</label><input id="u-s" inputmode="numeric" value="' + (u && u.stok != null ? u.stok : '') + '" placeholder="Örn. 40">' +
        '<label>Fotoğraf (müşteri QR menüsünde görünür)</label><div class="foto-alan"><div class="foto-onizle" id="u-foto-onizle">📷</div>' +
        '<div><input type="file" id="u-foto" accept="image/*" style="display:none"><button type="button" class="btn kucuk" data-e="fotoSec">Fotoğraf seç</button> ' +
        '<button type="button" class="btn kucuk" data-e="fotoSil">Kaldır</button><p class="aciklama" style="margin:6px 0 0">Kare kırpılır, küçültülür. Telefondan çekebilirsin.</p></div></div>' +
        '<div class="eylemler">' + (u ? '<button type="button" class="btn tehlike" data-e="sil">Sil</button>' : '<button type="button" class="btn" data-e="kapat">Vazgeç</button>') +
        '<button class="btn ana" type="submit">Kaydet</button></div></form>', {
        fotoSec: (el, e, p) => p.querySelector('#u-foto').click(),
        fotoSil: () => { foto = null; fotoGoster(null); },
        gonder: async (form, e, p, kapat) => {
          const fiyat = sayi(parseFloat(p.querySelector('#u-f').value.replace(',', '.')));
          const sv = p.querySelector('#u-s').value.trim(); const stok = sv === '' ? null : parseInt(sv, 10);
          if (sv !== '' && (isNaN(stok) || stok < 0)) return bildir('Stok için 0 ya da daha büyük bir sayı yaz.', 'hata');
          let kat = p.querySelector('#u-k').value;
          if (kat === '__yeni') kat = p.querySelector('#u-k-yeni').value.trim();
          const veri = { kategori: kat.trim() || 'Genel', ad: p.querySelector('#u-a').value.trim(), fiyat, stok };
          if (!veri.ad || !(fiyat >= 0)) return bildir('Ad ve fiyatı kontrol et.', 'hata');
          try {
            // yeni kategori ise önce oluştur (yoksa)
            if (!katBul(veri.kategori)) { try { await rpc('ads_kategori_kaydet', { p_id: null, p_ad: veri.kategori, p_istasyon: 1, p_aktif: true }); } catch (e2) { /* varsa geç */ } }
            let urunId = u && u.id;
            if (u) await q(db.from('ads_urunler').update(veri).eq('id', u.id));
            else { veri.sira = (S.urunler.reduce((m, x) => Math.max(m, x.sira), 0) || 0) + 1; const yeni = await q(db.from('ads_urunler').insert(veri).select('id')); urunId = yeni && yeni[0] && yeni[0].id; }
            if (urunId && foto === null) await q(db.from('ads_urun_fotolar').delete().eq('urun_id', urunId));
            else if (urunId && foto) await q(db.from('ads_urun_fotolar').upsert({ urun_id: urunId, veri: foto, guncelleme: new Date().toISOString() }));
            kapat(); bildir('Kaydedildi', 'basari'); yenile();
          } catch (err) { hata(err); }
        },
        sil: async (el, e, p, kapat) => {
          kapat();
          if (!await onayla(u.ad + ' silinsin mi?', 'Geçmiş hesaplardaki kayıtlar silinmez. Geçici olarak kaldırmak için "Satışta" kutusunu kapatman yeterli.', 'Sil', true)) return;
          try { await q(db.from('ads_urunler').delete().eq('id', u.id)); bildir('Silindi'); yenile(); } catch (err) { hata(err); }
        }
      }, (p) => {
        const sel = p.querySelector('#u-k'); const yeni = p.querySelector('#u-k-yeni');
        sel.addEventListener('change', () => { yeni.style.display = sel.value === '__yeni' ? '' : 'none'; if (sel.value === '__yeni') yeni.focus(); });
        if (!kats.length) { sel.value = '__yeni'; yeni.style.display = ''; }
        if (!u) (kats.length ? p.querySelector('#u-a') : yeni).focus();
        p.querySelector('#u-foto').addEventListener('change', async (ev) => {
          const f = ev.target.files && ev.target.files[0]; if (!f) return;
          try { foto = kareFoto(await resimAc(f), 360); fotoGoster(foto); } catch (err) { hata(err); }
        });
        if (u) q(db.from('ads_urun_fotolar').select('veri').eq('urun_id', u.id)).then((r) => { if (foto === undefined && r && r[0]) fotoGoster(r[0].veri); }).catch(() => {});
      });
    }

    function garsonPenceresi(g) {
      const rollar = rolData.roller;
      const sistemRol = (s) => (rollar.find((x) => x.sistem === s) || {}).id;
      const rolSec = g ? (g.izin_ozel ? 'ozel' : (g.rol_id || sistemRol(g.rol === 'admin' ? 'yonetici' : 'garson'))) : sistemRol('garson');
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + (g ? 'Hesabı düzenle' : 'Yeni garson') + '</h2><form autocomplete="off">' +
        '<label>Ad Soyad</label><input id="g-ad" value="' + esc(g ? g.ad : '') + '" required>' +
        '<label>Kullanıcı adı</label><input id="g-ku" value="' + esc(g ? g.kullanici : '') + '" autocapitalize="none" required>' +
        '<label>' + (g ? 'Yeni şifre (değiştirmeyeceksen boş bırak)' : 'Şifre (en az 4 karakter)') + '</label><input id="g-pi" type="text" inputmode="numeric" autocomplete="new-password"' + (g ? '' : ' required') + '>' +
        '<label for="g-rol">Rol (neleri görüp yapabilir)</label><select id="g-rol">' +
          rolData.roller.map((r) => '<option value="' + r.id + '"' + (rolSec === r.id ? ' selected' : '') + '>' + esc(r.ad) + (r.sistem === 'yonetici' ? ' (her şeyi yapar)' : '') + '</option>').join('') +
          '<option value="ozel"' + (rolSec === 'ozel' ? ' selected' : '') + '>Özel — tek tek seç…</option></select>' +
        '<div id="g-izin-alan"></div>' +
        (bolumListesi().length ? '<label>Hangi bölümlere bakar?</label><div class="secenekler">' + bolumListesi().map((b) =>
          '<button type="button" class="secenek' + (g && g.bolumler && g.bolumler.includes(b) ? ' aktif' : '') + '" data-e="bolumSec" data-b="' + esc(b) + '">' + esc(b) + '</button>').join('') + '</div>' +
          '<p class="aciklama">Hiçbirini seçmezsen bütün masaları görür. Yöneticiler her zaman hepsini görür. Paketleri herkes görür.</p>'
          : '<p class="aciklama">Bölüm atamak için önce Masalar sekmesinde masalara bölüm yaz.</p>') +
        '<label for="g-ik">🎁 Hediye ikram hakkı (₺)</label><input id="g-ik" inputmode="decimal" placeholder="0 = yok" value="' + (g && Number(g.ikram_limit) > 0 ? String(g.ikram_limit).replace('.', ',') : '') + '">' +
        '<label for="g-ikb">⏳ Hediye hakkı son kullanma (isteğe bağlı)</label><input id="g-ikb" type="datetime-local" value="' + (g ? ikramBitisInput(g.ikram_bitis) : '') + '">' +
        '<p class="aciklama">Boş bırakırsan süresizdir. Süre dolunca hak kullanılamaz; tarihi uzatarak yeniden açabilirsin (saat İstanbul saatidir).</p>' +
        '<p class="aciklama">Bu garson bu tutar kadar ürünü bedava yiyebilir. Hesapta ödeme türü olarak "Garson ikramı" seçilir.' +
        (g && Number(g.ikram_limit) > 0 ? ' Şu an <b>' + para(g.ikram_kalan) + '</b> kaldı. <button type="button" class="not-btn" style="margin:4px 0 0" data-e="ikramSifirla">Hakkı yenile</button>' : '') + '</p>' +
        '<label class="anahtar"><span>Hesap açık (giriş yapabilir)</span><input type="checkbox" id="g-ak"' + (!g || g.aktif ? ' checked' : '') + '></label>' +
        '<div class="eylemler"><button type="button" class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" type="submit">Kaydet</button></div></form>', {
        bolumSec: (el) => el.classList.toggle('aktif'),
        ikramSifirla: async (el, e, p, kapat) => {
          try { await rpc('ads_ikram_sifirla', { p_garson: g.id }); kapat(); bildir(g.ad + ' için hediye hakkı yenilendi', 'basari'); yenile(); } catch (err) { hata(err); }
        },
        gonder: async (form, e, p, kapat) => {
          const pin = p.querySelector('#g-pi').value;
          const secim = p.querySelector('#g-rol').value; const ozelMi = secim === 'ozel';
          const secilenRolId = ozelMi ? sistemRol('garson') : secim;
          const rolDeger = rollar.find((x) => x.id === secilenRolId) || {};
          try {
            await rpc('ads_garson_kaydet', {
              p_id: g ? g.id : null, p_ad: p.querySelector('#g-ad').value, p_kullanici: p.querySelector('#g-ku').value,
              p_pin: pin ? pin : null, p_rol: rolDeger.sistem === 'yonetici' ? 'admin' : 'garson', p_rol_id: secilenRolId, p_izin_ozel: ozelMi ? izinOku(p.querySelector('#g-izin-alan')) : null,
              p_aktif: p.querySelector('#g-ak').checked,
              p_ikram_limit: sayi(parseFloat((p.querySelector('#g-ik').value || '0').replace(',', '.'))) || 0,
              p_ikram_bitis: p.querySelector('#g-ikb').value ? p.querySelector('#g-ikb').value + ':00+03:00' : null,
              p_bolumler: Array.from(p.querySelectorAll('[data-e="bolumSec"].aktif')).map((b) => b.dataset.b)
            });
            if (g && ben && g.id === ben.id) { ben.ad = p.querySelector('#g-ad').value.trim(); LS.yaz('ads_ben', ben); }
            kapat(); bildir('Kaydedildi', 'basari'); yenile();
          } catch (err) { hata(err); }
        }
      }, (p) => {
        const sec = p.querySelector('#g-rol'); const alan = p.querySelector('#g-izin-alan');
        let onceki = g && !g.izin_ozel ? ((rollar.find((x) => x.id === rolSec) || {}).izinler || []) : GARSON_VARSAYILAN_IZIN;
        let ozelBaslangic = g && g.izin_ozel ? g.izin_ozel : null;
        const ciz = () => {
          if (sec.value === 'ozel') {
            alan.innerHTML = '<p class="aciklama">Bu kişiye yetkileri tek tek ver:</p>' + izinKutulari(ozelBaslangic || onceki, false);
          } else {
            const r = rollar.find((x) => x.id === sec.value) || {};
            onceki = r.sistem === 'yonetici' ? rolData.tum : (r.izinler || []);
            alan.innerHTML = '<p class="aciklama">' + (r.sistem === 'yonetici' ? 'Her şeyi yapabilir.' : 'Bu rolde: ' + (onceki.length ? onceki.map((k) => esc((IZIN_ADI[k] || k).split(',')[0])).join('; ') : 'hiçbir yetki yok (sadece masaları görür)') + '.') +
              ' Rolün yetkilerini Garsonlar sekmesinin altındaki Roller bölümünden değiştirebilirsin.</p>';
          }
        };
        sec.addEventListener('change', () => { if (sec.value !== 'ozel') ozelBaslangic = null; ciz(); });
        ciz();
      });
    }

    eylemBagla(Object.assign({}, ortakEylemler, {
      rolEkle: () => rolPenceresi(null),
      rolDuzenle: (el) => rolPenceresi(rolData.roller.find((x) => x.id === el.dataset.id)),
      sekme: (el) => { sekme = el.dataset.s; LS.yaz('ads_yonetim_sekme', sekme); $app.querySelector('main').innerHTML = '<div class="bos">Yükleniyor…</div>'; yenile(); },
      masaEkle: async () => {
        const sira = (S.masalar.reduce((m, x) => Math.max(m, x.sira), 0) || 0) + 1;
        try { await q(db.from('ads_masalar').insert({ ad: 'Masa ' + (S.masalar.length + 1), sira })); yenile(); } catch (e) { hata(e); }
      },
      masaToplu: async () => {
        const n = parseInt(prompt('Kaç masa eklensin?', '5'), 10);
        if (!(n > 0 && n <= 100)) return;
        let sira = S.masalar.reduce((m, x) => Math.max(m, x.sira), 0) || 0; const bas = S.masalar.length;
        const bolum = (prompt('Hangi bölüme eklensin? (boş bırakabilirsin)', '') || '').trim() || null;
        const satirlar = Array.from({ length: n }, (_, i) => ({ ad: 'Masa ' + (bas + i + 1), sira: ++sira, bolum }));
        try { await q(db.from('ads_masalar').insert(satirlar)); bildir(n + ' masa eklendi', 'basari'); yenile(); } catch (e) { hata(e); }
      },
      masaYukari: (el) => { const i = Number(el.dataset.i); siraDegistir(i, i - 1); },
      masaAsagi: (el) => { const i = Number(el.dataset.i); siraDegistir(i, i + 1); },
      masaSil: async (el) => {
        const m = S.masalar.find((x) => x.id === el.dataset.id);
        try {
          const acik = await q(db.from('ads_adisyonlar').select('id').eq('masa_id', m.id).eq('durum', 'acik'));
          if (acik.length) return bildir(m.ad + ' masasında açık hesap var, önce kapat.', 'hata');
          if (!await onayla(m.ad + ' silinsin mi?', '', 'Sil', true)) return;
          await q(db.from('ads_masalar').update({ aktif: false }).eq('id', m.id));
          yenile();
        } catch (e) { hata(e); }
      },
      urunEkle: (el) => urunPenceresi(null, el.dataset.k || null),
      urunDuzenle: (el) => urunPenceresi(S.urunler.find((u) => u.id === el.dataset.id)),
      katEkle: () => kategoriPenceresi(null),
      katDuzenle: (el) => kategoriPenceresi(S.kategoriler.find((c) => c.id === el.dataset.id)),
      katYukari: (el) => katSiraDegistir(el.dataset.id, -1),
      katAsagi: (el) => katSiraDegistir(el.dataset.id, 1),
      sablonlar: () => sablonPenceresi(),
      urunToplu: () => {
        pencere('<button class="kapat-x" data-e="kapat">×</button><h2>Toplu ürün ekle</h2>' +
          '<p class="aciklama">Her satıra bir ürün: <b>Kategori ; Ürün ; Fiyat</b> (istersen sonuna <b>; Stok</b>)<br>Kategori yazmazsan "Genel" olur: <b>Ürün ; Fiyat</b></p>' +
          '<form><textarea id="t-m" rows="9" placeholder="Ana Yemek ; Hamsi Tava ; 250\nAna Yemek ; Levrek ; 320\nİçecek ; Çay ; 15\nİçecek ; Ayran ; 25"></textarea>' +
          '<label class="anahtar"><span>Mevcut menüyü sil, bununla değiştir</span><input type="checkbox" id="t-sil"></label>' +
          '<div class="eylemler"><button type="button" class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" type="submit">Ekle</button></div></form>', {
          gonder: async (form, e, p, kapat) => {
            const hatali = [];
            let sira = p.querySelector('#t-sil').checked ? 0 : (S.urunler.reduce((m, x) => Math.max(m, x.sira), 0) || 0);
            const satirlar = p.querySelector('#t-m').value.split('\n').map((s) => s.trim()).filter(Boolean).map((s, i) => {
              const parca = s.split(/[;\t|]/).map((x) => x.trim());
              let kategori = 'Genel'; let ad; let fiyat;
              let stok = null;
              if (parca.length >= 3) { kategori = parca[0] || 'Genel'; ad = parca[1]; fiyat = parca[2]; if (parca.length >= 4 && parca[3] !== '') stok = parseInt(parca[3], 10); } else { ad = parca[0]; fiyat = parca[1]; }
              fiyat = sayi(parseFloat(String(fiyat || '').replace(/[^\d,.]/g, '').replace(',', '.')));
              if (!ad || !(fiyat >= 0) || isNaN(fiyat) || (stok !== null && (isNaN(stok) || stok < 0))) { hatali.push(i + 1); return null; }
              return { kategori, ad, fiyat, stok, sira: ++sira };
            }).filter(Boolean);
            if (hatali.length) return bildir('Hatalı satır: ' + hatali.join(', '), 'hata');
            if (!satirlar.length) return;
            try {
              if (p.querySelector('#t-sil').checked) {
                if (!confirm('Mevcut ' + S.urunler.length + ' ürün silinecek. Emin misin?')) return;
                await q(db.from('ads_urunler').delete().not('id', 'is', null));
              }
              // yeni kategorileri oluştur
              const yeniKat = Array.from(new Set(satirlar.map((x) => x.kategori))).filter((k) => !katBul(k));
              for (const k of yeniKat) { try { await rpc('ads_kategori_kaydet', { p_id: null, p_ad: k, p_istasyon: 1, p_aktif: true }); } catch (e2) { /* */ } }
              await q(db.from('ads_urunler').insert(satirlar));
              kapat(); bildir(satirlar.length + ' ürün eklendi', 'basari'); yenile();
            } catch (err) { hata(err); }
          }
        });
      },
      garsonEkle: () => garsonPenceresi(null),
      ikramHepsi: async () => {
        if (!await onayla('Hediye hakları yenilensin mi?', 'Herkesin kullandığı tutar sıfırlanır, yeniden tam hakla başlarlar.', 'Yenile')) return;
        try { await rpc('ads_ikram_sifirla', { p_garson: null }); bildir('Hediye hakları yenilendi', 'basari'); yenile(); } catch (e) { hata(e); }
      },
      garsonDuzenle: (el) => garsonPenceresi(garsonlar.find((g) => g.id === el.dataset.id)),
      yedekKur: () => yedekKurPenceresi(),
      yedekKapat: async () => {
        if (!await onayla('Otomatik yedek kapatılsın mı?', 'Google tarafındaki kod çalışmaya devam etse bile artık veri alamaz. İstersen sonra yeniden kurabilirsin.', 'Kapat', true)) return;
        try { await rpc('ads_yedek_kapat'); bildir('Otomatik yedek kapatıldı'); yedekKartYukle(); } catch (err) { hata(err); }
      },
      istEkle: () => {
        istTaslakOku(); const t = istTaslakAl();
        const id = Math.max(1, ...Object.keys(t).map(Number)) + 1; t[id] = '';
        ciz(); const yeni = document.querySelector('#ayar-form [data-ist="' + id + '"]'); if (yeni) { yeni.focus(); yeni.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      },
      istSil: async (el) => {
        istTaslakOku(); const n = el.dataset.n; const t = istTaslakAl();
        const kullanan = S.kategoriler.filter((c) => String(c.istasyon) === n);
        if (kullanan.length && !await onayla((t[n] || 'İstasyon ' + n) + ' silinsin mi?', kullanan.map((c) => c.ad).join(', ') + ' kategorileri varsayılan istasyona (Mutfak) taşınır. Kaydedince geçerli olur.', 'Sil', true)) return;
        delete t[n]; ciz();
      },
      gunModu: (el) => {
        S.ayarlar.gun_sonu_modu = el.dataset.m;
        el.parentNode.querySelectorAll('.secenek').forEach((b) => b.classList.toggle('aktif', b === el));
      },
      bolme: (el) => {
        S.ayarlar.fis_bolme = el.dataset.b;
        el.parentNode.querySelectorAll('.secenek').forEach((b) => b.classList.toggle('aktif', b === el));
      },
      genislik: (el) => {
        S.ayarlar.fis_genislik = Number(el.dataset.g);
        el.parentNode.querySelectorAll('.secenek').forEach((b) => b.classList.toggle('aktif', b === el));
      }
    }));

    // anlık kaydetmeler
    $app.onchange = async (e) => {
      const t = e.target;
      if (t.dataset.masaAd) {
        const ad = t.value.trim(); const m = S.masalar.find((x) => x.id === t.dataset.masaAd);
        if (!ad || !m || ad === m.ad) { if (m) t.value = m.ad; return; }
        try { await q(db.from('ads_masalar').update({ ad }).eq('id', m.id)); m.ad = ad; bildir('Kaydedildi: ' + ad, 'basari'); } catch (err) { hata(err); }
      }
      if (t.dataset.masaBolum !== undefined) {
        const bolum = t.value.trim(); const m = S.masalar.find((x) => x.id === t.dataset.masaBolum);
        if (!m || bolum === (m.bolum || '')) return;
        try { await q(db.from('ads_masalar').update({ bolum: bolum || null }).eq('id', m.id)); m.bolum = bolum; bildir(m.ad + ' → ' + (bolum || 'bölümsüz'), 'basari'); } catch (err) { hata(err); }
      }
      if (t.dataset.urunStok) {
        const u = S.urunler.find((x) => x.id === t.dataset.urunStok); if (!u) return;
        const v = t.value.trim();
        const stok = v === '' ? null : parseInt(v, 10);
        if (v !== '' && (isNaN(stok) || stok < 0)) { bildir('Stok için 0 ya da daha büyük bir sayı yaz (boş = takip yok).', 'hata'); t.value = u.stok == null ? '' : u.stok; return; }
        try { await q(db.from('ads_urunler').update({ stok }).eq('id', u.id)); u.stok = stok; bildir(u.ad + ': ' + (stok == null ? 'stok takibi kapalı' : 'stok ' + stok), 'basari'); kanalGonder('stok'); await yenile(); } catch (err) { hata(err); }
        return;
      }
      if (t.dataset.urunTukendi) {
        const u = S.urunler.find((x) => x.id === t.dataset.urunTukendi); if (!u) return;
        try { await q(db.from('ads_urunler').update({ tukendi: t.checked }).eq('id', u.id)); bildir(u.ad + (t.checked ? ' tükendi olarak işaretlendi' : ' yeniden satışta'), 'basari'); kanalGonder('stok'); await yenile(); } catch (err) { hata(err); t.checked = !t.checked; }
        return;
      }
      if (t.dataset.urunAktif) {
        try { await q(db.from('ads_urunler').update({ aktif: t.checked }).eq('id', t.dataset.urunAktif)); kanalGonder('stok'); await yenile(); } catch (err) { hata(err); t.checked = !t.checked; }
      }
    };

    $app.innerHTML = ustBar('Yönetim', '', geriBtn('/masalar')) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { if (!S.ayarlar) await ayarlariYukle(); await yukle(); ciz(); } catch (e) { hata(e); }
  }

  // ---------------------------------------------------------------
  // GÜN SONU RAPORU
  // ---------------------------------------------------------------
  // ---------------------------------------------------------------
  // GRAFİKLER (bağımlılıksız SVG/HTML; açık-koyu moda uyar, üstüne gelince/dokununca ipucu verir)
  // ---------------------------------------------------------------
  const GRAFIK_RENK = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g4)', 'var(--g5)'];
  const tip = (t) => ' data-tip="' + esc(t) + '"';
  const yuzde = (a, b) => (b > 0 ? Math.round(a * 100 / b) : 0);

  function grafikYatay(liste, biçim) {
    // liste: [{ad, deger, ek?}]
    const mx = Math.max(1, ...liste.map((x) => x.deger));
    return '<div class="yatay">' + liste.map((x, i) => '<div class="sira"' + tip(x.ad + ' · ' + (biçim ? biçim(x.deger) : para(x.deger)) + (x.ek ? ' · ' + x.ek : '')) + '>' +
      '<span class="ad">' + esc(x.ad) + '</span><span class="yol"><span class="dolgu" style="display:block;width:' + Math.max(2, x.deger * 100 / mx) + '%;animation-delay:' + (i * 50) + 'ms"></span></span>' +
      '<span class="deger">' + (biçim ? biçim(x.deger) : para(x.deger)) + '</span></div>').join('') + '</div>';
  }

  function grafikHalka(parcalar, ortaBaslik, ortaYazi) {
    const toplam = parcalar.reduce((t, x) => t + x.deger, 0);
    if (toplam <= 0) return '<div class="bos">Veri yok.</div>';
    let ofs = 0;
    const dilimler = parcalar.map((x) => {
      const pay = x.deger * 100 / toplam; const d = '<circle class="dilim" cx="18" cy="18" r="15.9155" pathLength="100" stroke="' + x.renk + '" stroke-dasharray="' + Math.max(0, pay - 0.9) + ' ' + (100 - Math.max(0, pay - 0.9)) + '" stroke-dashoffset="' + (-ofs) + '"' + tip(x.ad + ' · ' + para(x.deger) + ' · %' + yuzde(x.deger, toplam)) + '/>';
      ofs += pay; return d;
    }).join('');
    return '<div class="halka-kap"><div class="halka"><svg viewBox="0 0 36 36" aria-hidden="true"><circle class="iz" cx="18" cy="18" r="15.9155"/>' + dilimler + '</svg>' +
      '<div class="orta"><b>' + esc(ortaBaslik) + '</b><span>' + esc(ortaYazi) + '</span></div></div>' +
      '<div class="lejant">' + parcalar.map((x) => '<div><i style="background:' + x.renk + '"></i>' + esc(x.ad) + '<span class="yuzde">%' + yuzde(x.deger, toplam) + '</span><b>' + para(x.deger) + '</b></div>').join('') + '</div></div>';
  }

  // Yoğunluk: günün hangi saatinde kaç sipariş / ne kadar satış
  function yogunlukHesapla(R, olcu, dakika) {
    const adet = 1440 / dakika; const dizi = new Array(adet).fill(0); const goruldu = new Set(); const bas = gbs() * 60;
    (R.kalemler || []).forEach((k) => {
      const t = new Date(k.z); const m = t.getHours() * 60 + t.getMinutes(); const idx = Math.floor((((m - bas) % 1440) + 1440) % 1440 / dakika);
      if (olcu === 'siparis') { if (!goruldu.has(k.no)) { goruldu.add(k.no); dizi[idx] += 1; } }
      else if (olcu === 'tutar') dizi[idx] += k.tutar; else dizi[idx] += k.adet;
    });
    let ilk = dizi.findIndex((v) => v > 0); let son = dizi.length - 1 - [...dizi].reverse().findIndex((v) => v > 0);
    if (ilk < 0) return { dizi, ilk: 0, son: -1, bos: true, adet, dakika, bas };
    const en = Math.max(1, Math.round(60 / dakika) * 4); // en az ~4 saat göster
    ilk = Math.max(0, ilk - Math.round(60 / dakika)); son = Math.min(adet - 1, son + Math.round(60 / dakika));
    while (son - ilk + 1 < en && (ilk > 0 || son < adet - 1)) { if (son < adet - 1) son++; if (son - ilk + 1 < en && ilk > 0) ilk--; }
    return { dizi, ilk, son, bos: false, adet, dakika, bas };
  }
  const bucketSaati = (Y, i) => { const m = (Y.bas + i * Y.dakika) % 1440; return ikiHane(Math.floor(m / 60)) + ':' + ikiHane(m % 60); };
  function grafikYogunluk(R, olcu, dakika) {
    const Y = yogunlukHesapla(R, olcu, dakika);
    if (Y.bos) return '<div class="bos">Bu aralıkta sipariş yok.</div>';
    const f = (v) => olcu === 'tutar' ? para(v) : olcu === 'adet' ? v + ' ürün' : v + ' sipariş';
    const kes = Y.dizi.slice(Y.ilk, Y.son + 1); const mx = Math.max(...kes); const toplam = kes.reduce((t, v) => t + v, 0);
    const sutunlar = kes.map((v, i) => {
      const gi = Y.ilk + i; const zirve = v === mx && v > 0;
      return '<div class="sut' + (zirve ? ' zirve' : '') + '"' + (zirve ? ' data-deger="' + esc(olcu === 'tutar' ? para(v) : String(v)) + '"' : '') + tip(bucketSaati(Y, gi) + '–' + bucketSaati(Y, gi + 1) + ' · ' + f(v) + (toplam ? ' · %' + yuzde(v, toplam) : '')) + '>' +
        '<div class="cb" style="height:' + (v > 0 ? Math.max(3, v * 84 / mx) : 0) + '%;animation-delay:' + (i * 18) + 'ms"></div></div>';
    }).join('');
    const etiket = kes.map((_, i) => { const gi = Y.ilk + i; const m = (Y.bas + gi * Y.dakika) % 1440; return '<span>' + (m % 60 === 0 ? ikiHane(Math.floor(m / 60)) : '') + '</span>'; }).join('');
    const sirali = kes.map((v, i) => ({ v, i: Y.ilk + i })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    const z = sirali[0];
    const ozet = '<div class="grafik-not">En yoğun: <b>' + bucketSaati(Y, z.i) + '–' + bucketSaati(Y, z.i + 1) + '</b> · ' + f(z.v) + ' (toplamın %' + yuzde(z.v, toplam) + '\'i)' +
      (sirali[1] ? ' · sonra <b>' + bucketSaati(Y, sirali[1].i) + '</b>' : '') + (sirali[2] ? ', <b>' + bucketSaati(Y, sirali[2].i) + '</b>' : '') + '</div>';
    return ozet + '<div class="dikey">' + sutunlar + '</div><div class="eksen">' + etiket + '</div>';
  }

  // tüm sayfalarda çalışan ipucu (fare ile üstüne gel ya da dokun)
  (function ipucuKur() {
    const el = document.createElement('div'); el.className = 'ipucu'; el.setAttribute('role', 'tooltip'); document.body.appendChild(el);
    let hedef = null;
    const gizle = () => { hedef = null; el.classList.remove('ac'); };
    const goster = (e) => {
      const t = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
      if (!t) return gizle();
      if (t === hedef) return; hedef = t;
      el.textContent = t.getAttribute('data-tip'); el.classList.add('ac');
      const r = t.getBoundingClientRect(); const w = el.offsetWidth; const h = el.offsetHeight;
      let x = r.left + r.width / 2 - w / 2; x = Math.max(8, Math.min(window.innerWidth - w - 8, x));
      let y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
      el.style.left = x + 'px'; el.style.top = y + 'px';
    };
    document.addEventListener('pointerover', goster); document.addEventListener('pointerdown', goster);
    document.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse') gizle(); });
    document.addEventListener('scroll', gizle, true);
    document.addEventListener('pointerdown', (e) => { if (!(e.target.closest && e.target.closest('[data-tip]'))) gizle(); });
  })();

  // Panel ve Gün Sonu'nda ortak: grafik kartlarının HTML'i
  function grafikBolumuHtml(R, yg) {
    const odeme = [['Nakit', R.odeme.nakit, GRAFIK_RENK[0]], ['Kart', R.odeme.kart, GRAFIK_RENK[1]], ['İkram', R.odeme.ikram, GRAFIK_RENK[2]], ['İndirim', R.odeme.indirim, GRAFIK_RENK[3]], ['Garson ikramı', R.odeme.garson_ikram, GRAFIK_RENK[4]]]
      .filter((x) => x[1] > 0).map((x) => ({ ad: x[0], deger: x[1], renk: x[2] }));
    const urunler = Object.entries(R.urun).sort((a, b) => b[1].adet - a[1].adet).slice(0, 8).map(([ad, v]) => ({ ad, deger: v.adet, ek: para(v.tutar) }));
    const garsonlar = Object.entries(R.garson).sort((a, b) => b[1].tutar - a[1].tutar).slice(0, 8).map(([ad, v]) => ({ ad, deger: v.tutar, ek: v.hesap.size + ' hesap' }));
    const tahsil = R.odeme.nakit + R.odeme.kart;
    const ols = [['siparis', 'Sipariş sayısı'], ['tutar', 'Satış tutarı'], ['adet', 'Ürün adedi']];
    return '<div class="panel-izgara iki">' +
      '<div class="kart dolgulu grafik-kart genis"><div class="grafik-baslik"><h3>⏱ Günün yoğunluğu</h3><span class="alt">Hangi saatte ne kadar iş var</span></div>' +
      '<div class="mini-cipler">' + ols.map(([k, e]) => '<button class="cip' + (yg.olcu === k ? ' aktif' : '') + '" data-e="ygOlcu" data-v="' + k + '">' + e + '</button>').join('') +
      '<span style="flex:1"></span>' + [60, 30].map((d) => '<button class="cip' + (yg.dakika === d ? ' aktif' : '') + '" data-e="ygDakika" data-v="' + d + '">' + (d === 60 ? 'Saatlik' : '30 dk') + '</button>').join('') + '</div>' +
      grafikYogunluk(R, yg.olcu, yg.dakika) + '</div>' +
      '<div class="kart dolgulu grafik-kart"><div class="grafik-baslik"><h3>💳 Ödeme dağılımı</h3></div>' + (odeme.length ? grafikHalka(odeme, para(tahsil), 'tahsilat') : '<div class="bos">Ödeme yok.</div>') + '</div>' +
      '<div class="kart dolgulu grafik-kart"><div class="grafik-baslik"><h3>🐟 En çok satanlar</h3><span class="alt">adet</span></div>' + (urunler.length ? grafikYatay(urunler, (v) => v + ' adet') : '<div class="bos">Satış yok.</div>') + '</div>' +
      '<div class="kart dolgulu grafik-kart genis"><div class="grafik-baslik"><h3>🧑‍🍳 Garsonlar</h3><span class="alt">satış tutarı</span></div>' + (garsonlar.length ? grafikYatay(garsonlar) : '<div class="bos">—</div>') + '</div></div>';
  }

  // ---------------------------------------------------------------
  // RAPOR VERİSİ (Gün Sonu ve Genel Panel ortak kullanır)
  // ---------------------------------------------------------------
  async function raporVerisiGetir(bas, son, donem) {
    const Q = sorgu(bas, son, donem); const { b, e } = Q;
    let [hesaplar, iptaller] = await Promise.all([
      hepsiniGetir(() => db.from('ads_adisyonlar').select('id, acilis, kapanis, kapatan_ad, acan_ad, indirim_oran, ads_masalar(ad, tur, bolum), ads_kalemler(id, ad, fiyat, adet, durum, garson_ad, notu, olusturma, siparis_no, iptal_eden, iptal_neden), ads_odemeler(id, tur, tutar, ikram_garson_ad, garson_ad, olusturma)')
        .eq('durum', 'kapali').gte('kapanis', b.toISOString()).lt('kapanis', e.toISOString()).order('kapanis', { ascending: false })),
      hepsiniGetir(() => db.from('ads_kalemler').select('ad, fiyat, adet, notu, garson_ad, iptal_eden, iptal_neden, iptal_zaman, ads_adisyonlar(ads_masalar(ad))')
        .eq('durum', 'iptal').gte('iptal_zaman', b.toISOString()).lt('iptal_zaman', e.toISOString()).order('iptal_zaman', { ascending: false }))
    ]);
    hesaplar = hesaplar.filter((h) => Q.icinde(h.kapanis));
    iptaller = iptaller.filter((k) => Q.icinde(k.iptal_zaman));
    await acikHesaplariYukle();
    const urun = {}; const garson = {}; const garsonUrun = {}; const odeme = { nakit: 0, kart: 0, ikram: 0, indirim: 0, garson_ikram: 0 };
    const hediye = {}; let personel = 0; let paketSayi = 0; let paketTutar = 0; let satis = 0;
    hesaplar.forEach((h) => {
      h.ads_kalemler.filter((k) => k.durum === 'aktif').forEach((k) => {
        const t = k.fiyat * k.adet; satis += t;
        urun[k.ad] = urun[k.ad] || { adet: 0, tutar: 0 }; urun[k.ad].adet += k.adet; urun[k.ad].tutar += t;
        const g = k.garson_ad || '—';
        garson[g] = garson[g] || { adet: 0, tutar: 0, hesap: new Set() }; garson[g].adet += k.adet; garson[g].tutar += t; garson[g].hesap.add(h.id);
        const gu = g + '\u0000' + k.ad; garsonUrun[gu] = garsonUrun[gu] || { garson: g, urun: k.ad, adet: 0, tutar: 0 }; garsonUrun[gu].adet += k.adet; garsonUrun[gu].tutar += t;
      });
      h.ads_odemeler.forEach((o) => {
        odeme[o.tur] = (odeme[o.tur] || 0) + Number(o.tutar);
        if (o.tur === 'garson_ikram') { const k = o.ikram_garson_ad || '—'; hediye[k] = (hediye[k] || 0) + Number(o.tutar); }
      });
      const t = hesapToplam(h); personel += t.indirim;
      if (h.ads_masalar && h.ads_masalar.tur === 'paket') { paketSayi++; paketTutar += t.net; }
    });
    const kalemler = [];
    hesaplar.forEach((h) => h.ads_kalemler.filter((k) => k.durum === 'aktif').forEach((k) => kalemler.push({ z: k.olusturma, no: h.id + ':' + (k.siparis_no != null ? k.siparis_no : k.id), tutar: k.fiyat * k.adet, adet: k.adet })));
    return { hesaplar, iptaller, urun, garson, garsonUrun, odeme, hediye, personel: sayi(personel), paketSayi, paketTutar: sayi(paketTutar), satis: sayi(satis),
      acikToplam: sayi(S.acik.reduce((t, a) => t + hesapToplam(a).kalan, 0)), acikSayi: S.acik.length,
      iptalToplam: sayi(iptaller.reduce((t, k) => t + k.fiyat * k.adet, 0)), kalemler };
  }


  async function raporSayfa() {
    $app.innerHTML = ustBar('Gün Sonu / Rapor', '', geriBtn('/masalar')) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { await raporHazirla(); } catch (e) { hata(e); }
    const gun = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const bugun = () => isGunu(new Date());
    let bas = LS.al('ads_rapor_bas', null) || bugun();
    let son = LS.al('ads_rapor_son', null) || bas;
    if (LS.al('ads_rapor_gun', '') !== bugun()) { bas = son = bugun(); } // her gün bugünle açılsın
    LS.yaz('ads_rapor_gun', bugun());
    let R = null; const yg = { olcu: 'siparis', dakika: 60 };
    let donem = manuelMod() ? acikDonem() : null;
    const trTarih = (g) => g.split('-').reverse().join('.');
    const aralikYazi = () => donem ? donemYazi(donem) : (bas === son ? trTarih(bas) : trTarih(bas) + ' – ' + trTarih(son));

    async function yukle() { R = await raporVerisiGetir(bas, son, donem); }

    function ciz() {
      const ust = ustBar('Gün Sonu / Rapor', '', geriBtn('/masalar'), '<button class="ust-btn" data-e="menu">☰</button>');
      const tarihSatir = '<div class="kart dolgulu"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">' +
        '<div style="flex:1;min-width:130px"><label style="margin-top:0">Başlangıç</label><input type="date" id="r-b" value="' + bas + '"></div>' +
        '<div style="flex:1;min-width:130px"><label style="margin-top:0">Bitiş</label><input type="date" id="r-s" value="' + son + '"></div></div>' +
        '<div class="btn-satir" style="margin-top:10px"><button class="btn kucuk" data-e="aralik" data-a="bugun">Bugün</button><button class="btn kucuk" data-e="aralik" data-a="dun">Dün</button>' +
        '<button class="btn kucuk" data-e="aralik" data-a="hafta">Son 7 gün</button><button class="btn kucuk" data-e="aralik" data-a="ay">Bu ay</button></div>' +
        '<div class="btn-satir" style="margin-top:10px"><button class="btn ana" data-e="excel">📥 Excel / CSV</button><button class="btn koyu" data-e="yazdir">🖨️ Fiş bas</button></div>' +
        '<div class="btn-satir" style="margin-top:8px"><button class="btn" data-e="git" data-hedef="/dokum">🔎 Detaylı döküm</button><button class="btn" data-e="git" data-hedef="/karsilastirma">📈 Haftalık karşılaştırma</button></div></div>';
      if (!R) { $app.innerHTML = ust + '<main class="icerik">' + gunSonuKarti() + tarihSatir + '<div class="bos">Yükleniyor…</div></main>'; tarihBagla(); return; }
      const urunler = Object.entries(R.urun).sort((a, b) => b[1].tutar - a[1].tutar);
      const garsonlar = Object.entries(R.garson).sort((a, b) => b[1].tutar - a[1].tutar);
      $app.innerHTML = ust + '<main class="icerik">' + gunSonuKarti() + tarihSatir +
        '<div class="aralik-baslik">' + esc(aralikYazi()) + '</div>' +
        '<div class="istatistik">' +
        '<div class="kutu"><span>Satış toplamı</span><b>' + para(R.satis) + '</b></div>' +
        '<div class="kutu"><span>Tahsilat (nakit + kart)</span><b>' + para(R.odeme.nakit + R.odeme.kart) + '</b></div>' +
        '<div class="kutu"><span>Nakit</span><b>' + para(R.odeme.nakit) + '</b></div>' +
        '<div class="kutu"><span>Kart</span><b>' + para(R.odeme.kart) + '</b></div>' +
        '<div class="kutu"><span>İkram</span><b>' + para(R.odeme.ikram) + '</b></div>' +
        '<div class="kutu"><span>İndirim</span><b>' + para(R.odeme.indirim) + '</b></div>' +
        '<div class="kutu"><span>Personel indirimi</span><b>' + para(R.personel) + '</b></div>' +
        '<div class="kutu"><span>Garson ikramı</span><b>' + para(R.odeme.garson_ikram) + '</b></div>' +
        '<div class="kutu"><span>Paket</span><b>' + R.paketSayi + ' · ' + para(R.paketTutar) + '</b></div>' +
        '<div class="kutu"><span>Kapanan hesap</span><b>' + R.hesaplar.length + '</b></div>' +
        '<div class="kutu"><span>İptal edilen</span><b>' + para(R.iptalToplam) + '</b></div>' +
        '</div>' +
        (R.acikSayi ? '<div class="kart dolgulu" style="border-left:4px solid var(--turuncu)"><b>Şu an ' + R.acikSayi + ' açık hesap var</b> · ' + para(R.acikToplam) + ' tahsil edilmedi. Bu tutar rapora girmez.</div>' : '') +
        '<div class="bolum-baslik">Grafikler</div>' + grafikBolumuHtml(R, yg) +
        '<div class="bolum-baslik">Ürün satışları</div><div class="kart">' + (urunler.length ? urunler.map(([ad, v]) =>
          '<div class="satir"><div class="sol"><div class="ad">' + esc(ad) + '</div></div><div class="kucuk" style="min-width:56px;text-align:right">' + v.adet + ' adet</div><div class="sag" style="min-width:90px">' + para(v.tutar) + '</div></div>').join('') : '<div class="bos">Satış yok.</div>') + '</div>' +
        '<div class="bolum-baslik">Garsonlara göre</div><div class="kart">' + (garsonlar.length ? garsonlar.map(([ad, v]) =>
          '<div class="satir tiklanir" data-e="garsonDetay" data-g="' + esc(ad) + '"><div class="sol"><div class="ad">' + esc(ad) + '</div><div class="kucuk">' + v.adet + ' ürün · ' + v.hesap.size + ' hesap · detay için dokun</div></div><div class="sag">' + para(v.tutar) + '</div></div>').join('') : '<div class="bos">—</div>') + '</div>' +
        (Object.keys(R.hediye).length ? '<div class="bolum-baslik">🎁 Garson ikramları</div><div class="kart">' + Object.entries(R.hediye).map(([ad, t]) =>
          '<div class="satir"><div class="sol"><div class="ad">' + esc(ad) + '</div></div><div class="sag">' + para(t) + '</div></div>').join('') + '</div>' : '') +
        '<div class="bolum-baslik"><span>Kapanan hesaplar</span><span style="text-transform:none;letter-spacing:0;font-weight:600">Düzeltmek için hesaba dokun</span></div><div class="kart">' + (R.hesaplar.length ? R.hesaplar.slice(0, 200).map((h) => {
          const t = hesapToplam(h);
          return '<div class="satir tiklanir" data-e="hesapDetay" data-id="' + h.id + '"><div class="sol"><div class="ad">' + esc(h.ads_masalar ? h.ads_masalar.ad : '') + (t.oran ? ' <span class="etiket">Personel</span>' : '') + '</div><div class="kucuk">' +
            (bas !== son ? new Date(h.kapanis).toLocaleDateString('tr-TR') + ' · ' : '') + saat(h.acilis) + ' – ' + saat(h.kapanis) + ' · ' + esc(h.kapatan_ad || '') + ' · ' +
            h.ads_odemeler.map((o) => odemeAdi(o)).filter((v, i, a) => a.indexOf(v) === i).join(', ') + '</div></div><div class="sag">' + para(t.net) + '</div></div>';
        }).join('') + (R.hesaplar.length > 200 ? '<div class="bos">… ve ' + (R.hesaplar.length - 200) + ' hesap daha (hepsi Excel\'de)</div>' : '') : '<div class="bos">—</div>') + '</div>' +
        '<div class="bolum-baslik">İptaller</div><div class="kart">' + (R.iptaller.length ? R.iptaller.map((k) =>
          '<div class="satir"><div class="sol"><div class="ad">' + k.adet + ' × ' + esc(k.ad) + (k.notu ? ' <span class="etiket" style="text-transform:none">📝 ' + esc(k.notu) + '</span>' : '') + '</div><div class="kucuk">' +
          esc((k.ads_adisyonlar && k.ads_adisyonlar.ads_masalar && k.ads_adisyonlar.ads_masalar.ad) || '') + ' · ' + saat(k.iptal_zaman) + ' · ' + esc(k.iptal_eden || '') + (k.iptal_neden ? ' · ' + esc(k.iptal_neden) : '') + '</div></div>' +
          '<div class="sag" style="color:var(--kirmizi)">' + para(k.fiyat * k.adet) + '</div></div>').join('') : '<div class="bos">İptal yok.</div>') + '</div>' +
        '</main>';
      tarihBagla();
    }

    function tarihBagla() {
      const bi = document.getElementById('r-b'); const si = document.getElementById('r-s');
      const degisti = () => {
        bas = bi.value || gun(new Date()); son = si.value || bas;
        if (son < bas) { const x = bas; bas = son; son = x; }
        donem = null;
        LS.yaz('ads_rapor_bas', bas); LS.yaz('ads_rapor_son', son); yenile();
      };
      if (bi) bi.onchange = degisti; if (si) si.onchange = degisti;
    }
    async function yenile() { R = null; ciz(); try { await yukle(); ciz(); } catch (err) { hata(err); } }

    // ---------- gün sonu kartı ----------
    function gunSonuKarti() {
      if (manuelMod()) {
        const ad = acikDonem(); const sonlar = donemler().filter((p) => !p.acik).slice(-8).reverse();
        const aktif = (p) => donem && donem.id === p.id;
        return '<div class="kart dolgulu gs-kart"><div class="gs-ust"><div class="gs-bilgi"><span class="etiket yesil">Manuel gün sonu</span>' +
          '<div class="gs-baslik">Açık gün</div><div class="aciklama" style="margin:0">' + (ad ? tarihSaat(ad.bas) + '\'den beri · ' + sure(ad.bas) : '') +
          (S.acik.length ? ' · <b style="color:var(--turuncu)">' + S.acik.length + ' açık hesap</b>' : '') + '</div></div>' +
          (izin('gunsonu') ? '<button class="btn ana buyuk gs-btn" data-e="gunSonuAl">🔒 Gün Sonunu Al</button>' : '') + '</div>' +
          '<div class="cipler" style="margin-top:12px"><button class="cip' + (donem && donem.acik ? ' aktif' : '') + '" data-e="donemSec" data-id="acik">Açık gün</button>' +
          sonlar.map((p) => '<button class="cip' + (aktif(p) ? ' aktif' : '') + '" data-e="donemSec" data-id="' + p.id + '">' + kisaTarih(p.etiket) + ' ' + gunAdi(p.etiket).slice(0, 3) + ' · ' + saat(p.bit) + '</button>').join('') + '</div></div>';
      }
      return '<div class="kart dolgulu gs-kart"><div class="gs-ust"><div class="gs-bilgi"><span class="etiket">Otomatik gün sonu</span>' +
        '<div class="gs-baslik">Gün her gün ' + ikiHane(gbs()) + ':00\'da kendiliğinden kapanır</div>' +
        '<div class="aciklama" style="margin:0">Şu anki gün ' + tarihSaat(acikGunBaslangic()) + '\'de başladı' + (S.acik.length ? ' · <b style="color:var(--turuncu)">' + S.acik.length + ' açık hesap</b>' : '') + '</div></div>' +
        '<button class="btn koyu buyuk gs-btn" data-e="gunSonuFisi">🖨️ Gün Sonu Fişi</button></div></div>';
    }

    function gunSonuAlPenceresi() {
      const ad = acikDonem(); if (!ad) return;
      const ay = S.ayarlar || {};
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>🔒 Gün sonunu al</h2>' +
        '<p class="aciklama" style="font-size:15px">' + tarihSaat(ad.bas) + ' → şimdi (' + sure(ad.bas) + ')</p>' +
        (S.acik.length ? '<div class="kart dolgulu" style="border-left:4px solid var(--turuncu);margin-top:10px;box-shadow:none;background:var(--uyari-zemin)"><b>' + S.acik.length + ' masa hâlâ açık.</b> ' +
          'Gün sonu yine de alınabilir; bu hesaplar kapandıklarında yeni güne yazılır.</div>' : '') +
        '<label class="anahtar"><span>Gün sonu fişi kasadan çıksın</span><input type="checkbox" id="gs-fis" checked></label>' +
        '<label class="anahtar"><span>Yönetici raporu Excel olarak insin</span><input type="checkbox" id="gs-xl"></label>' +
        (ay.ikram_gunluk ? '<p class="aciklama">Garsonların hediye ikram hakları yeni günde baştan başlar.</p>' : '') +
        '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" data-e="evet">Gün Sonunu Al</button></div>', {
        evet: (el, e, p, kapat) => bekle(el, async () => {
          const fis = p.querySelector('#gs-fis').checked; const xl = p.querySelector('#gs-xl').checked;
          try {
            const r = await rpc('ads_gun_sonu_al');
            kapat();
            await gunleriYukle(); _donemOnbellek = null;
            donem = donemler().find((x) => x.id === r.id) || null;
            await yenile();
            bildir('✓ Gün sonu alındı, yeni gün başladı', 'basari');
            if (fis && R) { try { await kasayaGonder(raporFisi(), 'Gün sonu'); } catch (err) { hata(err); } }
            if (xl) { try { await excelIndirTam(await hareketleriGetir(bas, son, donem), 'yonetici'); } catch (err) { hata(err); } }
          } catch (err) { hata(err); }
        })
      });
    }

    function raporFisi() {
      const ay = S.ayarlar || {};
      const urunler = Object.entries(R.urun).sort((a, b) => b[1].tutar - a[1].tutar);
      const s = (a, b) => '<div class="s"><span>' + a + '</span><span>' + b + '</span></div>';
      return '<div class="fis"><div class="orta buyuk">' + esc(ay.isletme_adi || '') + '</div><div class="orta b">GÜN SONU RAPORU</div>' +
        '<div class="orta">' + aralikYazi() + '</div><div class="cift-cizgi"></div>' +
        s('Satış', para2(R.satis)) + s('Nakit', para2(R.odeme.nakit)) + s('Kart', para2(R.odeme.kart)) + s('İkram', para2(R.odeme.ikram)) + s('İndirim', para2(R.odeme.indirim)) +
        s('Personel ind.', para2(R.personel)) + s('Garson ikramı', para2(R.odeme.garson_ikram)) + s('Paket', R.paketSayi + ' / ' + para2(R.paketTutar)) +
        '<div class="cizgi"></div>' + s('<b>TAHSİLAT</b>', '<b>' + para2(R.odeme.nakit + R.odeme.kart) + '</b>') +
        s('Hesap sayısı', R.hesaplar.length) + s('İptal', para2(R.iptalToplam)) +
        (R.acikSayi ? s('Açık masa', R.acikSayi + ' / ' + para2(R.acikToplam)) : '') +
        '<div class="cift-cizgi"></div><div class="b">GARSONLAR</div>' +
        Object.entries(R.garson).sort((a, b) => b[1].tutar - a[1].tutar).map(([ad, v]) => s(esc(ad), para2(v.tutar))).join('') +
        '<div class="cift-cizgi"></div><div class="b">ÜRÜNLER</div>' +
        urunler.map(([ad, v]) => s(v.adet + ' x ' + esc(ad), para2(v.tutar))).join('') +
        '<div class="cizgi"></div><div class="orta">' + tarihSaat(new Date()) + '</div></div>';
    }

    function garsonDetayAc(ad) {
      const satir = Object.values(R.garsonUrun).filter((v) => v.garson === ad).sort((a, b) => b.tutar - a.tutar);
      const g = R.garson[ad];
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + esc(ad) + '</h2><p class="aciklama">' + aralikYazi() + ' · ' + g.adet + ' ürün · ' + g.hesap.size + ' hesap</p>' +
        '<div style="margin-top:8px">' + satir.map((v) => '<div class="satir"><div class="sol"><div class="ad">' + esc(v.urun) + '</div></div><div class="kucuk">' + v.adet + ' adet</div><div class="sag" style="min-width:80px">' + para(v.tutar) + '</div></div>').join('') + '</div>' +
        '<div class="toplam-satir buyuk"><span>Toplam</span><span>' + para(g.tutar) + '</span></div>' +
        (R.hediye[ad] ? '<div class="toplam-satir"><span>🎁 Hediye ikramı kullandı</span><span>' + para(R.hediye[ad]) + '</span></div>' : ''), {});
    }

    // ---------- gün sonu düzeltme: kapanmış hesap ----------
    function hesapDetayAc(id) {
      const h = R && R.hesaplar.find((x) => x.id === id);
      if (!h) return;
      const t = hesapToplam(h);
      const aktif = h.ads_kalemler.filter((k) => k.durum === 'aktif').sort((a, b) => new Date(a.olusturma) - new Date(b.olusturma));
      const iptal = h.ads_kalemler.filter((k) => k.durum === 'iptal');
      const { kapat } = pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + esc(h.ads_masalar ? h.ads_masalar.ad : 'Hesap') + '</h2>' +
        '<p class="aciklama">' + new Date(h.kapanis).toLocaleDateString('tr-TR') + ' · ' + saat(h.acilis) + ' – ' + saat(h.kapanis) + ' · kapatan ' + esc(h.kapatan_ad || '') + '</p>' +
        '<div style="margin-top:6px">' + (aktif.length ? aktif.map((k) =>
          '<div class="satir"><div class="sol"><div class="ad">' + k.adet + ' × ' + esc(k.ad) + '</div><div class="kucuk">' + esc(k.garson_ad || '') + ' · ' + saat(k.olusturma) + (k.notu ? ' · ' + esc(k.notu) : '') + '</div></div>' +
          '<div class="sag">' + para(k.fiyat * k.adet) + '</div><button class="btn kucuk tehlike" data-e="kalemIptal" data-id="' + k.id + '">İptal</button></div>').join('') : '<div class="bos">Hesapta ürün kalmadı.</div>') + '</div>' +
        (iptal.length ? '<div class="bolum-baslik">İptal edilenler</div>' + iptal.map((k) => '<div class="satir iptal"><div class="sol"><div class="ad">' + k.adet + ' × ' + esc(k.ad) + '</div><div class="kucuk">' + (k.notu ? '📝 ' + esc(k.notu) + ' · ' : '') + esc(k.iptal_eden || '') + (k.iptal_neden ? ' · ' + esc(k.iptal_neden) : '') + '</div></div><div class="sag">' + para(k.fiyat * k.adet) + '</div></div>').join('') : '') +
        '<div class="kart dolgulu" style="margin-top:10px;box-shadow:none;background:var(--zemin)">' +
        (t.oran ? '<div class="toplam-satir"><span>Personel indirimi %' + t.oran + '</span><span>− ' + para(t.indirim) + '</span></div>' : '') +
        '<div class="toplam-satir buyuk"><span>Toplam</span><span>' + para(t.net) + '</span></div>' +
        h.ads_odemeler.map((o) => '<div class="toplam-satir"><span>' + odemeAdi(o) + '</span><span>' + para(o.tutar) + '</span></div>').join('') + '</div>' +
        '<p class="aciklama">İptal ettiğin tutar bu hesabın ödemelerinden düşülür (önce ikram/indirim, sonra nakit/kart), rapor kendiliğinden düzelir. Fiş basılmaz.</p>' +
        '<div class="btn-satir" style="margin-top:12px"><button class="btn" data-e="geriAc">↩︎ Masaya geri aç</button><button class="btn tehlike" data-e="hepsiIptal">Hesabı tamamen iptal et</button></div>', {
        kalemIptal: (el) => { kapat(); kalemIptalAc(h, el.dataset.id); },
        geriAc: async () => {
          kapat();
          if (!await onayla('Hesap masaya geri açılsın mı?', 'Hesap yeniden açık olur; ürün ekleyip çıkarabilir, sonra tekrar kapatabilirsin. Alınan ödemeler yerinde kalır.', 'Geri aç')) return;
          try { await rpc('ads_hesap_geri_ac', { p_adisyon: h.id }); bildir('Hesap ' + (h.ads_masalar ? h.ads_masalar.ad : '') + ' masasına geri açıldı', 'basari'); yenile(); } catch (err) { hata(err); }
        },
        hepsiIptal: async () => {
          kapat();
          const neden = prompt('Neden iptal ediliyor? (isteğe bağlı)', 'Yanlış girildi');
          if (neden === null) return;
          if (!await onayla('Hesap tamamen iptal edilsin mi?', 'Bütün ürünler iptal edilir, ödemeler silinir ve rapordan düşer.', 'İptal et', true)) return;
          try { await rpc('ads_kapali_hesap_iptal', { p_adisyon: h.id, p_neden: neden }); bildir('Hesap iptal edildi, rapor güncellendi', 'basari'); yenile(); } catch (err) { hata(err); }
        }
      });
    }

    function kalemIptalAc(h, kalemId) {
      const k = h.ads_kalemler.find((x) => x.id === kalemId); if (!k) return;
      let adet = k.adet;
      pencere('<button class="kapat-x" data-e="kapat">×</button><h2>' + k.adet + ' × ' + esc(k.ad) + '</h2>' +
        '<p class="aciklama">' + esc(h.ads_masalar ? h.ads_masalar.ad : '') + ' · ' + para(k.fiyat) + ' / adet</p>' +
        (k.notu ? '<div class="kalem-not-kutu">📝 Not: <b>' + esc(k.notu) + '</b></div>' : '') +
        (k.adet > 1 ? '<label>Kaç adet iptal edilecek?</label><div class="adet-kutu"><button data-e="az">−</button><span id="d-a">' + adet + '</span><button data-e="cok">+</button></div>' : '') +
        '<label for="d-n">Neden</label><input id="d-n" value="Yanlış girildi">' +
        '<div class="btn-satir" style="margin-top:8px">' + ['Yanlış girildi', 'Müşteri almadı', 'Ürün çıkmadı', 'Fazla girildi'].map((n) => '<button class="btn kucuk" style="flex:none" data-e="neden" data-n="' + n + '">' + n + '</button>').join('') + '</div>' +
        '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn tehlike dolu" data-e="iptal">İptal Et</button></div>', {
        az: (el, e, p) => { adet = Math.max(1, adet - 1); p.querySelector('#d-a').textContent = adet; },
        cok: (el, e, p) => { adet = Math.min(k.adet, adet + 1); p.querySelector('#d-a').textContent = adet; },
        neden: (el, e, p) => { p.querySelector('#d-n').value = el.dataset.n; },
        iptal: (el, e, p, kapat) => bekle(el, async () => {
          try {
            const r = await rpc('ads_kapali_kalem_iptal', { p_kalem: k.id, p_adet: adet, p_neden: p.querySelector('#d-n').value });
            kapat();
            const dus = (r.dusulen || []).map((d) => para(d.tutar) + ' ' + odemeAdi(d).toLocaleLowerCase('tr')).join(', ');
            bildir(r.adet + ' × ' + r.ad + ' iptal edildi' + (dus ? ' · ödemeden düşüldü: ' + dus : ''), 'basari');
            await yenile();
            hesapDetayAc(h.id);
          } catch (err) { hata(err); }
        })
      });
    }

    eylemBagla(Object.assign({}, ortakEylemler, {
      hesapDetay: (el) => hesapDetayAc(el.dataset.id),
      yazdir: (el) => bekle(el, async () => { if (!R) return; try { await kasayaGonder(raporFisi(), 'Rapor'); } catch (err) { hata(err); } }),
      gunSonuAl: () => gunSonuAlPenceresi(),
      gunSonuFisi: (el) => bekle(el, async () => {
        donem = null; bas = son = bugun(); LS.yaz('ads_rapor_bas', bas); LS.yaz('ads_rapor_son', son);
        await yenile();
        if (R) { try { await kasayaGonder(raporFisi(), 'Gün sonu'); } catch (err) { hata(err); } }
      }),
      donemSec: (el) => {
        const id = el.dataset.id;
        donem = id === 'acik' ? acikDonem() : donemler().find((p) => String(p.id) === id) || null;
        if (donem) { bas = son = donem.etiket; }
        yenile();
      },
      excel: () => disariAktarPenceresi(bas, son, null, donem),
      garsonDetay: (el) => garsonDetayAc(el.dataset.g),
      ygOlcu: (el) => { yg.olcu = el.dataset.v; ciz(); },
      ygDakika: (el) => { yg.dakika = Number(el.dataset.v); ciz(); },
      aralik: (el) => {
        const d = new Date();
        donem = null;
        if (el.dataset.a === 'bugun') { bas = son = bugun(); if (manuelMod()) donem = acikDonem(); }
        else if (el.dataset.a === 'dun') { if (manuelMod() && sonKapaliDonem()) { donem = sonKapaliDonem(); bas = son = donem.etiket; } else bas = son = oncekiGun(bugun()); }
        else if (el.dataset.a === 'hafta') { son = bugun(); d.setDate(d.getDate() - 6); bas = gun(d); }
        else { son = bugun(); bas = gun(new Date(d.getFullYear(), d.getMonth(), 1)); }
        LS.yaz('ads_rapor_bas', bas); LS.yaz('ads_rapor_son', son); yenile();
      }
    }));
    yenile();
  }

  // ---------------------------------------------------------------
  // HAFTALIK KARŞILAŞTIRMA
  // Gece yarısını geçen satışlar aynı geceye sayılır (gün 05:00'te başlar).
  // ---------------------------------------------------------------
  // gün sınırı:
  //  otomatik → her gün ayarlardaki saatte (varsayılan 05:00) yeni gün başlar
  //  manuel   → iki "Gün Sonu" arası bir gündür; günün adı gün sonunun alındığı gecedir
  const gbs = () => (S.ayarlar && S.ayarlar.gun_basi_saat != null ? Number(S.ayarlar.gun_basi_saat) : 5);
  const manuelMod = () => !!(S.ayarlar && S.ayarlar.gun_sonu_modu === 'manuel');
  const tarihAnahtar = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function saatKurali(t) { return tarihAnahtar(new Date(new Date(t).getTime() - gbs() * 3600000)); }
  function gunSiniri(gun) { const d = new Date(gun + 'T00:00:00'); d.setHours(gbs()); return d; }
  function ertesiGun(gun) { const d = new Date(gun + 'T12:00:00'); d.setDate(d.getDate() + 1); return tarihAnahtar(d); }
  function acikGunBaslangic() {
    const son = S.gunler.length ? new Date(S.gunler[S.gunler.length - 1].bitis) : null;
    if (manuelMod()) {
      const m = S.ayarlar.manuel_baslangic ? new Date(S.ayarlar.manuel_baslangic) : null;
      return [son, m].filter(Boolean).sort((a, b) => b - a)[0] || gunSiniri(saatKurali(new Date()));
    }
    const sinir = gunSiniri(saatKurali(new Date()));
    return son && son > sinir ? son : sinir;
  }
  let _donemOnbellek = null;
  function donemler() {
    const anahtar = S.gunler.length + '|' + (S.gunler.length ? S.gunler[S.gunler.length - 1].bitis : '') + '|' + manuelMod() + '|' + gbs() + '|' + (S.ayarlar && S.ayarlar.manuel_baslangic);
    if (_donemOnbellek && _donemOnbellek.anahtar === anahtar && Date.now() - _donemOnbellek.zaman < 60000) return _donemOnbellek.liste;
    const liste = S.gunler.map((g) => ({ id: g.id, bas: +new Date(g.baslangic), bit: +new Date(g.bitis), etiket: saatKurali(new Date(+new Date(g.bitis) - 1)), kayit: g }));
    if (manuelMod()) liste.push({ id: 'acik', bas: +acikGunBaslangic(), bit: Date.now() + 864e5, etiket: saatKurali(new Date()), acik: true });
    _donemOnbellek = { anahtar, liste, zaman: Date.now() };
    return liste;
  }
  function isGunu(t) {
    const x = +new Date(t); const L = donemler();
    for (let i = L.length - 1; i >= 0; i--) if (x >= L[i].bas && x < L[i].bit) return L[i].etiket;
    return saatKurali(t);
  }
  // [bas, son] günlerini kapsayan geniş sorgu aralığı (sonra isGunu ile süzülür)
  function sorguAraligi(bas, son) {
    let b = +gunSiniri(bas); let e = +gunSiniri(ertesiGun(son));
    donemler().forEach((p) => { if (p.etiket >= bas && p.etiket <= son) { b = Math.min(b, p.bas); e = Math.max(e, Math.min(p.bit, Date.now() + 60000)); } });
    return { b: new Date(b), e: new Date(e) };
  }
  function oncekiGun(g) {
    if (manuelMod()) { const once = donemler().filter((p) => !p.acik && p.etiket < g).map((p) => p.etiket); if (once.length) return once[once.length - 1]; }
    const d = new Date(g + 'T12:00:00'); d.setDate(d.getDate() - 1); return tarihAnahtar(d);
  }
  const gunIcinde = (t, bas, son) => { const g = isGunu(t); return g >= bas && g <= son; };
  const acikDonem = () => donemler().find((p) => p.acik) || null;
  const sonKapaliDonem = () => { const L = donemler().filter((p) => !p.acik); return L.length ? L[L.length - 1] : null; };
  function donemYazi(d) {
    return d.acik ? 'Açık gün · ' + tarihSaat(d.bas) + '\'den beri' : 'Gün sonu · ' + tarihSaat(d.bas) + ' – ' + tarihSaat(d.bit);
  }
  // seçim: belirli bir gün sonu dönemi (manuel mod) ya da tarih aralığı
  function sorgu(bas, son, donem) {
    if (donem) {
      const bit = Math.min(donem.bit, Date.now() + 60000);
      return { b: new Date(donem.bas), e: new Date(bit), icinde: (t) => { const x = +new Date(t); return x >= donem.bas && x < donem.bit; } };
    }
    const r = sorguAraligi(bas, son); r.icinde = (t) => gunIcinde(t, bas, son); return r;
  }
  async function kasayaGonder(html, baslik) {
    await rpc('ads_fis_rapor', { p_html: html, p_baslik: baslik });
    bildir('🖨️ ' + baslik + ' fişi kasaya gönderildi', 'basari'); kanalGonder('fis');
  }
  const GUN_ADI = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
  const kisaTarih = (g) => { const [y, m, d] = g.split('-'); return d + '.' + m; };
  const gunAdi = (g) => GUN_ADI[new Date(g + 'T12:00:00').getDay()];

  // Supabase tek seferde en fazla 1000 satır verir; sayfa sayfa hepsini çeker
  async function hepsiniGetir(sorguKur) {
    const sonuc = []; const boy = 1000;
    for (let i = 0; i < 50; i++) {
      const parca = await q(sorguKur().range(i * boy, i * boy + boy - 1));
      sonuc.push(...parca);
      if (parca.length < boy) break;
    }
    return sonuc;
  }

  async function karsilastirmaSayfa() {
    let adet = LS.al('ads_kars_adet', 8);
    let D = null;
    let urunGoster = 'adet'; // adet | tutar
    let secA = null; let secB = null; // iki geceyi yan yana karşılaştır (A = önceki, B = sonraki)

    async function yukle() {
      const bas = new Date(); bas.setHours(gbs(), 0, 0, 0); bas.setDate(bas.getDate() - (adet * 7 + 7));
      const ilkDonem = donemler().find((p) => p.bit > +bas); if (ilkDonem && ilkDonem.bas < +bas) bas.setTime(ilkDonem.bas);
      const hesaplar = await hepsiniGetir(() => db.from('ads_adisyonlar')
        .select('id, kapanis, indirim_oran, ads_masalar(tur), ads_kalemler(ad, fiyat, adet, durum, garson_ad, kategori), ads_odemeler(tur, tutar)')
        .eq('durum', 'kapali').gte('kapanis', bas.toISOString()).order('kapanis'));
      const gunler = {};
      hesaplar.forEach((h) => {
        const g = isGunu(h.kapanis);
        const G = gunler[g] = gunler[g] || { gun: g, satis: 0, net: 0, tahsilat: 0, hesap: 0, adet: 0, paket: 0, ikram: 0, personel: 0, urun: {}, garson: {}, kat: {} };
        const t = hesapToplam(h);
        G.hesap++; G.satis += t.toplam; G.net += t.net; G.personel += t.indirim;
        if (h.ads_masalar && h.ads_masalar.tur === 'paket') G.paket++;
        h.ads_odemeler.forEach((o) => {
          if (o.tur === 'nakit' || o.tur === 'kart') G.tahsilat += Number(o.tutar); else G.ikram += Number(o.tutar);
        });
        h.ads_kalemler.filter((k) => k.durum === 'aktif').forEach((k) => {
          const tt = k.fiyat * k.adet; G.adet += k.adet;
          const u = G.urun[k.ad] = G.urun[k.ad] || { adet: 0, tutar: 0 }; u.adet += k.adet; u.tutar += tt;
          const kt = k.kategori || 'Diğer'; const kk = G.kat[kt] = G.kat[kt] || { adet: 0, tutar: 0 }; kk.adet += k.adet; kk.tutar += tt;
          const gg = k.garson_ad || '—'; const w = G.garson[gg] = G.garson[gg] || { adet: 0, tutar: 0 }; w.adet += k.adet; w.tutar += tt;
        });
      });
      const liste = Object.values(gunler).sort((a, b) => a.gun.localeCompare(b.gun)).slice(-adet);
      liste.forEach((G) => { ['satis', 'net', 'tahsilat', 'ikram', 'personel'].forEach((k) => { G[k] = sayi(G[k]); }); G.ort = G.hesap ? sayi(G.net / G.hesap) : 0; });
      let etiket = {};
      try { (await q(db.from('ads_gece_etiket').select('gun, etiket'))).forEach((r) => { etiket[r.gun] = r.etiket; }); } catch (e) { etiket = {}; }
      D = { liste, etiket };
      if (liste.length >= 2) {
        if (!secA || !liste.some((G) => G.gun === secA)) secA = liste[liste.length - 2].gun;
        if (!secB || !liste.some((G) => G.gun === secB)) secB = liste[liste.length - 1].gun;
      }
    }
    const geceAd = (G) => (D.etiket[G.gun] ? D.etiket[G.gun] + ' · ' : '') + kisaTarih(G.gun) + ' ' + gunAdi(G.gun).slice(0, 3);

    // iki geceyi yan yana: toplamlar, kategoriler, ürünler (tantuni günü ↔ balık günü gibi)
    function ikiliHtml() {
      const L = D.liste; if (L.length < 2) return '';
      const GA = L.find((G) => G.gun === secA) || L[L.length - 2]; const GB = L.find((G) => G.gun === secB) || L[L.length - 1];
      const opt = (sel) => L.slice().reverse().map((G) => '<option value="' + G.gun + '"' + (G.gun === sel ? ' selected' : '') + '>' + esc(geceAd(G)) + '</option>').join('');
      const satir = (ad, a, b, f) => '<tr><th>' + ad + '</th><td>' + f(a) + '</td><td>' + f(b) + '</td><td>' + (degisim(b, a) || (b && !a ? '<span class="degisim artis">yeni</span>' : '')) + '</td></tr>';
      const hucre = (v) => (urunGoster === 'adet' ? (v || 0) : (v ? para(v) : '—'));
      const fark = (alan, ust) => {
        const adlar = Array.from(new Set(Object.keys(GA[alan]).concat(Object.keys(GB[alan]))));
        const dv = (G, ad) => (G[alan][ad] || {})[urunGoster] || 0;
        adlar.sort((x, y) => Math.max(dv(GA, y), dv(GB, y)) - Math.max(dv(GA, x), dv(GB, x)));
        return adlar.slice(0, ust).map((ad) => {
          const a = dv(GA, ad), b = dv(GB, ad);
          return '<tr><th>' + esc(ad) + '</th><td>' + hucre(a) + '</td><td>' + hucre(b) + '</td><td>' + (a && b ? degisim(b, a) : (b ? '<span class="degisim artis">sadece B</span>' : '<span class="degisim azalis">sadece A</span>')) + '</td></tr>';
        }).join('');
      };
      const bas = '<thead><tr><th></th><th>A</th><th>B</th><th>B / A</th></tr></thead>';
      return '<div class="bolum-baslik">İki geceyi karşılaştır</div><div class="kart dolgulu ikili">' +
        '<div class="ikili-sec"><label>A (önceki)<select id="k-a">' + opt(GA.gun) + '</select></label><label>B (sonraki)<select id="k-b">' + opt(GB.gun) + '</select></label></div>' +
        '<div class="btn-satir" style="margin:8px 0 0"><button class="btn kucuk" data-e="etiketVer" data-g="' + GA.gun + '">✏️ A\'ya ad ver</button><button class="btn kucuk" data-e="etiketVer" data-g="' + GB.gun + '">✏️ B\'ye ad ver</button></div>' +
        '<div class="tablo-kap"><table class="matris">' + bas + '<tbody>' +
        satir('Satış (ödenecek)', GA.net, GB.net, para) + satir('Hesap sayısı', GA.hesap, GB.hesap, (v) => v) + satir('Ortalama hesap', GA.ort, GB.ort, para) +
        satir('Satılan ürün', GA.adet, GB.adet, (v) => v) + satir('Paket', GA.paket, GB.paket, (v) => v) + '</tbody></table></div>' +
        '<div class="btn-satir" style="margin:10px 0 0"><button class="btn kucuk' + (urunGoster === 'adet' ? ' koyu' : '') + '" data-e="goster" data-g="adet">Adet</button><button class="btn kucuk' + (urunGoster === 'tutar' ? ' koyu' : '') + '" data-e="goster" data-g="tutar">Tutar</button></div>' +
        '<div class="tablo-kap"><table class="matris">' + bas.replace('<th></th>', '<th>Kategori</th>') + '<tbody>' + fark('kat', 12) + '</tbody></table></div>' +
        '<div class="tablo-kap"><table class="matris">' + bas.replace('<th></th>', '<th>Ürün</th>') + '<tbody>' + fark('urun', 20) + '</tbody></table></div>' +
        '<p class="aciklama">Farklı menülü geceleri (balık ↔ tantuni) de karşılaştırır: sadece birinde satılan ürünler "sadece A / sadece B" diye işaretlenir. En çok satan 20 ürün gösterilir.</p></div>';
    }

    function degisim(simdi, once) {
      if (!once) return '';
      const y = Math.round((simdi - once) / once * 100);
      if (y === 0) return '<span class="degisim">±0%</span>';
      return '<span class="degisim ' + (y > 0 ? 'artis' : 'azalis') + '">' + (y > 0 ? '▲ ' : '▼ ') + Math.abs(y) + '%</span>';
    }

    function matris(baslik, alan, ust) {
      const L = D.liste;
      const toplam = {};
      L.forEach((G) => Object.entries(G[alan]).forEach(([ad, v]) => { toplam[ad] = (toplam[ad] || 0) + v[urunGoster]; }));
      const adlar = Object.keys(toplam).sort((a, b) => toplam[b] - toplam[a]).slice(0, ust);
      if (!adlar.length) return '';
      const hucre = (v) => urunGoster === 'adet' ? (v || 0) : (v ? para(v) : '—');
      return '<div class="bolum-baslik">' + baslik + '</div><div class="kart tablo-kap"><table class="matris"><thead><tr><th></th>' +
        L.map((G) => '<th>' + kisaTarih(G.gun) + '</th>').join('') + '<th>Değişim</th></tr></thead><tbody>' +
        adlar.map((ad) => {
          const deger = L.map((G) => (G[alan][ad] || {})[urunGoster] || 0);
          const enCok = Math.max(...deger);
          const son = deger[deger.length - 1]; const once = deger.length > 1 ? deger[deger.length - 2] : 0;
          return '<tr><th>' + esc(ad) + '</th>' + deger.map((v) => '<td' + (v && v === enCok && L.length > 1 ? ' class="en"' : '') + '>' + hucre(v) + '</td>').join('') +
            '<td>' + (L.length > 1 ? degisim(son, once) || (son && !once ? '<span class="degisim artis">yeni</span>' : '') : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    function ciz() {
      const ust = ustBar('Haftalık Karşılaştırma', 'Etkinlik geceleri yan yana', geriBtn('/rapor'), '<button class="ust-btn" data-e="menu">☰</button>');
      const secim = '<div class="btn-satir" style="margin-bottom:12px">' + [4, 8, 12, 26].map((n) =>
        '<button class="btn kucuk' + (n === adet ? ' koyu' : '') + '" data-e="adet" data-n="' + n + '">Son ' + n + '</button>').join('') +
        '<button class="btn kucuk ana" data-e="excel">📊 Excel</button></div>';
      if (!D) { $app.innerHTML = ust + '<main class="icerik">' + secim + '<div class="bos">Yükleniyor…</div></main>'; return; }
      const L = D.liste;
      if (!L.length) { $app.innerHTML = ust + '<main class="icerik">' + secim + '<div class="bos">Bu aralıkta kapanmış hesap yok. Etkinlikler oldukça burada yan yana görünecek.</div></main>'; return; }
      const son = L[L.length - 1]; const once = L.length > 1 ? L[L.length - 2] : null;
      const enIyi = L.reduce((a, b) => (b.net > a.net ? b : a));
      const ort = sayi(L.reduce((t, G) => t + G.net, 0) / L.length);
      const maks = Math.max(...L.map((G) => G.net)) || 1;

      $app.innerHTML = ust + '<main class="icerik">' + secim +
        '<div class="istatistik">' +
        '<div class="kutu"><span>Son etkinlik · ' + kisaTarih(son.gun) + '</span><b>' + para(son.net) + '</b>' + (once ? degisim(son.net, once.net) + ' <span class="kucuk aciklama" style="display:inline">önceki geceye göre</span>' : '') + '</div>' +
        '<div class="kutu"><span>Ortalama gece</span><b>' + para(ort) + '</b>' + (L.length > 1 ? degisim(son.net, ort) + ' <span class="kucuk aciklama" style="display:inline">son gece ortalamaya göre</span>' : '') + '</div>' +
        '<div class="kutu"><span>En iyi gece</span><b>' + para(enIyi.net) + '</b><span class="kucuk aciklama" style="display:block">' + kisaTarih(enIyi.gun) + ' ' + gunAdi(enIyi.gun) + '</span></div>' +
        '<div class="kutu"><span>Toplam (' + L.length + ' gece)</span><b>' + para(L.reduce((t, G) => t + G.net, 0)) + '</b></div>' +
        '</div>' +
        '<div class="bolum-baslik">Gece gece satış</div><div class="kart dolgulu"><div class="cubuklar">' +
        L.map((G, i) => '<div class="cubuk-satir' + (G === son ? ' son' : '') + '"><div class="cubuk-etiket" data-e="etiketVer" data-g="' + G.gun + '" title="Geceye ad ver"><b>' + kisaTarih(G.gun) + '</b><span>' + (D.etiket[G.gun] ? esc(D.etiket[G.gun]) : gunAdi(G.gun).slice(0, 3)) + '</span></div>' +
          '<div class="cubuk-yol"><div class="cubuk" style="width:' + Math.max(2, G.net / maks * 100).toFixed(1) + '%"></div></div>' +
          '<div class="cubuk-deger">' + para(G.net) + (i > 0 ? '<br>' + degisim(G.net, L[i - 1].net) : '') + '</div></div>').join('') +
        '</div></div>' +
        ikiliHtml() +
        '<div class="bolum-baslik">Gecelerin özeti</div><div class="kart tablo-kap"><table class="matris"><thead><tr><th></th>' +
        L.map((G) => '<th>' + kisaTarih(G.gun) + '<br><span style="font-weight:500">' + (D.etiket[G.gun] ? esc(D.etiket[G.gun]) : gunAdi(G.gun).slice(0, 3)) + '</span></th>').join('') + '</tr></thead><tbody>' +
        [['Satış (ödenecek)', 'net', para], ['Tahsilat (nakit+kart)', 'tahsilat', para], ['Hesap sayısı', 'hesap', (v) => v], ['Ortalama hesap', 'ort', para],
          ['Satılan ürün', 'adet', (v) => v], ['Paket', 'paket', (v) => v], ['İkram / indirim', 'ikram', para], ['Personel indirimi', 'personel', para]].map(([ad, k, f]) => {
          const enCok = Math.max(...L.map((G) => G[k]));
          return '<tr><th>' + ad + '</th>' + L.map((G) => '<td' + (G[k] && G[k] === enCok && L.length > 1 && k !== 'ikram' && k !== 'personel' ? ' class="en"' : '') + '>' + f(G[k]) + '</td>').join('') + '</tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="btn-satir" style="margin:18px 0 0"><button class="btn kucuk' + (urunGoster === 'adet' ? ' koyu' : '') + '" data-e="goster" data-g="adet">Adet</button>' +
        '<button class="btn kucuk' + (urunGoster === 'tutar' ? ' koyu' : '') + '" data-e="goster" data-g="tutar">Tutar</button></div>' +
        matris('Ürünler (en çok satan 20)', 'urun', 20) +
        matris('Garsonlar', 'garson', 30) +
        '<p class="aciklama">Yeşil hücre: o satırın en iyi gecesi. Değişim: son gece bir öncekine göre. Gece yarısından sonra kapanan hesaplar o geceye sayılır (gün 05:00\'te başlar).</p>' +
        '</main>';
    }

    async function excelIndir() {
      const ExcelJS = await exceljsYukle();
      const L = D.liste; const wb = new ExcelJS.Workbook();
      const alt = ((S.ayarlar && S.ayarlar.isletme_adi) || 'Yavuztürk Süleymaniye') + ' · son ' + L.length + ' gece · hazırlanma ' + tarihSaat(new Date());
      const bas = L.map((G) => geceAd(G));
      const geceKol = [{ ad: 'Kalem', genislik: 26 }].concat(bas.map((b) => ({ ad: b, genislik: 13, tip: 'sayi' })));
      const ws1 = bicimliSayfa(wb, 'Geceler', 'Gece gece karşılaştırma', alt, geceKol,
        [['Net satış (₺)', 'net'], ['Satış indirimsiz (₺)', 'satis'], ['Tahsilat nakit+kart (₺)', 'tahsilat'], ['Hesap sayısı', 'hesap'], ['Ortalama hesap (₺)', 'ort'],
          ['Satılan ürün', 'adet'], ['Paket', 'paket'], ['İkram / indirim (₺)', 'ikram'], ['Personel indirimi (₺)', 'personel']].map(([ad, k]) => [ad].concat(L.map((G) => G[k]))),
        { vurgu: (r, s2) => { const p2 = /₺/.test(s2[0]); r.eachCell((c, i) => { if (i > 1) c.numFmt = p2 ? XL.para : XL.adet; }); } });
      ws1.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];
      const tablo = (alan, deger) => {
        const toplam = {}; L.forEach((G) => Object.entries(G[alan]).forEach(([a2, v]) => { toplam[a2] = (toplam[a2] || 0) + v[deger]; }));
        return Object.keys(toplam).sort((a2, b2) => toplam[b2] - toplam[a2]).map((a2) => [a2].concat(L.map((G) => sayi((G[alan][a2] || {})[deger] || 0))).concat([sayi(toplam[a2])]));
      };
      [['Ürün adet', 'Ürün satışları (adet)', 'urun', 'adet', XL.adet], ['Ürün tutar', 'Ürün satışları (₺)', 'urun', 'tutar', XL.para], ['Garsonlar', 'Garson satışları (₺)', 'garson', 'tutar', XL.para]].forEach(([ad, baslik, alan, deger, fmt]) => {
        const ws = bicimliSayfa(wb, ad, baslik, alt, [{ ad: alan === 'urun' ? 'Ürün' : 'Garson', genislik: 24 }].concat(bas.map((b) => ({ ad: b, genislik: 12 })), [{ ad: 'TOPLAM', genislik: 13 }]), tablo(alan, deger), { renk: XL.yesil });
        for (let i = 2; i <= L.length + 2; i++) ws.getColumn(i).numFmt = fmt;
        ws.getColumn(L.length + 2).font = { bold: true };
        ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];
      });
      await excelKaydet(wb, 'Haftalik-Karsilastirma-' + L[0].gun + '_' + L[L.length - 1].gun + '.xlsx');
    }

    $app.onchange = (e) => {
      const el = e.target;
      if (el && el.id === 'k-a') { secA = el.value; ciz(); } else if (el && el.id === 'k-b') { secB = el.value; ciz(); }
    };
    eylemBagla(Object.assign({}, ortakEylemler, {
      adet: async (el) => { adet = Number(el.dataset.n); LS.yaz('ads_kars_adet', adet); D = null; ciz(); try { await yukle(); ciz(); } catch (e) { hata(e); } },
      goster: (el) => { urunGoster = el.dataset.g; ciz(); },
      etiketVer: (el) => {
        const gun = el.dataset.g;
        pencere('<button class="kapat-x" data-e="kapat">×</button><h2>✏️ ' + esc(kisaTarih(gun) + ' ' + gunAdi(gun)) + ' gecesine ad ver</h2>' +
          '<p class="aciklama" style="margin-top:0">Karşılaştırmada tarihin yanında görünür. Örn. "Balık günü", "Tantuni günü".</p>' +
          '<form><input id="ge-ad" maxlength="40" value="' + esc(D.etiket[gun] || '') + '" placeholder="Örn. Tantuni günü">' +
          '<div class="eylemler"><button type="button" class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" type="submit">Kaydet</button></div></form>', {
          gonder: async (form, e, p, kapat) => {
            const ad = p.querySelector('#ge-ad').value.trim();
            try {
              if (ad) await q(db.from('ads_gece_etiket').upsert({ gun, etiket: ad })); else await q(db.from('ads_gece_etiket').delete().eq('gun', gun));
              if (ad) D.etiket[gun] = ad; else delete D.etiket[gun];
              kapat(); bildir(ad ? 'Gece adlandırıldı' : 'Ad kaldırıldı', 'basari'); ciz();
            } catch (err) { hata(err); }
          }
        }, (p) => p.querySelector('#ge-ad').focus());
      },
      excel: (el) => bekle(el, async () => { if (!D || !D.liste.length) return bildir('Karşılaştırılacak gece yok.'); try { await excelIndir(); } catch (e) { hata(e); } })
    }));
    ciz();
    try { await raporHazirla(); await yukle(); ciz(); } catch (e) { hata(e); }
  }

  // ---------------------------------------------------------------
  // HAREKET KAYDI: ortak tanımlar
  // ---------------------------------------------------------------
  const HAREKET = {
    giris: { ad: 'Giriş yaptı', ikon: '🔑', grup: 'diger' },
    hesap_acildi: { ad: 'Hesap açıldı', ikon: '🟢', grup: 'hesap' },
    siparis: { ad: 'Sipariş', ikon: '🧾', grup: 'siparis' },
    iptal: { ad: 'İptal', ikon: '✖', grup: 'iptal' },
    odeme: { ad: 'Ödeme', ikon: '💳', grup: 'odeme' },
    odeme_silindi: { ad: 'Ödeme silindi', ikon: '↩', grup: 'odeme' },
    odeme_duzeltme: { ad: 'Ödeme düzeltme', ikon: '↩', grup: 'odeme' },
    ara_hesap: { ad: 'Ara hesap fişi', ikon: '🧾', grup: 'hesap' },
    hesap_kapandi: { ad: 'Hesap kapandı', ikon: '✅', grup: 'hesap' },
    hesap_iptal: { ad: 'Hesap iptal', ikon: '⛔', grup: 'iptal' },
    hesap_geri_acildi: { ad: 'Hesap geri açıldı', ikon: '↺', grup: 'hesap' },
    masa_tasindi: { ad: 'Masa taşındı', ikon: '⇄', grup: 'hesap' },
    personel_indirimi: { ad: 'Personel indirimi', ikon: '👤', grup: 'hesap' },
    paket_acildi: { ad: 'Paket açıldı', ikon: '📦', grup: 'hesap' },
    paket_silindi: { ad: 'Paket silindi', ikon: '📦', grup: 'hesap' },
    gun_sonu: { ad: 'Gün sonu alındı', ikon: '🔒', grup: 'diger' },
    yedek: { ad: 'Yedek alındı', ikon: '☁', grup: 'diger' }
  };
  const GRUPLAR = [['siparis', 'Sipariş'], ['iptal', 'İptal'], ['odeme', 'Ödeme'], ['hesap', 'Hesap işlemleri'], ['diger', 'Giriş / gün sonu']];
  const hTur = (h) => HAREKET[h.tur] || { ad: h.tur, ikon: '•', grup: 'diger' };
  const saatSn = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ikiHane = (n) => String(n).padStart(2, '0');
  const saatDilimi = (t) => { const d = new Date(t); return ikiHane(d.getHours()) + ':00–' + ikiHane((d.getHours() + 1) % 24) + ':00'; };
  const trGun = (g) => g.split('-').reverse().join('.');

  // pivot / analiz boyutları
  const BOYUT = {
    garson: { ad: 'Garson (siparişi giren)', f: (h) => (h.tur === 'iptal' ? h.siparisi_giren : null) || h.garson_ad || '—' },
    yapan: { ad: 'İşlemi yapan', f: (h) => h.garson_ad || '—' },
    urun: { ad: 'Ürün', f: (h) => h.urun_ad || '—' },
    kategori: { ad: 'Kategori', f: (h) => h.kategori || '—' },
    bolum: { ad: 'Bölüm', f: (h) => h.bolum || (h.masa_tur === 'paket' ? 'Paket' : (h.masa_ad ? 'Bölümsüz' : '—')) },
    masa: { ad: 'Masa', f: (h) => h.masa_ad || '—' },
    saat: { ad: 'Saat', f: (h) => saatDilimi(h.zaman), sirali: true, anahtar: (h) => ikiHane((new Date(h.zaman).getHours() + 24 - gbs()) % 24) },
    gun: { ad: 'Gün', f: (h) => trGun(isGunu(h.zaman)), sirali: true, anahtar: (h) => isGunu(h.zaman) },
    tur: { ad: 'Hareket türü', f: (h) => hTur(h).ad },
    odeme: { ad: 'Ödeme türü', f: (h) => (h.odeme_tur ? (ODEME_TUR[h.odeme_tur] || h.odeme_tur) : '—') }
  };
  const SATIS = (h) => h.tur === 'siparis' || h.tur === 'iptal';
  const DEGER = {
    net_tutar: { ad: 'Net satış (₺)', para: true, f: (h) => (SATIS(h) ? Number(h.tutar) || 0 : 0) },
    net_adet: { ad: 'Net adet', f: (h) => (SATIS(h) ? Number(h.adet) || 0 : 0) },
    siparis_adet: { ad: 'Sipariş edilen adet', f: (h) => (h.tur === 'siparis' ? Number(h.adet) || 0 : 0) },
    iptal_adet: { ad: 'İptal edilen adet', f: (h) => (h.tur === 'iptal' ? -Number(h.adet) || 0 : 0) },
    iptal_tutar: { ad: 'İptal tutarı (₺)', para: true, f: (h) => (h.tur === 'iptal' ? -Number(h.tutar) || 0 : 0) },
    tahsilat: { ad: 'Tahsilat nakit+kart (₺)', para: true, f: (h) => (/^odeme/.test(h.tur) && (h.odeme_tur === 'nakit' || h.odeme_tur === 'kart') ? Number(h.tutar) || 0 : 0) },
    hareket: { ad: 'Hareket sayısı', f: () => 1 }
  };

  function hareketMetni(h) {
    const masa = h.masa_ad ? h.masa_ad + (h.bolum ? ' (' + h.bolum + ')' : '') : '';
    const ad = Math.abs(Number(h.adet) || 0);
    switch (h.tur) {
      case 'siparis': return { ana: ad + ' × ' + h.urun_ad, alt: [h.garson_ad, masa, h.siparis_no ? '#' + h.siparis_no : ''].filter(Boolean).join(' · '), tutar: h.tutar };
      case 'iptal': return { ana: ad + ' × ' + h.urun_ad + ' iptal', alt: [h.garson_ad + ' iptal etti', masa, h.siparisi_giren ? 'giren: ' + h.siparisi_giren + (h.siparis_zaman ? ' ' + saat(h.siparis_zaman) : '') : ''].filter(Boolean).join(' · '), tutar: h.tutar };
      case 'odeme': case 'odeme_silindi': case 'odeme_duzeltme':
        return { ana: hTur(h).ad + ' · ' + (ODEME_TUR[h.odeme_tur] || h.odeme_tur || ''), alt: [h.garson_ad, masa].filter(Boolean).join(' · '), tutar: h.tutar };
      case 'giris': return { ana: h.garson_ad + ' giriş yaptı', alt: '' };
      default: return { ana: hTur(h).ad, alt: [h.garson_ad, masa].filter(Boolean).join(' · '), tutar: h.tutar };
    }
  }

  async function hareketleriGetir(bas, son, donem) {
    const Q = sorgu(bas, son, donem); const { b, e } = Q;
    let [hareketler, adisyonlar] = await Promise.all([
      hepsiniGetir(() => db.from('ads_hareketler').select('*').gte('zaman', b.toISOString()).lt('zaman', e.toISOString()).order('zaman').order('id')),
      hepsiniGetir(() => { const b2 = new Date(b); b2.setDate(b2.getDate() - 2); return db.from('ads_adisyonlar').select('id, durum, indirim_oran, acilis, kapanis').gte('acilis', b2.toISOString()).order('acilis'); })
    ]);
    hareketler = hareketler.filter((h) => Q.icinde(h.zaman));
    const hesap = {}; adisyonlar.forEach((a) => { hesap[a.id] = a; });
    return { hareketler, hesap, bas, son, donem: donem || null };
  }

  // basit çapraz tablo hesabı
  function pivotHesapla(liste, satirB, sutunB, degerK) {
    const SB = BOYUT[satirB]; const CB = sutunB ? BOYUT[sutunB] : null; const D = DEGER[degerK];
    const hucre = {}; const satirT = {}; const sutunT = {}; let genel = 0;
    const satirAnahtar = {}; const sutunAnahtar = {};
    liste.forEach((h) => {
      const v = D.f(h); if (!v) return;
      const r = SB.f(h); const c = CB ? CB.f(h) : 'Toplam';
      satirAnahtar[r] = SB.anahtar ? SB.anahtar(h) : r; if (CB) sutunAnahtar[c] = CB.anahtar ? CB.anahtar(h) : c;
      hucre[r + '\u0000' + c] = (hucre[r + '\u0000' + c] || 0) + v;
      satirT[r] = (satirT[r] || 0) + v; sutunT[c] = (sutunT[c] || 0) + v; genel += v;
    });
    const sirala = (obj, B, anahtar) => Object.keys(obj).sort(B && B.sirali ? (a, b) => String(anahtar[a]).localeCompare(String(anahtar[b])) : (a, b) => obj[b] - obj[a]);
    const satirlar = sirala(satirT, SB, satirAnahtar);
    const sutunlar = CB ? sirala(sutunT, CB, sutunAnahtar) : [];
    return { satirlar, sutunlar, hucre, satirT, sutunT, genel, D, SB, CB };
  }

  // ---------------------------------------------------------------
  // DETAYLI DÖKÜM SAYFASI
  // ---------------------------------------------------------------
  async function dokumSayfa() {
    $app.innerHTML = ustBar('Detaylı Döküm', '', geriBtn('/rapor')) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { await raporHazirla(); } catch (e) { hata(e); }
    const bugun = () => isGunu(new Date());
    let bas = LS.al('ads_rapor_bas', null) || bugun(); let son = LS.al('ads_rapor_son', null) || bas;
    if (LS.al('ads_rapor_gun', '') !== bugun()) { bas = son = bugun(); }
    let V = null;
    let donem = manuelMod() && bas === bugun() && son === bas ? acikDonem() : null;
    let sekme = LS.al('ads_dokum_sekme', 'liste');
    const F = { gruplar: new Set(['siparis', 'iptal', 'odeme', 'hesap']), garson: '', bolum: '', masa: '', urun: '', ara: '', adisyon: '' };
    let goster = 200;
    let acik = null;
    const P = LS.al('ads_pivot', { satir: 'garson', sutun: 'urun', deger: 'net_adet' });

    function filtrele() {
      if (!V) return [];
      const ara = F.ara.trim().toLocaleLowerCase('tr');
      return V.hareketler.filter((h) => {
        if (F.adisyon) return h.adisyon_id === F.adisyon;
        if (!F.gruplar.has(hTur(h).grup)) return false;
        if (F.garson && h.garson_ad !== F.garson && h.siparisi_giren !== F.garson) return false;
        if (F.bolum && BOYUT.bolum.f(h) !== F.bolum) return false;
        if (F.masa && h.masa_ad !== F.masa) return false;
        if (F.urun && h.urun_ad !== F.urun) return false;
        if (ara && ![h.urun_ad, h.garson_ad, h.masa_ad, h.aciklama, h.siparisi_giren, h.bolum, hTur(h).ad, h.siparis_no && '#' + h.siparis_no].join(' ').toLocaleLowerCase('tr').includes(ara)) return false;
        return true;
      });
    }
    const benzersiz = (f) => Array.from(new Set(V.hareketler.map(f).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr'));

    function tarihKart() {
      return '<div class="kart dolgulu"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">' +
        '<div style="flex:1;min-width:130px"><label style="margin-top:0">Başlangıç</label><input type="date" id="d-b" value="' + bas + '"></div>' +
        '<div style="flex:1;min-width:130px"><label style="margin-top:0">Bitiş</label><input type="date" id="d-s" value="' + son + '"></div></div>' +
        '<div class="btn-satir" style="margin-top:10px"><button class="btn kucuk" data-e="aralik" data-a="bugun">Bugün</button><button class="btn kucuk" data-e="aralik" data-a="dun">Dün</button>' +
        '<button class="btn kucuk" data-e="aralik" data-a="hafta">Son 7 gün</button><button class="btn kucuk" data-e="aralik" data-a="ay">Bu ay</button>' +
        '<button class="btn kucuk ana" data-e="disari">📥 Excel / CSV</button></div></div>';
    }

    function filtreHtml() {
      const sec = (id, bos, liste, deger) => '<select data-f="' + id + '"><option value="">' + bos + '</option>' + liste.map((x) => '<option' + (x === deger ? ' selected' : '') + '>' + esc(x) + '</option>').join('') + '</select>';
      return '<div class="kart dolgulu filtreler">' +
        '<div class="cipler">' + GRUPLAR.map(([k, a]) => '<button class="cip' + (F.gruplar.has(k) ? ' aktif' : '') + '" data-e="grup" data-g="' + k + '">' + a + '</button>').join('') + '</div>' +
        '<div class="filtre-izgara">' +
        sec('garson', 'Bütün garsonlar', benzersiz((h) => h.garson_ad).concat(benzersiz((h) => h.siparisi_giren)).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a.localeCompare(b, 'tr')), F.garson) +
        sec('bolum', 'Bütün bölümler', benzersiz((h) => (h.masa_ad ? BOYUT.bolum.f(h) : null)), F.bolum) +
        sec('masa', 'Bütün masalar', benzersiz((h) => h.masa_ad), F.masa) +
        sec('urun', 'Bütün ürünler', benzersiz((h) => h.urun_ad), F.urun) +
        '</div><input type="search" id="d-ara" placeholder="Ara: ürün, garson, masa, iptal nedeni, sipariş no…" value="' + esc(F.ara) + '" style="margin-top:8px">' +
        (F.adisyon ? '<div class="filtre-hesap">Tek hesap gösteriliyor <button class="btn kucuk" data-e="hesapTemizle">× Bütün hareketlere dön</button></div>' : '') +
        '</div>';
    }

    function ozet(liste) {
      let netAdet = 0; let net = 0; let ipAdet = 0; let ipTutar = 0; let tahsil = 0;
      liste.forEach((h) => { netAdet += DEGER.net_adet.f(h); net += DEGER.net_tutar.f(h); ipAdet += DEGER.iptal_adet.f(h); ipTutar += DEGER.iptal_tutar.f(h); tahsil += DEGER.tahsilat.f(h); });
      return '<div class="ozet-serit">' +
        '<div class="parca">Hareket<b>' + liste.length + '</b></div>' +
        '<div class="parca">Net adet<b>' + netAdet + '</b></div>' +
        '<div class="parca">Net satış<b>' + para(net) + '</b></div>' +
        '<div class="parca">İptal<b>' + ipAdet + ' · ' + para(ipTutar) + '</b></div>' +
        '<div class="parca">Tahsilat<b>' + para(tahsil) + '</b></div></div>';
    }

    function listeHtml(liste) {
      if (!liste.length) return '<div class="bos">Bu filtrelere uyan hareket yok.</div>';
      const tersi = liste.slice().reverse();
      let sonGun = ''; let sonSaat = '';
      const satirlar = tersi.slice(0, goster).map((h) => {
        const T = hTur(h); const M = hareketMetni(h);
        const g = isGunu(h.zaman); const s = saatDilimi(h.zaman);
        let ust = '';
        if (g !== sonGun && V.bas !== V.son) { ust += '<div class="dokum-gun">' + trGun(g) + ' ' + gunAdi(g) + '</div>'; sonGun = g; sonSaat = ''; }
        if (s !== sonSaat) { ust += '<div class="dokum-saat">' + s + '</div>'; sonSaat = s; }
        const tutar = M.tutar != null && M.tutar !== '' ? Number(M.tutar) : null;
        return ust + '<div class="dokum-satir g-' + T.grup + (acik === h.id ? ' acik' : '') + '" data-e="ac" data-id="' + h.id + '">' +
          '<div class="dokum-zaman">' + saatSn(h.zaman) + '</div><div class="dokum-ikon">' + T.ikon + '</div>' +
          '<div class="sol"><div class="ad">' + esc(M.ana) + '</div><div class="kucuk">' + esc(M.alt) + '</div>' +
          (h.aciklama ? '<div class="not">' + esc(h.aciklama) + '</div>' : '') +
          (acik === h.id ? detayHtml(h) : '') + '</div>' +
          (tutar != null && !isNaN(tutar) ? '<div class="sag' + (tutar < 0 ? ' eksi' : '') + '">' + (tutar < 0 ? '−' : '') + para(Math.abs(tutar)) + '</div>' : '') + '</div>';
      }).join('');
      return '<div class="kart dokum">' + satirlar + '</div>' +
        (tersi.length > goster ? '<button class="btn tam" data-e="dahaFazla">Daha fazla göster (' + (tersi.length - goster) + ' hareket daha)</button>' : '');
    }

    function detayHtml(h) {
      const a = h.adisyon_id && V.hesap[h.adisyon_id];
      const alanlar = [
        ['Zaman', tarihSaat(h.zaman) + ':' + ikiHane(new Date(h.zaman).getSeconds())], ['Tür', hTur(h).ad], ['İşlemi yapan', h.garson_ad],
        ['Masa', h.masa_ad], ['Bölüm', h.bolum || (h.masa_tur === 'paket' ? 'Paket' : '')], ['Sipariş no', h.siparis_no ? '#' + h.siparis_no : ''],
        ['Ürün', h.urun_ad], ['Kategori', h.kategori], ['Adet', h.adet], ['Birim fiyat', h.birim_fiyat != null ? para(h.birim_fiyat) : ''],
        ['Tutar', h.tutar != null ? para(h.tutar) : ''], ['Ödeme türü', h.odeme_tur ? ODEME_TUR[h.odeme_tur] || h.odeme_tur : ''],
        ['Siparişi giren', h.siparisi_giren], ['Sipariş zamanı', h.siparis_zaman ? tarihSaat(h.siparis_zaman) : ''],
        ['Siparişten iptale', h.siparis_zaman ? Math.max(0, Math.round((new Date(h.zaman) - new Date(h.siparis_zaman)) / 60000)) + ' dk' : ''],
        ['Açıklama', h.aciklama], ['Hesap durumu', a ? ({ acik: 'Açık', kapali: 'Kapandı', iptal: 'İptal', birlesti: 'Birleşti' }[a.durum] || a.durum) + (a.indirim_oran ? ' · personel %' + a.indirim_oran : '') : '']
      ].filter(([, v]) => v !== null && v !== undefined && v !== '');
      return '<div class="dokum-detay">' + alanlar.map(([k, v]) => '<div><span>' + k + '</span><b>' + esc(v) + '</b></div>').join('') +
        (h.adisyon_id && !F.adisyon ? '<button class="btn kucuk" data-e="hesapGoster" data-id="' + h.adisyon_id + '">Bu hesabın bütün hareketleri</button>' : '') + '</div>';
    }

    function pivotHtml(liste) {
      const sec = (k, liste2, deger, bosEtiket) => '<select data-p="' + k + '">' + (bosEtiket ? '<option value="">' + bosEtiket + '</option>' : '') +
        liste2.map(([v, a]) => '<option value="' + v + '"' + (v === deger ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>';
      const boyutlar = Object.entries(BOYUT).map(([k, b]) => [k, b.ad]);
      const R = pivotHesapla(liste, P.satir, P.sutun, P.deger);
      const fmt = (v) => (R.D.para ? para(v) : (Math.round(v * 100) / 100).toLocaleString('tr-TR'));
      const maks = Math.max(1, ...Object.values(R.hucre).map(Math.abs));
      const sut = R.CB ? R.sutunlar.slice(0, 40) : [];
      const tablo = !R.satirlar.length ? '<div class="bos">Seçilen değer için veri yok.</div>' :
        '<div class="kart tablo-kap"><table class="matris pivot"><thead><tr><th>' + esc(R.SB.ad) + (R.CB ? ' ↓ / ' + esc(R.CB.ad) + ' →' : '') + '</th>' +
        sut.map((c) => '<th>' + esc(c) + '</th>').join('') + '<th>Toplam</th></tr></thead><tbody>' +
        R.satirlar.map((r) => '<tr><th>' + esc(r) + '</th>' + sut.map((c) => {
          const v = R.hucre[r + '\u0000' + c] || 0;
          return '<td style="background:' + (v ? 'rgba(40,114,79,' + (0.08 + 0.42 * Math.abs(v) / maks).toFixed(2) + ')' : 'transparent') + '">' + (v ? fmt(v) : '') + '</td>';
        }).join('') + '<td class="toplam">' + fmt(R.satirT[r]) + '</td></tr>').join('') +
        '</tbody><tfoot><tr><th>Toplam</th>' + sut.map((c) => '<td>' + fmt(R.sutunT[c]) + '</td>').join('') + '<td class="toplam">' + fmt(R.genel) + '</td></tr></tfoot></table></div>';
      return '<div class="kart dolgulu"><div class="filtre-izgara">' +
        '<div><label style="margin-top:0">Satırlar</label>' + sec('satir', boyutlar, P.satir) + '</div>' +
        '<div><label style="margin-top:0">Sütunlar</label>' + sec('sutun', boyutlar, P.sutun, '— yok —') + '</div>' +
        '<div><label style="margin-top:0">Değer</label>' + sec('deger', Object.entries(DEGER).map(([k, d]) => [k, d.ad]), P.deger) + '</div>' +
        '<div style="align-self:end"><button class="btn tam kucuk" data-e="pivotExcel">📊 Bu tabloyu Excel\'e</button></div></div>' +
        '<div class="btn-satir" style="margin-top:10px">' + [['garson', 'urun', 'net_adet', 'Garson × Ürün'], ['saat', 'urun', 'net_adet', 'Saat × Ürün'], ['bolum', 'garson', 'net_tutar', 'Bölüm × Garson'],
          ['urun', '', 'iptal_adet', 'İptaller'], ['yapan', 'tur', 'hareket', 'Kim ne yaptı'], ['saat', '', 'net_tutar', 'Saatlik satış']].map(([a, b, c, ad]) =>
          '<button class="btn kucuk" style="flex:none" data-e="hazir" data-a="' + a + '" data-b="' + b + '" data-c="' + c + '">' + ad + '</button>').join('') + '</div>' +
        '<p class="aciklama">Üstteki filtreler (tür, garson, bölüm, masa, ürün, arama) bu tabloya da uygulanır. İptal satırlarında "Garson (siparişi giren)" siparişi giren kişidir, net satış böylece doğru çıkar.</p></div>' + tablo;
    }

    function ciz() {
      const ust = ustBar('Detaylı Döküm', V ? (V.donem ? donemYazi(V.donem) : V.bas === V.son ? trGun(V.bas) + ' ' + gunAdi(V.bas) : trGun(V.bas) + ' – ' + trGun(V.son)) : '', geriBtn('/rapor'), '<button class="ust-btn" data-e="menu">☰</button>');
      if (!V) { $app.innerHTML = ust + '<main class="icerik">' + tarihKart() + '<div class="bos">Yükleniyor…</div></main>'; baglaTarih(); return; }
      const liste = filtrele();
      const y = window.scrollY; const odak = document.activeElement && document.activeElement.id;
      $app.innerHTML = ust + '<main class="icerik">' + tarihKart() + filtreHtml() +
        '<div class="sekmeler"><button class="sekme' + (sekme === 'liste' ? ' aktif' : '') + '" data-e="sekme" data-s="liste">🕑 Hareketler</button>' +
        '<button class="sekme' + (sekme === 'pivot' ? ' aktif' : '') + '" data-e="sekme" data-s="pivot">▦ Çapraz tablo</button></div>' +
        ozet(liste) + (sekme === 'liste' ? listeHtml(liste) : pivotHtml(liste)) + '</main>';
      window.scrollTo(0, y);
      baglaTarih();
      const ara = document.getElementById('d-ara');
      if (ara) {
        let z = null;
        ara.oninput = () => { clearTimeout(z); z = setTimeout(() => { F.ara = ara.value; goster = 200; ciz(); const a2 = document.getElementById('d-ara'); a2.focus(); a2.setSelectionRange(a2.value.length, a2.value.length); }, 250); };
        if (odak === 'd-ara') ara.focus();
      }
    }

    function baglaTarih() {
      const bi = document.getElementById('d-b'); const si = document.getElementById('d-s');
      const degisti = () => { bas = bi.value || bugun(); son = si.value || bas; if (son < bas) { const x = bas; bas = son; son = x; } donem = null; LS.yaz('ads_rapor_bas', bas); LS.yaz('ads_rapor_son', son); yenile(); };
      if (bi) bi.onchange = degisti; if (si) si.onchange = degisti;
    }
    async function yenile() { V = null; acik = null; goster = 200; ciz(); try { V = await hareketleriGetir(bas, son, donem); ciz(); } catch (e) { hata(e); } }

    $app.onchange = (e) => {
      const t = e.target;
      if (t.dataset.f !== undefined) { F[t.dataset.f] = t.value; goster = 200; ciz(); }
      if (t.dataset.p !== undefined) { P[t.dataset.p] = t.value; LS.yaz('ads_pivot', P); ciz(); }
    };
    eylemBagla(Object.assign({}, ortakEylemler, {
      sekme: (el) => { sekme = el.dataset.s; LS.yaz('ads_dokum_sekme', sekme); ciz(); },
      grup: (el) => { const g = el.dataset.g; if (F.gruplar.has(g)) F.gruplar.delete(g); else F.gruplar.add(g); goster = 200; ciz(); },
      ac: (el, e) => { if (e.target.closest('button')) return; const id = Number(el.dataset.id); acik = acik === id ? null : id; ciz(); },
      hesapGoster: (el) => { F.adisyon = el.dataset.id; acik = null; sekme = 'liste'; window.scrollTo(0, 0); ciz(); },
      hesapTemizle: () => { F.adisyon = ''; ciz(); },
      dahaFazla: () => { goster += 300; ciz(); },
      hazir: (el) => { P.satir = el.dataset.a; P.sutun = el.dataset.b; P.deger = el.dataset.c; LS.yaz('ads_pivot', P); if (el.dataset.c === 'iptal_adet') { F.gruplar.add('iptal'); } ciz(); },
      pivotExcel: (el) => bekle(el, async () => { try { await pivotExcelIndir(pivotHesapla(filtrele(), P.satir, P.sutun, P.deger), V); } catch (err) { hata(err); } }),
      disari: () => disariAktarPenceresi(bas, son, V, donem),
      aralik: (el) => {
        const d = new Date(); const gun = (x) => x.getFullYear() + '-' + ikiHane(x.getMonth() + 1) + '-' + ikiHane(x.getDate());
        if (el.dataset.a === 'bugun') { bas = son = bugun(); }
        else if (el.dataset.a === 'dun') { bas = son = oncekiGun(bugun()); }
        else if (el.dataset.a === 'hafta') { son = bugun(); d.setDate(d.getDate() - 6); bas = gun(d); }
        else { son = bugun(); bas = gun(new Date(d.getFullYear(), d.getMonth(), 1)); }
        donem = null;
        if (el.dataset.a === 'bugun' && manuelMod()) donem = acikDonem();
        if (el.dataset.a === 'dun' && manuelMod() && sonKapaliDonem()) { donem = sonKapaliDonem(); bas = son = donem.etiket; }
        LS.yaz('ads_rapor_bas', bas); LS.yaz('ads_rapor_son', son); yenile();
      }
    }));
    yenile();
  }

  // ---------------------------------------------------------------
  // DIŞA AKTARMA (Excel / CSV)
  // ---------------------------------------------------------------
  const XL = {
    lacivert: 'FF28334A', yesil: 'FF28724F', gri: 'FFD9D9D6', acik: 'FFF4F4F1', kirmizi: 'FFB3261E',
    para: '#,##0.00 "₺";[Red]-#,##0.00 "₺"', adet: '#,##0;[Red]-#,##0', tarih: 'dd.mm.yyyy', tarihSaat: 'dd.mm.yyyy hh:mm:ss', saat: 'hh:mm'
  };
  async function exceljsYukle() {
    if (window.ExcelJS) return window.ExcelJS;
    await new Promise((coz, red) => {
      const sc = document.createElement('script'); sc.src = 'exceljs.min.js';
      sc.onload = coz; sc.onerror = () => red(new Error('Excel aracı yüklenemedi, interneti kontrol et.'));
      document.head.appendChild(sc);
    });
    return window.ExcelJS;
  }
  async function excelKaydet(wb, dosya) {
    const buf = await wb.xlsx.writeBuffer();
    dosyaIndir(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), dosya);
  }
  function dosyaIndir(blob, dosya) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = dosya;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    bildir('İndirildi: ' + dosya, 'basari');
  }
  // Excel tarih değeri: saat dilimi kaymasın diye yerel saati "UTC gibi" yaz
  const xlTarih = (t) => { const d = new Date(t); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds())); };
  const xlGun = (g) => { const [y, m, d] = g.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };

  // biçimli tablo sayfası: başlık + açıklama + tablo (filtreli, dondurulmuş başlık, toplam satırı)
  function bicimliSayfa(wb, ad, baslik, altBaslik, kolonlar, satirlar, ayar) {
    ayar = ayar || {};
    const ws = wb.addWorksheet(ad, { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }], properties: { tabColor: { argb: ayar.renk || XL.lacivert } } });
    ws.mergeCells(1, 1, 1, Math.max(2, kolonlar.length));
    ws.getCell(1, 1).value = baslik; ws.getCell(1, 1).font = { bold: true, size: 15, color: { argb: XL.lacivert } };
    ws.getCell(2, 1).value = altBaslik; ws.getCell(2, 1).font = { italic: true, size: 10, color: { argb: 'FF6B7282' } };
    ws.getRow(1).height = 24;
    const bas = ws.getRow(4);
    kolonlar.forEach((k, i) => {
      const c = bas.getCell(i + 1); c.value = k.ad;
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ayar.renk || XL.lacivert } };
      c.alignment = { vertical: 'middle', horizontal: k.tip === 'metin' || !k.tip ? 'left' : 'right', wrapText: true };
      ws.getColumn(i + 1).width = k.genislik || 14;
      if (k.tip === 'para') ws.getColumn(i + 1).numFmt = XL.para;
      if (k.tip === 'adet') ws.getColumn(i + 1).numFmt = XL.adet;
      if (k.tip === 'tarih') ws.getColumn(i + 1).numFmt = XL.tarih;
      if (k.tip === 'tarihSaat') ws.getColumn(i + 1).numFmt = XL.tarihSaat;
      if (k.tip === 'yuzde') ws.getColumn(i + 1).numFmt = '0%';
    });
    bas.height = 22;
    satirlar.forEach((s, ri) => {
      const r = ws.getRow(5 + ri); r.values = s;
      if (ri % 2 === 1) r.eachCell({ includeEmpty: true }, (c, ci) => { if (ci <= kolonlar.length) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.acik } }; });
      if (ayar.vurgu) ayar.vurgu(r, s);
    });
    const sonSatir = 4 + satirlar.length;
    if (satirlar.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: sonSatir, column: kolonlar.length } };
    if (ayar.toplam && satirlar.length) {
      const t = ws.getRow(sonSatir + 1);
      kolonlar.forEach((k, i) => {
        const c = t.getCell(i + 1);
        if (i === 0) c.value = 'TOPLAM';
        else if (k.topla) { const harf = ws.getColumn(i + 1).letter; c.value = { formula: 'SUBTOTAL(9,' + harf + '5:' + harf + sonSatir + ')' }; }
        c.font = { bold: true }; c.border = { top: { style: 'medium', color: { argb: XL.lacivert } } };
      });
    }
    return ws;
  }

  // ham tablo sayfası (Excel "Tablo" nesnesi: filtre, şerit, pivot kaynağı olarak genişler)
  function hamTabloSayfa(wb, ad, tabloAdi, kolonlar, satirlar, renk) {
    const ws = wb.addWorksheet(ad, { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: renk || XL.yesil } } });
    if (!satirlar.length) { ws.addRow(kolonlar.map((k) => k.ad)); ws.getRow(1).font = { bold: true }; ws.addRow(['Bu aralıkta kayıt yok']); return ws; }
    ws.addTable({ name: tabloAdi, ref: 'A1', headerRow: true, style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: kolonlar.map((k) => ({ name: k.ad, filterButton: true })), rows: satirlar });
    kolonlar.forEach((k, i) => {
      const col = ws.getColumn(i + 1); col.width = k.genislik || 14;
      if (k.tip === 'para') col.numFmt = XL.para; if (k.tip === 'adet') col.numFmt = XL.adet;
      if (k.tip === 'tarih') col.numFmt = XL.tarih; if (k.tip === 'tarihSaat') col.numFmt = XL.tarihSaat;
    });
    return ws;
  }

  function netOran(V, h) { const a = h.adisyon_id && V.hesap[h.adisyon_id]; return a ? Number(a.indirim_oran) || 0 : 0; }

  // satış satırları (sipariş + / iptal −): pivot kaynağı
  function satisSatirlari(V) {
    return V.hareketler.filter(SATIS).map((h) => {
      const oran = netOran(V, h); const tutar = Number(h.tutar) || 0;
      return { h, oran, tutar, net: sayi(tutar * (100 - oran) / 100) };
    });
  }

  function disariAktarPenceresi(bas, son, Vhazir, donem) {
    let secim = LS.al('ads_disari_secim', 'yonetici');
    const secenekler = [
      ['yonetici', '📘 Yönetici raporu', 'Biçimli, yazdırmaya hazır: özet, ürünler, garsonlar, bölümler, saatlik satış, garson × ürün, hesaplar, iptaller (kim, ne zaman, neden), ödemeler.'],
      ['pivot', '🧮 Ham veri + PivotTable', 'Analiz için: hazır bir Excel PivotTable (alanları sürükleyip istediğin gibi değiştirirsin), satır satır satış verisi ve bütün hareketlerin tam dökümü.'],
      ['hepsi', '📦 İkisi bir arada', 'Yönetici raporu + ham veri + PivotTable tek dosyada.'],
      ['csv', '📄 CSV (ham hareketler)', 'Her hareket bir satır, bütün alanlar. Başka programlara aktarmak için (Excel, Google Sheets, Power BI).']
    ];
    pencere('<button class="kapat-x" data-e="kapat">×</button><h2>Dışa aktar</h2>' +
      '<p class="aciklama">' + (donem ? donemYazi(donem) : (bas === son ? trGun(bas) + ' ' + gunAdi(bas) : trGun(bas) + ' – ' + trGun(son)) + ' · ' + (manuelMod() ? 'gün sonlarına göre' : 'gün ' + ikiHane(gbs()) + ':00\'da başlar')) + '</p>' +
      '<div class="secenekler" style="grid-template-columns:1fr;margin-top:10px">' + secenekler.map(([k, a, d]) =>
        '<button class="secenek' + (k === secim ? ' aktif' : '') + '" style="text-align:left" data-e="sec" data-k="' + k + '"><b>' + a + '</b><br><span class="aciklama" style="font-weight:500">' + d + '</span></button>').join('') + '</div>' +
      '<div class="eylemler"><button class="btn" data-e="kapat">Vazgeç</button><button class="btn ana" data-e="indir">İndir</button></div>', {
      sec: (el, e, p) => { secim = el.dataset.k; LS.yaz('ads_disari_secim', secim); p.querySelectorAll('[data-e="sec"]').forEach((b) => b.classList.toggle('aktif', b === el)); },
      indir: (el, e, p, kapat) => bekle(el, async () => {
        try {
          const V = Vhazir && Vhazir.bas === bas && Vhazir.son === son && (Vhazir.donem || null) === (donem || null) ? Vhazir : await hareketleriGetir(bas, son, donem);
          if (secim === 'csv') csvIndir(V);
          else await excelIndirTam(V, secim);
          kapat();
        } catch (err) { hata(err); }
      })
    });
  }

  function dosyaEtiketi(V) { return V.bas === V.son ? V.bas : V.bas + '_' + V.son; }

  function csvIndir(V) {
    const kol = ['İş günü', 'Tarih saat', 'Hareket', 'İşlemi yapan', 'Masa', 'Bölüm', 'Masa türü', 'Hesap', 'Sipariş no', 'Ürün', 'Kategori', 'Adet', 'Birim fiyat', 'Tutar', 'Personel ind. %', 'Net tutar', 'Ödeme türü', 'Siparişi giren', 'Sipariş zamanı', 'Açıklama'];
    const sayiTR = (v) => (v === null || v === undefined || v === '' ? '' : String(v).replace('.', ','));
    const hucre = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const satirlar = V.hareketler.map((h) => {
      const oran = netOran(V, h); const t = h.tutar != null ? Number(h.tutar) : null;
      return [trGun(isGunu(h.zaman)), tarihSaat(h.zaman) + ':' + ikiHane(new Date(h.zaman).getSeconds()), hTur(h).ad, h.garson_ad, h.masa_ad, h.bolum, h.masa_tur, h.adisyon_id ? h.adisyon_id.slice(0, 8) : '',
        h.siparis_no, h.urun_ad, h.kategori, h.adet, sayiTR(h.birim_fiyat), sayiTR(t), SATIS(h) ? oran : '', SATIS(h) && t != null ? sayiTR(sayi(t * (100 - oran) / 100)) : '',
        h.odeme_tur ? ODEME_TUR[h.odeme_tur] || h.odeme_tur : '', h.siparisi_giren, h.siparis_zaman ? tarihSaat(h.siparis_zaman) : '', h.aciklama].map(hucre).join(';');
    });
    const csv = '﻿' + [kol.join(';')].concat(satirlar).join('\r\n');
    dosyaIndir(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'Adisyon-Hareketler-' + dosyaEtiketi(V) + '.csv');
  }

  async function excelIndirTam(V, secim) {
    const ExcelJS = await exceljsYukle();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'YSipariş'; wb.created = new Date();
    const ay = S.ayarlar || {};
    const aralik = V.donem ? donemYazi(V.donem) : V.bas === V.son ? trGun(V.bas) + ' ' + gunAdi(V.bas) : trGun(V.bas) + ' – ' + trGun(V.son);
    const alt = (ay.isletme_adi || 'Yavuztürk Süleymaniye') + ' · ' + aralik + ' · hazırlanma ' + tarihSaat(new Date());
    const satis = satisSatirlari(V);
    if (secim === 'yonetici' || secim === 'hepsi') yoneticiSayfalari(wb, V, satis, alt);
    if (secim === 'pivot' || secim === 'hepsi') hamSayfalar(wb, V, satis, alt, secim === 'pivot');
    await excelKaydet(wb, (secim === 'pivot' ? 'Adisyon-Analiz-' : secim === 'hepsi' ? 'Adisyon-Tam-' : 'Adisyon-Rapor-') + dosyaEtiketi(V) + '.xlsx');
  }

  function yoneticiSayfalari(wb, V, satis, alt) {
    const H = V.hareketler;
    const topla = (liste, anahtar, deger) => { const o = {}; liste.forEach((x) => { const k = anahtar(x); o[k] = o[k] || { adet: 0, tutar: 0, net: 0, n: 0 }; o[k].adet += Number(x.h.adet) || 0; o[k].tutar += x.tutar; o[k].net += x.net; o[k].n++; if (deger) deger(o[k], x); }); return o; };
    // ödemeler
    const od = { nakit: 0, kart: 0, ikram: 0, indirim: 0, garson_ikram: 0 };
    H.filter((h) => /^odeme/.test(h.tur)).forEach((h) => { od[h.odeme_tur] = (od[h.odeme_tur] || 0) + Number(h.tutar); });
    const brut = satis.reduce((t, x) => t + x.tutar, 0); const net = satis.reduce((t, x) => t + x.net, 0);
    const siparisAdet = H.filter((h) => h.tur === 'siparis').reduce((t, h) => t + h.adet, 0);
    const iptaller = H.filter((h) => h.tur === 'iptal');
    const kapanan = H.filter((h) => h.tur === 'hesap_kapandi');
    const acilan = H.filter((h) => h.tur === 'hesap_acildi');
    // 1) ÖZET
    const oz = [
      ['Satış (indirimsiz)', sayi(brut), 'Siparişler − iptaller, liste fiyatıyla'],
      ['Personel indirimi', sayi(brut - net), 'Personel hesaplarına uygulanan indirim'],
      ['Net satış', sayi(net), 'Müşteriden alınması gereken'],
      ['Nakit', sayi(od.nakit), ''], ['Kart', sayi(od.kart), ''],
      ['TAHSİLAT (nakit + kart)', sayi(od.nakit + od.kart), 'Kasaya giren para'],
      ['İkram', sayi(od.ikram), ''], ['İndirim', sayi(od.indirim), ''], ['Garson hediye ikramı', sayi(od.garson_ikram), ''],
      ['İptal edilen tutar', sayi(-iptaller.reduce((t, h) => t + Number(h.tutar), 0)), iptaller.length + ' iptal hareketi'],
      ['Açılan hesap', acilan.length, ''], ['Kapanan hesap', kapanan.length, ''],
      ['Ortalama hesap (kapanan)', kapanan.length ? sayi(kapanan.reduce((t, h) => t + Number(h.tutar || 0), 0) / kapanan.length) : 0, ''],
      ['Sipariş edilen ürün adedi', siparisAdet, ''], ['İptal edilen ürün adedi', -iptaller.reduce((t, h) => t + h.adet, 0), ''],
      ['Net satılan ürün adedi', siparisAdet + iptaller.reduce((t, h) => t + h.adet, 0), '']
    ];
    bicimliSayfa(wb, 'Özet', 'Satış Özeti', alt, [{ ad: 'Kalem', genislik: 30 }, { ad: 'Değer', genislik: 18, tip: 'sayi' }, { ad: 'Açıklama', genislik: 46 }], oz, {
      vurgu: (r, s) => { const c = r.getCell(2); c.numFmt = /adet|hesap$|Açılan|Kapanan/.test(s[0]) && !/Ortalama/.test(s[0]) ? XL.adet : XL.para; if (/TAHSİLAT|Net satış/.test(s[0])) { r.font = { bold: true }; r.getCell(1).font = { bold: true, color: { argb: XL.yesil } }; } }
    });
    // 2) ÜRÜNLER
    const urun = topla(satis, (x) => x.h.urun_ad + '\u0000' + (x.h.kategori || ''));
    const ipUrun = {}; iptaller.forEach((h) => { ipUrun[h.urun_ad] = (ipUrun[h.urun_ad] || 0) - h.adet; });
    bicimliSayfa(wb, 'Ürünler', 'Ürün Satışları', alt, [{ ad: 'Ürün', genislik: 28 }, { ad: 'Kategori', genislik: 16 }, { ad: 'Net adet', tip: 'adet', topla: true }, { ad: 'İptal adet', tip: 'adet', topla: true },
      { ad: 'Satış (₺)', tip: 'para', genislik: 15, topla: true }, { ad: 'Net satış (₺)', tip: 'para', genislik: 15, topla: true }, { ad: 'Pay %', tip: 'yuzde', genislik: 9 }],
    Object.entries(urun).sort((a, b) => b[1].tutar - a[1].tutar).map(([k, v]) => { const [u, kat] = k.split('\u0000'); return [u, kat || '', v.adet, ipUrun[u] || 0, sayi(v.tutar), sayi(v.net), brut ? v.tutar / brut : 0]; }), { toplam: true, renk: XL.yesil });
    // 3) GARSONLAR
    const garsonAd = (h) => (h.tur === 'iptal' ? h.siparisi_giren : null) || h.garson_ad || '—';
    const g = topla(satis, (x) => garsonAd(x.h));
    const gHesap = {}; acilan.forEach((h) => { gHesap[h.garson_ad] = (gHesap[h.garson_ad] || 0) + 1; });
    const gIptalYapti = {}; iptaller.forEach((h) => { gIptalYapti[h.garson_ad] = (gIptalYapti[h.garson_ad] || 0) - h.adet; });
    const gIptalEdildi = {}; iptaller.forEach((h) => { const k = h.siparisi_giren || '—'; gIptalEdildi[k] = (gIptalEdildi[k] || 0) - h.adet; });
    const gTahsil = {}; H.filter((h) => /^odeme/.test(h.tur) && (h.odeme_tur === 'nakit' || h.odeme_tur === 'kart')).forEach((h) => { gTahsil[h.garson_ad] = (gTahsil[h.garson_ad] || 0) + Number(h.tutar); });
    const gIlk = {}; const gSon = {}; H.filter((h) => h.tur === 'siparis').forEach((h) => { if (!gIlk[h.garson_ad] || h.zaman < gIlk[h.garson_ad]) gIlk[h.garson_ad] = h.zaman; if (!gSon[h.garson_ad] || h.zaman > gSon[h.garson_ad]) gSon[h.garson_ad] = h.zaman; });
    const hediye = {}; H.filter((h) => h.tur === 'odeme' && h.odeme_tur === 'garson_ikram').forEach((h) => { const k = (h.aciklama || '').replace(' hediye hakkından', '') || '—'; hediye[k] = (hediye[k] || 0) + Number(h.tutar); });
    const tumG = Array.from(new Set(Object.keys(g).concat(Object.keys(gTahsil), Object.keys(gIptalYapti)))).filter((x) => x !== '—' || g[x]);
    bicimliSayfa(wb, 'Garsonlar', 'Garson Performansı', alt, [{ ad: 'Garson', genislik: 22 }, { ad: 'Açtığı hesap', tip: 'adet', topla: true }, { ad: 'Net ürün adedi', tip: 'adet', topla: true },
      { ad: 'Net satış (₺)', tip: 'para', genislik: 15, topla: true }, { ad: 'Aldığı ödeme nakit+kart (₺)', tip: 'para', genislik: 17, topla: true }, { ad: 'Siparişinden iptal edilen adet', tip: 'adet', genislik: 15, topla: true },
      { ad: 'Kendi yaptığı iptal adedi', tip: 'adet', genislik: 14, topla: true }, { ad: 'Hediye ikramı kullandı (₺)', tip: 'para', genislik: 15, topla: true }, { ad: 'İlk sipariş', genislik: 10 }, { ad: 'Son sipariş', genislik: 10 }],
    tumG.sort((a, b) => ((g[b] || {}).net || 0) - ((g[a] || {}).net || 0)).map((k) => [k, gHesap[k] || 0, (g[k] || {}).adet || 0, sayi((g[k] || {}).net || 0), sayi(gTahsil[k] || 0), gIptalEdildi[k] || 0, gIptalYapti[k] || 0, sayi(hediye[k] || 0),
      gIlk[k] ? saat(gIlk[k]) : '', gSon[k] ? saat(gSon[k]) : '']), { toplam: true });
    // 4) GARSON × ÜRÜN (matris)
    matrisSayfa(wb, 'Garson x Ürün', 'Garson × Ürün (net adet)', alt, satis, (x) => garsonAd(x.h), (x) => x.h.urun_ad, (x) => Number(x.h.adet) || 0, XL.adet);
    // 5) BÖLÜM × GARSON
    matrisSayfa(wb, 'Bölüm x Garson', 'Bölüm × Garson (net satış ₺)', alt, satis, (x) => BOYUT.bolum.f(x.h), (x) => garsonAd(x.h), (x) => x.net, XL.para);
    // 6) SAATLİK
    matrisSayfa(wb, 'Saatlik', 'Saat × Ürün (net adet)', alt, satis, (x) => saatDilimi(x.h.zaman), (x) => x.h.urun_ad, (x) => Number(x.h.adet) || 0, XL.adet,
      (a, b) => ((Number(a.slice(0, 2)) + 24 - gbs()) % 24) - ((Number(b.slice(0, 2)) + 24 - gbs()) % 24));
    // 7) HESAPLAR
    const hesapBilgi = {};
    H.forEach((h) => {
      if (!h.adisyon_id) return;
      const b = hesapBilgi[h.adisyon_id] = hesapBilgi[h.adisyon_id] || { masa: h.masa_ad, bolum: BOYUT.bolum.f(h), acan: '', acilis: null, kapatan: '', kapanis: null, brut: 0, net: 0, adet: 0, od: { nakit: 0, kart: 0, ikram: 0, indirim: 0, garson_ikram: 0 }, iptal: 0, durum: '' };
      if (h.tur === 'hesap_acildi') { b.acan = h.garson_ad; b.acilis = h.zaman; }
      if (h.tur === 'hesap_kapandi') { b.kapatan = h.garson_ad; b.kapanis = h.zaman; b.masa = h.masa_ad; b.bolum = BOYUT.bolum.f(h); }
      if (SATIS(h)) { const o = netOran(V, h); b.brut += Number(h.tutar); b.net += Number(h.tutar) * (100 - o) / 100; b.adet += h.adet; if (h.tur === 'iptal') b.iptal -= h.adet; }
      if (/^odeme/.test(h.tur)) b.od[h.odeme_tur] = (b.od[h.odeme_tur] || 0) + Number(h.tutar);
    });
    bicimliSayfa(wb, 'Hesaplar', 'Hesaplar', alt, [{ ad: 'Masa', genislik: 18 }, { ad: 'Bölüm', genislik: 12 }, { ad: 'Açılış', tip: 'tarihSaat', genislik: 19 }, { ad: 'Açan', genislik: 16 }, { ad: 'Kapanış', tip: 'tarihSaat', genislik: 19 },
      { ad: 'Kapatan', genislik: 16 }, { ad: 'Süre (dk)', tip: 'adet', genislik: 9 }, { ad: 'Ürün adedi', tip: 'adet', topla: true }, { ad: 'İptal adedi', tip: 'adet', topla: true },
      { ad: 'Satış (₺)', tip: 'para', topla: true }, { ad: 'Net (₺)', tip: 'para', topla: true }, { ad: 'Nakit', tip: 'para', topla: true }, { ad: 'Kart', tip: 'para', topla: true },
      { ad: 'İkram', tip: 'para', topla: true }, { ad: 'İndirim', tip: 'para', topla: true }, { ad: 'Garson ikramı', tip: 'para', topla: true }, { ad: 'Durum', genislik: 10 }],
    Object.entries(hesapBilgi).sort((a, b) => String(a[1].acilis || a[1].kapanis).localeCompare(String(b[1].acilis || b[1].kapanis))).map(([id, b]) => {
      const a = V.hesap[id];
      return [b.masa, b.bolum, b.acilis ? xlTarih(b.acilis) : null, b.acan, b.kapanis ? xlTarih(b.kapanis) : null, b.kapatan,
        b.acilis && b.kapanis ? Math.round((new Date(b.kapanis) - new Date(b.acilis)) / 60000) : null, b.adet, b.iptal, sayi(b.brut), sayi(b.net),
        sayi(b.od.nakit), sayi(b.od.kart), sayi(b.od.ikram), sayi(b.od.indirim), sayi(b.od.garson_ikram),
        a ? ({ acik: 'Açık', kapali: 'Kapandı', iptal: 'İptal', birlesti: 'Birleşti' }[a.durum] || a.durum) : (b.kapanis ? 'Kapandı' : '')];
    }), { toplam: true });
    // 8) İPTALLER
    bicimliSayfa(wb, 'İptaller', 'İptal Edilenler — kim, ne zaman, neden', alt, [{ ad: 'İptal zamanı', tip: 'tarihSaat', genislik: 19 }, { ad: 'İptal eden', genislik: 16 }, { ad: 'Masa', genislik: 16 }, { ad: 'Bölüm', genislik: 12 },
      { ad: 'Ürün', genislik: 24 }, { ad: 'Adet', tip: 'adet', topla: true }, { ad: 'Tutar (₺)', tip: 'para', topla: true }, { ad: 'Siparişi giren', genislik: 16 }, { ad: 'Sipariş zamanı', tip: 'tarihSaat', genislik: 19 },
      { ad: 'Siparişten sonra (dk)', tip: 'adet', genislik: 11 }, { ad: 'Sipariş no', tip: 'adet', genislik: 9 }, { ad: 'Neden', genislik: 34 }],
    iptaller.map((h) => [xlTarih(h.zaman), h.garson_ad, h.masa_ad, BOYUT.bolum.f(h), h.urun_ad, -h.adet, -Number(h.tutar), h.siparisi_giren || '', h.siparis_zaman ? xlTarih(h.siparis_zaman) : null,
      h.siparis_zaman ? Math.round((new Date(h.zaman) - new Date(h.siparis_zaman)) / 60000) : null, h.siparis_no || null, h.aciklama || '']), { toplam: true, renk: XL.kirmizi });
    // 9) ÖDEMELER
    bicimliSayfa(wb, 'Ödemeler', 'Ödeme Hareketleri', alt, [{ ad: 'Zaman', tip: 'tarihSaat', genislik: 19 }, { ad: 'Hareket', genislik: 16 }, { ad: 'Ödeme türü', genislik: 15 }, { ad: 'Tutar (₺)', tip: 'para', topla: true },
      { ad: 'Alan / işlemi yapan', genislik: 18 }, { ad: 'Masa', genislik: 16 }, { ad: 'Bölüm', genislik: 12 }, { ad: 'Açıklama', genislik: 30 }],
    H.filter((h) => /^odeme/.test(h.tur)).map((h) => [xlTarih(h.zaman), hTur(h).ad, ODEME_TUR[h.odeme_tur] || h.odeme_tur, Number(h.tutar), h.garson_ad, h.masa_ad, BOYUT.bolum.f(h), h.aciklama || '']), { toplam: true });
  }

  function matrisSayfa(wb, ad, baslik, alt, liste, satirF, sutunF, degerF, numFmt, satirSirali) {
    const hucre = {}; const rT = {}; const cT = {};
    liste.forEach((x) => { const r = satirF(x); const c = sutunF(x); const v = degerF(x); if (!v) return; hucre[r + '\u0000' + c] = (hucre[r + '\u0000' + c] || 0) + v; rT[r] = (rT[r] || 0) + v; cT[c] = (cT[c] || 0) + v; });
    const rows = Object.keys(rT).sort(typeof satirSirali === 'function' ? satirSirali : satirSirali ? undefined : (a, b) => rT[b] - rT[a]);
    const cols = Object.keys(cT).sort((a, b) => cT[b] - cT[a]);
    const kol = [{ ad: '', genislik: 22 }].concat(cols.map((c) => ({ ad: c, genislik: Math.min(16, Math.max(9, c.length + 2)), tip: 'sayi' })), [{ ad: 'TOPLAM', genislik: 13, tip: 'sayi' }]);
    const satir = rows.map((r) => [r].concat(cols.map((c) => (hucre[r + '\u0000' + c] ? sayi(hucre[r + '\u0000' + c]) : null)), [sayi(rT[r])]));
    satir.push(['TOPLAM'].concat(cols.map((c) => sayi(cT[c])), [sayi(Object.values(rT).reduce((t, v) => t + v, 0))]));
    const ws = bicimliSayfa(wb, ad, baslik, alt, kol, satir, { renk: XL.yesil });
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];
    for (let i = 2; i <= kol.length; i++) ws.getColumn(i).numFmt = numFmt;
    const sonR = 4 + satir.length;
    ws.getRow(sonR).font = { bold: true }; ws.getRow(sonR).eachCell((c) => { c.border = { top: { style: 'medium', color: { argb: XL.lacivert } } }; });
    ws.getColumn(kol.length).font = { bold: true };
    if (rows.length && cols.length) {
      ws.addConditionalFormatting({ ref: ws.getColumn(2).letter + '5:' + ws.getColumn(kol.length - 1).letter + (sonR - 1),
        rules: [{ type: 'colorScale', priority: 1, cfvo: [{ type: 'min' }, { type: 'max' }], color: [{ argb: 'FFFFFFFF' }, { argb: 'FF8FC7A8' }] }] });
    }
    ws.autoFilter = undefined;
  }

  function hamSayfalar(wb, V, satis, alt, pivotOne) {
    // pivot kaynağı: yalnız metin + sayı (her satır bir sipariş/iptal kalemi)
    const kaynakKol = ['İş günü', 'Saat', 'Garson', 'Bölüm', 'Masa', 'Ürün', 'Kategori', 'Hareket', 'Adet', 'Satış', 'Net satış', 'İptal eden', 'Sipariş no'];
    const kaynak = satis.map((x) => {
      const h = x.h;
      return [trGun(isGunu(h.zaman)), saatDilimi(h.zaman), (h.tur === 'iptal' ? h.siparisi_giren : null) || h.garson_ad || '—', BOYUT.bolum.f(h), h.masa_ad || '—', h.urun_ad || '—', h.kategori || '—',
        h.tur === 'iptal' ? 'İptal' : 'Sipariş', Number(h.adet) || 0, sayi(x.tutar), x.net, h.tur === 'iptal' ? h.garson_ad || '—' : '—', h.siparis_no || 0];
    });
    // 1) PIVOT (gerçek Excel PivotTable)
    let pivotSayfa = null;
    if (kaynak.length) {
      pivotSayfa = wb.addWorksheet('Pivot', { properties: { tabColor: { argb: XL.yesil } } });
      if (pivotOne) wb.views = [{ activeTab: 0 }];
    }
    // 2) Satış verisi (pivot kaynağı) — düz liste, ilk satır başlık
    const kws = wb.addWorksheet('Satış Verisi', { views: [{ state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: XL.yesil } } });
    kws.addRow(kaynakKol);
    kaynak.forEach((r) => kws.addRow(r));
    const kb = kws.getRow(1); kb.font = { bold: true, color: { argb: 'FFFFFFFF' } }; kb.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.yesil } };
    [11, 13, 18, 12, 16, 24, 14, 9, 8, 12, 12, 16, 10].forEach((w, i) => { kws.getColumn(i + 1).width = w; });
    kws.getColumn(10).numFmt = XL.para; kws.getColumn(11).numFmt = XL.para; kws.getColumn(9).numFmt = XL.adet;
    if (kaynak.length) kws.autoFilter = { from: { row: 1, column: 1 }, to: { row: kaynak.length + 1, column: kaynakKol.length } };
    if (pivotSayfa) {
      [16, 26, 15, 15, 15, 15, 15, 15].forEach((w, i) => { pivotSayfa.getColumn(i + 1).width = w; });
      pivotSayfa.addPivotTable({ sourceSheet: kws, rows: ['Garson', 'Ürün'], columns: ['Bölüm'], values: ['Net satış'], metric: 'sum' });
    }
    // 3) Bütün hareketler — Excel Tablosu
    const kol = [{ ad: 'Zaman', tip: 'tarihSaat', genislik: 19 }, { ad: 'İş günü', tip: 'tarih', genislik: 11 }, { ad: 'Saat dilimi', genislik: 13 }, { ad: 'Hareket', genislik: 17 },
      { ad: 'İşlemi yapan', genislik: 16 }, { ad: 'Masa', genislik: 16 }, { ad: 'Bölüm', genislik: 12 }, { ad: 'Masa türü', genislik: 9 }, { ad: 'Hesap', genislik: 10 }, { ad: 'Sipariş no', tip: 'adet', genislik: 9 },
      { ad: 'Ürün', genislik: 22 }, { ad: 'Kategori', genislik: 13 }, { ad: 'Adet', tip: 'adet', genislik: 7 }, { ad: 'Birim fiyat', tip: 'para', genislik: 11 }, { ad: 'Tutar', tip: 'para', genislik: 12 },
      { ad: 'Personel ind %', genislik: 9 }, { ad: 'Net tutar', tip: 'para', genislik: 12 }, { ad: 'Ödeme türü', genislik: 13 }, { ad: 'Siparişi giren', genislik: 16 },
      { ad: 'Sipariş zamanı', tip: 'tarihSaat', genislik: 19 }, { ad: 'Açıklama', genislik: 34 }];
    hamTabloSayfa(wb, 'Tüm Hareketler', 'Hareketler', kol, V.hareketler.map((h) => {
      const oran = SATIS(h) ? netOran(V, h) : null; const t = h.tutar != null ? Number(h.tutar) : null;
      return [xlTarih(h.zaman), xlGun(isGunu(h.zaman)), saatDilimi(h.zaman), hTur(h).ad, h.garson_ad || '', h.masa_ad || '', h.bolum || (h.masa_tur === 'paket' ? 'Paket' : ''), h.masa_tur === 'paket' ? 'Paket' : (h.masa_tur ? 'Masa' : ''),
        h.adisyon_id ? h.adisyon_id.slice(0, 8) : '', h.siparis_no || null, h.urun_ad || '', h.kategori || '', h.adet != null ? Number(h.adet) : null, h.birim_fiyat != null ? Number(h.birim_fiyat) : null, t,
        oran, oran != null && t != null ? sayi(t * (100 - oran) / 100) : null, h.odeme_tur ? ODEME_TUR[h.odeme_tur] || h.odeme_tur : '', h.siparisi_giren || '', h.siparis_zaman ? xlTarih(h.siparis_zaman) : null, h.aciklama || ''];
    }), XL.lacivert);
    // 4) Nasıl kullanılır
    const nk = wb.addWorksheet('Nasıl Kullanılır', { properties: { tabColor: { argb: XL.gri } } });
    nk.getColumn(1).width = 110;
    [['Bu dosya nasıl kullanılır?', true], [alt], [''],
      ['• "Pivot" sayfası gerçek bir Excel PivotTable\'dır. Tabloya tıklayınca sağda "PivotTable Alanları" açılır.', false],
      ['  Alanları sürükleyerek istediğin raporu kurarsın: örn. Satırlar = Garson, Sütunlar = Saat, Değerler = Adet.', false],
      ['  Başlangıçta: Satırlar = Garson › Ürün, Sütunlar = Bölüm, Değer = Net satış (₺).', false],
      ['  Veri değiştiğinde: tabloya sağ tıkla › Yenile.', false], [''],
      ['• "Satış Verisi": pivotun kaynağı. Her satır bir sipariş kalemi; iptaller eksi adet/tutar olarak yazılıdır, böylece toplamlar net çıkar.', false],
      ['  "Garson" sütunu iptallerde siparişi giren kişidir; iptali yapan "İptal eden" sütunundadır.', false], [''],
      ['• "Tüm Hareketler": bütün işlemlerin saniyesine kadar tam dökümü (giriş, hesap açma, sipariş, iptal, ödeme, ödeme silme,', false],
      ['  masa taşıma, personel indirimi, hesap kapatma, gün sonu düzeltmeleri). Başlıklardaki oklarla filtreleyebilirsin.', false],
      ['  Kendi pivotunu kurmak için: tablonun içine tıkla › Ekle › PivotTable.', false], [''],
      ['• Gün sabah 05:00\'te başlar; gece yarısından sonraki satışlar o gecenin içindedir.', false]
    ].forEach(([t, b], i) => { const c = nk.getCell(i + 1, 1); c.value = t; if (b) c.font = { bold: true, size: 15, color: { argb: XL.lacivert } }; if (i === 1) c.font = { italic: true, color: { argb: 'FF6B7282' } }; });
  }

  async function pivotExcelIndir(R, V) {
    if (!R.satirlar.length) return bildir('Tabloda veri yok.', 'hata');
    const ExcelJS = await exceljsYukle();
    const wb = new ExcelJS.Workbook();
    const cols = R.CB ? R.sutunlar : [];
    const kol = [{ ad: R.SB.ad, genislik: 24 }].concat(cols.map((c) => ({ ad: c, genislik: Math.min(16, Math.max(9, c.length + 2)) })), [{ ad: 'TOPLAM', genislik: 13 }]);
    const satir = R.satirlar.map((r) => [r].concat(cols.map((c) => (R.hucre[r + '\u0000' + c] ? sayi(R.hucre[r + '\u0000' + c]) : null)), [sayi(R.satirT[r])]));
    satir.push(['TOPLAM'].concat(cols.map((c) => sayi(R.sutunT[c])), [sayi(R.genel)]));
    const aralik = V.bas === V.son ? trGun(V.bas) : trGun(V.bas) + ' – ' + trGun(V.son);
    const ws = bicimliSayfa(wb, 'Tablo', R.D.ad + ' · ' + R.SB.ad + (R.CB ? ' × ' + R.CB.ad : ''), aralik + ' · hazırlanma ' + tarihSaat(new Date()), kol, satir, { renk: XL.yesil });
    for (let i = 2; i <= kol.length; i++) ws.getColumn(i).numFmt = R.D.para ? XL.para : XL.adet;
    ws.getRow(4 + satir.length).font = { bold: true };
    ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];
    await excelKaydet(wb, 'Adisyon-Tablo-' + dosyaEtiketi(V) + '.xlsx');
  }

  // ---------------------------------------------------------------
  // MÜŞTERİ QR MENÜSÜ
  // ---------------------------------------------------------------
  function menuAdresi(masa) {
    const ayarTaban = (window.ADISYON_AYAR || {}).MENU_TABAN;
    const taban = (ayarTaban ? ayarTaban.replace(/\/?$/, '/') : location.origin + location.pathname.replace(/[^/]*$/, '')) + 'menu.html';
    return taban + (masa ? '?masa=' + encodeURIComponent(masa) : '');
  }
  function qrYukle() {
    if (window.qrcode) return Promise.resolve();
    return new Promise((coz, red) => { const sc = document.createElement('script'); sc.src = 'qrcode.min.js'; sc.onload = coz; sc.onerror = () => red(new Error('QR aracı yüklenemedi.')); document.head.appendChild(sc); });
  }
  function qrSvg(metin, boyut) {
    const q = window.qrcode(0, 'M'); q.addData(metin); q.make();
    return q.createSvgTag({ cellSize: Math.max(2, Math.round((boyut || 180) / q.getModuleCount())), margin: 2 });
  }

  async function qrMenuSayfa() {
    $app.innerHTML = ustBar('Müşteri Menüsü / QR', '', geriBtn('/masalar')) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { await Promise.all([ayarlariYukle(), masalariYukle(), qrYukle()]); } catch (e) { hata(e); }
    const url = menuAdresi(null);
    function ciz() {
      $app.innerHTML = ustBar('Müşteri Menüsü / QR', '', geriBtn('/masalar'), '<button class="ust-btn" data-e="menu">☰</button>') +
        '<main class="icerik">' +
        '<div class="kart dolgulu"><p class="aciklama" style="margin-top:0">Müşteriler masadaki QR\'ı okutunca menüyü görür; <b>sipariş veremez</b>. Menüde bir ürünü/kategoriyi kapatırsan (Yönetim › Menü) müşteri menüsünden de anında kalkar. Stoğu biten ürünü aşağıdan gizleyebilir ya da "Tükendi" yazıp gösterebilirsin.</p>' +
        '<div class="qr-tek">' + qrSvg(url, 200) + '</div>' +
        '<label>Menü adresi</label><input id="qr-url" readonly value="' + esc(url) + '" onclick="this.select()">' +
        '<div class="btn-satir" style="margin-top:8px"><button class="btn ana" data-e="kopyala">📋 Adresi kopyala</button><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">↗ Önizle</a></div></div>' +
        '<div class="kart dolgulu"><b>✏️ Menünün üstündeki yazılar</b><p class="aciklama" style="margin-top:4px">Her hafta istediğini yaz: balık günü, tavuk günü, özel bir akşam… Müşteri menüyü açınca en üstte görür.</p>' +
        '<label>Küçük başlık (işletme adının üstü)</label><input id="qr-baslik" maxlength="40" value="' + esc((S.ayarlar && S.ayarlar.menu_baslik) || '') + '" placeholder="Menü  ·  örn. Çarşamba Balık Akşamı">' +
        '<label>İşletme adı (menüde büyük görünen)</label><input id="qr-isletme" maxlength="50" value="' + esc((S.ayarlar && S.ayarlar.menu_isletme) || '') + '" placeholder="' + esc((S.ayarlar && S.ayarlar.isletme_adi) || 'Yavuztürk Süleymaniye') + '">' +
        '<p class="aciklama" style="margin:4px 0 0">Boş bırakırsan fişteki işletme adı yazılır.</p>' +
        '<label>Alt yazı (işletme adının altı)</label><input id="qr-acik" maxlength="90" value="' + esc((S.ayarlar && S.ayarlar.menu_aciklama) || '') + '" placeholder="Örn. Bu akşam balık günü · Afiyet olsun">' +
        '<button class="btn ana kucuk" style="margin-top:10px" data-e="aciklamaKaydet">Kaydet</button></div>' +
        '<div class="kart dolgulu"><label class="anahtar" style="margin:0"><span><b>Stoğu biten ürün menüden gizlensin</b><br><span class="aciklama" style="font-weight:500">Kapalıysa ürün çizili ve "Tükendi" yazılı görünür. Stok 0 olunca ya da "tükendi" işaretlenince devreye girer.</span></span><input type="checkbox" id="qr-gizle"' + (!S.ayarlar || S.ayarlar.menu_tukenen_gizle !== false ? ' checked' : '') + ' data-e="gizleDegis"></label></div>' +
        '<div class="btn-satir" style="margin:4px 0 10px"><button class="btn koyu tam" data-e="yazdir">🖨️ Masalar için QR kartları yazdır</button></div>' +
        '<p class="aciklama">Yazdır dediğinde her masa için ayrı bir QR kartı çıkar (üstünde masa adı). Kes, masalara koy. Aynı menü her masada açılır; masa adı sadece görüntü içindir.</p>' +
        '</main>';
    }
    function yazdirKartlar() {
      const kartlar = S.masalar.map((m) => '<div class="qr-kart"><div class="qr-isletme">' + esc((S.ayarlar && (S.ayarlar.menu_isletme || S.ayarlar.isletme_adi)) || '') + '</div>' +
        qrSvg(menuAdresi(m.ad), 220) + '<div class="qr-masa">' + esc(m.ad) + '</div><div class="qr-not">QR\'ı okutun, menümüze bakın</div></div>').join('');
      const w = window.open('', '_blank');
      if (!w) return bildir('Açılır pencere engellendi, tarayıcı iznini aç.', 'hata');
      w.document.write('<!doctype html><meta charset="utf-8"><title>Masa QR Kartları</title><style>' +
        'body{font-family:-apple-system,Arial,sans-serif;margin:0;padding:10px;display:flex;flex-wrap:wrap;gap:10px;justify-content:center}' +
        '.qr-kart{width:46%;max-width:300px;border:2px dashed #b8b6ac;border-radius:18px;padding:16px;text-align:center;page-break-inside:avoid}' +
        '.qr-isletme{font-weight:800;color:#0f766e;font-size:16px;margin-bottom:6px}.qr-masa{font-size:26px;font-weight:900;margin-top:6px}.qr-not{color:#666;font-size:13px;margin-top:4px}' +
        'svg{width:220px;height:220px}@media print{.qr-kart{border-color:#bbb}}</style>' + kartlar +
        '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print()},300)}</scr' + 'ipt>');
      w.document.close();
    }
    eylemBagla(Object.assign({}, ortakEylemler, {
      kopyala: async () => { try { await navigator.clipboard.writeText(url); bildir('Adres kopyalandı', 'basari'); } catch (e) { const i = document.getElementById('qr-url'); i.select(); try { document.execCommand('copy'); bildir('Kopyalandı', 'basari'); } catch (e2) { /* */ } } },
      aciklamaKaydet: (el) => bekle(el, async () => {
        const v = document.getElementById('qr-acik').value.trim() || null; const b = document.getElementById('qr-baslik').value.trim() || null; const ad = document.getElementById('qr-isletme').value.trim() || null;
        try { await q(db.from('ads_ayarlar').update({ menu_aciklama: v, menu_baslik: b, menu_isletme: ad }).eq('id', 1)); S.ayarlar.menu_aciklama = v; S.ayarlar.menu_baslik = b; S.ayarlar.menu_isletme = ad; bildir('Menü yazıları kaydedildi', 'basari'); } catch (err) { hata(err); }
      }),
      gizleDegis: async (el) => {
        const v = el.checked;
        try { await q(db.from('ads_ayarlar').update({ menu_tukenen_gizle: v }).eq('id', 1)); S.ayarlar.menu_tukenen_gizle = v; bildir(v ? 'Biten ürünler menüden gizlenecek' : 'Biten ürünler "Tükendi" yazıp görünecek', 'basari'); } catch (err) { hata(err); el.checked = !v; }
      },
      yazdir: () => yazdirKartlar()
    }));
    ciz();
  }

  // ---------------------------------------------------------------
  // FİŞ TASARIMI (özelleştirilebilir fiş + canlı önizleme)
  // ---------------------------------------------------------------
  async function fisTasarimSayfa() {
    $app.innerHTML = ustBar('Fiş Tasarımı', '', geriBtn('/masalar')) + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { await ayarlariYukle(); } catch (e) { hata(e); }
    const t0 = fisSablon(S.ayarlar);
    const d = { isletme_adi: S.ayarlar.isletme_adi || '', fis_alt_yazi: S.ayarlar.fis_alt_yazi || '', yazi: t0.yazi, font: t0.font, cizgi: t0.cizgi, ust: t0.ust.slice(), siparis: t0.siparis, hesap: t0.hesap, iptal: t0.iptal, logo: Object.assign({}, t0.logo) };
    let orijinalLogo = null;
    let renkliLogo = S.ayarlar.logo || '';
    if (renkliLogo) { try { orijinalLogo = { c: logoTuval(await resimAc(renkliLogo), 384), esik: 150 }; } catch (e) { orijinalLogo = null; } }
    let sek = 'siparis';
    const genislik = Number(S.ayarlar.fis_genislik) === 58 ? 58 : 80;

    const taslakAy = () => Object.assign({}, S.ayarlar, {
      isletme_adi: d.isletme_adi, fis_alt_yazi: d.fis_alt_yazi,
      fis_sablon: { yazi: d.yazi, font: d.font, cizgi: d.cizgi, ust: d.ust, siparis: d.siparis, hesap: d.hesap, iptal: d.iptal, logo: d.logo }
    });
    const simdi = new Date().toISOString();
    const ORNEK = {
      siparis: { tur: 'siparis', olusturma: simdi, veri: { masa: 'Masa 4', no: 128, garson: 'Ahmet', zaman: simdi, istasyon_ad: ((S.ayarlar.istasyon_adlari || {})[1]) || 'Mutfak', not: 'Çabuk olsun', kalemler: [{ adet: 2, ad: 'Fish Finger', not: 'Acısız' }, { adet: 1, ad: 'Çay' }] } },
      hesap: { tur: 'hesap', olusturma: simdi, veri: { masa: 'Masa 4', garson: 'Ahmet', zaman: simdi, toplam: 420, net: 420, odenen: 420, kalemler: [{ ad: 'Fish Finger', adet: 2, fiyat: 180, tutar: 360 }, { ad: 'Çay', adet: 4, fiyat: 15, tutar: 60 }], odemeler: [{ tur: 'nakit', tutar: 200 }, { tur: 'kart', tutar: 220 }] } },
      iptal: { tur: 'iptal', olusturma: simdi, veri: { masa: 'Masa 4', garson: 'Ahmet', zaman: simdi, neden: 'Yanlış girildi', kalemler: [{ adet: 1, ad: 'Fish Finger' }] } }
    };

    function sec(ad, deger, secenekler) {
      return '<select data-k="' + ad + '">' + secenekler.map(([v, e]) => '<option value="' + v + '"' + (String(deger) === String(v) ? ' selected' : '') + '>' + e + '</option>').join('') + '</select>';
    }
    function anahtar(yol, etiket, deger) {
      return '<label class="anahtar"><span>' + etiket + '</span><input type="checkbox" data-k="' + yol + '"' + (deger ? ' checked' : '') + '></label>';
    }
    function metin(yol, etiket, deger, ip, ml) {
      return '<label>' + etiket + '</label><input data-k="' + yol + '" value="' + esc(deger) + '" placeholder="' + esc(ip || '') + '" maxlength="' + (ml || 40) + '">';
    }
    function formHtml() {
      const s = d.siparis, h = d.hesap, i = d.iptal;
      return '<div class="kart dolgulu" id="fd-form">' +
        '<div class="ayar-bolum" style="margin-top:0;border-top:0;padding-top:0">Genel görünüm</div>' +
        '<div class="fd-alan"><div><label>Yazı boyutu</label>' + sec('yazi', d.yazi, [['kucuk', 'Küçük'], ['normal', 'Normal'], ['buyuk', 'Büyük'], ['cokbuyuk', 'Çok büyük']]) + '</div>' +
        '<div><label>Yazı tipi</label>' + sec('font', d.font, FIS_FONTLAR) + '</div></div>' +
        '<label>Ayırıcı çizgi</label>' + sec('cizgi', d.cizgi, [['kesik', '- - - - kesik çizgi'], ['duz', '——— düz çizgi'], ['yildiz', '*** yıldızlı ***'], ['bosluk', 'çizgisiz (boşluk)']]) +
        '<div class="ayar-bolum">Logo</div>' +
        '<div class="logo-alan">' + (d.logo.veri ? '<div class="logo-onizle"><img src="' + d.logo.veri + '" alt="logo"><small>Fişte bu siyah-beyaz hâli çıkar. Giriş ekranı ve QR menüde renkli hâli görünür.</small></div>' : '<p class="aciklama">Henüz logo yok. PNG/JPG yükle; fiş yazıcısı için otomatik siyah-beyaza çevrilir.</p>') +
        '<input type="file" id="logo-dosya" accept="image/*" style="display:none">' +
        '<div class="btn-satir"><button type="button" class="btn" data-e="logoSec">🖼 ' + (d.logo.veri ? 'Logoyu değiştir' : 'Logo yükle') + '</button>' +
        (d.logo.veri ? '<button type="button" class="btn" data-e="logoSil">🗑 Kaldır</button>' : '') + '</div>' +
        (d.logo.veri ? '<label>Logo boyutu</label>' + sec('logo.boyut', d.logo.boyut, [['kucuk', 'Küçük'], ['orta', 'Orta'], ['buyuk', 'Büyük'], ['tam', 'Tam genişlik']]) +
        (orijinalLogo ? '<label>Koyuluk (siyah-beyaz eşiği)</label><input type="range" id="logo-esik" min="40" max="220" value="' + orijinalLogo.esik + '">' : '') +
        anahtar('logo.hesap', 'Hesap fişinde göster', d.logo.hesap) + anahtar('logo.siparis', 'Sipariş fişinde göster', d.logo.siparis) + anahtar('logo.iptal', 'İptal fişinde göster', d.logo.iptal) : '') +
        '</div>' +
        '<div class="ayar-bolum">Sipariş fişi (mutfak / istasyon)</div>' +
        metin('siparis.ust', 'En üstte ek yazı (isteğe bağlı)', s.ust, 'Örn. BALIK EKİBİ', 30) +
        '<label>Masa adı boyutu</label>' + sec('siparis.masa', s.masa, [['cok', 'Çok büyük'], ['buyuk', 'Büyük'], ['normal', 'Normal']]) +
        '<label>Ürün satırı boyutu</label>' + sec('siparis.kalem', s.kalem, [['buyuk', 'Büyük (önerilen)'], ['normal', 'Normal']]) +
        anahtar('siparis.istasyon', 'İstasyon adı (» Mutfak «)', s.istasyon) +
        anahtar('siparis.no', 'Sipariş numarası', s.no) +
        anahtar('siparis.garson', 'Garson adı', s.garson) +
        anahtar('siparis.saat', 'Saat (garsonun yanında)', s.saat) +
        anahtar('siparis.tarih', 'Alt satırda tarih ve saat', s.tarih) +
        metin('siparis.alt', 'En altta ek yazı (isteğe bağlı)', s.alt, 'Örn. Servise hazır', 40) +
        '<div class="ayar-bolum">Hesap fişi (müşteriye)</div>' +
        anahtar('hesap.isletme', 'İşletme adı başlıkta görünsün', h.isletme) +
        metin('isletme_adi', 'İşletme adı', d.isletme_adi, 'Yavuztürk Süleymaniye', 40) +
        [0, 1, 2].map((n) => metin('ust.' + n, n === 0 ? 'Başlık altı satır 1 (adres, telefon…)' : 'Başlık altı satır ' + (n + 1), d.ust[n], n === 0 ? 'Örn. Süleymaniye / İstanbul' : n === 1 ? 'Örn. Tel: 0212 000 00 00' : '', 40)).join('') +
        anahtar('hesap.birim', 'Ürünlerin birim fiyatı yazsın (2 x 180,00)', h.birim) +
        anahtar('hesap.garson', 'Garson adı', h.garson) +
        anahtar('hesap.tarih', 'Tarih', h.tarih) +
        anahtar('hesap.odemeler', 'Ödeme satırları (nakit/kart…)', h.odemeler) +
        metin('fis_alt_yazi', 'Alt yazı', d.fis_alt_yazi, 'Afiyet olsun!', 50) +
        metin('hesap.alt2', 'İkinci alt yazı (isteğe bağlı)', h.alt2, 'Örn. Instagram: @yavuzturk', 50) +
        metin('hesap.mali', 'En alttaki küçük not (boşsa yazılmaz)', h.mali, 'Mali değeri yoktur', 40) +
        '<div class="ayar-bolum">İptal fişi</div>' +
        anahtar('iptal.garson', 'Garson adı', i.garson) +
        anahtar('iptal.neden', 'İptal nedeni', i.neden) +
        '<div class="btn-satir" style="margin-top:16px"><button class="btn ana" data-e="kaydet">💾 Kaydet</button>' +
        '<button class="btn" data-e="sifirla">↺ Varsayılana dön</button></div>' +
        '<p class="aciklama">Kaydedince kasa ekranı yeni tasarımı en geç yarım dakika içinde alır (ya da kasa sayfasını yenile). Bir sonraki fiş yeni görünümle çıkar.</p></div>';
    }
    function onizlemeHtml() {
      const f = ORNEK[sek];
      return '<div class="kart dolgulu fd-onizleme"><div class="fd-sekme">' +
        [['siparis', 'Sipariş'], ['hesap', 'Hesap'], ['iptal', 'İptal']].map(([k, e]) => '<button type="button" class="secenek' + (sek === k ? ' aktif' : '') + '" data-e="sek" data-s="' + k + '">' + e + '</button>').join('') + '</div>' +
        '<div id="fd-kagit" class="fd-kagit k' + genislik + '" style="--taban:' + (genislik === 58 ? 11 : 12.5) + 'px">' + fisHtml(f, taslakAy()) + '</div>' +
        '<div class="btn-satir" style="margin-top:12px"><button class="btn koyu" data-e="yazdir">🖨️ Bu cihazın yazıcısından dene</button></div>' +
        '<p class="aciklama">Önizleme ' + genislik + ' mm kâğıda göredir (Yönetim › Ayarlar\'dan değişir). Örnek veriyle çizilmiştir.</p></div>';
    }
    function ciz() {
      $app.innerHTML = ustBar('Fiş Tasarımı', '', geriBtn('/masalar'), '<button class="ust-btn" data-e="menu">☰</button>') +
        '<main class="icerik"><div class="fd-grid"><div>' + formHtml() + '</div><div id="fd-sag">' + onizlemeHtml() + '</div></div></main>';
      const form = document.getElementById('fd-form');
      const guncelle = (e) => {
        const el = e.target.closest('[data-k]'); if (!el) return;
        const yol = el.dataset.k.split('.');
        const deger = el.type === 'checkbox' ? el.checked : el.value;
        if (yol.length === 2 && yol[0] === 'ust') d.ust[Number(yol[1])] = deger;
        else if (yol.length === 2) d[yol[0]][yol[1]] = deger;
        else d[yol[0]] = deger;
        const k = document.getElementById('fd-kagit');
        if (k) { k.innerHTML = fisHtml(ORNEK[sek], taslakAy()); }
      };
      form.addEventListener('input', guncelle); form.addEventListener('change', guncelle);
      const dosya = document.getElementById('logo-dosya');
      if (dosya) dosya.addEventListener('change', () => {
        const f = dosya.files && dosya.files[0]; if (!f) return;
        if (f.size > 8 * 1024 * 1024) { bildir('Dosya çok büyük (en fazla 8 MB)', 'hata'); return; }
        resimAc(f).then((im) => {
          const c = logoTuval(im, 384);
          orijinalLogo = { c, esik: 150 }; renkliLogo = c.toDataURL('image/png'); d.logo.kapali = false; logoUygula(); ciz();
        }).catch((err) => hata(err));
      });
      const esik = document.getElementById('logo-esik');
      if (esik) esik.addEventListener('input', () => { orijinalLogo.esik = Number(esik.value); logoUygula(); const k = document.getElementById('fd-kagit'); if (k) k.innerHTML = fisHtml(ORNEK[sek], taslakAy()); const lo = document.querySelector('.logo-onizle img'); if (lo) lo.src = d.logo.veri; });
    }
    function logoUygula() {
      const c = orijinalLogo.c; const x = c.getContext('2d', { willReadFrequently: true });
      const id = x.getImageData(0, 0, c.width, c.height); const p = id.data;
      const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const ox = o.getContext('2d');
      const od = ox.createImageData(c.width, c.height);
      for (let i = 0; i < p.length; i += 4) {
        const l = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; const v = l < orijinalLogo.esik ? 0 : 255;
        od.data[i] = od.data[i + 1] = od.data[i + 2] = v; od.data[i + 3] = 255;
      }
      ox.putImageData(od, 0, 0); d.logo.veri = o.toDataURL('image/png');
    }
    function sablonKaydi() { return { yazi: d.yazi, font: d.font, cizgi: d.cizgi, ust: d.ust, siparis: d.siparis, hesap: d.hesap, iptal: d.iptal, logo: d.logo }; }
    eylemBagla(Object.assign({}, ortakEylemler, {
      logoSec: () => { const f = document.getElementById('logo-dosya'); if (f) f.click(); },
      logoSil: () => { d.logo.veri = ''; d.logo.kapali = true; renkliLogo = ''; orijinalLogo = null; ciz(); },
      sek: (el) => { sek = el.dataset.s; document.getElementById('fd-sag').innerHTML = onizlemeHtml(); },
      kaydet: (el) => bekle(el, async () => {
        if (d.logo.veri && d.logo.veri.length > 150000) { bildir('Logo çok büyük, daha basit bir resim dene', 'hata'); return; }
        const veri = { isletme_adi: d.isletme_adi.trim() || 'Yavuztürk Süleymaniye', fis_alt_yazi: d.fis_alt_yazi.trim(), fis_sablon: sablonKaydi(), logo: d.logo.veri && renkliLogo ? renkliLogo : null };
        if (veri.logo && veri.logo.length > 150000) { bildir('Logo çok büyük, daha basit bir resim dene', 'hata'); return; }
        try { await q(db.from('ads_ayarlar').update(veri).eq('id', 1)); Object.assign(S.ayarlar, veri); LS.yaz('ads_logo', veri.logo || ''); bildir('Fiş tasarımı kaydedildi', 'basari'); } catch (err) { hata(err); }
      }),
      sifirla: () => {
        if (!window.confirm('Fiş tasarımı varsayılana dönsün mü? (Kaydedene kadar kasaya yansımaz)')) return;
        const v = fisSablon({});
        Object.assign(d, { yazi: v.yazi, font: v.font, cizgi: v.cizgi, ust: ['', '', ''], siparis: v.siparis, hesap: v.hesap, iptal: v.iptal, logo: Object.assign({}, v.logo) });
        orijinalLogo = null; ciz();
      },
      yazdir: () => {
        fisStiliAyarla();
        $fis.innerHTML = ['siparis', 'hesap', 'iptal'].map((k) => fisHtml(ORNEK[k], taslakAy())).join('');
        resimleriBekle($fis).then(() => { try { window.print(); } catch (e) { /* */ } });
      }
    }));
    ciz();
  }

  // ---------------------------------------------------------------
  // SESLER: hazır sesler (WebAudio ile üretilir) + yüklenen kendi sesler
  // ---------------------------------------------------------------
  // not: [frekans Hz, başlangıç sn, süre sn, dalga, güç]
  const SES_HAZIR = [
    { id: 'zil', ad: '🔔 Zil', n: [[1319, 0, 1.3, 'sine', 1], [2637, 0, .7, 'sine', .35], [1319, .55, 1.3, 'sine', .8], [2637, .55, .6, 'sine', .3]] },
    { id: 'ding', ad: '✨ Ding', n: [[1568, 0, 1.2, 'sine', 1], [3136, 0, .5, 'sine', .25]] },
    { id: 'servis', ad: '🛎 Servis zili', n: [[1760, 0, .35, 'triangle', 1], [1760, .22, .5, 'triangle', 1], [3520, 0, .2, 'sine', .2], [3520, .22, .3, 'sine', .2]] },
    { id: 'melodi', ad: '🎵 Melodi', n: [[523, 0, .3, 'sine', 1], [659, .14, .3, 'sine', 1], [784, .28, .3, 'sine', 1], [1047, .42, .6, 'sine', 1]] },
    { id: 'kasa', ad: '💰 Kasa (şıngır)', n: [[1175, 0, .12, 'square', .5], [1568, .1, .12, 'square', .5], [2349, .2, .7, 'triangle', .8], [4698, .2, .4, 'sine', .15]] },
    { id: 'gong', ad: '🥁 Gong', n: [[196, 0, 2, 'sine', 1], [392, 0, 1.4, 'sine', .5], [588, 0, 1, 'sine', .25]] },
    { id: 'bip', ad: '📟 Kısa bip', n: [[880, 0, .18, 'sine', 1]] },
    { id: 'cift', ad: '📟 Çift bip', n: [[988, 0, .12, 'sine', 1], [988, .2, .12, 'sine', 1]] },
    { id: 'alarm', ad: '🚨 Alarm', n: [[880, 0, .18, 'square', .5], [660, .2, .18, 'square', .5], [880, .4, .18, 'square', .5], [660, .6, .18, 'square', .5]] },
    { id: 'sessiz', ad: '🔇 Sessiz', n: [] }
  ];
  const SES_OLAY = [
    ['siparis', '🍽 Yeni sipariş geldiğinde', 'zil'],
    ['iptal', '❌ İptal geldiğinde', 'alarm'],
    ['hesap', '🧾 Hesap / rapor fişi geldiğinde', 'sessiz']
  ];
  let sesCtx = null; let sesOzel = [];
  function sesHazirla() {
    try {
      if (!sesCtx) sesCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (sesCtx.state === 'suspended') sesCtx.resume();
    } catch (e) { /* */ }
  }
  async function sesOzelYukle() {
    try { sesOzel = await q(db.from('ads_sesler').select('id, ad, veri').order('olusturma')); } catch (e) { sesOzel = []; }
    return sesOzel;
  }
  function sesAyari(olay) {
    const v = (S.ayarlar && S.ayarlar.ses_ayar && S.ayarlar.ses_ayar[olay]) || {};
    const vars = SES_OLAY.find((o) => o[0] === olay);
    return { ses: v.ses || (vars ? vars[2] : 'bip'), vol: v.vol != null ? Number(v.vol) : 80 };
  }
  function sesCal(secim, vol) {
    const seviye = Math.max(0, Math.min(100, Number(vol != null ? vol : 80))) / 100;
    if (!secim || secim === 'sessiz') return;
    if (String(secim).indexOf('o:') === 0) {
      const o = sesOzel.find((x) => 'o:' + x.id === secim);
      if (!o) return;
      try { const a = new Audio(o.veri); a.volume = seviye; a.play().catch(() => {}); } catch (e) { /* */ }
      return;
    }
    const h = SES_HAZIR.find((x) => x.id === secim);
    if (!h || !h.n.length) return;
    sesHazirla();
    if (!sesCtx) return;
    try {
      const t0 = sesCtx.currentTime + 0.02;
      h.n.forEach(([f, bas, sure, dalga, guc]) => {
        const o = sesCtx.createOscillator(); const g = sesCtx.createGain();
        o.type = dalga; o.frequency.value = f;
        const tepe = 0.3 * seviye * guc;
        g.gain.setValueAtTime(0.0001, t0 + bas);
        g.gain.exponentialRampToValueAtTime(Math.max(tepe, 0.0002), t0 + bas + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + bas + sure);
        o.connect(g); g.connect(sesCtx.destination);
        o.start(t0 + bas); o.stop(t0 + bas + sure + 0.05);
      });
    } catch (e) { /* */ }
  }
  // fiş listesine göre kasada hangi ses çalsın (iptal > sipariş > hesap)
  function fisSesiCal(liste) {
    const var_ = (t) => liste.some((f) => f.tur === t);
    const olay = var_('iptal') ? 'iptal' : var_('siparis') ? 'siparis' : (var_('hesap') || var_('rapor')) ? 'hesap' : null;
    if (!olay) return;
    const a = sesAyari(olay); sesCal(a.ses, a.vol);
  }

  async function seslerSayfa() {
    const SINIR = 500 * 1024;
    $app.innerHTML = ustBar('Sesler', 'Kasa bildirim sesleri', geriBtn('/yonetim'), '<button class="ust-btn" data-e="menu">☰</button>') +
      '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { await Promise.all([ayarlariYukle(), sesOzelYukle()]); } catch (e) { return hata(e); }
    const secenekler = (secili) => '<optgroup label="Hazır sesler">' + SES_HAZIR.map((s) => '<option value="' + s.id + '"' + (secili === s.id ? ' selected' : '') + '>' + esc(s.ad.replace(/^\S+\s/, '')) + '</option>').join('') + '</optgroup>' +
      (sesOzel.length ? '<optgroup label="Yüklediklerim">' + sesOzel.map((s) => '<option value="o:' + s.id + '"' + (secili === 'o:' + s.id ? ' selected' : '') + '>' + esc(s.ad) + '</option>').join('') + '</optgroup>' : '');
    function ciz() {
      $app.innerHTML = ustBar('Sesler', 'Kasa bildirim sesleri', geriBtn('/yonetim'), '<button class="ust-btn" data-e="menu">☰</button>') +
        '<main class="icerik">' +
        '<p class="aciklama" style="margin:0 2px 10px">Bu sesler <b>Kasa / Yazıcı</b> ekranı açık olan bilgisayarda çalar. Seçtiğin an kaydolur, ▶ ile dinleyebilirsin.</p>' +
        SES_OLAY.map(([k, baslik]) => { const a = sesAyari(k); return '<div class="kart dolgulu ses-kart" style="margin-bottom:10px"><b>' + baslik + '</b>' +
          '<div class="ses-satir"><select data-ses-sec="' + k + '">' + secenekler(a.ses) + '</select>' +
          '<button class="btn" data-e="dinle" data-k="' + k + '" aria-label="Dinle">▶</button></div>' +
          '<label class="ses-vol"><span>🔈 Ses seviyesi %<b id="vol-' + k + '">' + a.vol + '</b></span><input type="range" min="10" max="100" step="5" value="' + a.vol + '" data-ses-vol="' + k + '"></label></div>'; }).join('') +
        '<div class="bolum-baslik">Kendi sesini ekle</div>' +
        '<div class="kart dolgulu"><p class="aciklama" style="margin-top:0">MP3, WAV, OGG… en fazla 500 KB (kısa bir zil sesi yeter). Telefonundan veya bilgisayarından seçebilirsin.</p>' +
        '<input type="file" id="ses-dosya" accept="audio/*" style="display:none">' +
        '<button class="btn ana tam" data-e="dosyaSec">⬆️ Ses dosyası yükle</button>' +
        (sesOzel.length ? '<div class="kart" style="margin-top:12px">' + sesOzel.map((s) => '<div class="satir"><div class="sol"><div class="ad">🎶 ' + esc(s.ad) + '</div></div>' +
          '<button class="btn kucuk" data-e="ozelDinle" data-id="' + s.id + '">▶</button><button class="btn kucuk tehlike" data-e="ozelSil" data-id="' + s.id + '">Sil</button></div>').join('') + '</div>' : '') +
        '</div></main>';
      const dosya = document.getElementById('ses-dosya');
      if (dosya) dosya.onchange = async () => {
        const f = dosya.files && dosya.files[0]; if (!f) return;
        if (f.size > SINIR) return bildir('Dosya çok büyük (' + Math.round(f.size / 1024) + ' KB). En fazla 500 KB.', 'hata');
        try {
          const veri = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
          if (String(veri).indexOf('data:audio') !== 0 && String(veri).indexOf('data:application/ogg') !== 0 && String(veri).indexOf('data:video') !== 0) return bildir('Bu bir ses dosyası değil.', 'hata');
          await q(db.from('ads_sesler').insert({ ad: f.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Ses', veri }));
          await sesOzelYukle(); bildir('Ses eklendi', 'basari'); ciz();
        } catch (e) { hata(e); }
      };
    }
    async function kaydet(k, parca) {
      const yeni = Object.assign({}, (S.ayarlar.ses_ayar || {}));
      yeni[k] = Object.assign({}, sesAyari(k), parca);
      try { await q(db.from('ads_ayarlar').update({ ses_ayar: yeni }).eq('id', 1)); S.ayarlar.ses_ayar = yeni; return true; } catch (e) { hata(e); return false; }
    }
    $app.onchange = async (e) => {
      const t = e.target;
      if (t.dataset.sesSec) { if (await kaydet(t.dataset.sesSec, { ses: t.value })) { const a = sesAyari(t.dataset.sesSec); sesCal(a.ses, a.vol); bildir('Kaydedildi', 'basari'); } }
      else if (t.dataset.sesVol) { if (await kaydet(t.dataset.sesVol, { vol: Number(t.value) })) { const a = sesAyari(t.dataset.sesVol); sesCal(a.ses, a.vol); } }
    };
    $app.oninput = (e) => { const t = e.target; if (t.dataset && t.dataset.sesVol) { const b = document.getElementById('vol-' + t.dataset.sesVol); if (b) b.textContent = t.value; } };
    eylemBagla(Object.assign({}, ortakEylemler, {
      dinle: (el) => { const a = sesAyari(el.dataset.k); sesCal(a.ses, a.vol); },
      dosyaSec: () => document.getElementById('ses-dosya').click(),
      ozelDinle: (el) => sesCal('o:' + el.dataset.id, 90),
      ozelSil: async (el) => {
        const id = el.dataset.id;
        if (!await onayla('Bu ses silinsin mi?', 'Bir olay için seçiliyse hazır sese döner.', 'Sil', true)) return;
        try {
          await q(db.from('ads_sesler').delete().eq('id', id));
          const yeni = Object.assign({}, S.ayarlar.ses_ayar || {}); let degisti = false;
          Object.keys(yeni).forEach((k) => { if (yeni[k] && yeni[k].ses === 'o:' + id) { yeni[k] = Object.assign({}, yeni[k], { ses: (SES_OLAY.find((o) => o[0] === k) || [0, 0, 'bip'])[2] }); degisti = true; } });
          if (degisti) { await q(db.from('ads_ayarlar').update({ ses_ayar: yeni }).eq('id', 1)); S.ayarlar.ses_ayar = yeni; }
          await sesOzelYukle(); ciz();
        } catch (e) { hata(e); }
      }
    }));
    ciz();
  }

  // ---------------------------------------------------------------
  // GENEL PANEL: sağ üstteki 📊 — satış, yoğunluk, ödeme, ürün, garson grafikleri
  // ---------------------------------------------------------------
  async function panelSayfa() {
    const baslik = (alt) => ustBar('Genel Panel', alt || '', geriBtn('/masalar'), '<button class="ust-btn" data-e="menu">☰</button>');
    $app.innerHTML = baslik() + '<main class="icerik"><div class="bos">Yükleniyor…</div></main>';
    try { await Promise.all([ayarlariYukle(), gunleriYukle()]); } catch (e) { hata(e); }
    const gunStr = (d) => tarihAnahtar(d);
    const bugun = () => isGunu(new Date());
    const oncekiG = (g) => { const d = new Date(g + 'T12:00:00'); d.setDate(d.getDate() - 1); return gunStr(d); };
    let aralik = LS.al('ads_panel_aralik', manuelMod() ? 'acik' : 'bugun');
    if (aralik === 'acik' && !manuelMod()) aralik = 'bugun';
    const yg = { olcu: 'siparis', dakika: 60 };
    let R = null; let bas; let son; let donem = null; let yukleniyor = false;

    function araligiKur() {
      donem = null; const d = new Date();
      if (aralik === 'acik' && manuelMod()) { donem = acikDonem(); bas = son = donem.etiket; }
      else if (aralik === 'dun') { if (manuelMod() && sonKapaliDonem()) { donem = sonKapaliDonem(); bas = son = donem.etiket; } else bas = son = oncekiG(bugun()); }
      else if (aralik === 'hafta') { son = bugun(); d.setDate(d.getDate() - 6); bas = gunStr(d); }
      else if (aralik === 'ay') { son = bugun(); bas = gunStr(new Date(d.getFullYear(), d.getMonth(), 1)); }
      else { bas = son = bugun(); if (manuelMod()) donem = acikDonem(); }
    }
    const aralikYazisi = () => donem ? donemYazi(donem) : (bas === son ? trGun(bas) + ' ' + gunAdi(bas) : trGun(bas) + ' – ' + trGun(son));

    async function yenile() {
      yukleniyor = true; araligiKur(); ciz();
      try { R = await raporVerisiGetir(bas, son, donem); } catch (e) { hata(e); }
      yukleniyor = false; ciz();
    }

    function kpiHtml() {
      const hesapSay = R.hesaplar.length; const ort = hesapSay ? R.satis / hesapSay : 0;
      const sip = new Set((R.kalemler || []).map((k) => k.no)).size;
      const Y = yogunlukHesapla(R, 'siparis', 60); let zirve = '—'; let zirveAlt = '';
      if (!Y.bos) { const mx = Math.max(...Y.dizi); const i = Y.dizi.indexOf(mx); zirve = bucketSaati(Y, i); zirveAlt = mx + ' sipariş'; }
      return '<div class="kpi">' +
        '<div class="kutu vurgu"><span>Satış toplamı</span><b>' + para(R.satis) + '</b><small>' + hesapSay + ' hesap</small></div>' +
        '<div class="kutu"><span>Tahsilat</span><b>' + para(R.odeme.nakit + R.odeme.kart) + '</b><small>nakit ' + para(R.odeme.nakit) + ' · kart ' + para(R.odeme.kart) + '</small></div>' +
        '<div class="kutu"><span>Ortalama hesap</span><b>' + para(ort) + '</b><small>' + sip + ' sipariş</small></div>' +
        '<div class="kutu"><span>En yoğun saat</span><b>' + zirve + '</b><small>' + zirveAlt + '</small></div>' +
        '<div class="kutu"><span>İptal</span><b>' + para(R.iptalToplam) + '</b><small>' + R.iptaller.length + ' kalem</small></div></div>';
    }
    function ciz() {
      const chip = (k, e) => '<button class="cip' + (aralik === k ? ' aktif' : '') + '" data-e="pAralik" data-a="' + k + '">' + e + '</button>';
      $app.innerHTML = baslik(R || yukleniyor ? aralikYazisi() : '') + '<main class="icerik">' +
        '<div class="mini-cipler" style="margin-bottom:12px">' + (manuelMod() ? chip('acik', 'Açık gün') : chip('bugun', 'Bugün')) + chip('dun', 'Dün') + chip('hafta', 'Son 7 gün') + chip('ay', 'Bu ay') +
        '<span style="flex:1"></span><button class="cip" data-e="git" data-hedef="/karsilastirma">📈 Haftalar</button><button class="cip" data-e="git" data-hedef="/rapor">🧾 Rapor</button></div>' +
        (!R || yukleniyor ? '<div class="bos">Yükleniyor…</div>' :
          (R.acikSayi ? '<div class="kart dolgulu" style="border-left:3px solid var(--turuncu)"><b>Şu an ' + R.acikSayi + ' açık hesap var</b> · ' + para(R.acikToplam) + ' henüz tahsil edilmedi (grafiklere girmez).</div>' : '') +
          kpiHtml() + grafikBolumuHtml(R, yg)) + '</main>';
    }
    eylemBagla(Object.assign({}, ortakEylemler, {
      pAralik: (el) => { aralik = el.dataset.a; LS.yaz('ads_panel_aralik', aralik); yenile(); },
      ygOlcu: (el) => { yg.olcu = el.dataset.v; ciz(); },
      ygDakika: (el) => { yg.dakika = Number(el.dataset.v); ciz(); }
    }));
    sayfaTemizle = () => { clearInterval(tazele); };
    const tazele = setInterval(() => { if (!document.hidden && !yukleniyor && aralik !== 'dun') { raporVerisiGetir(bas, son, donem).then((x) => { R = x; ciz(); }).catch(() => {}); } }, 60000);
    yenile();
  }

  // ---------------------------------------------------------------
  // BAŞLAT
  // ---------------------------------------------------------------
  async function basla() {
    if (!window.supabase) {
      $app.innerHTML = '<div class="giris-sayfa"><div class="giris-kutu"><h1>Bağlantı hatası</h1><p>Sayfa yüklenemedi. İnterneti kontrol edip sayfayı yenile.</p>' +
        '<button class="btn ana tam" onclick="location.reload()">Yenile</button></div></div>';
      return;
    }
    if (AYAR.SUPABASE_URL && !/PROJE-KODUN/.test(AYAR.SUPABASE_URL)) istemciKur();
    if (token && db) {
      // oturum hâlâ geçerli mi? (bağlantı yoksa elimizdekiyle devam)
      try { ben = await rpc('ads_ben'); LS.yaz('ads_ben', ben); temaUygula(); }
      catch (e) {
        if (/OTURUM/.test((e && e.message) || '')) { token = null; ben = null; LS.sil('ads_token'); LS.sil('ads_ben'); istemciKur(); }
      }
    }
    yonlendir();
  }
  basla();
})();
