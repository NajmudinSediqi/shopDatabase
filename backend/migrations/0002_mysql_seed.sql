INSERT IGNORE INTO app_locks (name) VALUES ('identity');
INSERT IGNORE INTO settings (id) VALUES (1);
INSERT IGNORE INTO permissions (code, label, grp, is_system) VALUES
 ('dashboard.view','دیدن داشبورد','فروشگاه',true),
 ('sales.view','دیدن فروش','فروشگاه',true),
 ('sales.manage','ویرایش و حذف فروش','فروشگاه',true),
 ('purchases.view','دیدن خرید','فروشگاه',true),
 ('purchases.manage','ثبت، ویرایش و حذف خرید','فروشگاه',true),
 ('customers.view','دیدن مشتریان','فروشگاه',true),
 ('customers.manage','ویرایش و حذف مشتریان و حساب‌ها','فروشگاه',true),
 ('suppliers.view','دیدن تأمین‌کنندگان','فروشگاه',true),
 ('suppliers.manage','مدیریت تأمین‌کنندگان و حساب‌ها','فروشگاه',true),
 ('expenses.view','دیدن مصارف','فروشگاه',true),
 ('expenses.manage','ثبت و حذف مصارف','فروشگاه',true),
 ('employees.view','دیدن کارمندان','فروشگاه',true),
 ('employees.manage','مدیریت کارمندان و معاشات','فروشگاه',true),
 ('reports.view','دیدن گزارشات و مفاد','فروشگاه',true),
 ('assistant.view','استفاده از دستیار هوشمند','فروشگاه',true),
 ('warehouse.view','دیدن موجودی انبار','انبار',true),
 ('stock.view','دیدن ورود و خروج','انبار',true),
 ('stock.manage','ویرایش و حذف حرکت‌های انبار','انبار',true),
 ('products.view','دیدن محصولات','انبار',true),
 ('products.manage','مدیریت محصولات و دسته‌ها','انبار',true),
 ('costs.view','دیدن قیمت خرید و ارزش انبار','انبار',true),
 ('settings.manage','تغییر تنظیمات و نرخ ارز','مدیریت',true);
INSERT IGNORE INTO roles (id,name,description,permissions,is_system) VALUES ('00000000-0000-4000-8000-000000000001','???????','?????? ??????? ???????','["dashboard.view","sales.view","customers.view","warehouse.view","stock.view","products.view"]',true);
INSERT IGNORE INTO expense_categories (id,name) VALUES ('00000000-0000-4000-8000-000000000002','????? ??????');
INSERT IGNORE INTO expense_categories (id,name) VALUES ('00000000-0000-4000-8000-000000000003','?????');
INSERT IGNORE INTO expense_categories (id,name) VALUES ('00000000-0000-4000-8000-000000000004','??? ? ??');
INSERT IGNORE INTO expense_categories (id,name) VALUES ('00000000-0000-4000-8000-000000000005','?????????');
INSERT IGNORE INTO expense_categories (id,name) VALUES ('00000000-0000-4000-8000-000000000006','??????');
