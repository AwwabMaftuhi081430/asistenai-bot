-- ============================================================
-- TELEGRAM BOT ASSISTANT — MYSQL MIGRATION (Laragon)
-- Jalankan di Laragon → MySQL → Query
-- ============================================================

CREATE DATABASE IF NOT EXISTS asistenai
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE asistenai;

-- Tabel users: registry semua pengguna bot
CREATE TABLE IF NOT EXISTS users (
  chat_id       BIGINT PRIMARY KEY,
  username      TEXT,
  full_name     TEXT,
  registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel finances: pencatatan pemasukan & pengeluaran
CREATE TABLE IF NOT EXISTS finances (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id    BIGINT NOT NULL,
  type       ENUM('masuk', 'keluar') NOT NULL,
  amount     DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
  note       TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
  INDEX idx_finances_chat_id (chat_id),
  INDEX idx_finances_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel tasks: manajemen tugas/deadline kuliah
CREATE TABLE IF NOT EXISTS tasks (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id    BIGINT NOT NULL,
  name       TEXT NOT NULL,
  deadline   DATE NOT NULL,
  priority   ENUM('rendah', 'normal', 'tinggi') DEFAULT 'normal',
  is_done    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
  INDEX idx_tasks_chat_deadline (chat_id, deadline)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel reminders: jadwal notifikasi absen
CREATE TABLE IF NOT EXISTS reminders (
  chat_id      BIGINT PRIMARY KEY,
  senin        VARCHAR(5),
  selasa       VARCHAR(5),
  rabu         VARCHAR(5),
  kamis        VARCHAR(5),
  jumat        VARCHAR(5),
  sabtu        VARCHAR(5),
  minggu       VARCHAR(5),
  is_active    BOOLEAN DEFAULT TRUE,
  last_sent_at DATE,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel study_logs: sesi belajar dengan durasi terukur
CREATE TABLE IF NOT EXISTS study_logs (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id          BIGINT NOT NULL,
  subject          TEXT DEFAULT 'Umum',
  start_time       TIMESTAMP NOT NULL,
  end_time         TIMESTAMP NULL,
  duration_minutes INT,
  is_active        BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
  INDEX idx_study_logs_chat_id (chat_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel chat_history: konteks percakapan AI per user
CREATE TABLE IF NOT EXISTS chat_history (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id    BIGINT NOT NULL,
  role       ENUM('user', 'model') NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES users(chat_id) ON DELETE CASCADE,
  INDEX idx_chat_history_chat (chat_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabel notifications_log: audit log semua notifikasi terkirim
CREATE TABLE IF NOT EXISTS notifications_log (
  id       BIGINT AUTO_INCREMENT PRIMARY KEY,
  chat_id  BIGINT NOT NULL,
  type     TEXT NOT NULL,
  message  TEXT,
  status   TEXT DEFAULT 'sent',
  sent_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
