-- A USD->AFN quote separate from `rate` (the multiplier into AFN, which is 1 for AFN).
-- Unknown legacy quotes remain NULL; never manufacture history from today's settings.
ALTER TABLE sales ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE purchases ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE expenses ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE salary_payments ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE products ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE employees ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE customer_debts ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE supplier_debts ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE customer_payments ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE supplier_payments ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
ALTER TABLE stock_movements ADD COLUMN exchange_rate DECIMAL(14,4) NULL CHECK (exchange_rate > 0);
UPDATE sales SET exchange_rate=rate WHERE currency='USD';
UPDATE purchases SET exchange_rate=rate WHERE currency='USD';
UPDATE expenses SET exchange_rate=rate WHERE currency='USD';
UPDATE salary_payments SET exchange_rate=rate WHERE currency='USD';
UPDATE supplier_payments p JOIN sales s ON s.id=p.settlement_sale_id
  SET p.exchange_rate=s.exchange_rate;
CREATE OR REPLACE VIEW supplier_invoice_payments AS
SELECT id,supplier_id,amount,currency,date,note,created_at,debt_id,purchase_id,settlement_sale_id,exchange_rate
FROM supplier_payments WHERE purchase_id IS NOT NULL AND settlement_sale_id IS NULL
UNION ALL
SELECT p.id,p.supplier_id,a.amount,p.currency,p.date,
 CONCAT('تسویه با جنس (غیرنقدی)',IF(p.note IS NULL,'',CONCAT(' · ',p.note))) AS note,
 p.created_at,NULL AS debt_id,a.purchase_id,p.settlement_sale_id,p.exchange_rate
FROM supplier_product_allocations a JOIN supplier_payments p ON p.id=a.payment_id;
