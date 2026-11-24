ALTER TABLE expenses
  ADD COLUMN expense_type ENUM('expense','withdrawal') NOT NULL DEFAULT 'expense',
  ADD COLUMN person_name VARCHAR(255) NULL,
  ADD CONSTRAINT expense_withdrawal_person CHECK (expense_type <> 'withdrawal' OR (person_name IS NOT NULL AND CHAR_LENGTH(TRIM(person_name)) > 0)),
  ADD INDEX expense_type_date (expense_type, date),
  ADD INDEX expense_person_date (person_name, date);
