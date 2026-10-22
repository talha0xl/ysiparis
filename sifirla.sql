-- =====================================================================
-- SIFIRLAMA — Supabase › SQL Editor'e yapıştır. DİKKAT: GERİ ALINAMAZ!
-- Aşağıdaki iki bölümden SADECE BİRİNİ seç (diğerini silme, başına -- koy).
-- Garsonlar (giriş bilgileri) ve ayarlar HİÇBİR ZAMAN silinmez.
-- =====================================================================

-- ---------- A) SATIŞ VERİLERİNİ SIFIRLA (önerilen) ----------
-- Menü, kategoriler, masalar, garsonlar, ayarlar, fiş tasarımı, sesler KALIR.
-- Siparişler, hesaplar, ödemeler, iptaller, fiş kuyruğu, gün sonu raporları,
-- hareket (denetim) kayıtları silinir. Sipariş numarası 1'den başlar.
begin;
  truncate table public.ads_fis_kuyrugu, public.ads_hareketler, public.ads_gunler restart identity;
  delete from public.ads_odemeler;
  delete from public.ads_kalemler;
  delete from public.ads_adisyonlar;
  -- istek / oturum çöpünü de temizle (garsonlar tekrar giriş yapmak zorunda kalmaz, sadece eski istekler gider)
  delete from public.ads_istekler;
  alter sequence public.ads_siparis_no_seq restart with 1;
  alter sequence public.ads_paket_no_seq restart with 1;
commit;

-- ---------- B) HER ŞEYİ SIFIRLA (menü ve masalar da gider) ----------
-- Yukarıdaki A'yı çalıştırdıktan sonra İSTERSEN ayrıca bunu da çalıştır.
-- Ürünler, kategoriler ve masalar silinir; garsonlar ve ayarlar kalır.
-- begin;
--   delete from public.ads_urunler;
--   delete from public.ads_kategoriler;
--   delete from public.ads_masalar;
-- commit;
