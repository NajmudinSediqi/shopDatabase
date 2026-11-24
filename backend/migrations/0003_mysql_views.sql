CREATE OR REPLACE VIEW product_stock AS
SELECT p.id AS product_id,
  COALESCE(m.qty,0) AS qty,
  COALESCE(m.buy_value / NULLIF(m.buy_qty,0),0) AS avg_cost_afn,
  (SELECT ROUND(pi.unit_price*pi.qty/NULLIF(pi.pieces,0),2)
   FROM purchase_items pi JOIN purchases pu ON pu.id=pi.purchase_id
   WHERE pi.product_id=p.id ORDER BY pu.date DESC,pu.created_at DESC,pu.invoice_no DESC LIMIT 1) AS last_buy_price,
  (SELECT pu.currency FROM purchase_items pi JOIN purchases pu ON pu.id=pi.purchase_id
   WHERE pi.product_id=p.id ORDER BY pu.date DESC,pu.created_at DESC,pu.invoice_no DESC LIMIT 1) AS last_buy_currency,
  COALESCE(m.warehouse_qty,0) AS warehouse_qty, COALESCE(m.shop_qty,0) AS shop_qty
FROM products p LEFT JOIN (
  SELECT product_id,SUM(qty) AS qty,
    SUM(CASE WHEN type='in' THEN qty*unit_cost_afn ELSE 0 END) AS buy_value,
    SUM(CASE WHEN type='in' THEN qty ELSE 0 END) AS buy_qty,
    SUM(CASE WHEN location='warehouse' THEN qty ELSE 0 END) AS warehouse_qty,
    SUM(CASE WHEN location='shop' THEN qty ELSE 0 END) AS shop_qty
  FROM stock_movements GROUP BY product_id
) m ON m.product_id=p.id;

CREATE OR REPLACE VIEW customer_balances AS
SELECT c.id AS customer_id,x.currency,SUM(x.amt) AS balance FROM customers c JOIN (
  SELECT customer_id,currency,total-discount-paid AS amt FROM sales WHERE customer_id IS NOT NULL
  UNION ALL SELECT customer_id,currency,-amount FROM customer_payments
  UNION ALL SELECT customer_id,currency,amount FROM customer_debts
) x ON x.customer_id=c.id GROUP BY c.id,x.currency;

CREATE OR REPLACE VIEW supplier_balances AS
SELECT s.id AS supplier_id,x.currency,SUM(x.amt) AS balance FROM suppliers s JOIN (
  SELECT supplier_id,currency,total-paid AS amt FROM purchases WHERE supplier_id IS NOT NULL
  UNION ALL SELECT supplier_id,currency,-amount FROM supplier_payments
  UNION ALL SELECT supplier_id,currency,amount FROM supplier_debts
) x ON x.supplier_id=s.id GROUP BY s.id,x.currency;
