import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createSalesOrderWithRetry } from "../services/webconnector.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  processOrder(shop, payload).catch(console.error);
  return new Response();
};

const processOrder = async (shop: string, payload: any) => {
  console.log("=== ORDER CREATE WEBHOOK DATA ===");
  console.log("Shop:", shop);
  console.log("Full payload:", JSON.stringify(payload, null, 2));
  console.log("Payload keys:", Object.keys(payload));
  console.log("=== END WEBHOOK DATA ===");

	await createSalesOrderWithRetry(payload);
};
