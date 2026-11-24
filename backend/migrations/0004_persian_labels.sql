-- Normalize built-in labels and future defaults without changing business records.
ALTER TABLE settings MODIFY shop_name VARCHAR(255) NOT NULL DEFAULT 'فروشگاه من';
ALTER TABLE products MODIFY unit VARCHAR(100) NOT NULL DEFAULT 'عدد';
UPDATE settings SET shop_name='فروشگاه من' WHERE id=1 AND shop_name='??????? ??';
UPDATE products SET unit='عدد' WHERE unit='???';
UPDATE roles SET name='فروشنده',description='دسترسی پیش‌فرض فروشنده'
WHERE id='00000000-0000-4000-8000-000000000001' AND name='???????';
UPDATE expense_categories SET name='مصارف روزانه' WHERE id='00000000-0000-4000-8000-000000000002' AND name='????? ??????';
UPDATE expense_categories SET name='کرایه' WHERE id='00000000-0000-4000-8000-000000000003' AND name='?????';
UPDATE expense_categories SET name='برق و آب' WHERE id='00000000-0000-4000-8000-000000000004' AND name='??? ? ??';
UPDATE expense_categories SET name='ترانسپورت' WHERE id='00000000-0000-4000-8000-000000000005' AND name='?????????';
UPDATE expense_categories SET name='متفرقه' WHERE id='00000000-0000-4000-8000-000000000006' AND name='??????';
INSERT IGNORE INTO expense_categories(id,name) VALUES
 ('00000000-0000-4000-8000-000000000002','مصارف روزانه'),
 ('00000000-0000-4000-8000-000000000003','کرایه'),
 ('00000000-0000-4000-8000-000000000004','برق و آب'),
 ('00000000-0000-4000-8000-000000000005','ترانسپورت'),
 ('00000000-0000-4000-8000-000000000006','متفرقه');
