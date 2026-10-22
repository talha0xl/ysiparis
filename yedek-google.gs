/* =====================================================================
   YAVUZTÜRK ADİSYON — OTOMATİK YEDEK (Google Apps Script)
   Her gün kapanınca o günün bütün hareketlerini:
     • Google Drive'da "Yavuztürk Adisyon Yedekleri" klasörüne tablo olarak kaydeder
     • E-postana özet + Excel eki olarak gönderir
   Kurulum: script.google.com → Yeni proje → bu kodun tamamını yapıştır →
            Kaydet → üstte "kurulum" seçili iken ▶ Çalıştır → izin ver.
   Hazırlayan: M. Talha Erbil
   ===================================================================== */

const AYAR = {
  SUPABASE_URL: '__SUPABASE_URL__',
  SUPABASE_KEY: '__SUPABASE_KEY__',
  YEDEK_ANAHTAR: '__YEDEK_ANAHTAR__',
  EPOSTA: '__EPOSTA__',
  KLASOR: 'Yavuztürk Adisyon Yedekleri',
  SAAT_DILIMI: 'Europe/Istanbul',
  KONTROL_DAKIKA: 15
};

/* ---------- 1) BİR KERE ÇALIŞTIR ---------- */
function kurulum() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'yedekKontrol') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('yedekKontrol').timeBased().everyMinutes(AYAR.KONTROL_DAKIKA).create();
  rpc_('ads_yedek_veri', { p_anahtar: AYAR.YEDEK_ANAHTAR, p_max: 1, p_simdi: true }); // bağlantı testi
  klasor_();
  MailApp.sendEmail({
    to: AYAR.EPOSTA,
    subject: '✓ Adisyon otomatik yedek kuruldu',
    htmlBody: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2433">' +
      '<h2 style="color:#28334A;margin:0 0 8px">Otomatik yedek kuruldu ✓</h2>' +
      '<p>Her gün kapandıktan sonra en geç ' + AYAR.KONTROL_DAKIKA + ' dakika içinde o günün raporu bu adrese gelecek ve ' +
      'Google Drive\'daki <b>' + AYAR.KLASOR + '</b> klasörüne kaydedilecek.</p>' +
      '<p>Hemen bir deneme görmek istersen Apps Script\'te <b>simdiDene</b> fonksiyonunu çalıştır.</p>' +
      '<p style="color:#6b7282;font-size:12px">Yavuztürk Adisyon · Hazırlayan: M. Talha Erbil</p></div>',
    name: 'Yavuztürk Adisyon'
  });
  Logger.log('Kurulum tamam. Kontrol her ' + AYAR.KONTROL_DAKIKA + ' dakikada bir çalışacak.');
}

/* ---------- 2) İSTERSEN: açık günün şu ana kadarki raporunu hemen gönder ---------- */
function simdiDene() {
  const liste = rpc_('ads_yedek_veri', { p_anahtar: AYAR.YEDEK_ANAHTAR, p_max: 1, p_simdi: true });
  if (!liste || !liste.length) { Logger.log('Veri yok.'); return; }
  const g = liste[0];
  if (!g.hareketler.length) { Logger.log('Açık günde henüz hareket yok.'); }
  const sonuc = gunuYedekle_(g, true);
  Logger.log('Deneme gönderildi: ' + sonuc.url);
}

/* ---------- Otomatik: her 15 dakikada bir ---------- */
function yedekKontrol() {
  const kilit = LockService.getScriptLock();
  if (!kilit.tryLock(10000)) return;
  try {
    const liste = rpc_('ads_yedek_veri', { p_anahtar: AYAR.YEDEK_ANAHTAR, p_max: 3, p_simdi: false }) || [];
    liste.forEach(function (g) {
      const sonuc = gunuYedekle_(g, false);
      rpc_('ads_yedek_tamam', {
        p_anahtar: AYAR.YEDEK_ANAHTAR, p_gun: g.anahtar, p_etiket: g.etiket,
        p_bas: g.bas, p_bit: g.bit, p_satir: g.hareketler.length, p_dosya: sonuc.url
      });
    });
  } finally {
    kilit.releaseLock();
  }
}

/* =====================================================================
   İÇ İŞLER
   ===================================================================== */
function rpc_(ad, govde) {
  const r = UrlFetchApp.fetch(AYAR.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/' + ad, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: AYAR.SUPABASE_KEY, Authorization: 'Bearer ' + AYAR.SUPABASE_KEY },
    payload: JSON.stringify(govde)
  });
  const kod = r.getResponseCode(); const metin = r.getContentText();
  if (kod >= 300) {
    let mesaj = metin;
    try { mesaj = JSON.parse(metin).message || metin; } catch (e) { /* düz metin */ }
    throw new Error('Adisyon sunucusu (' + ad + '): ' + mesaj);
  }
  return metin ? JSON.parse(metin) : null;
}

