import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createOrder, type OrderInput } from "../services/soap/create-order";
import { tagOrderWithExternalDoc } from "../services/admin/tag-order.server";

type NoteAttribute = {
  name: string;
  value: string
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  processOrder(shop, payload).catch(console.error);
  return new Response();
};

let order: any;

const processOrder = async (shop: string, payload: any) => {
  console.log("=== ORDER CREATE WEBHOOK DATA ===");
  console.log("Full payload:", JSON.stringify(payload, null, 2));
  console.log("=== END WEBHOOK DATA ===");


  const noteAttrs = payload.note_attributes as Array<NoteAttribute>;
  const noteTemplate = (noteAttrs.find((a) => a?.name === "kundengruppe")?.value || "").trim();

  order = {
    orderExternalDocNo: payload.id,
    orderDate: payload.created_at,
    customerTemplateCode: noteTemplate,
    products: (payload?.line_items)
      .map((li: any) => ({
        SKU: li?.sku,
        quantity: li?.quantity,
        price: li?.price,
      })),
    sellToName: payload.shipping_address.name,
    sellToAddress: payload.shipping_address.address1,
    sellToPostCode: payload.shipping_address.zip,
    sellToCity: payload.shipping_address.city,
    sellToCountry: payload.shipping_address.country_code,
    sellToEmail: payload.email,
    shippingLines: payload.shipping_lines,
  };

  try {
    const orderResp = await createOrder(order as OrderInput);
    console.log('!!!!!!!!orderResp: ', orderResp);
    const documentNo = orderResp.documentNo;
    if (documentNo) {
      const id = payload.admin_graphql_api_id;
      await tagOrderWithExternalDoc(shop, id, documentNo);
    }
  } catch (err) {
    console.error("NAV create flow failed:", err);
  }
};
