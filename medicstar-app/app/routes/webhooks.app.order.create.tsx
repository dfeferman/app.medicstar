import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createOrder, type OrderInput } from "../services/soap/create-order";
import { createOrderWithContact, type OrderInput as OrderWithContactInput } from "../services/soap/create-order-with-contact";
import { getOrderTransactions } from "../services/admin/order-transactions";
import { tagOrderWithExternalDoc } from "../services/admin/tag-order.server";
import { mapTransactionToPaymentFields } from "../utils/mappers/mapTransactionToPaymentFields";
import { mapShippingAgentCode } from "../utils/mappers/mapShippingAgentCode";
import { mapGatewayToTxCode } from "../utils/mappers/mapGatewayToTxCode";
import { getNoteTemplate } from "../utils/getNoteTemplate";
import { getContactByEmail } from "../services/soap/get-contact";
import { createContact } from "../services/soap/create-contact";
import { createFullName } from "../utils/createFullName";
import { concatenateAddress } from "../utils/concatenateAddress";
import { selectPhoneNumber } from "../utils/selectPhoneNumber";
import { createOrderProducts } from "../utils/createOrderProducts";
import { orderLogger } from "../../lib/logger";

type NoteAttribute = {
  name: string;
  value: string
};


export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { shop, payload } = await authenticate.webhook(request);

    console.log('payload >>>>', payload);

    orderLogger.info('Order webhook received', {
      shop,
      orderId: payload.id,
      orderName: payload.name,
      orderNumber: payload.order_number,
      totalPrice: payload.total_price,
      currency: payload.currency,
      customerEmail: payload.email,
    });

    processOrder(shop, payload).catch((error) => {
      orderLogger.error('Error processing order', {
        shop,
        orderId: payload.id,
        orderName: payload.name,
        error: error.message,
        stack: error.stack
      });
    });

    return new Response();
  } catch (error) {
    return new Response();
  }
};

let order: any;

const processOrder = async (shop: string, payload: any) => {
  const startTime = Date.now();

  try {
    const noteAttrs = payload.note_attributes as Array<NoteAttribute>;
    const billToCountry = payload.billing_address?.country_code;
    const taxesIncluded = parseFloat(payload.total_tax) > 0;

    const noteTemplate = getNoteTemplate(noteAttrs, billToCountry, taxesIncluded);
    const vatNumber = noteAttrs.find((attr) => attr?.name === "Vat Number")?.value || "";

    orderLogger.info('Extracted note attributes', {
      shop,
      orderId: payload.id,
      noteTemplate,
      vatNumber: vatNumber || 'Not provided',
      kundengruppe: noteAttrs.find((attr) => attr?.name === "kundengruppe")?.value || 'Not provided'
    });

    const orderGid = `gid://shopify/Order/${payload.id}`;

    orderLogger.info('Retrieving order transactions', {
      shop,
      orderId: payload.id,
      orderGid
    });

    const transactionData = await getOrderTransactions(shop, orderGid);
    const paymentFields = mapTransactionToPaymentFields(transactionData);

    orderLogger.info('Getting contact by email', {
      shop,
      orderId: payload.id,
      customerEmail: payload.email
    });

    const existingContacts = await getContactByEmail(payload.email);

    let contactNumber = "";
    if (existingContacts.length === 0 && (payload.billing_address?.phone || payload.customer?.phone ||  payload.shipping_address?.phone)) {
      contactNumber = await createContact({
        company: payload.billing_address?.company,
        fullName: createFullName(payload.customer?.first_name, payload.customer?.last_name),
        address: concatenateAddress(payload.billing_address?.address1, payload.billing_address?.address2),
        city: payload.billing_address?.city || "",
        phoneNumber: selectPhoneNumber(payload.customer?.phone, payload.billing_address?.phone, payload.shipping_address?.phone),
        countryRegionCode: payload.billing_address.country_code || "",
        postCode: payload.billing_address?.zip || "",
        email: payload.email,
        customerTemplateCode: noteTemplate,
        vatRegistrationNo: vatNumber,
      });
    }

    const products = createOrderProducts(payload);

    order = {
      orderExternalDocNo: payload.name,
      orderDate: payload.created_at,
      customerTemplateCode: noteTemplate,
      products: products,
      sellToAddress: concatenateAddress(payload.customer?.default_address?.address1, payload.customer?.default_address?.address2),
      sellToPostCode: payload.customer?.default_address?.zip,
      sellToCity: payload.customer?.default_address?.city,
      sellToCountry: payload.customer?.default_address?.country_code,
      sellToEmail: payload.email,

      shippingLines: payload.shipping_lines,
      shippingAgentCode: mapShippingAgentCode(payload.shipping_lines),
      shipToName: payload.shipping_address.name,
      shipToCustomerFullName: createFullName(payload.shipping_address?.first_name, payload.shipping_address?.last_name),
      shipToFirstName: payload.shipping_address.first_name,
      shipToSurname: payload.shipping_address.last_name,
      shipToAddress: concatenateAddress(payload.shipping_address?.address1, payload.shipping_address?.address2),
      shipToCompany: payload.shipping_address?.company || "",
      shipToPostCode: payload.shipping_address.zip,
      shipToCity: payload.shipping_address.city,
      shipToCountry: payload.shipping_address.country_code,

      billToCompany: payload.billing_address?.company || "",
      billToCustomerFullName: createFullName(payload.billing_address?.first_name, payload.billing_address?.last_name),
      billToFirstName: payload.billing_address?.first_name || "",
      billToSurname: payload.billing_address.last_name,
      billToAddress: concatenateAddress(payload.billing_address?.address1, payload.billing_address?.address2),
      billToPostCode: payload.billing_address.zip,
      billToCity: payload.billing_address.city,
      billToCountry: payload.billing_address.country_code,
      taxPercentage: payload.tax_lines?.[0]?.rate ? payload.tax_lines[0].rate * 100 : 0,
      taxPercentageFloat: payload.tax_lines?.[0]?.rate || 0,
      taxIncluded: payload.taxes_included,

      paymentTransaction: paymentFields,
      paymentTransactionCode: mapGatewayToTxCode(payload.payment_gateway_names?.[0]),
      paymentTransactionAmount: payload.total_price,
    };

    let orderResp;
    if (contactNumber) {
      orderLogger.info('Creating order with contact', {
        shop,
        orderId: payload.id,
        orderName: payload.name,
        contactNumber
      });
      orderResp = await createOrderWithContact({ ...order, contactNumber } as OrderWithContactInput);
    } else {
      orderLogger.info('Creating order without contact', {
        shop,
        orderId: payload.id,
        orderName: payload.name
      });
      orderResp = await createOrder(order as OrderInput);
    }

    const documentNo = orderResp.documentNo;
    const processingTime = Date.now() - startTime;

    if (documentNo) {
      orderLogger.info('Received documentNo from Business Central', {
        shop,
        orderId: payload.id,
        orderName: payload.name,
        bcDocumentNo: documentNo,
        processingTime
      });

      const id = payload.admin_graphql_api_id;
      await tagOrderWithExternalDoc(shop, id, documentNo);
    }
  } catch (err) {
    orderLogger.error('Error during order processing', {
      shop,
      orderId: payload.id,
      orderName: payload.name,
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
      processingTime: Date.now() - startTime
    });
  }
};
