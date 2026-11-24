-- Product credits and purchase dues are two ordered ranges per supplier/currency.
-- Their intersections allocate credits FIFO without counting another payment in
-- the supplier balance. Views stay correct after edits, deletions and new buys.
CREATE OR REPLACE VIEW supplier_product_credit_ranges AS
SELECT id AS payment_id,supplier_id,currency,
 SUM(amount) OVER (PARTITION BY supplier_id,currency ORDER BY date,created_at,id ROWS UNBOUNDED PRECEDING)-amount AS range_start,
 SUM(amount) OVER (PARTITION BY supplier_id,currency ORDER BY date,created_at,id ROWS UNBOUNDED PRECEDING) AS range_end
FROM supplier_payments WHERE settlement_sale_id IS NOT NULL;

CREATE OR REPLACE VIEW supplier_purchase_due_ranges AS
SELECT id AS purchase_id,supplier_id,currency,
 SUM(due) OVER (PARTITION BY supplier_id,currency ORDER BY date,created_at,id ROWS UNBOUNDED PRECEDING)-due AS range_start,
 SUM(due) OVER (PARTITION BY supplier_id,currency ORDER BY date,created_at,id ROWS UNBOUNDED PRECEDING) AS range_end
FROM (
 SELECT p.id,p.supplier_id,p.currency,p.date,p.created_at,
 GREATEST(p.total-p.paid-COALESCE(c.paid,0),0) AS due
 FROM purchases p LEFT JOIN (
  SELECT purchase_id,SUM(amount) AS paid FROM supplier_payments
  WHERE purchase_id IS NOT NULL AND settlement_sale_id IS NULL GROUP BY purchase_id
 ) c ON c.purchase_id=p.id WHERE p.supplier_id IS NOT NULL
) purchase_dues;

CREATE OR REPLACE VIEW supplier_product_allocations AS
SELECT c.payment_id,b.purchase_id,
 CAST(LEAST(c.range_end,b.range_end)-GREATEST(c.range_start,b.range_start) AS DECIMAL(14,2)) AS amount
FROM supplier_product_credit_ranges c JOIN supplier_purchase_due_ranges b
 ON b.supplier_id=c.supplier_id AND b.currency=c.currency
 AND c.range_end>b.range_start AND b.range_end>c.range_start;

CREATE OR REPLACE VIEW supplier_invoice_payments AS
SELECT id,supplier_id,amount,currency,date,note,created_at,debt_id,purchase_id,settlement_sale_id
FROM supplier_payments WHERE purchase_id IS NOT NULL AND settlement_sale_id IS NULL
UNION ALL
SELECT p.id,p.supplier_id,a.amount,p.currency,p.date,
 CONCAT('تسویه با جنس (غیرنقدی)',IF(p.note IS NULL,'',CONCAT(' · ',p.note))) AS note,
 p.created_at,NULL AS debt_id,a.purchase_id,p.settlement_sale_id
FROM supplier_product_allocations a JOIN supplier_payments p ON p.id=a.payment_id;
