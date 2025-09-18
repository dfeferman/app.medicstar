import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";

export const settingsLoader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shopRecord = await prisma.shop.findUnique({
    where: { domain: shopDomain },
  });

  if (!shopRecord) {
    throw new Error(`Shop not found for domain: ${shopDomain}`);
  }

  let settings = await prisma.setting.findUnique({
    where: { shopId: shopRecord.id },
  });

  if (!settings) {
    settings = await prisma.setting.create({
      data: {
        shopId: shopRecord.id,
        isAutoSyncEnabled: true,
        isStopAllPendingTasks: false,
        isForceSyncEnabled: false,
      },
    });
  }

  return { settings };
};
