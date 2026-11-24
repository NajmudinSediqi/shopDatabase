-- Add enforced permissions for the newer pages and previously bundled actions.
INSERT IGNORE INTO permissions (code,label,grp,is_system) VALUES
 ('sales.create','ثبت فروش جدید','فروش',true),
 ('sales.list.view','دیدن لیست فروشات و فیلتر اجناس','فروش',true),
 ('purchases.create','ثبت خرید جدید','خرید',true),
 ('purchases.list.view','دیدن لیست خرید و فیلتر اجناس','خرید',true),
 ('customers.payments.manage','ثبت و حذف دریافت پول مشتری','مشتریان',true),
 ('suppliers.payments.manage','ثبت و حذف پرداخت پول تأمین‌کننده / صراف','تأمین‌کنندگان',true),
 ('withdrawals.view','دیدن برداشت‌ها، اشخاص و مجموع برداشت','برداشت‌ها',true),
 ('withdrawals.manage','ثبت، ویرایش و حذف برداشت','برداشت‌ها',true),
 ('payroll.view','دیدن معاشات، پرداخت‌های میان‌ماه و جزئیات ماه','معاشات',true),
 ('payroll.manage','ثبت و حذف معاش و پرداخت میان‌ماه','معاشات',true),
 ('categories.manage','مدیریت دسته‌های محصول و آیکن‌ها','محصولات',true),
 ('bill.settings.manage','تنظیم طراحی بل، لوگو و QR','فروش',true),
 ('reports.purchase.view','دیدن گزارش خرید','گزارشات',true),
 ('reports.products.view','دیدن گزارش فروش اجناس و مفاد آن','گزارشات',true),
 ('documents.print','چاپ و دریافت PDF اطلاعات مجاز','چاپ و PDF',true);

UPDATE permissions SET label='دیدن فاکتورهای فروش' WHERE code='sales.view';
UPDATE permissions SET label='ویرایش و حذف فاکتور فروش' WHERE code='sales.manage';
UPDATE permissions SET label='ویرایش و حذف فاکتور خرید' WHERE code='purchases.manage';
UPDATE permissions SET label='مدیریت اطلاعات مشتری و باقی قبلی' WHERE code='customers.manage';
UPDATE permissions SET label='مدیریت تأمین‌کننده / صراف و بدهی قبلی' WHERE code='suppliers.manage';
UPDATE permissions SET label='ثبت، ویرایش و حذف مصارف دکان' WHERE code='expenses.manage';
UPDATE permissions SET label='ثبت، ویرایش و حذف کارمندان' WHERE code='employees.manage';
UPDATE permissions SET label='ثبت، ویرایش و حذف محصولات' WHERE code='products.manage';
UPDATE permissions SET label='گزارش جامع مالی، مفاد، مصارف و معاشات' WHERE code='reports.view';

-- Preserve existing role behavior once; future edits use the independent permissions.
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.create') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('sales.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.create'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.list.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('sales.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.list.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','purchases.list.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('purchases.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('purchases.list.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','purchases.create') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('purchases.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('purchases.create'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','customers.payments.manage') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('customers.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('customers.payments.manage'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','suppliers.payments.manage') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.payments.manage'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','withdrawals.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('expenses.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('withdrawals.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','withdrawals.manage') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('expenses.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('withdrawals.manage'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','payroll.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('employees.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('payroll.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','payroll.manage') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('employees.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('payroll.manage'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','categories.manage') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('products.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('categories.manage'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','bill.settings.manage') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('settings.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('bill.settings.manage'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','reports.purchase.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('reports.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('reports.purchase.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','reports.products.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('reports.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('reports.products.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','documents.print') WHERE NOT JSON_CONTAINS(permissions,JSON_QUOTE('documents.print'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('sales.create')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('sales.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','purchases.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('purchases.create')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('purchases.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','purchases.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('purchases.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('purchases.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','customers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('customers.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('customers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','customers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('customers.payments.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('customers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','suppliers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','suppliers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.payments.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','expenses.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('expenses.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('expenses.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','withdrawals.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('withdrawals.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('withdrawals.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','employees.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('employees.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('employees.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','employees.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('payroll.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('employees.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','payroll.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('payroll.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('payroll.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','products.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('products.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('products.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','products.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('categories.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('products.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','stock.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('stock.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('stock.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('bill.settings.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('sales.create')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('sales.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','purchases.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('purchases.create')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('purchases.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','purchases.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('purchases.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('purchases.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','customers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('customers.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('customers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','customers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('customers.payments.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('customers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','suppliers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','suppliers.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.payments.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('suppliers.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','expenses.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('expenses.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('expenses.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','withdrawals.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('withdrawals.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('withdrawals.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','employees.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('employees.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('employees.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','employees.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('payroll.view')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('employees.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','payroll.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('payroll.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('payroll.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','products.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('products.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('products.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','products.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('categories.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('products.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','stock.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('stock.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('stock.view'));
UPDATE roles SET permissions=JSON_ARRAY_APPEND(permissions,'$','sales.view') WHERE JSON_CONTAINS(permissions,JSON_QUOTE('bill.settings.manage')) AND NOT JSON_CONTAINS(permissions,JSON_QUOTE('sales.view'));