function klasor_() {
  const it = DriveApp.getFoldersByName(AYAR.KLASOR);
  return it.hasNext() ? it.next() : DriveApp.createFolder(AYAR.KLASOR);
}

const GUNLER_ = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const ODEME_ = { nakit: 'Nakit', kart: 'Kart', ikram: 'İkram', indirim: 'İndirim', garson_ikram: 'Garson ikramı' };
const HAREKET_ = {
  giris: 'Giriş', hesap_acildi: 'Hesap açıldı', siparis: 'Sipariş', iptal: 'İptal', odeme: 'Ödeme',
  odeme_silindi: 'Ödeme silindi', odeme_duzeltme: 'Ödeme düzeltme', ara_hesap: 'Ara hesap fişi',
  hesap_kapandi: 'Hesap kapandı', hesap_iptal: 'Hesap iptal', hesap_geri_acildi: 'Hesap geri açıldı',
  masa_tasindi: 'Masa taşındı', personel_indirimi: 'Personel indirimi', paket_acildi: 'Paket açıldı',
  paket_silindi: 'Paket silindi', gun_sonu: 'Gün sonu', yedek: 'Yedek'
};
function gunAdi_(etiket) { const p = etiket.split('-').map(Number); return GUNLER_[new Date(p[0], p[1] - 1, p[2], 12).getDay()]; }
function trTarih_(etiket) { return etiket.split('-').reverse().join('.'); }
function tarihStr_(d, bicim) { return Utilities.formatDate(new Date(d), AYAR.SAAT_DILIMI, bicim || 'dd.MM.yyyy HH:mm'); }
function r2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function tl_(n) {
  const v = r2_(n); const neg = v < 0; const p = Math.abs(v).toFixed(2).split('.');
  return (neg ? '−' : '') + p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (p[1] === '00' ? '' : ',' + p[1]) + ' ₺';
}
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

/* Bir günün hareketlerinden özet çıkarır (uygulamadaki raporla aynı kurallar) */
function hesapla_(g) {
  const H = g.hareketler;
  const R = { satis: 0, net: 0, personel: 0, od: { nakit: 0, kart: 0, ikram: 0, indirim: 0, garson_ikram: 0 },
    urun: {}, garson: {}, hediye: {}, iptaller: [], odemeler: [], kapanan: 0, kapananNet: 0, acilan: 0, paket: 0, siparisAdet: 0, iptalAdet: 0, iptalTutar: 0 };
  H.forEach(function (h) {
    if (h.tur === 'siparis' || h.tur === 'iptal') {
      const t = Number(h.tutar) || 0; const net = t * (100 - (Number(h.oran) || 0)) / 100; const adet = Number(h.adet) || 0;
      R.satis += t; R.net += net; R.personel += t - net;
      const u = R.urun[h.urun] = R.urun[h.urun] || { kategori: h.kategori || '', adet: 0, tutar: 0, iptal: 0 };
      u.adet += adet; u.tutar += t;
      const gad = (h.tur === 'iptal' ? h.siparisi_giren : null) || h.garson || '—';
      const w = R.garson[gad] = R.garson[gad] || { adet: 0, tutar: 0, hesap: {}, iptalYapti: 0 };
      w.adet += adet; w.tutar += net;
      if (h.tur === 'siparis') R.siparisAdet += adet;
      if (h.tur === 'iptal') { R.iptalAdet -= adet; R.iptalTutar -= t; u.iptal -= adet; R.iptaller.push(h); }
    }
    if (h.tur === 'iptal' && h.garson) { const w2 = R.garson[h.garson] = R.garson[h.garson] || { adet: 0, tutar: 0, hesap: {}, iptalYapti: 0 }; w2.iptalYapti -= Number(h.adet) || 0; }
    if (/^odeme/.test(h.tur)) {
      R.od[h.odeme] = (R.od[h.odeme] || 0) + (Number(h.tutar) || 0); R.odemeler.push(h);
      if (h.tur === 'odeme' && h.odeme === 'garson_ikram') { const k = String(h.aciklama || '').replace(' hediye hakkından', '') || '—'; R.hediye[k] = (R.hediye[k] || 0) + Number(h.tutar); }
    }
    if (h.tur === 'hesap_kapandi') { R.kapanan++; R.kapananNet += Number(h.tutar) || 0; }
    if (h.tur === 'hesap_acildi') { R.acilan++; if (h.masa_tur === 'paket') R.paket++; const w3 = R.garson[h.garson] = R.garson[h.garson] || { adet: 0, tutar: 0, hesap: {}, iptalYapti: 0 }; w3.hesap[h.hesap] = 1; }
  });
  R.tahsilat = R.od.nakit + R.od.kart;
  return R;
}

