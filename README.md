# PlakaHub Backend API

Express.js + Prisma + PostgreSQL tabanlı backend servisi.

## Gereksinimler

- Node.js 18+
- Docker & Docker Compose

## Kurulum

### 1. Bağımlılıkları kur

```bash
cd backend
npm install
```

### 2. PostgreSQL veritabanını başlat

Proje ana dizininde:

```bash
docker compose up -d
```

Veritabanı `localhost:5432` üzerinde çalışmaya başlayacaktır.

| Parametre | Değer      |
|-----------|------------|
| Host      | localhost  |
| Port      | 5432       |
| DB        | plakahub   |
| User      | postgres   |
| Password  | password   |

### 3. Prisma migration çalıştır

```bash
npm run prisma:migrate
```

İlk çalıştırmada migration adı sorulacaktır (örn. `init`).

### 4. Test verilerini ekle (seed)

```bash
npm run prisma:seed
```

Bu komut veritabanına iki test kullanıcısı ekler:

| Plaka      | Durum         | Profiller              |
|------------|---------------|------------------------|
| 34TEST11   | Doğrulanmış   | Instagram, Twitter     |
| 06KAYIT22  | Doğrulanmamış | TikTok                 |

### 5. Sunucuyu başlat

```bash
npm run dev
```

API `http://localhost:3001` adresinde çalışır.

## Faydalı Komutlar

```bash
docker compose up -d       # PostgreSQL başlat
docker compose down        # PostgreSQL durdur
npm run prisma:generate    # Prisma client yeniden oluştur
npm run prisma:migrate     # Migration çalıştır
npm run prisma:seed        # Seed verileri ekle
npm run build              # TypeScript derle
```
