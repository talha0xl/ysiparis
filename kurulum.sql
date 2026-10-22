-- =====================================================================
--  YAVUZTÜRK ADİSYON — Supabase kurulum dosyası
--  Supabase > SQL Editor > New query > bu dosyanın TAMAMINI yapıştır > Run
--  Menü sitesinin kullandığı projede çalıştırılabilir; bütün tablolar
--  "ads_" ile başlar, menü sitesinin tablolarına dokunmaz.
--  Tekrar çalıştırmak güvenlidir (mevcut verileri silmez).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- TABLOLAR
-- ---------------------------------------------------------------------
create table if not exists public.ads_garsonlar (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null,
  kullanici  text not null,
  pin_hash   text not null,
  rol        text not null default 'garson' check (rol in ('admin','garson')),
  aktif      boolean not null default true,
  olusturma  timestamptz not null default now()
);
create unique index if not exists ads_garsonlar_kullanici_uq on public.ads_garsonlar (lower(kullanici));

create table if not exists public.ads_oturumlar (
  token         uuid primary key default gen_random_uuid(),
  garson_id     uuid not null references public.ads_garsonlar(id) on delete cascade,
  olusturma     timestamptz not null default now(),
  son_kullanma  timestamptz not null default now() + interval '30 days'
);

create table if not exists public.ads_masalar (
  id     uuid primary key default gen_random_uuid(),
  ad     text not null,
  sira   int  not null default 0,
  aktif  boolean not null default true
);

create table if not exists public.ads_urunler (
  id        uuid primary key default gen_random_uuid(),
  kategori  text not null default 'Genel',
  ad        text not null,
  fiyat     numeric(10,2) not null default 0 check (fiyat >= 0),
  sira      int not null default 0,
  aktif     boolean not null default true
);

create table if not exists public.ads_adisyonlar (
  id          uuid primary key default gen_random_uuid(),
  masa_id     uuid not null references public.ads_masalar(id),
  durum       text not null default 'acik' check (durum in ('acik','kapali','iptal','birlesti')),
  acilis      timestamptz not null default now(),
  kapanis     timestamptz,
  acan_ad     text,
  kapatan_ad  text,
  notu        text
);
-- bir masada aynı anda tek açık adisyon
create unique index if not exists ads_adisyon_tek_acik on public.ads_adisyonlar (masa_id) where durum = 'acik';
create index if not exists ads_adisyon_kapanis on public.ads_adisyonlar (kapanis);

create table if not exists public.ads_kalemler (
  id           uuid primary key default gen_random_uuid(),
  adisyon_id   uuid not null references public.ads_adisyonlar(id) on delete cascade,
  urun_id      uuid references public.ads_urunler(id) on delete set null,
  ad           text not null,
  fiyat        numeric(10,2) not null,
  adet         int not null check (adet > 0),
  notu         text,
  durum        text not null default 'aktif' check (durum in ('aktif','iptal')),
  siparis_no   int,
  garson_ad    text,
  olusturma    timestamptz not null default now(),
  iptal_eden   text,
  iptal_neden  text,
  iptal_zaman  timestamptz
);
create index if not exists ads_kalem_adisyon on public.ads_kalemler (adisyon_id);
create index if not exists ads_kalem_iptal_zaman on public.ads_kalemler (iptal_zaman) where durum = 'iptal';
create index if not exists ads_adisyon_durum on public.ads_adisyonlar (durum);
create index if not exists ads_oturum_garson on public.ads_oturumlar (garson_id);

create table if not exists public.ads_odemeler (
  id          uuid primary key default gen_random_uuid(),
  adisyon_id  uuid not null references public.ads_adisyonlar(id) on delete cascade,
  tur         text not null check (tur in ('nakit','kart','ikram','indirim')),
  tutar       numeric(10,2) not null check (tutar > 0),
  garson_ad   text,
  olusturma   timestamptz not null default now()
);
create index if not exists ads_odeme_adisyon on public.ads_odemeler (adisyon_id);

create table if not exists public.ads_fis_kuyrugu (
  id         bigserial primary key,
  tur        text not null,          -- siparis | iptal | hesap | test
  veri       jsonb not null,
  basildi    boolean not null default false,
  olusturma  timestamptz not null default now()
);
create index if not exists ads_fis_bekleyen on public.ads_fis_kuyrugu (basildi, id);

create table if not exists public.ads_istekler (
  istek_id   uuid primary key,
  sonuc      jsonb,
  olusturma  timestamptz not null default now()
);

create table if not exists public.ads_ayarlar (
  id              int primary key default 1 check (id = 1),
  isletme_adi     text not null default 'Yavuztürk Süleymaniye',
  fis_genislik    int  not null default 80 check (fis_genislik in (58,80)),
  fis_alt_yazi    text not null default 'Afiyet olsun!',
  iptal_yetkisi   text not null default 'admin' check (iptal_yetkisi in ('admin','herkes')),
  hesap_fisi_otomatik boolean not null default true
);
insert into public.ads_ayarlar (id) values (1) on conflict do nothing;

create sequence if not exists public.ads_siparis_no_seq;
create sequence if not exists public.ads_paket_no_seq;

-- ---------------------------------------------------------------------
-- SÜRÜM 2 EKLERİ: personel indirimi, garson ikram hakkı, paket servis
-- (eski kurulumun üstüne çalıştırılınca eksik sütunları ekler)
-- ---------------------------------------------------------------------
alter table public.ads_ayarlar    add column if not exists personel_oran int not null default 33;
alter table public.ads_garsonlar  add column if not exists ikram_limit numeric(10,2) not null default 0;
alter table public.ads_garsonlar  add column if not exists ikram_baslangic timestamptz not null default now();
-- SÜRÜM 15: hediye ikram hakkına son kullanma zamanı (boşsa süresiz)
alter table public.ads_garsonlar  add column if not exists ikram_bitis timestamptz;
alter table public.ads_masalar    add column if not exists tur text not null default 'masa';
alter table public.ads_masalar    add column if not exists olusturma timestamptz not null default now();
alter table public.ads_adisyonlar add column if not exists indirim_oran int not null default 0;
alter table public.ads_odemeler   add column if not exists ikram_garson_id uuid references public.ads_garsonlar(id) on delete set null;
alter table public.ads_odemeler   add column if not exists ikram_garson_ad text;

alter table public.ads_masalar drop constraint if exists ads_masalar_tur_check;
alter table public.ads_masalar add constraint ads_masalar_tur_check check (tur in ('masa','paket'));
alter table public.ads_ayarlar drop constraint if exists ads_ayarlar_personel_oran_check;
alter table public.ads_ayarlar add constraint ads_ayarlar_personel_oran_check check (personel_oran between 0 and 100);
alter table public.ads_odemeler drop constraint if exists ads_odemeler_tur_check;
alter table public.ads_odemeler add constraint ads_odemeler_tur_check check (tur in ('nakit','kart','ikram','indirim','garson_ikram'));

-- SÜRÜM 3: bölümler (reyon) ve fiş bölme
alter table public.ads_masalar   add column if not exists bolum text;
alter table public.ads_garsonlar add column if not exists bolumler text[] not null default '{}';
alter table public.ads_ayarlar   add column if not exists fis_bolme text not null default 'tek';
alter table public.ads_ayarlar drop constraint if exists ads_ayarlar_fis_bolme_check;
alter table public.ads_ayarlar add constraint ads_ayarlar_fis_bolme_check check (fis_bolme in ('tek','urun','adet'));

-- SÜRÜM 4: hareket kaydı (kim, ne zaman, hangi masada ne yaptı) ve ürün kategorisi
alter table public.ads_kalemler add column if not exists kategori text;
update public.ads_kalemler k set kategori = u.kategori from public.ads_urunler u where k.kategori is null and u.id = k.urun_id;

create table if not exists public.ads_hareketler (
  id              bigserial primary key,
  zaman           timestamptz not null default now(),
  tur             text not null,   -- giris, hesap_acildi, siparis, iptal, odeme, odeme_silindi, odeme_duzeltme, ara_hesap,
                                   -- hesap_kapandi, hesap_iptal, hesap_geri_acildi, masa_tasindi, personel_indirimi, paket_acildi, paket_silindi
  garson_id       uuid,
  garson_ad       text,            -- işlemi yapan
  masa_id         uuid,
  masa_ad         text,
  bolum           text,
  masa_tur        text,
  adisyon_id      uuid,
  siparis_no      int,
  urun_ad         text,
  kategori        text,
  adet            int,             -- iptalde eksi
  birim_fiyat     numeric(10,2),
  tutar           numeric(10,2),   -- iptalde / silinen ödemede eksi
  odeme_tur       text,
  aciklama        text,            -- not, iptal nedeni, taşıma bilgisi...
  siparisi_giren  text,            -- iptalde: siparişi kim girmişti
  siparis_zaman   timestamptz      -- iptalde: sipariş ne zaman girilmişti
);
create index if not exists ads_hareket_zaman on public.ads_hareketler (zaman);
create index if not exists ads_hareket_adisyon on public.ads_hareketler (adisyon_id);

-- SÜRÜM 5: gün sonu (otomatik / manuel) ve hediye ikramı kuralları
alter table public.ads_ayarlar add column if not exists gun_sonu_modu text not null default 'otomatik';
alter table public.ads_ayarlar add column if not exists gun_basi_saat int not null default 5;
alter table public.ads_ayarlar add column if not exists manuel_baslangic timestamptz;
alter table public.ads_ayarlar add column if not exists ikram_gunluk boolean not null default true;
alter table public.ads_ayarlar add column if not exists ikram_kural text not null default 'kendi';
alter table public.ads_ayarlar drop constraint if exists ads_ayarlar_gun_sonu_modu_check;
alter table public.ads_ayarlar add constraint ads_ayarlar_gun_sonu_modu_check check (gun_sonu_modu in ('otomatik','manuel'));
alter table public.ads_ayarlar drop constraint if exists ads_ayarlar_gun_basi_saat_check;
alter table public.ads_ayarlar add constraint ads_ayarlar_gun_basi_saat_check check (gun_basi_saat between 0 and 23);
alter table public.ads_ayarlar drop constraint if exists ads_ayarlar_ikram_kural_check;
alter table public.ads_ayarlar add constraint ads_ayarlar_ikram_kural_check check (ikram_kural in ('kendi','yonetici_secer'));

-- alınan her gün sonu (manuel modda bir "gün" = iki gün sonu arası)
create table if not exists public.ads_gunler (
  id         bigserial primary key,
  baslangic  timestamptz not null,
  bitis      timestamptz not null default now(),
  kapatan    text,
  ozet       jsonb
);
create index if not exists ads_gunler_bitis on public.ads_gunler (bitis);

-- SÜRÜM 6: stok takibi
alter table public.ads_urunler add column if not exists stok int;                       -- boş = stok takibi yok
alter table public.ads_urunler add column if not exists tukendi boolean not null default false; -- elle "stok bitti"
alter table public.ads_ayarlar add column if not exists stok_kritik int not null default 10;
alter table public.ads_urunler drop constraint if exists ads_urunler_stok_check;
alter table public.ads_urunler add constraint ads_urunler_stok_check check (stok is null or stok >= 0);

-- SÜRÜM 7: otomatik yedek (Google Drive + e-posta)
-- gizli bilgiler ayrı tabloda: garsonlar ayarları okuyabilir ama bunu okuyamaz
create table if not exists public.ads_gizli (
  id               int primary key default 1 check (id = 1),
  yedek_anahtar    text,
  yedek_baslangic  timestamptz,
  yedek_eposta     text
);
insert into public.ads_gizli (id) values (1) on conflict do nothing;

create table if not exists public.ads_yedekler (
  gun        text primary key,   -- 'g:<gün sonu no>' (manuel) ya da 'd:YYYY-MM-DD' (otomatik)
  etiket     text,
  baslangic  timestamptz,
  bitis      timestamptz,
  satir      int,
  dosya      text,               -- Drive'daki tablonun bağlantısı
  zaman      timestamptz not null default now()
);