function gunuYedekle_(g, deneme) {
  const R = hesapla_(g);
  const baslik = (deneme ? 'DENEME · ' : '') + 'Adisyon ' + g.etiket + ' ' + gunAdi_(g.etiket);
  const ss = SpreadsheetApp.create(baslik);
  ss.setSpreadsheetTimeZone(AYAR.SAAT_DILIMI);
  DriveApp.getFileById(ss.getId()).moveTo(klasor_());
  sayfalariYaz_(ss, g, R, deneme);
  SpreadsheetApp.flush();
  const ek = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx', {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  }).getBlob().setName(baslik.replace(/[·]/g, '-') + '.xlsx');
  MailApp.sendEmail({
    to: AYAR.EPOSTA,
    subject: (deneme ? '[DENEME] ' : '') + 'Gün sonu · ' + trTarih_(g.etiket) + ' ' + gunAdi_(g.etiket) + ' · ' + tl_(R.kapananNet),
    htmlBody: epostaHtml_(g, R, ss.getUrl(), deneme),
    attachments: [ek],
    name: 'Yavuztürk Adisyon'
  });
  return { url: ss.getUrl() };
}

/* ---------- Drive'daki tablo ---------- */
function sayfaYaz_(sh, basliklar, satirlar, bicimler) {
  const tum = [basliklar].concat(satirlar.length ? satirlar : [basliklar.map(function (_, i) { return i === 0 ? 'Kayıt yok' : ''; })]);
  sh.getRange(1, 1, tum.length, basliklar.length).setValues(tum);
  sh.getRange(1, 1, 1, basliklar.length).setFontWeight('bold').setFontColor('#ffffff').setBackground('#28334A');
  sh.setFrozenRows(1);
  (bicimler || []).forEach(function (b, i) { if (b && tum.length > 1) sh.getRange(2, i + 1, tum.length - 1, 1).setNumberFormat(b); });
  if (satirlar.length) sh.getRange(1, 1, tum.length, basliklar.length).createFilter();
  sh.autoResizeColumns(1, basliklar.length);
}

