ALTER TABLE settings ADD COLUMN platform_title VARCHAR(100) NOT NULL DEFAULT 'مدیریت فروشگاه';
ALTER TABLE settings ADD COLUMN favicon_data MEDIUMTEXT NULL;
ALTER TABLE settings ADD COLUMN branding_version CHAR(36) NOT NULL DEFAULT '';