-- SÜRÜM 8: kategoriler (gerçek tablo), yazıcı istasyonu, müşteri QR menüsü
create table if not exists public.ads_kategoriler (
  id        uuid primary key default gen_random_uuid(),
  ad        text not null,
  sira      int not null default 0,
  aktif     boolean not null default true,     -- gizli kategori: garson ve müşteri görmez
  istasyon  int not null default 1,            -- bu kategorinin fişi hangi yazıcıya (1..6); 0 = kasa
  olusturma timestamptz not null default now()
);
create unique index if not exists ads_kategori_ad_uq on public.ads_kategoriler (lower(ad));
-- mevcut ürünlerdeki kategori adlarını tabloya taşı (bir kere)
insert into public.ads_kategoriler (ad, sira)
select kategori, row_number() over (order by min(sira), kategori)
  from public.ads_urunler where coalesce(trim(kategori),'') <> ''
 group by kategori
 on conflict do nothing;

alter table public.ads_fis_kuyrugu add column if not exists istasyon int;
alter table public.ads_ayarlar add column if not exists istasyon_adlari jsonb not null default '{"1":"Mutfak","2":"Tatlı","3":"İçecek","4":"Bar"}'::jsonb;
alter table public.ads_ayarlar add column if not exists menu_aciklama text;

-- SÜRÜM 9: özelleştirilebilir fiş tasarımı (kasa/garson ekranı bunu okuyup fişi çizer)
alter table public.ads_ayarlar add column if not exists fis_sablon jsonb not null default '{}'::jsonb;

-- SÜRÜM 10: kasa sesleri (hazır ses seçimi + yüklenen kendi sesler)
alter table public.ads_ayarlar add column if not exists ses_ayar jsonb not null default '{}'::jsonb;

-- SÜRÜM 11: roller ve izinler
create table if not exists public.ads_roller (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null check (length(trim(ad)) between 1 and 30),
  izinler    text[] not null default '{}',
  sistem     text check (sistem in ('yonetici','garson')),   -- hazır roller (silinemez)
  olusturma  timestamptz not null default now()
);
create unique index if not exists ads_roller_ad_uq on public.ads_roller (lower(ad));
create unique index if not exists ads_roller_sistem_uq on public.ads_roller (sistem) where sistem is not null;
alter table public.ads_garsonlar add column if not exists rol_id uuid references public.ads_roller(id) on delete set null;
alter table public.ads_garsonlar add column if not exists izin_ozel text[];   -- dolu ise rolün yerine kişiye özel izinler
insert into public.ads_roller (ad, izinler, sistem)
select 'Yönetici', array['siparis','paket','masa_tasi','hesap','indirim','iptal','hesap_iptal','kapali_duzelt','stok','menu','masalar','kasa','rapor','panel','gunsonu','ayarlar'], 'yonetici'
where not exists (select 1 from public.ads_roller where sistem = 'yonetici');
insert into public.ads_roller (ad, izinler, sistem)
select 'Garson', array['siparis','paket','masa_tasi','hesap','indirim'] || case when coalesce((select iptal_yetkisi from public.ads_ayarlar where id = 1), 'admin') = 'herkes' then array['iptal'] else '{}'::text[] end, 'garson'
where not exists (select 1 from public.ads_roller where sistem = 'garson');
update public.ads_garsonlar g set rol_id = (select r.id from public.ads_roller r where r.sistem = case when g.rol = 'admin' then 'yonetici' else 'garson' end)
 where g.rol_id is null;

-- müşteri menüsünde stoğu biten ürün: gizle (varsayılan) ya da 'Tükendi' yazıp göster
alter table public.ads_ayarlar add column if not exists menu_tukenen_gizle boolean not null default true;
create table if not exists public.ads_sesler (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null,
  veri       text not null check (length(veri) <= 700000),   -- data: URL (≈500 KB'a kadar ses dosyası)
  olusturma  timestamptz not null default now()
);
create index if not exists ads_fis_bekleyen2 on public.ads_fis_kuyrugu (basildi, istasyon, id);

-- eski sürümün fonksiyon imzaları (parametreleri değişti)
drop function if exists public.ads_siparis_gec(uuid, jsonb, uuid, text);
drop function if exists public.ads_fis_test();
drop function if exists public.ads_garson_kaydet(uuid, text, text, text, text, boolean, numeric);
drop function if exists public.ads_siparis_gec(uuid, jsonb, uuid);
drop function if exists public.ads_odeme_ekle(uuid, text, numeric);
drop function if exists public.ads_garson_kaydet(uuid, text, text, text, text, boolean);

-- ---------------------------------------------------------------------
-- YARDIMCI FONKSİYONLAR
-- ---------------------------------------------------------------------
create or replace function public.ads_token() returns uuid
language plpgsql stable as $$
declare t text;
begin
  begin
    t := current_setting('request.headers', true)::json ->> 'x-adisyon-token';
  exception when others then
    return null;
  end;
  if t is null or t !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return null;
  end if;
  return t::uuid;
end $$;

create or replace function public.ads_garson_id() returns uuid
language sql stable security definer set search_path = public as $$
  select o.garson_id
  from ads_oturumlar o join ads_garsonlar g on g.id = o.garson_id
  where o.token = ads_token() and o.son_kullanma > now() and g.aktif
$$;

create or replace function public.ads_admin_mi() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from ads_garsonlar where id = ads_garson_id() and rol = 'admin')
$$;

-- hareket kaydı yazar (sadece diğer fonksiyonlar çağırır)
create or replace function public.ads_log(p_tur text, p_garson ads_garsonlar, p_adisyon uuid, p_masa uuid default null,
  p_urun text default null, p_kategori text default null, p_adet int default null, p_fiyat numeric default null,
  p_tutar numeric default null, p_odeme text default null, p_aciklama text default null, p_siparis_no int default null,
  p_siparisi_giren text default null, p_siparis_zaman timestamptz default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare m ads_masalar;
begin
  select * into m from ads_masalar
   where id = coalesce(p_masa, (select masa_id from ads_adisyonlar where id = p_adisyon));
  insert into ads_hareketler (tur, garson_id, garson_ad, masa_id, masa_ad, bolum, masa_tur, adisyon_id, siparis_no,
                              urun_ad, kategori, adet, birim_fiyat, tutar, odeme_tur, aciklama, siparisi_giren, siparis_zaman)
  values (p_tur, p_garson.id, p_garson.ad, m.id, m.ad, nullif(trim(m.bolum), ''), m.tur, p_adisyon, p_siparis_no,
          p_urun, p_kategori, p_adet, p_fiyat, round(p_tutar, 2), p_odeme, nullif(trim(p_aciklama), ''), p_siparisi_giren, p_siparis_zaman);
end $$;

-- bir kategorinin yazıcı istasyonu (kategori yoksa 1)
create or replace function public.ads_kategori_istasyon(p_kategori text) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((select istasyon from ads_kategoriler where lower(ad) = lower(coalesce(p_kategori,'')) limit 1), 1)
$$;

-- garson bu masayı görebilir mi? (yönetici her şeyi, paketleri herkes görür;
-- bölümü boş masa ve bölümü atanmamış garson = kısıtlama yok)
create or replace function public.ads_masa_gorur(p_bolum text, p_tur text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from ads_garsonlar g
     where g.id = ads_garson_id()
       and (g.rol = 'admin' or p_tur = 'paket' or coalesce(trim(p_bolum), '') = ''
            or cardinality(g.bolumler) = 0 or trim(p_bolum) = any(g.bolumler)))
$$;

-- oturum yoksa hata verir, varsa garsonu döndürür
create or replace function public.ads_garson_zorunlu() returns ads_garsonlar
language plpgsql stable security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  select * into g from ads_garsonlar where id = ads_garson_id();
  if g.id is null then
    raise exception 'OTURUM: Oturumun kapanmış, tekrar giriş yap.';
  end if;
  return g;
end $$;

create or replace function public.ads_admin_zorunlu() returns ads_garsonlar
language plpgsql stable security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_garson_zorunlu();
  if g.rol <> 'admin' then
    raise exception 'Bu işlem için yönetici yetkisi gerekiyor.';
  end if;
  return g;
end $$;


-- ---------------------------------------------------------------------
-- İZİNLER (roller). Yönetici her şeyi yapar; diğerleri rolünün (ya da kişiye özel) izinleriyle.
-- Hesap/rol yönetimi sadece Yönetici rolündedir, devredilemez.
-- ---------------------------------------------------------------------
create or replace function public.ads_tum_izinler() returns text[]
language sql immutable as $$ select array['siparis','paket','masa_tasi','hesap','indirim','iptal','hesap_iptal','kapali_duzelt','stok','menu','masalar','kasa','rapor','panel','gunsonu','ayarlar'] $$;

create or replace function public.ads_izinler_de(g ads_garsonlar) returns text[]
language sql stable security definer set search_path = public as $$
  select case when g.rol = 'admin' then ads_tum_izinler()
              else coalesce(g.izin_ozel,
                            (select r.izinler from ads_roller r where r.id = g.rol_id),
                            (select r.izinler from ads_roller r where r.sistem = 'garson'),
                            '{}'::text[]) end
$$;

create or replace function public.ads_izin(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p = any(ads_izinler_de(g)) from ads_garsonlar g where g.id = ads_garson_id()), false)
$$;

create or replace function public.ads_izin_zorunlu(p text) returns ads_garsonlar
language plpgsql stable security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_garson_zorunlu();
  if not (p = any(ads_izinler_de(g))) then
    raise exception 'Bu işlem için yetkin yok. Yöneticiye haber ver.';
  end if;
  return g;
end $$;

create or replace function public.ads_kimlik(g ads_garsonlar) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', g.id, 'ad', g.ad, 'rol', g.rol, 'kullanici', g.kullanici, 'bolumler', g.bolumler,
    'izinler', to_jsonb(ads_izinler_de(g)),
    'rol_ad', case when g.izin_ozel is not null and g.rol <> 'admin' then 'Özel'
                   else coalesce((select r.ad from ads_roller r where r.id = g.rol_id), case when g.rol = 'admin' then 'Yönetici' else 'Garson' end) end)
$$;

-- rol yönetimi (sadece Yönetici)
create or replace function public.ads_rol_listesi() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform ads_admin_zorunlu();
  return jsonb_build_object('tum', to_jsonb(ads_tum_izinler()),
    'roller', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'ad', r.ad, 'izinler', to_jsonb(r.izinler), 'sistem', r.sistem,
        'kisi', (select count(*) from ads_garsonlar g where g.izin_ozel is null and (g.rol_id = r.id
                 or (g.rol_id is null and r.sistem = case when g.rol = 'admin' then 'yonetici' else 'garson' end))))
        order by case r.sistem when 'yonetici' then 0 when 'garson' then 1 else 2 end, r.ad) from ads_roller r), '[]'::jsonb));
end $$;

create or replace function public.ads_rol_kaydet(p_id uuid, p_ad text, p_izinler text[]) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare r ads_roller; v_iz text[]; v_id uuid;
begin
  perform ads_admin_zorunlu();
  v_iz := coalesce((select array_agg(distinct x) from unnest(coalesce(p_izinler, '{}')) x where x = any(ads_tum_izinler())), '{}');
  if p_id is not null then
    select * into r from ads_roller where id = p_id;
    if r.id is null then raise exception 'Rol bulunamadı.'; end if;
    if r.sistem = 'yonetici' then raise exception 'Yönetici rolü değiştirilemez (her şeyi yapabilir).'; end if;
  end if;
  if r.sistem is null then
    if coalesce(trim(p_ad), '') = '' then raise exception 'Rol adı boş olamaz.'; end if;
    if length(trim(p_ad)) > 30 then raise exception 'Rol adı en fazla 30 karakter.'; end if;
    if exists (select 1 from ads_roller where lower(ad) = lower(trim(p_ad)) and id is distinct from p_id) then
      raise exception 'Bu adda bir rol zaten var.';
    end if;
  end if;
  if p_id is null then
    insert into ads_roller (ad, izinler) values (trim(p_ad), v_iz) returning id into v_id;
  else
    update ads_roller set ad = case when sistem is null then trim(p_ad) else ad end, izinler = v_iz where id = p_id;
    v_id := p_id;
  end if;
  return v_id;
end $$;

