ALTER TABLE "UserObjectAccess" ADD COLUMN "role_new" "UserRole";

UPDATE "UserObjectAccess" AS access
SET "role_new" = CASE
  WHEN access."role"::text = 'OWNER' THEN 'DIRECTOR'::"UserRole"
  WHEN "User"."role" IS NOT NULL THEN "User"."role"
  ELSE 'FOREMAN'::"UserRole"
END
FROM "User"
WHERE "User"."id" = access."userId";

ALTER TABLE "UserObjectAccess" DROP COLUMN "role";
ALTER TABLE "UserObjectAccess" RENAME COLUMN "role_new" TO "role";
ALTER TABLE "UserObjectAccess" ALTER COLUMN "role" SET NOT NULL;

ALTER TABLE "Invitation" DROP COLUMN IF EXISTS "objectRole";

DROP TYPE IF EXISTS "UserObjectRole";
