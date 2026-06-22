-- ============================================================
-- TELEGRAM BOT ASSISTANT — DATABASE MIGRATION
-- Jalankan sekali di Supabase SQL Editor
-- ============================================================

-- Tabel users: registry semua pengguna bot
CREATE TABLE IF NOT EXISTS users (
  chat_id     BIGINT PRIMARY KEY,
  username    TEXT,
  full_name   TEXT,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel finances: pencatatan pemasukan & pengeluaran
CREATE TABLE IF NOT EXISTS finances (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    BIGINT NOT NULL REFERENCES users(chat_id),
  type       TEXT NOT NULL CHECK (type IN ('masuk', 'keluar')),
  amount     NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_finances_chat_id    ON finances(chat_id);
CREATE INDEX IF NOT EXISTS idx_finances_created_at ON finances(created_at DESC);

-- Tabel tasks: manajemen tugas/deadline kuliah
CREATE TABLE IF NOT EXISTS tasks (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    BIGINT NOT NULL REFERENCES users(chat_id),
  name       TEXT NOT NULL,
  deadline   DATE NOT NULL,
  priority   TEXT DEFAULT 'normal' CHECK (priority IN ('rendah', 'normal', 'tinggi')),
  is_done    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tasks_chat_deadline ON tasks(chat_id, deadline);

-- Tabel reminders: jadwal notifikasi absen BERBEDA tiap hari
-- NULL pada kolom hari = libur / tidak ada reminder hari itu
-- DROP dulu jika ada struktur lama (cascade untuk bersihkan dependensi)
DROP TABLE IF EXISTS reminders CASCADE;

CREATE TABLE IF NOT EXISTS reminders (
  chat_id      BIGINT PRIMARY KEY REFERENCES users(chat_id),
  senin        TEXT CHECK (senin   ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  selasa       TEXT CHECK (selasa  ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  rabu         TEXT CHECK (rabu    ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  kamis        TEXT CHECK (kamis   ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  jumat        TEXT CHECK (jumat   ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  sabtu        TEXT CHECK (sabtu   ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  minggu       TEXT CHECK (minggu  ~ '^([01]?\d|2[0-3]):[0-5]\d$'),
  is_active    BOOLEAN DEFAULT TRUE,
  last_sent_at DATE,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Tabel study_logs: sesi belajar dengan durasi terukur
CREATE TABLE IF NOT EXISTS study_logs (
  id               BIGSERIAL PRIMARY KEY,
  chat_id          BIGINT NOT NULL REFERENCES users(chat_id),
  subject          TEXT DEFAULT 'Umum',
  start_time       TIMESTAMPTZ NOT NULL,
  end_time         TIMESTAMPTZ,
  duration_minutes INT,               -- diisi otomatis saat sesi selesai
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_logs_chat_id ON study_logs(chat_id);

-- Tabel chat_history: konteks percakapan AI per user (max 20 entri)
CREATE TABLE IF NOT EXISTS chat_history (
  id         BIGSERIAL PRIMARY KEY,
  chat_id    BIGINT NOT NULL REFERENCES users(chat_id),
  role       TEXT NOT NULL CHECK (role IN ('user', 'model')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_history_chat ON chat_history(chat_id, created_at DESC);

-- Function: trim chat history — hapus entri paling lama jika melebihi 20
CREATE OR REPLACE FUNCTION trim_chat_history(p_chat_id BIGINT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM chat_history
  WHERE id IN (
    SELECT id FROM chat_history
    WHERE chat_id = p_chat_id
    ORDER BY created_at DESC
    OFFSET 20
  );
END;
$$;

-- Tabel notifications_log: audit log semua notifikasi terkirim
CREATE TABLE IF NOT EXISTS notifications_log (
  id       BIGSERIAL PRIMARY KEY,
  chat_id  BIGINT NOT NULL,
  type     TEXT NOT NULL,
  message  TEXT,
  status   TEXT DEFAULT 'sent',
  sent_at  TIMESTAMPTZ DEFAULT NOW()
);
