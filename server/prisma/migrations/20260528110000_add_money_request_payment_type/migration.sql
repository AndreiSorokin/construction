DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'MoneyRequestPaymentType'
  ) THEN
    CREATE TYPE "MoneyRequestPaymentType" AS ENUM ('CASH', 'NON_CASH');
  END IF;
END $$;

ALTER TABLE "SupplyRequest"
ADD COLUMN IF NOT EXISTS "paymentType" "MoneyRequestPaymentType";