function sayfalariYaz_(ss, g, R, deneme) {
  const TL = '#,##0.00 "₺";[Red]-#,##0.00 "₺"'; const AD = '#,##0;[Red]-#,##0'; const ZAMAN = 'dd.mm.yyyy hh:mm:ss';
  const ozet = ss.getSheets()[0]; ozet.setName('Özet');
  const satir = [
    ['Gün', trTarih_(g.etiket) + ' ' + gunAdi_(g.etiket) + (deneme ? ' (DENEME - gün henüz kapanmadı)' : '')],
    ['Aralık', tarihStr_(g.bas) + ' – ' + tarihStr_(g.bit)],
    ['Gün sonu modu', g.mod === 'manuel' ? 'Manuel' : 'Otomatik'],
    ['', ''],
    ['Kapanan hesaplar toplamı', r2_(R.kapananNet)], ['Girilen siparişler (iptaller düşülmüş)', r2_(R.net)], ['Personel indirimi', r2_(R.personel)],
    ['Nakit', r2_(R.od.nakit)], ['Kart', r2_(R.od.kart)], ['TAHSİLAT (nakit + kart)', r2_(R.tahsilat)],
    ['İkram', r2_(R.od.ikram)], ['İndirim', r2_(R.od.indirim)], ['Garson hediye ikramı', r2_(R.od.garson_ikram)],
    ['İptal edilen tutar', r2_(R.iptalTutar)], ['', ''],
    ['Açılan hesap', R.acilan], ['Kapanan hesap', R.kapanan], ['Paket', R.paket],
    ['Sipariş edilen ürün', R.siparisAdet], ['İptal edilen ürün', R.iptalAdet], ['Net satılan ürün', R.siparisAdet - R.iptalAdet],
    ['Hareket sayısı', g.hareketler.length]
  ];
  ozet.getRange(1, 1, 1, 2).setValues([[g.isletme || 'Yavuztürk Süleymaniye', 'Gün Sonu Raporu']]).setFontWeight('bold').setFontSize(13).setFontColor('#28334A');
  ozet.getRange(3, 1, satir.length, 2).setValues(satir);
  ozet.getRange(7, 2, 10, 1).setNumberFormat(TL);
  ozet.getRange(18, 2, 6, 1).setNumberFormat(AD);
  [7, 12].forEach(function (r) { ozet.getRange(r, 1, 1, 2).setFontWeight('bold').setFontColor('#28724F'); });
  ozet.setColumnWidth(1, 220); ozet.setColumnWidth(2, 260);

  const urunler = Object.keys(R.urun).sort(function (a, b) { return R.urun[b].tutar - R.urun[a].tutar; });
  sayfaYaz_(ss.insertSheet('Ürünler'), ['Ürün', 'Kategori', 'Net adet', 'İptal adet', 'Satış (₺)', 'Pay %'],
    urunler.map(function (u) { const x = R.urun[u]; return [u, x.kategori, x.adet, x.iptal, r2_(x.tutar), R.satis ? x.tutar / R.satis : 0]; }),
    [null, null, AD, AD, TL, '0.0%']);

  const gs = Object.keys(R.garson).filter(function (k) { const w = R.garson[k]; return w.adet || w.tutar || w.iptalYapti || Object.keys(w.hesap).length; })
    .sort(function (a, b) { return R.garson[b].tutar - R.garson[a].tutar; });
  sayfaYaz_(ss.insertSheet('Garsonlar'), ['Garson', 'Açtığı hesap', 'Net ürün', 'Net satış (₺)', 'Yaptığı iptal (adet)', 'Hediye ikramı (₺)'],
    gs.map(function (k) { const w = R.garson[k]; return [k, Object.keys(w.hesap).length, w.adet, r2_(w.tutar), w.iptalYapti, r2_(R.hediye[k] || 0)]; }),
    [null, AD, AD, TL, AD, TL]);

  sayfaYaz_(ss.insertSheet('İptaller'), ['İptal zamanı', 'İptal eden', 'Masa', 'Bölüm', 'Ürün', 'Adet', 'Tutar (₺)', 'Siparişi giren', 'Sipariş zamanı', 'Siparişten sonra (dk)', 'Neden'],
    R.iptaller.map(function (h) {
      return [new Date(h.zaman), h.garson || '', h.masa || '', h.bolum || '', h.urun || '', -Number(h.adet), -Number(h.tutar), h.siparisi_giren || '',
        h.siparis_zaman ? new Date(h.siparis_zaman) : '', h.siparis_zaman ? Math.round((new Date(h.zaman) - new Date(h.siparis_zaman)) / 60000) : '', h.aciklama || ''];
    }), [ZAMAN, null, null, null, null, AD, TL, null, ZAMAN, AD, null]);

  sayfaYaz_(ss.insertSheet('Ödemeler'), ['Zaman', 'Hareket', 'Ödeme türü', 'Tutar (₺)', 'İşlemi yapan', 'Masa', 'Açıklama'],
    R.odemeler.map(function (h) { return [new Date(h.zaman), HAREKET_[h.tur] || h.tur, ODEME_[h.odeme] || h.odeme || '', Number(h.tutar) || 0, h.garson || '', h.masa || '', h.aciklama || '']; }),
    [ZAMAN, null, null, TL, null, null, null]);

  sayfaYaz_(ss.insertSheet('Tüm Hareketler'),
    ['Zaman', 'Hareket', 'İşlemi yapan', 'Masa', 'Bölüm', 'Hesap', 'Sipariş no', 'Ürün', 'Kategori', 'Adet', 'Birim fiyat', 'Tutar', 'Personel ind %', 'Ödeme türü', 'Siparişi giren', 'Sipariş zamanı', 'Açıklama'],
    g.hareketler.map(function (h) {
      return [new Date(h.zaman), HAREKET_[h.tur] || h.tur, h.garson || '', h.masa || '', h.bolum || (h.masa_tur === 'paket' ? 'Paket' : ''), h.hesap || '', h.siparis_no || '',
        h.urun || '', h.kategori || '', h.adet == null ? '' : Number(h.adet), h.birim == null ? '' : Number(h.birim), h.tutar == null ? '' : Number(h.tutar),
        (h.tur === 'siparis' || h.tur === 'iptal') ? Number(h.oran) || 0 : '', ODEME_[h.odeme] || h.odeme || '', h.siparisi_giren || '',
        h.siparis_zaman ? new Date(h.siparis_zaman) : '', h.aciklama || ''];
    }), [ZAMAN, null, null, null, null, null, AD, null, null, AD, TL, TL, AD, null, null, ZAMAN, null]);
}

