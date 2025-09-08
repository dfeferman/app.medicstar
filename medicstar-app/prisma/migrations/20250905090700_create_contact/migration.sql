-- CreateTable
CREATE TABLE "public"."WebConnector" (
    "id" TEXT NOT NULL,
    "externalAccessToken" TEXT NOT NULL,

    CONSTRAINT "WebConnector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contact" (
    "id" SERIAL NOT NULL,
    "shopifyCustomerId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "businessCenterContactNo" TEXT NOT NULL,
    "businessCenterCustomerTemplateCode" TEXT NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contact_businessCenterContactNo_idx" ON "public"."Contact"("businessCenterContactNo");
