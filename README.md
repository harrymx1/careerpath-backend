# CareerPath AI - Backend

## 📌 Deskripsi Singkat
CareerPath AI adalah platform asisten karier personal yang dirancang untuk memberikan rekomendasi profesi di bidang IT serta menyusun roadmap belajar yang adaptif bagi pengguna. Repository ini berisi *source code* untuk backend dari aplikasi tersebut yang dibangun menggunakan Node.js, Express.js, dan database PostgreSQL (Supabase).

---

## 🛠️ Prasyarat (Prerequisites)
Sebelum menjalankan proyek ini, pastikan Anda telah menginstal beberapa perangkat lunak berikut di komputer Anda:
- **Node.js** (direkomendasikan versi 16.x atau LTS terbaru) - [Download di sini](https://nodejs.org/)
- **npm** (sudah termasuk saat menginstal Node.js)
- **Python** (versi 3.8 atau lebih baru) - Diperlukan untuk menjalankan model Machine Learning. [Download di sini](https://www.python.org/downloads/)
- **Akun Supabase** atau **PostgreSQL lokal** untuk setup database.

---

## 🚀 Cara Instalasi & Setup Environment

Ikuti langkah-langkah detail di bawah ini untuk meng-clone dan menjalankan proyek di mesin lokal Anda:

### 1. Clone Repositori
Buka terminal Anda, lalu clone proyek ini dan masuk ke dalam foldernya:
```bash
git clone https://github.com/harrymx1/careerpath-backend.git
cd careerpath-ai-backend
```

### 2. Instalasi Dependensi (Packages Node.js & Python)
Proyek ini menggunakan Node.js untuk server utama dan Python untuk menjalankan model Machine Learning.

**A. Instalasi Dependensi Node.js**
Jalankan perintah berikut untuk mengunduh library backend:
```bash
npm install
```

**B. Instalasi Dependensi Python (Sangat Disarankan Menggunakan Virtual Environment / venv)**
Karena server mengeksekusi skrip Python (`predict.py`), Anda wajib menginstal library Python yang dibutuhkan.
```bash
# 1. Pindah ke direktori model ML
cd src/ml_model

# 2. Buat virtual environment (venv)
python -m venv venv

# 3. Aktifkan virtual environment
# Untuk Windows (Command Prompt / PowerShell):
venv\Scripts\activate
# Untuk Mac / Linux / Git Bash:
source venv/bin/activate

# 4. Instal library Python
pip install -r requirements.txt

# 5. Kembali ke folder utama proyek
cd ../..
```

### 3. Konfigurasi Environment Variables
Proyek ini membutuhkan kredensial rahasia (environment variables) agar bisa terhubung ke database.
- Duplikat file template `.env.example` dan ubah namanya menjadi `.env`:
  ```bash
  # Di OS Windows (Command Prompt)
  copy .env.example .env
  
  # Di OS Linux / macOS / Git Bash (Windows)
  cp .env.example .env
  ```
- Buka file `.env` menggunakan code editor Anda (seperti VS Code) dan isi nilai variabelnya. Jika Anda menggunakan Supabase, bentuknya kurang lebih seperti ini:
  ```env
  PORT=3000
  DB_USER=postgres.username_anda
  DB_PASSWORD=password_database_anda_yang_kuat
  DB_HOST=aws-0-region.pooler.supabase.com
  DB_NAME=postgres
  DB_PORT=6543
  ```

### 4. Setup Database Schema (Penting!)
Agar aplikasi dapat menyimpan data dengan benar, Anda harus membuat tabel-tabel yang diperlukan di database Anda.
- Buka file `supabase_schema.sql` yang ada di dalam repositori ini.
- **Jika menggunakan Supabase:** 
  1. Buka dashboard proyek Supabase Anda.
  2. Buka menu **SQL Editor**.
  3. Copy seluruh isi dari file `supabase_schema.sql` dan paste ke editor tersebut.
  4. Klik **Run** (Jalankan).
- Skema tersebut akan secara otomatis membuat tabel-tabel seperti `profiles`, `assessments`, `recommendations`, `recommended_professions` beserta fungsi otorisasi keamanan (Row Level Security / RLS).

---

## 🏃‍♂️ Cara Menjalankan Aplikasi

Jika semua konfigurasi di atas telah selesai dan database siap, Anda bisa mulai menyalakan server dengan perintah:

> ⚠️ **PENTING**: Pastikan Anda menjalankan server di **terminal yang sama** di mana Virtual Environment (`venv`) Python Anda **sedang aktif**. Jika Anda membuka terminal baru, pastikan untuk mengaktifkan `venv`-nya terlebih dahulu (lihat Langkah 2B).

```bash
node src/app.js
```

Jika server berhasil dijalankan tanpa error, Anda akan melihat pesan log di terminal bahwa server telah berjalan, biasanya di alamat:
**`http://localhost:3000`**

---

## 📁 Struktur Folder Proyek
Untuk mempermudah pemahaman kode, berikut adalah panduan struktur folder di dalam proyek backend ini:

```text
careerpath-ai-backend/
│
├── src/
│   ├── config/        # Konfigurasi global (contoh: koneksi database)
│   ├── controllers/   # Logika bisnis dan fungsi utama dari endpoint API
│   ├── middlewares/   # Middleware Express (contoh: validasi input, otorisasi)
│   ├── ml_model/      # File atau integrasi untuk Model Machine Learning
│   ├── models/        # Skrip representasi data atau query database
│   ├── routes/        # Definisi URL API (contoh: rute di api.js)
│   └── app.js         # Entry point (file utama) untuk menjalankan server
│
├── .env.example       # Contoh struktur file konfigurasi rahasia
├── package.json       # Daftar dependensi & script project (Node.js)
├── supabase_schema.sql # Skema SQL untuk membuat tabel-tabel database awal
└── README.md          # Dokumentasi proyek (file yang sedang Anda baca)
```

---

## 🔗 Endpoint API Utama
Berikut adalah gambaran sekilas terkait rute (endpoint) API utama yang tersedia (didefinisikan di `src/routes/api.js`):
- `POST /api/assessments` : Menyimpan data jawaban asesmen pengguna dan memanggil model ML untuk mendapatkan rekomendasi karier.
- `GET /api/profiles/:id/recommendations` : Mengambil data hasil rekomendasi karier IT milik seorang pengguna berdasarkan ID-nya.

**Contoh Testing API menggunakan cURL (Terminal / Git Bash):**
```bash
curl -X POST http://localhost:3000/api/assessments \
-H "Content-Type: application/json" \
-d "{\"answers\": [5, 4, 3, 4, 2, 5, 3, 4, 2, 4], \"time_commitment_hours\": 10}"
```

*(Catatan: prefix url `/api` dapat bervariasi bergantung pada pengaturan route utama yang ada di dalam `src/app.js`)*

---

## 💡 Troubleshooting (Masalah Umum)
Jika Anda mengalami kendala saat menjalankan project, coba cek beberapa hal berikut:
1. **Error "Cannot connect to database" atau "Connection refused"**: 
   - Pastikan variabel di file `.env` (seperti `DB_PASSWORD`, `DB_HOST`) sudah terisi dengan benar.
   - Pastikan database Anda (misalnya Supabase) dalam keadaan aktif (tidak paused).
2. **Error "Module not found" saat menjalankan `node src/app.js`**: 
   - Pastikan Anda sudah menjalankan perintah `npm install`. Jika masih bermasalah, hapus folder `node_modules` dan file `package-lock.json`, lalu jalankan `npm install` kembali.
3. **Port 3000 sudah digunakan (EADDRINUSE)**:
   - Aplikasi lain mungkin sedang menggunakan port 3000. Anda bisa mengganti nilai `PORT` di file `.env` menjadi port lain (contoh: `PORT=5000`).
