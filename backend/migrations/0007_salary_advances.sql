-- Existing payments remain salary payments; preserve their dates, amounts and periods.
ALTER TABLE salary_payments
  ADD COLUMN payment_type ENUM('salary','advance') NOT NULL DEFAULT 'salary',
  ADD INDEX salary_employee_period (employee_id, period);
