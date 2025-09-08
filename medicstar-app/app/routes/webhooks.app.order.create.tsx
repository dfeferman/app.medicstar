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

  processOrder(shop, payload).catch(console.error);
  return new Response();
};

let order: any;

const processOrder = async (shop: string, payload: any) => {
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
    sellToName: `${payload.customer?.first_name || ''} ${payload.customer?.last_name}`.trim(),
    sellToAddress: payload.customer?.default_address?.address1,
    sellToPostCode: payload.customer?.default_address?.zip,
    sellToCity: payload.customer?.default_address?.city,
    sellToCountry: payload.customer?.default_address?.country_code,
    sellToEmail: payload.email,
    shippingLines: payload.shipping_lines,
    shipToName: payload.shipping_address.name,
    shipToAddress: payload.shipping_address.address1,
    shipToPostCode: payload.shipping_address.zip,
    shipToCity: payload.shipping_address.city,
    shipToCountry: payload.shipping_address.country_code,
  };

  try {
    const orderResp = await createOrder(order as OrderInput);
    const documentNo = orderResp.documentNo;
    if (documentNo) {
      const id = payload.admin_graphql_api_id;
      await tagOrderWithExternalDoc(shop, id, documentNo);
    }
  } catch (err) {
  }
};
