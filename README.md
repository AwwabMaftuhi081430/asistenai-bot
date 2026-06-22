# 🤖 AsistenAI — Telegram Bot Assistant

Bot Telegram multifungsi untuk mahasiswa Indonesia. Bantu catat **keuangan**, **tugas kuliah**, **pengingat absen**, dan **timer belajar** — ditambah **AI chat** berbasis Google Gemini.

---

## ✨ Fitur

| Fitur | Perintah | Deskripsi |
|-------|----------|-----------|
| 📊 Keuangan | `/keuangan` | Catat pemasukan & pengeluaran harian |
| 📚 Tugas | `/tugas` | Manajemen deadline tugas kuliah |
| ⏰ Absen | `/absen` | Pengingat absen harian via notifikasi |
| 🧠 Belajar | `/belajar` | Timer sesi belajar dengan statistik |
| 📈 Rekap | `/rekap` | Ringkasan keuangan & tugas |
| 💬 AI Chat | _(teks bebas)_ | Ngobrol dengan AI berbasis Gemini |

---

## 🛠 Tech Stack

- **Runtime:** Node.js 20 LTS
- **Bot Framework:** Telegraf v4
- **Database:** MySQL (Aiven / Laragon)
- **AI:** Google Gemini 1.5 Flash
- **Scheduler:** node-cron
- **Hosting:** Render.com (free tier)

---

## 🚀 Cara Deploy

### 1. Prasyarat

- [Node.js](https://nodejs.org/) v18+
- Database MySQL (Aiven / Laragon)
- API Key [Google AI Studio](https://aistudio.google.com)
- Token bot dari [@BotFather](https://t.me/BotFather) di Telegram

### 2. Clone & Install

```bash
git clone https://github.com/username/telegram-bot.git
cd telegram-bot
npm install
```

### 3. Setup Database

Jalankan `sql/migration_mysql.sql` di MySQL client (HeidiSQL, phpMyAdmin, dll).

### 4. Konfigurasi Environment

```bash
cp .env.example .env
```

Isi `.env`:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=asistenai

BOT_TOKEN=7881234567:AAHxyz...          # dari @BotFather
GEMINI_API_KEY=AIzaSy...                 # dari Google AI Studio
PORT=3000
NODE_ENV=production
```

### 5. Jalankan

**Local development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

### 6. Deploy ke Render.com + Aiven MySQL

1. Buat akun [Aiven](https://aiven.io) → pilih **Aiven for MySQL** (free tier)
2. Catat **Host**, **Port**, **User**, **Password**, **Database Name** dari Aiven dashboard
3. Push project ke GitHub
4. Buat **Web Service** baru di [Render](https://render.com)
5. Hubungkan repository kamu
6. **Start Command:** `npm start`
7. Tambahkan environment variable (lihat .env.example) — isi `DB_*` dengan data dari Aiven
8. Pilih **Free** instance (512MB RAM)
9. Deploy! 🎉

### 7. Keep Alive (anti-idle)

Render free tier akan meng-suspend instance yang idle. Cegah dengan [cron-job.org](https://cron-job.org):

1. Daftar di cron-job.org
2. Buat job baru:
   - **URL:** `https://nama-app-mu.onrender.com/health`
   - **Method:** GET
   - **Interval:** Setiap 5 menit
3. Aktifkan — bot kamu akan tetap online 24/7

---

## 📋 Daftar Perintah

| Perintah | Fungsi |
|----------|--------|
| `/start` | Mulai / reset bot |
| `/menu` | Tampilkan menu utama |
| `/keuangan` | Catat pemasukan / pengeluaran |
| `/tugas` | Tambah tugas baru |
| `/daftartugas` | Lihat semua tugas aktif |
| `/selesai [id]` | Tandai tugas selesai (contoh: `/selesai 3`) |
| `/absen` | Atur pengingat absen |
| `/matikanabsen` | Nonaktifkan pengingat absen |
| `/hidupkanabsen` | Aktifkan kembali pengingat absen |
| `/belajar` | Mulai / akhiri sesi belajar |
| `/rekap` | Ringkasan keuangan & tugas |
| `/batal` | Batalkan sesi / pengisian data |
| `/help` | Bantuan & daftar perintah |

---

## 🗄 Struktur Database

- **users** — Registrasi pengguna bot
- **finances** — Catatan pemasukan & pengeluaran
- **tasks** — Manajemen tugas & deadline
- **reminders** — Jadwal notifikasi absen per user
- **study_logs** — Log sesi belajar dengan durasi
- **chat_history** — Riwayat percakapan AI (max 20 per user)
- **notifications_log** — Audit trail notifikasi terkirim

---

## 📝 Catatan Penting

- Semua waktu menggunakan **WIB (Asia/Jakarta, UTC+7)**
- Bot menggunakan **long polling** — cocok untuk free tier Render
- Jika user memblokir bot, reminder akan otomatis dinonaktifkan
- Riwayat chat AI dibatasi 20 pesan terakhir per user
- Sesi input akan timeout setelah **5 menit** tidak ada aktivitas

---

## 🐛 Troubleshooting

**Bot tidak merespons:**
- Cek environment variable `BOT_TOKEN`
- Pastikan bot belum di-revoke dari @BotFather

**Error database:**
- Pastikan migrasi SQL sudah dijalankan
- Cek koneksi Supabase di Dashboard

**AI tidak menjawab:**
- Validasi `GEMINI_API_KEY`
- Cek kuota Google AI Studio

---

## 📄 Lisensi

MIT License — bebas digunakan dan dikembangkan.
