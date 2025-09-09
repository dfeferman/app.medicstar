-- AlterTable
ALTER TABLE "public"."Product" ALTER COLUMN "listOfAdvantages" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."ProductVariant" ALTER COLUMN "listOfAdvantages" DROP NOT NULL;
