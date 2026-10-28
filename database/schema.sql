-- Fasimāķu dictionary: table setup for MySQL (HostGator cPanel → phpMyAdmin).
-- Select your database in phpMyAdmin, open the SQL tab, paste this file, click Go.
-- Safe to run again: it only creates tables that don't exist yet.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS fas_words (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,   -- also the display order
    -- utf8mb4_bin compares exactly, so bī / bi and ka / ķa / kā stay separate words.
    -- (MySQL's default collation treats them as duplicates.)
    fas        VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
    eng        VARCHAR(255) NOT NULL,                  -- English meanings, '/'-separated
    pos        VARCHAR(100) NOT NULL,                  -- part of speech, e.g. 'N / V (A O)'
    expl       TEXT NOT NULL,                          -- full explanation
    derivs     TEXT NOT NULL,                          -- JSON array of root words, e.g. ["bī","lauliñ"]
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY fas_words_fas (fas)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Failed password attempts, used to lock out password guessing.
CREATE TABLE IF NOT EXISTS fas_login_attempts (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ip           VARCHAR(45) NOT NULL,
    attempted_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY fas_login_attempts_time (attempted_at),
    KEY fas_login_attempts_ip (ip, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
