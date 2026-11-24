CREATE TABLE IF NOT EXISTS assistant_chats (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  topic VARCHAR(20) NOT NULL,
  title VARCHAR(120) NOT NULL,
  messages JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
  INDEX assistant_chats_user_updated (user_id,updated_at)
) ENGINE=InnoDB;
