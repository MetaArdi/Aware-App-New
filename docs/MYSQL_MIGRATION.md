# Panduan Migrasi MySQL untuk AWARE

Proyek AWARE saat ini menggunakan SQLite untuk kemudahan pengembangan. Untuk skala produksi atau integrasi lebih lanjut, berikut adalah langkah-langkah berpindah ke MySQL.

## 1. Persiapan Database MySQL
Pastikan MySQL Server sudah terinstal dan berjalan. Buat database baru:
```sql
CREATE DATABASE aware_db;
```

## 2. Instalasi Driver Python
Di dalam lingkungan virtual backend, instal driver MySQL:
```bash
pip install mysqlclient
# ATAU jika bermasalah dengan mysqlclient:
pip install pymysql
```

## 3. Update Konfigurasi (.env)
Buka file `AWARE/backend/.env` dan ubah `DATABASE_URL`:

**Jika menggunakan mysqlclient:**
```env
DATABASE_URL=mysql://username:password@localhost/aware_db
```

**Jika menggunakan pymysql:**
```env
DATABASE_URL=mysql+pymysql://username:password@localhost/aware_db
```

## 4. Inisialisasi Ulang Database
Karena skema database di MySQL sedikit berbeda (misal: panjang string), jalankan script inisialisasi:
```bash
cd AWARE/backend
python init_db.py
```

## 5. Sinkronisasi Data (Opsional)
Jika Anda memiliki data di `aware.db` yang ingin dipindah, gunakan tool seperti `db-sync` atau ekspor-impor manual via CSV. Namun, sangat disarankan untuk melakukan **Clean Install** menggunakan `init_db.py`.

## Catatan Penting
- **String Length**: Pastikan tipe `Enum` dan `String` di `models/database.py` sudah memiliki panjang yang cukup (MySQL mewajibkan panjang untuk String/Varchar yang di-index).
- **Boolean**: SQLAlchemy akan otomatis menangani konvasi Boolean SQLite (0/1) ke MySQL (TinyInt).

---

## 🚀 Panduan Deployment

Setelah migrasi ke MySQL selesai, berikut adalah opsi deployment untuk proyek AWARE:

### 1. Opsi A: Cloud Managed (Vercel + Render/Railway)
Ini adalah opsi tercepat untuk pengujian publik.
- **Frontend**: Deploy ke **Vercel** menggunakan integrasi GitHub. File `vercel.json` sudah tersedia di folder `frontend`.
- **Backend**: Deploy ke **Render** atau **Railway**.
- **Database**: Gunakan layanan Managed MySQL dari Railway atau Aiven.
- **Config**: Gunakan Environment Variables pada masing-masing dashboard platform untuk `DATABASE_URL`, `SECRET_KEY`, dan `ML_SERVER_URL`.

### 2. Opsi B: VPS / Dedicated Server (Docker Compose)
Opsi paling stabil untuk lingkungan industri/pabrik.
- **Dockerize**: Buat `Dockerfile` untuk backend dan frontend.
- **Orchestration**: Gunakan `docker-compose.yml` untuk menjalankan container:
  - `aware-api`: FastAPI Python app.
  - `aware-mysql`: MySQL database container.
  - `aware-proxy`: Nginx sebagai load balancer & penyaji file statis frontend.

### 3. Opsi C: Local Network (On-Premise)
Jika privasi data sangat dijaga (offline mode).
- Jalankan satu PC server di jaringan lokal.
- Install Docker atau jalankan aplikasi menggunakan layanan (Systemd di Linux).
- Pastikan IP Server bersifat statis agar client (browser di area screening) dapat mengakses URL yang sama secara konsisten.