create or replace function public.ads_rol_sil(p_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare r ads_roller; v_garson uuid;
begin
  perform ads_admin_zorunlu();
  select * into r from ads_roller where id = p_id;
  if r.id is null then return; end if;
  if r.sistem is not null then raise exception 'Hazır roller silinemez.'; end if;
  select id into v_garson from ads_roller where sistem = 'garson';
  update ads_garsonlar set rol_id = v_garson where rol_id = p_id;
  delete from ads_roller where id = p_id;
end $$;

-- hesabın ödenecek tutarı (personel indirimi düşülmüş)
create or replace function public.ads_net(p_adisyon uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(coalesce((select sum(adet*fiyat) from ads_kalemler where adisyon_id = a.id and durum = 'aktif'), 0)
               * (100 - a.indirim_oran) / 100.0, 2)
  from ads_adisyonlar a where a.id = p_adisyon
$$;

-- hesap fişi için adisyonun özeti
create or replace function public.ads_hesap_ozeti(p_adisyon uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'adisyon_id', a.id,
    'masa', m.ad,
    'paket', m.tur = 'paket',
    'acilis', a.acilis,
    'indirim_oran', a.indirim_oran,
    'kalemler', coalesce((
        select jsonb_agg(jsonb_build_object('ad', k.ad, 'fiyat', k.fiyat, 'adet', k.adet, 'tutar', k.tutar) order by k.ilk)
        from (select ad, fiyat, sum(adet) adet, sum(adet*fiyat) tutar, min(olusturma) ilk
              from ads_kalemler where adisyon_id = a.id and durum = 'aktif'
              group by ad, fiyat) k), '[]'::jsonb),
    'toplam', coalesce((select sum(adet*fiyat) from ads_kalemler where adisyon_id = a.id and durum='aktif'), 0),
    'net', ads_net(a.id),
    'odemeler', coalesce((
        select jsonb_agg(jsonb_build_object('tur', o.tur, 'tutar', o.tutar, 'garson', o.ikram_garson_ad) order by o.olusturma)
        from ads_odemeler o where o.adisyon_id = a.id), '[]'::jsonb),
    'odenen', coalesce((select sum(tutar) from ads_odemeler where adisyon_id = a.id), 0)
  )
  from ads_adisyonlar a join ads_masalar m on m.id = a.masa_id
  where a.id = p_adisyon
$$;

-- ---------------------------------------------------------------------
-- GİRİŞ / ÇIKIŞ
-- ---------------------------------------------------------------------
create or replace function public.ads_giris(p_kullanici text, p_pin text) returns jsonb
language plpgsql volatile security definer set search_path = public, extensions as $$
declare g ads_garsonlar; t uuid;
begin
  select * into g from ads_garsonlar
   where lower(kullanici) = lower(trim(p_kullanici)) and aktif;
  if g.id is null or g.pin_hash <> crypt(p_pin, g.pin_hash) then
    perform pg_sleep(0.6);
    raise exception 'Kullanıcı adı veya şifre yanlış.';
  end if;
  delete from ads_oturumlar where son_kullanma < now();
  insert into ads_oturumlar (garson_id) values (g.id) returning token into t;
  perform ads_log('giris', g, null);
  return jsonb_build_object('token', t, 'garson', ads_kimlik(g));
end $$;

create or replace function public.ads_ben() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_garson_zorunlu();
  return ads_kimlik(g);
end $$;

create or replace function public.ads_cikis() returns void
language sql volatile security definer set search_path = public as $$
  delete from ads_oturumlar where token = ads_token();
$$;

-- ---------------------------------------------------------------------
-- SİPARİŞ
-- p_kalemler: [{"urun_id": "...", "adet": 2, "not": "az acılı"}]
-- p_istek: tarayıcının ürettiği benzersiz kimlik (internet kopup tekrar
--          gönderilirse aynı sipariş iki kere düşmesin diye)
-- ---------------------------------------------------------------------
create or replace function public.ads_siparis_gec(p_masa uuid, p_kalemler jsonb, p_istek uuid, p_not text default null) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  g ads_garsonlar; m ads_masalar; a_id uuid; no int; k jsonb; u ads_urunler;
  v_adet int; fis_kalem jsonb := '[]'::jsonb; v_sonuc jsonb; onceki jsonb;
  bolme text; ust jsonb; uid text; parca int := 0; parca_say int; j int; ist int; ist_kalem jsonb; ist_adlari jsonb;
begin
  g := ads_izin_zorunlu('siparis');

  select i.sonuc into onceki from ads_istekler i where i.istek_id = p_istek;
  if found then return onceki; end if;

  if p_kalemler is null or jsonb_array_length(p_kalemler) = 0 then
    raise exception 'Sepet boş.';
  end if;

  select * into m from ads_masalar where id = p_masa and aktif for update;
  if m.id is null then raise exception 'Masa bulunamadı.'; end if;
  if not ads_masa_gorur(m.bolum, m.tur) then raise exception 'Bu masa senin bölümünde değil.'; end if;

  select id into a_id from ads_adisyonlar where masa_id = m.id and durum = 'acik';
  if a_id is null then
    insert into ads_adisyonlar (masa_id, acan_ad) values (m.id, g.ad) returning id into a_id;
    perform ads_log('hesap_acildi', g, a_id);
  end if;

  no := nextval('ads_siparis_no_seq');

  -- aynı anda sipariş giren garsonlar birbirini kilitlemesin: ürünleri hep aynı sırayla kilitle
  perform 1 from ads_urunler
   where id in (select (e->>'urun_id')::uuid from jsonb_array_elements(p_kalemler) e)
   order by id for update;

  for k in select * from jsonb_array_elements(p_kalemler) loop
    select * into u from ads_urunler where id = (k->>'urun_id')::uuid for update;
    if u.id is null then raise exception 'Menüde olmayan bir ürün var, sayfayı yenile.'; end if;
    v_adet := coalesce((k->>'adet')::int, 1);
    if v_adet < 1 or v_adet > 999 then raise exception 'Geçersiz adet.'; end if;
    if not u.aktif then raise exception '% şu an satışta değil.', u.ad; end if;
    if u.tukendi then raise exception 'STOK: % tükendi.', u.ad; end if;
    if u.stok is not null then
      if u.stok < v_adet then
        raise exception 'STOK: % için stokta % adet kaldı.', u.ad, u.stok;
      end if;
      update ads_urunler set stok = stok - v_adet where id = u.id;
    end if;
    insert into ads_kalemler (adisyon_id, urun_id, ad, fiyat, adet, notu, siparis_no, garson_ad, kategori)
    values (a_id, u.id, u.ad, u.fiyat, v_adet, nullif(trim(k->>'not'), ''), no, g.ad, u.kategori);
    perform ads_log('siparis', g, a_id, null, u.ad, u.kategori, v_adet, u.fiyat, u.fiyat * v_adet, null,
                    concat_ws(' · ', nullif(trim(k->>'not'), ''), case when nullif(trim(p_not), '') is not null then 'Sipariş notu: ' || trim(p_not) end), no);
    fis_kalem := fis_kalem || jsonb_build_object('urun_id', u.id, 'ad', u.ad, 'adet', v_adet, 'not', nullif(trim(k->>'not'), ''), 'fiyat', u.fiyat,
                 'istasyon', ads_kategori_istasyon(u.kategori));
  end loop;

  -- fiş bölme ayarı: tek = hepsi bir fişte, urun = her ürün ayrı fiş, adet = her adet ayrı fiş
  -- ÖNCE istasyona göre böl (balık ayrı yazıcı, tatlı ayrı), SONRA ürün/adet böl
  bolme := coalesce((select fis_bolme from ads_ayarlar where id = 1), 'tek');
  ist_adlari := coalesce((select istasyon_adlari from ads_ayarlar where id = 1), '{}'::jsonb);
  for ist in select distinct (e->>'istasyon')::int from jsonb_array_elements(fis_kalem) e order by 1 loop
    ist_kalem := (select jsonb_agg(e order by i) from jsonb_array_elements(fis_kalem) with ordinality x(e, i) where (e->>'istasyon')::int = ist);
    ust := jsonb_build_object('masa', m.ad, 'paket', m.tur = 'paket', 'garson', g.ad, 'no', no, 'zaman', now(),
                              'not', nullif(trim(p_not), ''), 'istasyon', ist, 'istasyon_ad', ist_adlari->>ist::text);
    parca := 0;
    if bolme = 'urun' then
      select count(distinct e->>'urun_id') into parca_say from jsonb_array_elements(ist_kalem) e;
      for uid in select e->>'urun_id' from jsonb_array_elements(ist_kalem) with ordinality x(e, i)
                 group by e->>'urun_id' order by min(i) loop
        parca := parca + 1;
        insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('siparis', ist, ust || jsonb_build_object(
          'parca', parca, 'parca_say', parca_say,
          'kalemler', (select jsonb_agg(e order by i) from jsonb_array_elements(ist_kalem) with ordinality x(e, i) where e->>'urun_id' = uid)));
      end loop;
    elsif bolme = 'adet' then
      select sum((e->>'adet')::int) into parca_say from jsonb_array_elements(ist_kalem) e;
      for k in select e from jsonb_array_elements(ist_kalem) e loop
        for j in 1 .. (k->>'adet')::int loop
          parca := parca + 1;
          insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('siparis', ist, ust || jsonb_build_object(
            'parca', parca, 'parca_say', parca_say, 'kalemler', jsonb_build_array(k || jsonb_build_object('adet', 1))));
        end loop;
      end loop;
    else
      insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('siparis', ist, ust || jsonb_build_object('kalemler', ist_kalem));
    end if;
  end loop;

  v_sonuc := jsonb_build_object('adisyon_id', a_id, 'siparis_no', no);
  insert into ads_istekler (istek_id, sonuc) values (p_istek, v_sonuc);
  delete from ads_istekler where olusturma < now() - interval '2 days';
  return v_sonuc;
end $$;

-- ---------------------------------------------------------------------
-- İPTAL
-- ---------------------------------------------------------------------
create or replace function public.ads_iptal_yetkisi_kontrol(g ads_garsonlar) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not ('iptal' = any(ads_izinler_de(g))) and (select iptal_yetkisi from ads_ayarlar where id = 1) <> 'herkes' then
    raise exception 'İptal yetkin yok. Yöneticiye haber ver.';
  end if;
end $$;

create or replace function public.ads_kalem_iptal(p_kalem uuid, p_adet int, p_neden text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; k ads_kalemler; a ads_adisyonlar; masa_ad text; n int;
begin
  g := ads_garson_zorunlu();
  perform ads_iptal_yetkisi_kontrol(g);

  select * into k from ads_kalemler where id = p_kalem for update;
  if k.id is null or k.durum <> 'aktif' then raise exception 'Bu ürün zaten iptal edilmiş.'; end if;
  select * into a from ads_adisyonlar where id = k.adisyon_id;
  if a.durum <> 'acik' then raise exception 'Bu hesap kapalı.'; end if;
  select ad into masa_ad from ads_masalar where id = a.masa_id;

  n := least(greatest(coalesce(p_adet, k.adet), 1), k.adet);
  update ads_urunler set stok = stok + n where id = k.urun_id and stok is not null;
  if n = k.adet then
    update ads_kalemler set durum = 'iptal', iptal_eden = g.ad, iptal_neden = nullif(trim(p_neden), ''), iptal_zaman = now()
     where id = k.id;
  else
    update ads_kalemler set adet = adet - n where id = k.id;
    insert into ads_kalemler (adisyon_id, urun_id, ad, fiyat, adet, notu, durum, siparis_no, garson_ad, olusturma, iptal_eden, iptal_neden, iptal_zaman)
    values (k.adisyon_id, k.urun_id, k.ad, k.fiyat, n, k.notu, 'iptal', k.siparis_no, k.garson_ad, k.olusturma, g.ad, nullif(trim(p_neden), ''), now());
  end if;
  perform ads_log('iptal', g, a.id, null, k.ad, k.kategori, -n, k.fiyat, -(n * k.fiyat), null, concat_ws(' · ', case when nullif(trim(k.notu), '') is not null then 'Not: ' || trim(k.notu) end, nullif(trim(p_neden), '')), k.siparis_no, k.garson_ad, k.olusturma);

  insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('iptal', ads_kategori_istasyon(k.kategori), jsonb_build_object(
    'masa', masa_ad, 'garson', g.ad, 'zaman', now(), 'neden', nullif(trim(p_neden), ''), 'istasyon', ads_kategori_istasyon(k.kategori),
    'kalemler', jsonb_build_array(jsonb_build_object('ad', k.ad, 'adet', n, 'not', nullif(trim(k.notu), '')))));
end $$;

create or replace function public.ads_adisyon_iptal(p_adisyon uuid, p_neden text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; a ads_adisyonlar; masa_ad text; liste jsonb; ist_i text;
begin
  g := ads_izin_zorunlu('hesap_iptal');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'acik' then raise exception 'Hesap açık değil.'; end if;
  select ad into masa_ad from ads_masalar where id = a.masa_id;

  -- kalan ürünleri istasyona göre grupla (her mutfak kendi iptalini görsün)
  select coalesce(jsonb_object_agg(ist, kl), '{}'::jsonb) into liste
    from (select ads_kategori_istasyon(kategori) ist, jsonb_agg(jsonb_build_object('ad', ad, 'adet', adet, 'not', nullif(trim(notu), ''))) kl
          from ads_kalemler where adisyon_id = a.id and durum = 'aktif' group by ads_kategori_istasyon(kategori)) z;
  perform ads_log('iptal', g, a.id, null, x.ad, x.kategori, -x.adet, x.fiyat, -(x.adet * x.fiyat), null,
                  concat_ws(' · ', case when nullif(trim(x.notu), '') is not null then 'Not: ' || trim(x.notu) end, coalesce(nullif(trim(p_neden), ''), 'Hesap iptal')), x.siparis_no, x.garson_ad, x.olusturma)
     from ads_kalemler x where x.adisyon_id = a.id and x.durum = 'aktif';
  perform ads_log('odeme_silindi', g, a.id, null, null, null, null, null, -o.tutar, o.tur, 'Hesap iptal')
     from ads_odemeler o where o.adisyon_id = a.id;

  update ads_urunler u set stok = u.stok + x.toplam
    from (select urun_id, sum(adet) toplam from ads_kalemler where adisyon_id = a.id and durum = 'aktif' group by urun_id) x
   where u.id = x.urun_id and u.stok is not null;
  update ads_kalemler set durum = 'iptal', iptal_eden = g.ad, iptal_neden = coalesce(nullif(trim(p_neden), ''), 'Hesap iptal'), iptal_zaman = now()
   where adisyon_id = a.id and durum = 'aktif';
  delete from ads_odemeler where adisyon_id = a.id;
  update ads_adisyonlar set durum = 'iptal', kapanis = now(), kapatan_ad = g.ad, notu = nullif(trim(p_neden), '') where id = a.id;
  perform ads_log('hesap_iptal', g, a.id, null, null, null, null, null, null, null, p_neden);
  update ads_masalar set aktif = false where id = a.masa_id and tur = 'paket';

  perform (select 1);
  for ist_i in select jsonb_object_keys(liste) loop
    insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('iptal', ist_i::int, jsonb_build_object(
      'masa', masa_ad, 'garson', g.ad, 'zaman', now(), 'neden', coalesce(nullif(trim(p_neden), ''), 'Hesap iptal'),
      'istasyon', ist_i::int, 'kalemler', liste->ist_i));
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- GÜN SONU DÜZELTME: kapanmış hesaplarda iptal / geri açma (yönetici)
-- Fiş basılmaz. İptal edilen tutar hesabın ödemelerinden düşülür
-- (önce ikram/indirim/garson ikramı, sonra en son alınan nakit/kart).
-- ---------------------------------------------------------------------
create or replace function public.ads_odeme_fazlasini_dus(p_adisyon uuid) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare fazla numeric; o ads_odemeler; d numeric; dusulen jsonb := '[]'::jsonb;
begin
  fazla := coalesce((select sum(tutar) from ads_odemeler where adisyon_id = p_adisyon), 0) - ads_net(p_adisyon);
  for o in select * from ads_odemeler where adisyon_id = p_adisyon
           order by (tur in ('nakit','kart')), olusturma desc loop
    exit when fazla <= 0.009;
    d := least(o.tutar, round(fazla, 2));
    if d >= o.tutar - 0.009 then delete from ads_odemeler where id = o.id;
    else update ads_odemeler set tutar = tutar - d where id = o.id; end if;
    fazla := fazla - d;
    dusulen := dusulen || jsonb_build_object('tur', o.tur, 'tutar', d, 'garson', o.ikram_garson_ad);
  end loop;
  return dusulen;
end $$;

create or replace function public.ads_kapali_kalem_iptal(p_kalem uuid, p_adet int, p_neden text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; k ads_kalemler; a ads_adisyonlar; n int; neden text; dusulen jsonb;
begin
  g := ads_izin_zorunlu('kapali_duzelt');
  select * into k from ads_kalemler where id = p_kalem for update;
  if k.id is null or k.durum <> 'aktif' then raise exception 'Bu ürün zaten iptal edilmiş.'; end if;
  select * into a from ads_adisyonlar where id = k.adisyon_id for update;
  if a.durum <> 'kapali' then raise exception 'Bu hesap kapalı değil; masadan iptal et.'; end if;
  neden := coalesce(nullif(trim(p_neden), ''), 'Gün sonu düzeltme');
  n := least(greatest(coalesce(p_adet, k.adet), 1), k.adet);
  update ads_urunler set stok = stok + n where id = k.urun_id and stok is not null;
  if n = k.adet then
    update ads_kalemler set durum = 'iptal', iptal_eden = g.ad, iptal_neden = neden, iptal_zaman = now() where id = k.id;
  else
    update ads_kalemler set adet = adet - n where id = k.id;
    insert into ads_kalemler (adisyon_id, urun_id, ad, fiyat, adet, notu, durum, siparis_no, garson_ad, olusturma, iptal_eden, iptal_neden, iptal_zaman)
    values (k.adisyon_id, k.urun_id, k.ad, k.fiyat, n, k.notu, 'iptal', k.siparis_no, k.garson_ad, k.olusturma, g.ad, neden, now());
  end if;
  perform ads_log('iptal', g, a.id, null, k.ad, k.kategori, -n, k.fiyat, -(n * k.fiyat), null, concat_ws(' · ', case when nullif(trim(k.notu), '') is not null then 'Not: ' || trim(k.notu) end, 'Gün sonu düzeltme: ' || neden), k.siparis_no, k.garson_ad, k.olusturma);
  dusulen := ads_odeme_fazlasini_dus(a.id);
  perform ads_log('odeme_duzeltme', g, a.id, null, null, null, null, null, -(d->>'tutar')::numeric, d->>'tur', 'Gün sonu iptal nedeniyle düşüldü')
     from jsonb_array_elements(dusulen) d;
  return jsonb_build_object('adet', n, 'ad', k.ad, 'dusulen', dusulen);
end $$;

create or replace function public.ads_kapali_hesap_iptal(p_adisyon uuid, p_neden text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; a ads_adisyonlar; neden text;
begin
  g := ads_izin_zorunlu('kapali_duzelt');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'kapali' then raise exception 'Bu hesap kapalı değil.'; end if;
  neden := coalesce(nullif(trim(p_neden), ''), 'Gün sonu düzeltme');
  perform ads_log('iptal', g, a.id, null, x.ad, x.kategori, -x.adet, x.fiyat, -(x.adet * x.fiyat), null,
                  concat_ws(' · ', case when nullif(trim(x.notu), '') is not null then 'Not: ' || trim(x.notu) end, 'Gün sonu düzeltme: ' || neden), x.siparis_no, x.garson_ad, x.olusturma)
     from ads_kalemler x where x.adisyon_id = a.id and x.durum = 'aktif';
  perform ads_log('odeme_silindi', g, a.id, null, null, null, null, null, -o.tutar, o.tur, 'Gün sonu hesap iptali')
     from ads_odemeler o where o.adisyon_id = a.id;
  update ads_urunler u set stok = u.stok + x.toplam
    from (select urun_id, sum(adet) toplam from ads_kalemler where adisyon_id = a.id and durum = 'aktif' group by urun_id) x
   where u.id = x.urun_id and u.stok is not null;
  update ads_kalemler set durum = 'iptal', iptal_eden = g.ad, iptal_neden = neden, iptal_zaman = now()
   where adisyon_id = a.id and durum = 'aktif';
  delete from ads_odemeler where adisyon_id = a.id;
  update ads_adisyonlar set durum = 'iptal', notu = neden where id = a.id;
  perform ads_log('hesap_iptal', g, a.id, null, null, null, null, null, null, null, 'Gün sonu düzeltme: ' || neden);
end $$;

-- yanlışlıkla kapatılan hesabı masaya geri açar (ödemeler yerinde kalır)
create or replace function public.ads_hesap_geri_ac(p_adisyon uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a ads_adisyonlar; m ads_masalar; g ads_garsonlar;
begin
  g := ads_izin_zorunlu('kapali_duzelt');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'kapali' then raise exception 'Bu hesap kapalı değil.'; end if;
  select * into m from ads_masalar where id = a.masa_id for update;
  if not m.aktif and m.tur = 'masa' then raise exception '% silinmiş bir masa; önce Yönetim''den geri ekle.', m.ad; end if;
  if exists (select 1 from ads_adisyonlar where masa_id = a.masa_id and durum = 'acik') then
    raise exception '% masasında şu an açık hesap var. Önce onu kapat ya da taşı.', m.ad;
  end if;
  update ads_masalar set aktif = true where id = m.id;
  update ads_adisyonlar set durum = 'acik', kapanis = null, kapatan_ad = null where id = a.id;
  perform ads_log('hesap_geri_acildi', g, a.id);
end $$;

-- ---------------------------------------------------------------------
-- GÜN SONU (manuel mod): tek tuşla günü kapatır, yeni gün başlar
-- ---------------------------------------------------------------------
create or replace function public.ads_gun_sonu_al() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; bas timestamptz; r ads_gunler; oz jsonb;
begin
  g := ads_izin_zorunlu('gunsonu');
  if (select gun_sonu_modu from ads_ayarlar where id = 1) <> 'manuel' then
    raise exception 'Gün sonu otomatik modda; Ayarlar''dan manuele al.';
  end if;
  -- aynı anda iki kez basılırsa ikinci istek beklesin
  perform pg_advisory_xact_lock(424242);
  bas := ads_gun_baslangic();
  if now() - bas < interval '1 minute' then raise exception 'Gün sonu az önce alındı.'; end if;
  select jsonb_build_object(
      'kapanan_hesap', count(*) filter (where a.durum = 'kapali'),
      'net', coalesce(sum(ads_net(a.id)) filter (where a.durum = 'kapali'), 0),
      'nakit', coalesce((select sum(o.tutar) from ads_odemeler o join ads_adisyonlar x on x.id = o.adisyon_id
                          where x.durum = 'kapali' and x.kapanis >= bas and x.kapanis < now() and o.tur = 'nakit'), 0),
      'kart', coalesce((select sum(o.tutar) from ads_odemeler o join ads_adisyonlar x on x.id = o.adisyon_id
                          where x.durum = 'kapali' and x.kapanis >= bas and x.kapanis < now() and o.tur = 'kart'), 0),
      'acik_hesap', (select count(*) from ads_adisyonlar where durum = 'acik'))
    into oz
    from ads_adisyonlar a where a.kapanis >= bas and a.kapanis < now();
  insert into ads_gunler (baslangic, bitis, kapatan, ozet) values (bas, now(), g.ad, oz) returning * into r;
  perform ads_log('gun_sonu', g, null, null, null, null, null, null, (oz->>'net')::numeric, null,
                  'Gün sonu alındı · ' || (oz->>'kapanan_hesap') || ' hesap' ||
                  case when (oz->>'acik_hesap')::int > 0 then ' · ' || (oz->>'acik_hesap') || ' açık hesap sonraki güne kaldı' else '' end);
  return jsonb_build_object('id', r.id, 'baslangic', r.baslangic, 'bitis', r.bitis, 'kapatan', r.kapatan, 'ozet', r.ozet);
end $$;

-- yöneticinin hazırladığı rapor fişini kasadaki yazıcıya gönderir
create or replace function public.ads_fis_rapor(p_html text, p_baslik text) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_izin_zorunlu('rapor');
  insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('rapor', 0, jsonb_build_object('html', p_html, 'masa', coalesce(p_baslik, 'Rapor'), 'garson', g.ad, 'zaman', now()));
end $$;

create or replace function public.ads_gun_durum() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform ads_garson_zorunlu();
  return jsonb_build_object('baslangic', ads_gun_baslangic(), 'simdi', now());
end $$;

-- ---------------------------------------------------------------------
-- OTOMATİK YEDEK
-- Google Apps Script 15 dakikada bir sorar: "biten ama yedeklenmemiş gün var mı?"
-- ---------------------------------------------------------------------
create or replace function public.ads_yedek_bekleyenler()
returns table (gun text, etiket text, baslangic timestamptz, bitis timestamptz)
language sql stable security definer set search_path = public as $$
  with a as (select * from ads_ayarlar where id = 1),
  z as (select yedek_baslangic from ads_gizli where id = 1),
  son as (select coalesce(max(bitis), '-infinity'::timestamptz) as t from ads_gunler),
  donem as (
    select 'g:' || g.id as gun, g.baslangic as bs, g.bitis as bt from ads_gunler g
    union all
    select 'd:' || to_char(d, 'YYYY-MM-DD'),
           greatest((d + make_interval(hours => a.gun_basi_saat)) at time zone 'Europe/Istanbul', son.t),
           (d + interval '1 day' + make_interval(hours => a.gun_basi_saat)) at time zone 'Europe/Istanbul'
      from a, son,
           generate_series(date_trunc('day', now() at time zone 'Europe/Istanbul') - interval '14 days',
                           date_trunc('day', now() at time zone 'Europe/Istanbul'), interval '1 day') d
     where a.gun_sonu_modu = 'otomatik'
  )
  select x.gun,
         to_char(((x.bt - interval '1 millisecond') at time zone 'Europe/Istanbul') - make_interval(hours => (select gun_basi_saat from a)), 'YYYY-MM-DD'),
         x.bs, x.bt
    from donem x, z
   where x.bt <= now() and x.bt > x.bs
     and x.bt > coalesce(z.yedek_baslangic, 'infinity'::timestamptz)
     and not exists (select 1 from ads_yedekler y where y.gun = x.gun)
     and exists (select 1 from ads_hareketler h where h.zaman >= x.bs and h.zaman < x.bt and h.tur not in ('giris', 'gun_sonu', 'yedek'))
   order by x.bt
$$;

create or replace function public.ads_yedek_anahtar_kontrol(p_anahtar text) returns void
language plpgsql stable security definer set search_path = public as $$
declare k text;
begin
  select yedek_anahtar into k from ads_gizli where id = 1;
  if k is null or p_anahtar is null or p_anahtar <> k then
    perform pg_sleep(0.5);
    raise exception 'Yedek anahtarı geçersiz. Uygulamada Ayarlar > Otomatik yedek bölümünden yeni kodu al.';
  end if;
end $$;

-- p_simdi = true: açık günün o ana kadarki verisi (deneme için, yedeklendi sayılmaz)
create or replace function public.ads_yedek_veri(p_anahtar text, p_max int default 3, p_simdi boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare liste jsonb := '[]'::jsonb; r record; a ads_ayarlar;
begin
  perform ads_yedek_anahtar_kontrol(p_anahtar);
  select * into a from ads_ayarlar where id = 1;
  for r in
    select * from ads_yedek_bekleyenler() where not p_simdi
    union all
    select 'deneme', to_char(((now()) at time zone 'Europe/Istanbul') - make_interval(hours => a.gun_basi_saat), 'YYYY-MM-DD'), ads_gun_baslangic(), now()
     where p_simdi
    limit greatest(1, least(coalesce(p_max, 3), 10))
  loop
    liste := liste || jsonb_build_object(
      'anahtar', r.gun, 'etiket', r.etiket, 'bas', r.baslangic, 'bit', r.bitis,
      'isletme', a.isletme_adi, 'mod', a.gun_sonu_modu,
      'hareketler', coalesce((
        select jsonb_agg(jsonb_build_object(
          'zaman', h.zaman, 'tur', h.tur, 'garson', h.garson_ad, 'masa', h.masa_ad, 'bolum', h.bolum, 'masa_tur', h.masa_tur,
          'hesap', left(h.adisyon_id::text, 8), 'siparis_no', h.siparis_no, 'urun', h.urun_ad, 'kategori', h.kategori,
          'adet', h.adet, 'birim', h.birim_fiyat, 'tutar', h.tutar, 'odeme', h.odeme_tur, 'aciklama', h.aciklama,
          'siparisi_giren', h.siparisi_giren, 'siparis_zaman', h.siparis_zaman, 'oran', coalesce(ad.indirim_oran, 0)
        ) order by h.zaman, h.id)
        from ads_hareketler h left join ads_adisyonlar ad on ad.id = h.adisyon_id
        where h.zaman >= r.baslangic and h.zaman < r.bitis), '[]'::jsonb));
  end loop;
  return liste;
end $$;

create or replace function public.ads_yedek_tamam(p_anahtar text, p_gun text, p_etiket text, p_bas timestamptz, p_bit timestamptz, p_satir int, p_dosya text) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform ads_yedek_anahtar_kontrol(p_anahtar);
  if p_gun = 'deneme' then return; end if;
  insert into ads_yedekler (gun, etiket, baslangic, bitis, satir, dosya) values (p_gun, p_etiket, p_bas, p_bit, p_satir, p_dosya)
  on conflict (gun) do nothing;
  insert into ads_hareketler (tur, garson_ad, tutar, aciklama)
  values ('yedek', 'Otomatik yedek', null, p_etiket || ' gününün yedeği Drive''a kaydedildi ve e-postayla gönderildi (' || p_satir || ' satır)');
end $$;

-- yönetici: anahtar oluştur / yenile (eskisi geçersiz olur)
create or replace function public.ads_yedek_anahtar_olustur(p_eposta text) returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare k text;
begin
  perform ads_izin_zorunlu('ayarlar');
  k := encode(gen_random_bytes(24), 'hex');
  update ads_gizli set yedek_anahtar = k, yedek_eposta = nullif(trim(p_eposta), ''),
         yedek_baslangic = coalesce(yedek_baslangic, ads_gun_baslangic()) where id = 1;
  return k;
end $$;

create or replace function public.ads_yedek_kapat() returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform ads_izin_zorunlu('ayarlar');
  update ads_gizli set yedek_anahtar = null where id = 1;
end $$;

create or replace function public.ads_yedek_durum() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare z ads_gizli;
begin
  perform ads_izin_zorunlu('ayarlar');
  select * into z from ads_gizli where id = 1;
  return jsonb_build_object(
    'kurulu', z.yedek_anahtar is not null,
    'eposta', z.yedek_eposta,
    'baslangic', z.yedek_baslangic,
    'son', coalesce((select jsonb_agg(jsonb_build_object('gun', gun, 'etiket', etiket, 'satir', satir, 'dosya', dosya, 'zaman', zaman, 'bit', bitis) order by zaman desc)
                     from (select * from ads_yedekler order by zaman desc limit 10) y), '[]'::jsonb),
    'bekleyen', coalesce((select jsonb_agg(jsonb_build_object('gun', gun, 'etiket', etiket, 'bit', bitis) order by bitis) from ads_yedek_bekleyenler()), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------
-- ÖDEME / HESAP
-- ---------------------------------------------------------------------
-- p_ikram_garson: tür 'garson_ikram' ise hangi garsonun hediye hakkından düşüleceği
create or replace function public.ads_odeme_ekle(p_adisyon uuid, p_tur text, p_tutar numeric, p_ikram_garson uuid default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; a ads_adisyonlar; ig ads_garsonlar; kalan numeric;
begin
  g := ads_izin_zorunlu('hesap');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'acik' then raise exception 'Hesap açık değil.'; end if;
  if p_tutar is null or p_tutar <= 0 then raise exception 'Tutar geçersiz.'; end if;
  if p_tur = 'garson_ikram' then
    select * into ig from ads_garsonlar where id = p_ikram_garson for update;
    if ig.id is null then raise exception 'İkram hakkı kullanılacak garsonu seç.'; end if;
    if not ads_ikram_secebilir(g, ig.id) then
      raise exception 'Sadece kendi hediye ikram hakkını kullanabilirsin.';
    end if;
    if ig.ikram_bitis is not null and ig.ikram_bitis <= now() then
      raise exception '% için hediye ikram hakkının süresi dolmuş.', ig.ad;
    end if;
    kalan := ads_ikram_kalan(ig.id);
    if round(p_tutar, 2) > kalan + 0.009 then
      raise exception '% için kalan ikram hakkı % ₺', ig.ad, kalan;
    end if;
  end if;
  insert into ads_odemeler (adisyon_id, tur, tutar, garson_ad, ikram_garson_id, ikram_garson_ad)
  values (a.id, p_tur, round(p_tutar, 2), g.ad,
          case when p_tur = 'garson_ikram' then ig.id end,
          case when p_tur = 'garson_ikram' then ig.ad end);
  perform ads_log('odeme', g, a.id, null, null, null, null, null, round(p_tutar, 2), p_tur,
                  case when p_tur = 'garson_ikram' then ig.ad || ' hediye hakkından' end);
end $$;

-- garsonun kalan hediye ikram hakkı (son sıfırlamadan beri)
-- şu anki "gün" ne zaman başladı?
--  otomatik: her gün ayarlanan saatte (İstanbul saatiyle) yeni gün başlar
--  manuel:   son alınan gün sonundan (ya da manuele geçilen andan) beri
create or replace function public.ads_gun_baslangic() returns timestamptz
language plpgsql stable security definer set search_path = public as $$
declare a ads_ayarlar; son_bitis timestamptz; sinir timestamptz; yerel timestamp;
begin
  select * into a from ads_ayarlar where id = 1;
  select max(bitis) into son_bitis from ads_gunler;
  if a.gun_sonu_modu = 'manuel' then
    return greatest(coalesce(son_bitis, '-infinity'), coalesce(a.manuel_baslangic, '-infinity'), '2000-01-01'::timestamptz);
  end if;
  yerel := (now() at time zone 'Europe/Istanbul') - make_interval(hours => a.gun_basi_saat);
  sinir := (date_trunc('day', yerel) + make_interval(hours => a.gun_basi_saat)) at time zone 'Europe/Istanbul';
  return greatest(sinir, coalesce(son_bitis, '-infinity'));
end $$;

create or replace function public.ads_ikram_kalan(p_garson uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select case when g.ikram_bitis is not null and g.ikram_bitis <= now() then 0 else greatest(0, g.ikram_limit - coalesce((
           select sum(o.tutar) from ads_odemeler o join ads_adisyonlar a on a.id = o.adisyon_id
            where o.ikram_garson_id = g.id and o.tur = 'garson_ikram'
              and o.olusturma >= greatest(g.ikram_baslangic,
                    case when (select ikram_gunluk from ads_ayarlar where id = 1) then ads_gun_baslangic() else '-infinity'::timestamptz end)
              and a.durum in ('acik','kapali')), 0)) end
  from ads_garsonlar g where g.id = p_garson
$$;

-- bu kullanıcı kimin hediye hakkını kullanabilir?
create or replace function public.ads_ikram_secebilir(g ads_garsonlar, p_hedef uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_hedef = g.id
      or (g.rol = 'admin' and (select ikram_kural from ads_ayarlar where id = 1) = 'yonetici_secer')
$$;

-- ödeme penceresi için: hediye hakkı olan garsonlar
create or replace function public.ads_ikram_durum() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_garson_zorunlu();
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'ad', x.ad, 'limit', x.ikram_limit, 'kendisi', x.id = g.id,
                     'bitis', x.ikram_bitis, 'bitti', (x.ikram_bitis is not null and x.ikram_bitis <= now()), 'kalan', ads_ikram_kalan(x.id), 'kullanilan', x.ikram_limit - ads_ikram_kalan(x.id)) order by x.id <> g.id, x.ad)
                   from ads_garsonlar x where x.aktif and x.ikram_limit > 0 and ads_ikram_secebilir(g, x.id)), '[]'::jsonb);
end $$;

-- hediye haklarını yeniden başlat (p_garson boşsa herkesin)
create or replace function public.ads_ikram_sifirla(p_garson uuid default null) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  perform ads_admin_zorunlu();
  update ads_garsonlar set ikram_baslangic = now() where p_garson is null or id = p_garson;
end $$;

-- personel hesabı: açınca ayarlardaki oran kadar (varsayılan %33) indirim
create or replace function public.ads_personel_hesap(p_adisyon uuid, p_acik boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare a ads_adisyonlar; g ads_garsonlar; oran int;
begin
  g := ads_izin_zorunlu('indirim');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'acik' then raise exception 'Hesap açık değil.'; end if;
  oran := case when p_acik then (select personel_oran from ads_ayarlar where id = 1) else 0 end;
  update ads_adisyonlar set indirim_oran = oran where id = a.id;
  perform ads_log('personel_indirimi', g, a.id, null, null, null, null, null, null, null,
                  case when p_acik then 'Açıldı (%' || oran || ')' else 'Kaldırıldı' end);
end $$;

-- ---------------------------------------------------------------------
-- PAKET SERVİS: her paket kendi "masası" olur, hesap kapanınca kaybolur
-- ---------------------------------------------------------------------
create or replace function public.ads_paket_ac(p_musteri text) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; v_id uuid; no int;
begin
  g := ads_izin_zorunlu('paket');
  no := nextval('ads_paket_no_seq');
  insert into ads_masalar (ad, sira, tur)
  values ('Paket ' || no || coalesce(' · ' || nullif(trim(p_musteri), ''), ''), 100000 + no, 'paket')
  returning id into v_id;
  perform ads_log('paket_acildi', g, null, v_id, null, null, null, null, null, null, nullif(trim(p_musteri), ''));
  return v_id;
end $$;

create or replace function public.ads_paket_sil(p_masa uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_izin_zorunlu('paket');
  if exists (select 1 from ads_adisyonlar where masa_id = p_masa and durum = 'acik') then
    raise exception 'Bu paketin açık hesabı var. Önce hesabı kapat ya da iptal et.';
  end if;
  update ads_masalar set aktif = false where id = p_masa and tur = 'paket';
  perform ads_log('paket_silindi', g, null, p_masa);
end $$;

create or replace function public.ads_odeme_sil(p_odeme uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; o ads_odemeler;
begin
  g := ads_izin_zorunlu('hesap');
  select * into o from ads_odemeler where id = p_odeme;
  if o.id is null then return; end if;
  if (select durum from ads_adisyonlar where id = o.adisyon_id) <> 'acik' then
    raise exception 'Kapanmış hesaptan ödeme silinemez.';
  end if;
  delete from ads_odemeler where id = o.id;
  perform ads_log('odeme_silindi', g, o.adisyon_id, null, null, null, null, null, -o.tutar, o.tur, null);
end $$;

create or replace function public.ads_hesap_fisi(p_adisyon uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; v jsonb;
begin
  g := ads_izin_zorunlu('hesap');
  v := ads_hesap_ozeti(p_adisyon);
  if v is null then raise exception 'Hesap bulunamadı.'; end if;
  insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('hesap', 0,
    v || jsonb_build_object('garson', g.ad, 'zaman', now(), 'ara', true));
  perform ads_log('ara_hesap', g, p_adisyon, null, null, null, null, null, (v->>'net')::numeric);
end $$;

create or replace function public.ads_hesap_kapat(p_adisyon uuid, p_yazdir boolean) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; a ads_adisyonlar; v jsonb;
begin
  g := ads_izin_zorunlu('hesap');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'acik' then raise exception 'Hesap zaten kapalı.'; end if;
  v := ads_hesap_ozeti(a.id);
  if (v->>'odenen')::numeric + 0.009 < (v->>'net')::numeric then
    raise exception 'Ödenmemiş tutar var: % ₺', round((v->>'net')::numeric - (v->>'odenen')::numeric, 2);
  end if;
  update ads_adisyonlar set durum = 'kapali', kapanis = now(), kapatan_ad = g.ad where id = a.id;
  perform ads_log('hesap_kapandi', g, a.id, null, null, null, null, null, (v->>'net')::numeric, null,
                  case when a.indirim_oran > 0 then 'Personel %' || a.indirim_oran end);
  update ads_masalar set aktif = false where id = a.masa_id and tur = 'paket';
  if p_yazdir and (v->>'toplam')::numeric > 0 then
    insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('hesap', 0,
      v || jsonb_build_object('garson', g.ad, 'zaman', now(), 'ara', false));
  end if;
end $$;

-- masayı başka masaya taşı (hedef doluysa birleştirir)
create or replace function public.ads_masa_tasi(p_adisyon uuid, p_hedef_masa uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar; a ads_adisyonlar; hedef_id uuid; kaynak_ad text; hedef_ad text;
begin
  g := ads_izin_zorunlu('masa_tasi');
  select * into a from ads_adisyonlar where id = p_adisyon for update;
  if a.id is null or a.durum <> 'acik' then raise exception 'Hesap açık değil.'; end if;
  if a.masa_id = p_hedef_masa then return; end if;
  perform 1 from ads_masalar where id = p_hedef_masa and aktif for update;
  if not found then raise exception 'Hedef masa bulunamadı.'; end if;

  select ad into kaynak_ad from ads_masalar where id = a.masa_id;
  select ad into hedef_ad from ads_masalar where id = p_hedef_masa;
  select id into hedef_id from ads_adisyonlar where masa_id = p_hedef_masa and durum = 'acik' for update;
  perform ads_log('masa_tasindi', g, a.id, null, null, null, null, null, null, null,
                  kaynak_ad || ' → ' || hedef_ad || case when hedef_id is not null then ' (hesaplar birleşti)' else '' end);
  if hedef_id is null then
    update ads_adisyonlar set masa_id = p_hedef_masa where id = a.id;
  else
    update ads_kalemler set adisyon_id = hedef_id where adisyon_id = a.id;
    update ads_odemeler set adisyon_id = hedef_id where adisyon_id = a.id;
    update ads_adisyonlar set durum = 'birlesti', kapanis = now(), kapatan_ad = g.ad where id = a.id;
  end if;
  update ads_masalar set aktif = false where id = a.masa_id and tur = 'paket';
end $$;

-- ---------------------------------------------------------------------
-- KASA (yazıcı) — sadece yönetici
-- ---------------------------------------------------------------------
-- fişi "alır": iki kasa ekranı açık olsa bile her fiş tek kere basılır.
-- p_tekrar = true ise basılmış fişi yeniden basmak için döndürür.
drop function if exists public.ads_fis_basildi(bigint);
create or replace function public.ads_fis_al(p_id bigint, p_tekrar boolean default false) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare f ads_fis_kuyrugu;
begin
  perform ads_izin_zorunlu('kasa');
  if p_tekrar then
    select * into f from ads_fis_kuyrugu where id = p_id;
  else
    update ads_fis_kuyrugu set basildi = true where id = p_id and not basildi returning * into f;
  end if;
  if f.id is null then return null; end if;
  return jsonb_build_object('id', f.id, 'tur', f.tur, 'veri', f.veri, 'olusturma', f.olusturma);
end $$;

create or replace function public.ads_fis_test(p_istasyon int default 0) returns void
language plpgsql volatile security definer set search_path = public as $$
declare g ads_garsonlar;
begin
  g := ads_izin_zorunlu('kasa');
  insert into ads_fis_kuyrugu (tur, istasyon, veri) values ('test', coalesce(p_istasyon, 0), jsonb_build_object('garson', g.ad, 'zaman', now(), 'istasyon', coalesce(p_istasyon, 0)));
end $$;

-- ---------------------------------------------------------------------
-- GARSON YÖNETİMİ — sadece yönetici
-- ---------------------------------------------------------------------
create or replace function public.ads_garson_listesi() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform ads_admin_zorunlu();
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'ad', ad, 'kullanici', kullanici, 'rol', rol, 'aktif', aktif,
                     'ikram_limit', ikram_limit, 'ikram_kalan', ads_ikram_kalan(id), 'ikram_bitis', ikram_bitis, 'ikram_baslangic', ikram_baslangic, 'bolumler', bolumler,
                     'rol_id', rol_id, 'izin_ozel', to_jsonb(izin_ozel), 'rol_ad', (ads_kimlik(ads_garsonlar)->>'rol_ad')) order by aktif desc, rol, ad)
                   from ads_garsonlar), '[]'::jsonb);
end $$;

drop function if exists public.ads_garson_kaydet(uuid, text, text, text, text, boolean, numeric, text[]);
drop function if exists public.ads_garson_kaydet(uuid, text, text, text, text, boolean, numeric, text[], uuid, text[]);
create or replace function public.ads_garson_kaydet(p_id uuid, p_ad text, p_kullanici text, p_pin text, p_rol text, p_aktif boolean, p_ikram_limit numeric default 0, p_bolumler text[] default '{}',
  p_rol_id uuid default null, p_izin_ozel text[] default null, p_ikram_bitis timestamptz default null) returns void
language plpgsql volatile security definer set search_path = public, extensions as $$
declare g ads_garsonlar; r ads_roller; v_rol text; v_rol_id uuid; v_ozel text[];
begin
  g := ads_admin_zorunlu();
  if coalesce(trim(p_ad), '') = '' or coalesce(trim(p_kullanici), '') = '' then
    raise exception 'Ad ve kullanıcı adı boş olamaz.';
  end if;
  if p_pin is not null and length(p_pin) < 4 then
    raise exception 'Şifre en az 4 karakter olmalı.';
  end if;
  if exists (select 1 from ads_garsonlar where lower(kullanici) = lower(trim(p_kullanici)) and id is distinct from p_id) then
    raise exception 'Bu kullanıcı adı başka birinde var.';
  end if;
  if p_rol_id is not null then
    select * into r from ads_roller where id = p_rol_id;
    if r.id is null then raise exception 'Rol bulunamadı.'; end if;
    v_rol := case when r.sistem = 'yonetici' then 'admin' else 'garson' end;
    v_rol_id := r.id;
  else
    v_rol := case when p_rol = 'admin' then 'admin' else 'garson' end;
    select id into v_rol_id from ads_roller where sistem = case when v_rol = 'admin' then 'yonetici' else 'garson' end;
  end if;
  v_ozel := case when v_rol = 'admin' or p_izin_ozel is null then null
                 else coalesce((select array_agg(distinct x) from unnest(p_izin_ozel) x where x = any(ads_tum_izinler())), '{}') end;
  if p_id = g.id and (v_rol <> 'admin' or not coalesce(p_aktif, true)) then
    raise exception 'Kendi yönetici hesabını kapatamazsın.';
  end if;

  if p_id is null then
    if p_pin is null then raise exception 'Yeni hesap için şifre gir.'; end if;
    insert into ads_garsonlar (ad, kullanici, pin_hash, rol, aktif, ikram_limit, ikram_bitis, bolumler, rol_id, izin_ozel)
    values (trim(p_ad), trim(p_kullanici), crypt(p_pin, gen_salt('bf')), v_rol, coalesce(p_aktif, true), greatest(coalesce(p_ikram_limit, 0), 0), p_ikram_bitis, coalesce(p_bolumler, '{}'), v_rol_id, v_ozel);
  else
    update ads_garsonlar set ad = trim(p_ad), kullanici = trim(p_kullanici), rol = v_rol, rol_id = v_rol_id, izin_ozel = v_ozel, aktif = coalesce(p_aktif, true),
           ikram_limit = greatest(coalesce(p_ikram_limit, 0), 0), ikram_bitis = p_ikram_bitis,
           bolumler = coalesce(p_bolumler, '{}'),
           pin_hash = case when p_pin is null then pin_hash else crypt(p_pin, gen_salt('bf')) end
     where id = p_id;
    if not coalesce(p_aktif, true) or p_pin is not null then
      delete from ads_oturumlar where garson_id = p_id and token is distinct from ads_token();
    end if;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- ---------------------------------------------------------------------
-- KATEGORİLER (menü yönetimi) — sadece yönetici değiştirir
-- ---------------------------------------------------------------------
create or replace function public.ads_kategori_kaydet(p_id uuid, p_ad text, p_istasyon int, p_aktif boolean) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare k ads_kategoriler; v_id uuid; eski text;
begin
  perform ads_izin_zorunlu('menu');
  if coalesce(trim(p_ad), '') = '' then raise exception 'Kategori adı boş olamaz.'; end if;
  if exists (select 1 from ads_kategoriler where lower(ad) = lower(trim(p_ad)) and id is distinct from p_id) then
    raise exception 'Bu adda bir kategori zaten var.';
  end if;
  if p_id is null then
    insert into ads_kategoriler (ad, sira, istasyon, aktif)
    values (trim(p_ad), coalesce((select max(sira) from ads_kategoriler), 0) + 1, coalesce(p_istasyon, 1), coalesce(p_aktif, true))
    returning id into v_id;
    return v_id;
  else
    select * into k from ads_kategoriler where id = p_id;
    if k.id is null then raise exception 'Kategori bulunamadı.'; end if;
    eski := k.ad;
    update ads_kategoriler set ad = trim(p_ad), istasyon = coalesce(p_istasyon, istasyon), aktif = coalesce(p_aktif, true) where id = p_id;
    if lower(eski) <> lower(trim(p_ad)) then
      update ads_urunler set kategori = trim(p_ad) where lower(kategori) = lower(eski);
    end if;
    return p_id;
  end if;
end $$;

-- kategoriyi sil; ürünleri p_hedef kategorisine taşı (p_hedef boşsa "Genel")
create or replace function public.ads_kategori_sil(p_id uuid, p_hedef text default null) returns void
language plpgsql volatile security definer set search_path = public as $$
declare eski text; hedef text;
begin
  perform ads_izin_zorunlu('menu');
  select ad into eski from ads_kategoriler where id = p_id;
  if eski is null then return; end if;
  if exists (select 1 from ads_urunler where lower(kategori) = lower(eski)) then
    hedef := coalesce(nullif(trim(p_hedef), ''), 'Genel');
    insert into ads_kategoriler (ad, sira) select hedef, coalesce((select max(sira) from ads_kategoriler), 0) + 1
      where not exists (select 1 from ads_kategoriler where lower(ad) = lower(hedef));
    update ads_urunler set kategori = hedef where lower(kategori) = lower(eski);
  end if;
  delete from ads_kategoriler where id = p_id;
end $$;

create or replace function public.ads_kategori_sirala(p_sira uuid[]) returns void
language plpgsql volatile security definer set search_path = public as $$
declare i int;
begin
  perform ads_izin_zorunlu('menu');
  for i in 1 .. coalesce(array_length(p_sira, 1), 0) loop
    update ads_kategoriler set sira = i where id = p_sira[i];
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- MÜŞTERİ MENÜSÜ (QR): girişsiz, salt-okunur. Sadece aktif kategori/ürün.
-- Hiçbir fiyat/isim dışında veri sızmaz; sipariş verilemez.
-- SÜRÜM 14: gecelere ad verme ("Balık günü", "Tantuni günü") — haftalık karşılaştırmada görünür
create table if not exists public.ads_gece_etiket (
  gun    text primary key,      -- etkinlik günü, 'YYYY-MM-DD'
  etiket text not null check (length(etiket) <= 40)
);
alter table public.ads_gece_etiket enable row level security;
revoke all on public.ads_gece_etiket from anon, authenticated;
grant select, insert, update, delete on public.ads_gece_etiket to anon, authenticated;
drop policy if exists ads_oku on public.ads_gece_etiket;
create policy ads_oku on public.ads_gece_etiket for select to anon, authenticated using ((select public.ads_garson_id()) is not null);
drop policy if exists ads_ekle on public.ads_gece_etiket;
create policy ads_ekle on public.ads_gece_etiket for insert to anon, authenticated with check ((select public.ads_izin('rapor')));
drop policy if exists ads_guncelle on public.ads_gece_etiket;
create policy ads_guncelle on public.ads_gece_etiket for update to anon, authenticated using ((select public.ads_izin('rapor'))) with check ((select public.ads_izin('rapor')));
drop policy if exists ads_sil on public.ads_gece_etiket;
create policy ads_sil on public.ads_gece_etiket for delete to anon, authenticated using ((select public.ads_izin('rapor')));

-- SÜRÜM 13: haftalık menü şablonları (balık günü, tantuni günü…)
create table if not exists public.ads_menu_sablonlar (
  id         uuid primary key default gen_random_uuid(),
  ad         text not null,
  veri       jsonb not null,
  olusturan  text,
  olusturma  timestamptz not null default now()
);
alter table public.ads_menu_sablonlar enable row level security;
revoke all on public.ads_menu_sablonlar from anon, authenticated;
grant select on public.ads_menu_sablonlar to anon, authenticated;
drop policy if exists ads_oku on public.ads_menu_sablonlar;
create policy ads_oku on public.ads_menu_sablonlar for select to anon, authenticated using ((select public.ads_izin('menu')));

-- şu anki menüyü (bütün ürünler + fiyatlar + kategoriler + QR menü yazıları) kaydet
create or replace function public.ads_sablon_kaydet(p_ad text, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare g ads_garsonlar; v jsonb; yeni uuid;
begin
  g := ads_izin_zorunlu('menu');
  if coalesce(trim(p_ad), '') = '' then raise exception 'Şablona bir ad ver.'; end if;
  v := jsonb_build_object(
    'urunler', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'ad', u.ad, 'fiyat', u.fiyat, 'aktif', u.aktif, 'kategori', u.kategori, 'sira', u.sira)) from ads_urunler u), '[]'::jsonb),
    'kategoriler', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'ad', c.ad, 'aktif', c.aktif, 'sira', c.sira, 'istasyon', c.istasyon)) from ads_kategoriler c), '[]'::jsonb),
    'menu_baslik', (select menu_baslik from ads_ayarlar where id = 1),
    'menu_aciklama', (select menu_aciklama from ads_ayarlar where id = 1));
  if p_id is not null then
    update ads_menu_sablonlar set ad = trim(p_ad), veri = v, olusturan = g.ad, olusturma = now() where id = p_id returning id into yeni;
  end if;
  if yeni is null then
    insert into ads_menu_sablonlar (ad, veri, olusturan) values (trim(p_ad), v, g.ad) returning id into yeni;
  end if;
  return yeni;
end $$;

-- şablonu uygula: silinmiş ürünler/kategoriler geri eklenir, listedekiler açılır ve fiyatları geri gelir,
-- "tükendi" sıfırlanır; şablonda olmayan ürünler kapatılır. Stok sayıları değişmez.
-- (eski şablonlarda kategori bilgisi yoksa geri eklenen ürün "Genel" kategorisine gider)
create or replace function public.ads_sablon_uygula(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare g ads_garsonlar; v jsonb; e jsonb; acik int; geri int := 0; kat text; mevcut uuid;
begin
  g := ads_izin_zorunlu('menu');
  select veri into v from ads_menu_sablonlar where id = p_id;
  if v is null then raise exception 'Şablon bulunamadı.'; end if;

  -- kategoriler: yoksa oluştur, varsa durumunu geri getir
  for e in select * from jsonb_array_elements(coalesce(v->'kategoriler', '[]'::jsonb)) loop
    if e ? 'ad' and coalesce(trim(e->>'ad'), '') <> '' then
      select id into mevcut from ads_kategoriler where lower(ad) = lower(trim(e->>'ad'));
      if mevcut is null then
        insert into ads_kategoriler (id, ad, sira, aktif, istasyon)
          values (coalesce((e->>'id')::uuid, gen_random_uuid()), trim(e->>'ad'), coalesce((e->>'sira')::int, 0), coalesce((e->>'aktif')::boolean, true), coalesce((e->>'istasyon')::int, 1))
          on conflict do nothing;
      else
        update ads_kategoriler set aktif = coalesce((e->>'aktif')::boolean, true) where id = mevcut;
      end if;
    else
      update ads_kategoriler set aktif = coalesce((e->>'aktif')::boolean, true) where id = (e->>'id')::uuid;
    end if;
  end loop;

  -- ürünler: varsa güncelle, silinmişse aynı kimlikle geri ekle
  for e in select * from jsonb_array_elements(coalesce(v->'urunler', '[]'::jsonb)) loop
    kat := coalesce(nullif(trim(e->>'kategori'), ''), 'Genel');
    update ads_urunler set aktif = coalesce((e->>'aktif')::boolean, false), fiyat = coalesce((e->>'fiyat')::numeric, fiyat), tukendi = false
     where id = (e->>'id')::uuid;
    if not found then
      insert into ads_urunler (id, kategori, ad, fiyat, sira, aktif)
        values ((e->>'id')::uuid, kat, e->>'ad', coalesce((e->>'fiyat')::numeric, 0), coalesce((e->>'sira')::int, 0), coalesce((e->>'aktif')::boolean, true));
      geri := geri + 1;
      if not exists (select 1 from ads_kategoriler where lower(ad) = lower(kat)) then
        insert into ads_kategoriler (ad, sira, aktif, istasyon) values (kat, (select coalesce(max(sira), 0) + 1 from ads_kategoriler), true, 1);
      end if;
    end if;
  end loop;
  update ads_urunler set aktif = false
   where id not in (select (x->>'id')::uuid from jsonb_array_elements(coalesce(v->'urunler', '[]'::jsonb)) x);
  update ads_ayarlar set menu_baslik = v->>'menu_baslik', menu_aciklama = v->>'menu_aciklama' where id = 1;
  select count(*) into acik from ads_urunler where aktif;
  return jsonb_build_object('acik', acik, 'geri_eklenen', geri);
end $$;

create or replace function public.ads_sablon_sil(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform ads_izin_zorunlu('menu');
  delete from ads_menu_sablonlar where id = p_id;
end $$;

-- ---------------------------------------------------------------------
-- SÜRÜM 12: ürün fotoğrafı + işletme logosu
alter table public.ads_ayarlar add column if not exists logo text;
alter table public.ads_ayarlar add column if not exists menu_isletme text;  -- QR menüde görünen ad (boşsa işletme adı)
alter table public.ads_ayarlar add column if not exists menu_baslik text;   -- QR menünün üstündeki küçük başlık (boşsa "Menü")   -- renkli logo (data URL, PNG)
create table if not exists public.ads_urun_fotolar (
  urun_id     uuid primary key references public.ads_urunler(id) on delete cascade,
  veri        text not null check (length(veri) < 200000 and veri like 'data:image/%'),
  guncelleme  timestamptz not null default now()
);

-- menü sitesi fotoğrafları ayrı çeker (menü 30 sn'de bir yenilenir, fotoğraflar sadece değişince iner)
create or replace function public.ads_menu_gorseller() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'logo', (select logo from ads_ayarlar where id = 1),
    'urunler', coalesce((select jsonb_object_agg(f.urun_id::text, jsonb_build_object('v', left(md5(f.veri), 8), 'd', f.veri))
                           from ads_urun_fotolar f join ads_urunler u on u.id = f.urun_id where u.aktif), '{}'::jsonb))
$$;
-- giriş ekranı logosu (giriş yapmadan önce görünür)
create or replace function public.ads_logo_public() returns text
language sql stable security definer set search_path = public as $$
  select logo from ads_ayarlar where id = 1
$$;

create or replace function public.ads_menu_public() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'isletme', (select coalesce(nullif(trim(menu_isletme), ''), isletme_adi) from ads_ayarlar where id = 1),
    'aciklama', (select menu_aciklama from ads_ayarlar where id = 1),
    'baslik', (select menu_baslik from ads_ayarlar where id = 1),
    'logo_v', (select left(md5(logo), 8) from ads_ayarlar where id = 1),
    'kategoriler', coalesce((
      select jsonb_agg(jsonb_build_object(
          'ad', c.ad,
          'urunler', coalesce((
            select jsonb_agg(jsonb_build_object('id', u.id, 'ad', u.ad, 'fiyat', u.fiyat,
                     'f', (select left(md5(f.veri), 8) from ads_urun_fotolar f where f.urun_id = u.id),
                     'yok', (u.tukendi or (u.stok is not null and u.stok <= 0)))
                   order by u.sira, u.ad)
            from ads_urunler u where lower(u.kategori) = lower(c.ad) and u.aktif
              and not ((select menu_tukenen_gizle from ads_ayarlar where id = 1)
                       and (u.tukendi or (u.stok is not null and u.stok <= 0))) ), '[]'::jsonb))
        order by c.sira, c.ad)
      from ads_kategoriler c
      where c.aktif
        and exists (select 1 from ads_urunler u where lower(u.kategori) = lower(c.ad) and u.aktif
              and not ((select menu_tukenen_gizle from ads_ayarlar where id = 1)
                       and (u.tukendi or (u.stok is not null and u.stok <= 0))))
    ), '[]'::jsonb))
$$;

-- GÜVENLİK (RLS): okuma için geçerli oturum, menü/masa/ayar değişikliği
-- için yönetici gerekir. Diğer her şey yukarıdaki fonksiyonlarla yapılır.
-- ---------------------------------------------------------------------
alter table public.ads_garsonlar   enable row level security;
alter table public.ads_oturumlar   enable row level security;
alter table public.ads_istekler    enable row level security;
alter table public.ads_masalar     enable row level security;
alter table public.ads_urunler     enable row level security;
alter table public.ads_adisyonlar  enable row level security;
alter table public.ads_kalemler    enable row level security;
alter table public.ads_odemeler    enable row level security;
alter table public.ads_fis_kuyrugu enable row level security;
alter table public.ads_ayarlar     enable row level security;
alter table public.ads_kategoriler enable row level security;
alter table public.ads_hareketler  enable row level security;
alter table public.ads_gunler      enable row level security;
alter table public.ads_gizli       enable row level security;
alter table public.ads_yedekler    enable row level security;
revoke all on public.ads_gizli, public.ads_yedekler from anon, authenticated;
revoke all on public.ads_gunler from anon, authenticated;
grant select on public.ads_gunler to anon, authenticated;
drop policy if exists ads_oku on public.ads_gunler;
create policy ads_oku on public.ads_gunler for select to anon, authenticated using ((select public.ads_garson_id()) is not null);
revoke all on public.ads_hareketler from anon, authenticated;
grant select on public.ads_hareketler to anon, authenticated;
drop policy if exists ads_oku on public.ads_hareketler;
create policy ads_oku on public.ads_hareketler for select to anon, authenticated using ((select public.ads_izin('rapor')) or (select public.ads_izin('panel')));

revoke all on public.ads_garsonlar, public.ads_oturumlar, public.ads_istekler from anon, authenticated;
revoke all on public.ads_masalar, public.ads_urunler, public.ads_adisyonlar, public.ads_kalemler,
              public.ads_odemeler, public.ads_fis_kuyrugu, public.ads_ayarlar from anon, authenticated;
grant select on public.ads_masalar, public.ads_urunler, public.ads_adisyonlar, public.ads_kalemler,
               public.ads_odemeler, public.ads_fis_kuyrugu, public.ads_ayarlar, public.ads_kategoriler to anon, authenticated;
grant insert, update, delete on public.ads_masalar, public.ads_urunler, public.ads_kategoriler to anon, authenticated;
grant update on public.ads_ayarlar to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['ads_masalar','ads_urunler','ads_adisyonlar','ads_kalemler','ads_odemeler','ads_fis_kuyrugu','ads_ayarlar'] loop
    execute format('drop policy if exists ads_oku on public.%I', t);
    execute format('create policy ads_oku on public.%I for select to anon, authenticated using ((select public.ads_garson_id()) is not null)', t);
  end loop;
  -- garson sadece kendi bölümündeki masaları görür
  drop policy if exists ads_oku on public.ads_masalar;
  create policy ads_oku on public.ads_masalar for select to anon, authenticated
    using ((select public.ads_garson_id()) is not null and public.ads_masa_gorur(bolum, tur));
  -- kategorileri her oturum okur (garson menüsü için)
  drop policy if exists ads_oku on public.ads_kategoriler;
  create policy ads_oku on public.ads_kategoriler for select to anon, authenticated using ((select public.ads_garson_id()) is not null);
  foreach t in array array['ads_masalar','ads_urunler','ads_kategoriler'] loop
    execute format('drop policy if exists ads_ekle on public.%I', t);
    execute format('drop policy if exists ads_guncelle on public.%I', t);
    execute format('drop policy if exists ads_sil on public.%I', t);
  end loop;
  -- masalar: 'masalar' izni; ürünler: 'menu' (stok için güncelleme 'stok' izniyle de olur); kategoriler: 'menu'
  create policy ads_ekle on public.ads_masalar for insert to anon, authenticated with check ((select public.ads_izin('masalar')));
  create policy ads_guncelle on public.ads_masalar for update to anon, authenticated using ((select public.ads_izin('masalar'))) with check ((select public.ads_izin('masalar')));
  create policy ads_sil on public.ads_masalar for delete to anon, authenticated using ((select public.ads_izin('masalar')));
  create policy ads_ekle on public.ads_urunler for insert to anon, authenticated with check ((select public.ads_izin('menu')));
  create policy ads_guncelle on public.ads_urunler for update to anon, authenticated using ((select public.ads_izin('menu')) or (select public.ads_izin('stok'))) with check ((select public.ads_izin('menu')) or (select public.ads_izin('stok')));
  create policy ads_sil on public.ads_urunler for delete to anon, authenticated using ((select public.ads_izin('menu')));
  create policy ads_ekle on public.ads_kategoriler for insert to anon, authenticated with check ((select public.ads_izin('menu')));
  create policy ads_guncelle on public.ads_kategoriler for update to anon, authenticated using ((select public.ads_izin('menu'))) with check ((select public.ads_izin('menu')));
  create policy ads_sil on public.ads_kategoriler for delete to anon, authenticated using ((select public.ads_izin('menu')));
  drop policy if exists ads_guncelle on public.ads_ayarlar;
  create policy ads_guncelle on public.ads_ayarlar for update to anon, authenticated using ((select public.ads_izin('ayarlar'))) with check ((select public.ads_izin('ayarlar')));
end $$;

alter table public.ads_sesler enable row level security;
revoke all on public.ads_sesler from anon, authenticated;
grant select, insert, delete on public.ads_sesler to anon, authenticated;
drop policy if exists ads_oku on public.ads_sesler;
create policy ads_oku on public.ads_sesler for select to anon, authenticated using ((select public.ads_garson_id()) is not null);
drop policy if exists ads_ekle on public.ads_sesler;
create policy ads_ekle on public.ads_sesler for insert to anon, authenticated with check ((select public.ads_izin('ayarlar')));
drop policy if exists ads_sil on public.ads_sesler;
create policy ads_sil on public.ads_sesler for delete to anon, authenticated using ((select public.ads_izin('ayarlar')));

alter table public.ads_urun_fotolar enable row level security;
revoke all on public.ads_urun_fotolar from anon, authenticated;
grant select, insert, update, delete on public.ads_urun_fotolar to anon, authenticated;
drop policy if exists ads_oku on public.ads_urun_fotolar;
create policy ads_oku on public.ads_urun_fotolar for select to anon, authenticated using ((select public.ads_garson_id()) is not null);
drop policy if exists ads_ekle on public.ads_urun_fotolar;
create policy ads_ekle on public.ads_urun_fotolar for insert to anon, authenticated with check ((select public.ads_izin('menu')));
drop policy if exists ads_guncelle on public.ads_urun_fotolar;
create policy ads_guncelle on public.ads_urun_fotolar for update to anon, authenticated using ((select public.ads_izin('menu'))) with check ((select public.ads_izin('menu')));
drop policy if exists ads_sil on public.ads_urun_fotolar;
create policy ads_sil on public.ads_urun_fotolar for delete to anon, authenticated using ((select public.ads_izin('menu')));

alter table public.ads_roller enable row level security;
revoke all on public.ads_roller from anon, authenticated;

-- fonksiyonları sadece site kullanabilsin
-- (iç yardımcı fonksiyonlar dışarıdan çağrılamaz; menü sitesinin fonksiyonlarına dokunulmaz)
do $$
declare f record;
begin
  for f in select p.oid::regprocedure::text as imza, p.proname as ad
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'ads\_%' loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.imza);
    if f.ad not in ('ads_hesap_ozeti','ads_iptal_yetkisi_kontrol','ads_garson_zorunlu','ads_admin_zorunlu','ads_net','ads_ikram_kalan','ads_odeme_fazlasini_dus','ads_log','ads_ikram_secebilir','ads_yedek_bekleyenler','ads_yedek_anahtar_kontrol','ads_izin_zorunlu','ads_izinler_de','ads_tum_izinler','ads_kimlik') then
      execute format('grant execute on function %s to anon, authenticated', f.imza);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- İLK KURULUM VERİLERİ (sadece tablolar boşsa eklenir)
-- Yönetici: kullanıcı adı  admin   şifre  1234   → girdikten sonra DEĞİŞTİR
-- ---------------------------------------------------------------------
insert into public.ads_garsonlar (ad, kullanici, pin_hash, rol)
select 'Yönetici', 'admin', extensions.crypt('1234', extensions.gen_salt('bf')), 'admin'
where not exists (select 1 from public.ads_garsonlar);

insert into public.ads_masalar (ad, sira)
select 'Masa ' || i, i from generate_series(1, 10) i
where not exists (select 1 from public.ads_masalar);

-- ---------------------------------------------------------------------
-- HAREKET KAYDINI ESKİ VERİDEN DOLDUR (sadece kayıt tablosu boşsa, bir kere)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from public.ads_hareketler) then return; end if;
  insert into public.ads_hareketler (zaman, tur, garson_ad, masa_id, masa_ad, bolum, masa_tur, adisyon_id)
  select a.acilis, 'hesap_acildi', a.acan_ad, m.id, m.ad, nullif(trim(m.bolum), ''), m.tur, a.id
    from public.ads_adisyonlar a join public.ads_masalar m on m.id = a.masa_id;
  insert into public.ads_hareketler (zaman, tur, garson_ad, masa_id, masa_ad, bolum, masa_tur, adisyon_id, siparis_no, urun_ad, kategori, adet, birim_fiyat, tutar, aciklama)
  select k.olusturma, 'siparis', k.garson_ad, m.id, m.ad, nullif(trim(m.bolum), ''), m.tur, a.id, k.siparis_no, k.ad, k.kategori, k.adet, k.fiyat, k.adet * k.fiyat, k.notu
    from public.ads_kalemler k join public.ads_adisyonlar a on a.id = k.adisyon_id join public.ads_masalar m on m.id = a.masa_id;
  insert into public.ads_hareketler (zaman, tur, garson_ad, masa_id, masa_ad, bolum, masa_tur, adisyon_id, siparis_no, urun_ad, kategori, adet, birim_fiyat, tutar, aciklama, siparisi_giren, siparis_zaman)
  select coalesce(k.iptal_zaman, k.olusturma), 'iptal', k.iptal_eden, m.id, m.ad, nullif(trim(m.bolum), ''), m.tur, a.id, k.siparis_no, k.ad, k.kategori, -k.adet, k.fiyat, -(k.adet * k.fiyat), k.iptal_neden, k.garson_ad, k.olusturma
    from public.ads_kalemler k join public.ads_adisyonlar a on a.id = k.adisyon_id join public.ads_masalar m on m.id = a.masa_id
   where k.durum = 'iptal';
  insert into public.ads_hareketler (zaman, tur, garson_ad, masa_id, masa_ad, bolum, masa_tur, adisyon_id, tutar, odeme_tur, aciklama)
  select o.olusturma, 'odeme', o.garson_ad, m.id, m.ad, nullif(trim(m.bolum), ''), m.tur, a.id, o.tutar, o.tur,
         case when o.tur = 'garson_ikram' then o.ikram_garson_ad || ' hediye hakkından' end
    from public.ads_odemeler o join public.ads_adisyonlar a on a.id = o.adisyon_id join public.ads_masalar m on m.id = a.masa_id;
  insert into public.ads_hareketler (zaman, tur, garson_ad, masa_id, masa_ad, bolum, masa_tur, adisyon_id, tutar)
  select a.kapanis, case a.durum when 'kapali' then 'hesap_kapandi' when 'iptal' then 'hesap_iptal' else 'masa_tasindi' end,
         a.kapatan_ad, m.id, m.ad, nullif(trim(m.bolum), ''), m.tur, a.id, case when a.durum = 'kapali' then public.ads_net(a.id) end
    from public.ads_adisyonlar a join public.ads_masalar m on m.id = a.masa_id
   where a.durum <> 'acik' and a.kapanis is not null;
end $$;

-- ilk kurulumda eklenen yönetici de role bağlansın
update public.ads_garsonlar g set rol_id = (select r.id from public.ads_roller r where r.sistem = case when g.rol = 'admin' then 'yonetici' else 'garson' end) where g.rol_id is null;
