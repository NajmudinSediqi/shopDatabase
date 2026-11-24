ALTER TABLE settings
  ADD COLUMN sale_invoice_prefix VARCHAR(12) NOT NULL DEFAULT 'S',
  ADD COLUMN purchase_invoice_prefix VARCHAR(12) NOT NULL DEFAULT 'P',
  ADD COLUMN invoice_number_digits INT NOT NULL DEFAULT 5;
ALTER TABLE sales ADD COLUMN invoice_code VARCHAR(40) NULL UNIQUE;
ALTER TABLE purchases ADD COLUMN invoice_code VARCHAR(40) NULL UNIQUE;
UPDATE sales SET invoice_code=CONCAT('S-',LPAD(invoice_no,GREATEST(5,CHAR_LENGTH(invoice_no)),'0'));
UPDATE purchases SET invoice_code=CONCAT('P-',LPAD(invoice_no,GREATEST(5,CHAR_LENGTH(invoice_no)),'0'));
CREATE TABLE invoice_sequences (
  prefix VARCHAR(12) PRIMARY KEY,
  next_number BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB;
INSERT INTO invoice_sequences(prefix,next_number) SELECT 'S',COALESCE(MAX(invoice_no),0)+1 FROM sales;
INSERT INTO invoice_sequences(prefix,next_number) SELECT 'P',COALESCE(MAX(invoice_no),0)+1 FROM purchases;
