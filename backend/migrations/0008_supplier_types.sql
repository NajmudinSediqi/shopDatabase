-- Existing contacts remain product suppliers and retain their full ledger history.
ALTER TABLE suppliers
  ADD COLUMN supplier_type ENUM('supplier','payee') NOT NULL DEFAULT 'supplier';
