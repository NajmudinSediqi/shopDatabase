-- Per-invoice print recipient for anonymous cash customers; no customer ledger is created.
ALTER TABLE sales
  ADD COLUMN walk_in_name VARCHAR(255) NULL,
  ADD COLUMN walk_in_address VARCHAR(1000) NULL;
