ALTER TABLE sales ADD COLUMN settlement_supplier_id CHAR(36) NULL,
  ADD CONSTRAINT fk_sales_settlement_supplier FOREIGN KEY (settlement_supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT;
ALTER TABLE supplier_payments ADD COLUMN settlement_sale_id CHAR(36) NULL UNIQUE,
  ADD CONSTRAINT fk_supplier_payment_sale FOREIGN KEY (settlement_sale_id) REFERENCES sales(id) ON DELETE RESTRICT;