/* ---------- E-posta ---------- */
function epostaHtml_(g, R, url, deneme) {
  const sat = function (a, b, vurgu) {
    return '<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:' + (vurgu ? '#28724F;font-weight:bold' : '#1d2433') + '">' + a +
      '</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;font-weight:bold;white-space:nowrap">' + b + '</td></tr>';
  };
  const tablo = function (ic) { return '<table style="border-collapse:collapse;width:100%;max-width:520px;font-size:14px;margin:6px 0 18px">' + ic + '</table>'; };
  const bas = function (t) { return '<div style="font-size:12px;font-weight:bold;letter-spacing:.06em;text-transform:uppercase;color:#6b7282;margin-top:6px">' + t + '</div>'; };
  const urunler = Object.keys(R.urun).filter(function (u) { return R.urun[u].adet > 0; }).sort(function (a, b) { return R.urun[b].tutar - R.urun[a].tutar; });
  const gs = Object.keys(R.garson).filter(function (k) { return R.garson[k].tutar > 0; }).sort(function (a, b) { return R.garson[b].tutar - R.garson[a].tutar; });
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#1d2433;max-width:560px">' +
    (deneme ? '<div style="background:#fff4e0;color:#b8670a;padding:8px 12px;border-radius:8px;font-weight:bold;margin-bottom:10px">DENEME — gün henüz kapanmadı, şu ana kadarki rakamlar</div>' : '') +
    '<div style="background:#28334A;color:#fff;padding:16px 18px;border-radius:12px">' +
    '<div style="font-size:13px;opacity:.8">' + esc_(g.isletme || 'Yavuztürk Süleymaniye') + ' · Gün Sonu</div>' +
    '<div style="font-size:22px;font-weight:bold;margin-top:2px">' + trTarih_(g.etiket) + ' ' + gunAdi_(g.etiket) + '</div>' +
    '<div style="font-size:13px;opacity:.8;margin-top:2px">' + tarihStr_(g.bas) + ' – ' + tarihStr_(g.bit) + '</div>' +
    '<div style="font-size:30px;font-weight:bold;margin-top:10px">' + tl_(R.kapananNet) + '</div><div style="font-size:13px;opacity:.8">kapanan ' + R.kapanan + ' hesabın toplamı</div></div>' +
    bas('Kasa') + tablo(sat('Girilen siparişler (iptaller düşülmüş)', tl_(R.net)) + sat('Nakit', tl_(R.od.nakit)) + sat('Kart', tl_(R.od.kart)) + sat('Tahsilat (nakit + kart)', tl_(R.tahsilat), true) +
      (R.od.ikram ? sat('İkram', tl_(R.od.ikram)) : '') + (R.od.indirim ? sat('İndirim', tl_(R.od.indirim)) : '') +
      (R.od.garson_ikram ? sat('Garson hediye ikramı', tl_(R.od.garson_ikram)) : '') + (R.personel ? sat('Personel indirimi', tl_(R.personel)) : '') +
      sat('İptal edilen', R.iptalAdet + ' adet · ' + tl_(R.iptalTutar))) +
    bas('En çok satanlar') + tablo(urunler.slice(0, 8).map(function (u) { return sat(R.urun[u].adet + ' × ' + esc_(u), tl_(R.urun[u].tutar)); }).join('') || sat('Satış yok', '')) +
    bas('Garsonlar') + tablo(gs.map(function (k) { return sat(esc_(k) + ' <span style="color:#6b7282">(' + R.garson[k].adet + ' ürün)</span>', tl_(R.garson[k].tutar)); }).join('') || sat('—', '')) +
    (R.iptaller.length ? bas('İptaller') + tablo(R.iptaller.slice(0, 15).map(function (h) {
      return sat(tarihStr_(h.zaman, 'HH:mm') + ' · ' + (-h.adet) + ' × ' + esc_(h.urun) + ' <span style="color:#6b7282">· ' + esc_(h.garson) + (h.aciklama ? ' · ' + esc_(h.aciklama) : '') + '</span>', tl_(-h.tutar));
    }).join('') + (R.iptaller.length > 15 ? sat('… ve ' + (R.iptaller.length - 15) + ' iptal daha (ekteki dosyada)', '') : '')) : '') +
    '<a href="' + url + '" style="display:inline-block;background:#28724F;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:bold">Drive\'da tabloyu aç</a>' +
    '<p style="font-size:13px;color:#6b7282;margin-top:14px">Bütün hareketler saniyesiyle ekteki Excel dosyasında ve Drive\'daki tabloda.<br>' +
    'Yavuztürk Adisyon · otomatik yedek · Hazırlayan: M. Talha Erbil</p></div>';
}
