ALTER TABLE settings
  ADD COLUMN shop_address VARCHAR(1000) NOT NULL DEFAULT '',
  ADD COLUMN shop_phone VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN shop_phone_secondary VARCHAR(100) NOT NULL DEFAULT '',
  ADD COLUMN bill_footer VARCHAR(1000) NOT NULL DEFAULT 'با تشکر از خرید شما؛ اعتماد شما سرمایه ماست.';
