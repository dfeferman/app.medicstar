import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createOrder, type OrderInput } from "../services/soap/create-order";
import { createOrderWithContact, type OrderInput as OrderWithContactInput } from "../services/soap/create-order-with-contact";
import { tagOrderWithExternalDoc } from "../services/admin/tag-order.server";
import { getOrderTransactions, mapTransactionToPaymentFields } from "../services/admin/order-transactions";
import { mapShippingAgentCode } from "../utils/mappers/mapShippingAgentCode";
import { mapGatewayToTxCode } from "../utils/mappers/mapGatewayToTxCode";
import { mapCustomerGroup } from "../utils/mappers/mapCustomerGroup";
import { getContactByEmail } from "../services/soap/get-contact";
import { createContact } from "../services/soap/create-contact";

type NoteAttribute = {
  name: string;
  value: string
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  processOrder(shop, payload).catch(console.error);
  return new Response();
};

let order: any;

const processOrder = async (shop: string, payload: any) => {
  const noteAttrs = payload.note_attributes as Array<NoteAttribute>;
  const rawCustomerGroup = noteAttrs.find((a) => a?.name === "kundengruppe")?.value || "ONLINESHOP";
  const noteTemplate = mapCustomerGroup(rawCustomerGroup);

  console.log(`[processOrder] Customer group mapping: "${rawCustomerGroup}" -> "${noteTemplate}"`);

  // console.log("payload>>>>>>>>>", payload);

  // Fetch transaction data from Shopify
  const orderGid = `gid://shopify/Order/${payload.id}`;
  const transactionData = await getOrderTransactions(shop, orderGid);
  const paymentFields = mapTransactionToPaymentFields(transactionData);

  // console.log("Transaction data:", transactionData);
  // console.log("Payment fields:", paymentFields);

  // Console log shipping price
  const shippingPrice = payload.total_shipping_price_set?.shop_money?.amount || "0.00";
  // console.log("Shipping price:", shippingPrice);

  // Check if contact exists
  const existingContacts = await getContactByEmail(payload.email);
  console.log("Existing contacts found:", existingContacts.length);

  // If contact does not exist and we have phone, create contact first
  console.log("Customer phone:", payload.customer?.phone);
  console.log("Customer shipping phone:", payload.shipping_address?.phone);
  console.log("Billing phone:", payload.billing_address?.phone);

  let contactNumber = "";
  if (existingContacts.length === 0 && (payload.customer?.phone || payload.billing_address?.phone || payload.shipping_address?.phone)) {
    console.log("Creating new contact for email:", payload.email);
    try {
      contactNumber = await createContact({
        company: payload.billing_address?.company,
        fullName: payload.customer?.first_name || "" + " " + payload.customer?.last_name,
        address: payload.billing_address?.address2
          ? `${payload.billing_address?.address1} ${payload.billing_address?.address2}`.trim()
          : payload.billing_address?.address1,
        city: payload.billing_address?.city || "",
        phoneNumber: payload.customer?.phone || payload.billing_address?.phone || payload.shipping_address?.phone,
        countryRegionCode: payload.billing_address?.country_code || "",
        postCode: payload.billing_address?.zip || "",
        email: payload.email,
        customerTemplateCode: noteTemplate,
      });
      console.log("=== CONTACT CREATION RESPONSE ===");
      console.log("Contact created successfully with number:", contactNumber);
      console.log("=== END CONTACT CREATION RESPONSE ===");
    } catch (error) {
      console.error("Error creating contact:", error);
      // Continue with order creation even if contact creation fails
    }
  }

  order = {
    orderExternalDocNo: payload.name,
    orderDate: payload.created_at,
    customerTemplateCode: noteTemplate,
    products: [
      ...(payload?.line_items || [])
        .map((li: any) => {
          const basePrice = li?.price;
          const totalDiscount = li?.total_discount;
          const quantity = li?.quantity;

          // Calculate price with discount: basePrice - (totalDiscount / quantity)
          const discountedPrice = totalDiscount > 0 && quantity > 0
            ? basePrice - (totalDiscount / quantity)
            : basePrice;

          const product = {
            SKU: li?.sku,
            quantity: li?.quantity,
            price: discountedPrice,
            title: li?.name,
          };


          return product;
        }),
      // Add shipping line item as the last item
      {
        SKU: "V001",
        quantity: 1,
        price: shippingPrice,
        title: "Versandart",
        lineAmount: shippingPrice,
        lineAmountInclVAT: (parseFloat(shippingPrice) * (1 + (payload.tax_lines?.[0]?.rate || 0))).toFixed(2)
      }
    ],
    sellToAddress: payload.customer?.default_address?.address2
      ? `${payload.customer?.default_address?.address1} ${payload.customer?.default_address?.address2}`.trim()
      : payload.customer?.default_address?.address1,
    sellToPostCode: payload.customer?.default_address?.zip,
    sellToCity: payload.customer?.default_address?.city,
    sellToCountry: payload.customer?.default_address?.country_code,
    sellToEmail: payload.email,

    shippingLines: payload.shipping_lines,
    shippingAgentCode: mapShippingAgentCode(payload.shipping_lines),
    shipToName: payload.shipping_address.name,
    shipToCustomerFullName: `${payload.shipping_address?.first_name || ''} ${payload.shipping_address?.last_name}`.trim(),
    shipToFirstName: payload.shipping_address.first_name,
    shipToSurname: payload.shipping_address.last_name,
    shipToAddress: payload.shipping_address?.address2
      ? `${payload.shipping_address?.address1} ${payload.shipping_address?.address2}`.trim()
      : payload.shipping_address?.address1,
    shipToCompany: payload.shipping_address?.company || "",
    shipToPostCode: payload.shipping_address.zip,
    shipToCity: payload.shipping_address.city,
    shipToCountry: payload.shipping_address.country_code,

    billToCompany: payload.billing_address?.company || "",
    billToCustomerFullName: `${payload.billing_address?.first_name || ''} ${payload.billing_address?.last_name}`.trim(),
    billToFirstName: payload.billing_address?.first_name || "",
    billToSurname: payload.billing_address.last_name,
    billToAddress: payload.billing_address?.address2
      ? `${payload.billing_address?.address1} ${payload.billing_address?.address2}`.trim()
      : payload.billing_address?.address1,
    billToPostCode: payload.billing_address.zip,
    billToCity: payload.billing_address.city,
    billToCountry: payload.billing_address.country_code,
    taxPercentage: payload.tax_lines?.[0]?.rate ? payload.tax_lines[0].rate * 100 : 0,
    taxPercentageFloat: payload.tax_lines?.[0]?.rate || 0,
    taxIncluded: payload.taxes_included,

    // payment transaction data
    paymentTransaction: paymentFields,
    paymentTransactionCode: mapGatewayToTxCode(payload.payment_gateway_names?.[0]),
    paymentTransactionAmount: payload.total_price,
  };

  try {
    let orderResp;
    if (contactNumber) {
      // Use create-order-with-contact service when contact was created
      console.log("Creating order with contact number:", contactNumber);
      orderResp = await createOrderWithContact({ ...order, contactNumber } as OrderWithContactInput);
    } else {
      // Use regular create-order service
      console.log("Creating order without contact");
      orderResp = await createOrder(order as OrderInput);
    }
    const documentNo = orderResp.documentNo;

    console.log("Document no:", documentNo);
    if (documentNo) {
      const id = payload.admin_graphql_api_id;
      // console.log("Tagging order with ID:", id);
      // console.log("Tagging order with document no:", documentNo);
      // console.log("Tagging order with shop:", shop);
      await tagOrderWithExternalDoc(shop, id, documentNo);
    }
  } catch (err) {
  }
};
