import { getOrderById } from '../admin/get-order-by-id';
import { createOrder, type OrderInput } from '../soap/create-order';
import { createOrderWithContact, type OrderInput as OrderWithContactInput } from '../soap/create-order-with-contact';
import { getOrderTransactions } from '../admin/order-transactions';
import { tagOrderWithExternalDoc } from '../admin/tag-order.server';
import { mapTransactionToPaymentFields } from '../../utils/mappers/mapTransactionToPaymentFields';
import { mapShippingAgentCode } from '../../utils/mappers/mapShippingAgentCode';
import { mapGatewayToTxCode } from '../../utils/mappers/mapGatewayToTxCode';
import { getNoteTemplate } from '../../utils/getNoteTemplate';
import { getContactByEmail } from '../soap/get-contact';
import { createContact } from '../soap/create-contact';
import { createFullName } from '../../utils/createFullName';
import { concatenateAddress } from '../../utils/concatenateAddress';
import { selectPhoneNumber } from '../../utils/selectPhoneNumber';
import { createOrderProducts } from '../../utils/createOrderProducts';
import { orderLogger } from '../../../lib/logger';

type NoteAttribute = {
  name: string;
  value: string;
};

const ORDER_ID = '6893434405207';
const SHOP_DOMAIN = 'gaxjmv-fj.myshopify.com';

async function manualOrderProcess() {
  const startTime = Date.now();

  try {
    console.log(`=== Manual Order Processing for Order ID: ${ORDER_ID} ===`);
    console.log(`Shop: ${SHOP_DOMAIN}`);
    console.log('Time:', new Date().toISOString());

    console.log('\n=== Step 1: Fetching Order from Shopify ===');
    const payload = await getOrderById(SHOP_DOMAIN, ORDER_ID);

    orderLogger.info('Order webhook received', {
      shop: SHOP_DOMAIN,
      orderId: payload.id,
      orderName: payload.name,
      orderNumber: payload.order_number,
      totalPrice: payload.total_price,
      currency: payload.currency,
      customerEmail: payload.email,
      fullPayload: payload
    });

    console.log('✅ Order fetched successfully:');
    console.log(`   Order Name: ${payload.name}`);
    console.log(`   Order Number: ${payload.order_number}`);
    console.log(`   Total Price: ${payload.total_price} ${payload.currency}`);
    console.log(`   Email: ${payload.email}`);
    console.log(`   Note Attributes: ${JSON.stringify(payload.note_attributes)}`);

    console.log('\n=== Step 2: Processing Note Attributes ===');
    const noteAttrs = payload.note_attributes as Array<NoteAttribute>;
    const billToCountry = payload.billing_address?.country_code;
    const taxesIncluded = parseFloat(payload.total_tax) > 0;

    const noteTemplate = getNoteTemplate(noteAttrs, billToCountry, taxesIncluded);
    const vatNumber = noteAttrs.find((attr) => attr?.name === "Vat Number")?.value || "";

    orderLogger.info('Extracted note attributes', {
      shop: SHOP_DOMAIN,
      orderId: payload.id,
      noteTemplate,
      vatNumber: vatNumber || 'Not provided',
      kundengruppe: noteAttrs.find((attr) => attr?.name === "kundengruppe")?.value || 'Not provided'
    });

    console.log(`✅ Note Template: ${noteTemplate}`);
    console.log(`✅ VAT Number: ${vatNumber || 'Not provided'}`);
    console.log(`✅ Bill To Country: ${billToCountry}`);
    console.log(`✅ Taxes Included: ${taxesIncluded}`);

    console.log('\n=== Step 3: Getting Transaction Data ===');
    const orderGid = `gid://shopify/Order/${payload.id}`;

    orderLogger.info('Retrieving order transactions', {
      shop: SHOP_DOMAIN,
      orderId: payload.id,
      orderGid
    });

    const transactionData = await getOrderTransactions(SHOP_DOMAIN, orderGid);
    const paymentFields = mapTransactionToPaymentFields(transactionData);

    console.log('\n=== Step 4: Checking Existing Contacts ===');

    orderLogger.info('Getting contact by email', {
      shop: SHOP_DOMAIN,
      orderId: payload.id,
      customerEmail: payload.email
    });

    const existingContacts = await getContactByEmail(payload.email);
    console.log(`✅ Existing Contacts Count: ${existingContacts.length}`);

    // Step 5: Create contact if needed
    let contactNumber = "";
    if (existingContacts.length === 0 && (payload.billing_address?.phone || payload.customer?.phone || payload.shipping_address?.phone)) {
      console.log('\n=== Step 5: Creating New Contact ===');

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

      console.log(`✅ Contact created successfully: ${contactNumber}`);
    } else {
      console.log('\n=== Step 5: Contact Creation Skipped ===');
      const reason = existingContacts.length > 0 ? 'existing_contact_found' : 'no_phone_number';
      console.log(`✅ Reason: ${reason}`);
    }

    console.log('\n=== Step 6: Creating Products ===');
    const products = createOrderProducts(payload);
    console.log(`✅ Products created: ${products.length}`);
    console.log(`   Products: ${JSON.stringify(products, null, 2)}`);

    const orderObj = {
      orderExternalDocNo: payload.name,
      orderDate: payload.created_at,
      customerTemplateCode: noteTemplate,
      products: products,
      sellToAddress: concatenateAddress(payload.customer?.default_address?.address1, payload.customer?.default_address?.address2),
      sellToPostCode: payload.customer?.default_address?.zip,
      sellToCity: payload.customer?.default_address?.city,
      sellToCountry: payload.customer?.default_address?.country_code || "",
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
      shipToCountry: payload.shipping_address.country_code || "",

    billToCompany: payload.billing_address?.company || "",
    billToCustomerFullName: createFullName(payload.billing_address?.first_name, payload.billing_address?.last_name),
    billToFirstName: payload.billing_address?.first_name || "",
    billToSurname: payload.billing_address.last_name,
      billToAddress: concatenateAddress(payload.billing_address?.address1, payload.billing_address?.address2),
      billToPostCode: payload.billing_address.zip,
      billToCity: payload.billing_address.city,
      billToCountry: payload.billing_address.country_code || "",
      taxPercentage: payload.tax_lines?.[0]?.rate ? payload.tax_lines[0].rate * 100 : 0,
      taxPercentageFloat: payload.tax_lines?.[0]?.rate || 0,
      taxIncluded: payload.taxes_included,
      paymentTransaction: paymentFields,
      paymentTransactionCode: mapGatewayToTxCode(payload.payment_gateway_names?.[0]),
      paymentTransactionAmount: payload.total_price,
    };

    console.log('\n=== Step 7: Sending Order to Business Central ===');
    console.log(`   Order Type: ${contactNumber ? 'with_contact' : 'without_contact'}`);
    console.log(`   Contact Number: ${contactNumber || 'N/A'}`);

    let orderResp;
    if (contactNumber) {
      orderLogger.info('Creating order with contact', {
        shop: SHOP_DOMAIN,
        orderId: payload.id,
        orderName: payload.name,
        contactNumber
      });
      orderResp = await createOrderWithContact({ ...orderObj, contactNumber } as any);
    } else {
      orderLogger.info('Creating order without contact', {
        shop: SHOP_DOMAIN,
        orderId: payload.id,
        orderName: payload.name
      });
      orderResp = await createOrder(orderObj as any);
    }

    console.log('\n=== Step 8: Processing Result ===');
    const documentNo = orderResp.documentNo;
    const processingTime = Date.now() - startTime;

    if (documentNo) {
      orderLogger.info('Received documentNo from Business Central', {
        shop: SHOP_DOMAIN,
        orderId: payload.id,
        orderName: payload.name,
        bcDocumentNo: documentNo,
        processingTime
      });

      console.log(`✅ Order created successfully in Business Central!`);
      console.log(`   Document No: ${documentNo}`);
      console.log(`   Processing Time: ${processingTime}ms`);

      console.log('\n=== Step 9: Tagging Order in Shopify ===');
      const id = payload.admin_graphql_api_id;
      await tagOrderWithExternalDoc(SHOP_DOMAIN, id, documentNo);

      console.log(`✅ Order tagged successfully with document: ${documentNo}`);

      console.log('\n🎉 === MANUAL ORDER PROCESSING COMPLETED SUCCESSFULLY === 🎉');
      console.log(`   Order: ${payload.name}`);
      console.log(`   BC Document: ${documentNo}`);
      console.log(`   Total Time: ${processingTime}ms`);

    } else {
      orderLogger.error('Failed to create order in Business Central', {
        shop: SHOP_DOMAIN,
        orderId: payload.id,
        orderName: payload.name,
        bcResponse: orderResp,
        processingTime
      });

      console.log('❌ Order creation failed - no document number returned');
      console.log(`   Response: ${JSON.stringify(orderResp)}`);
      console.log(`   Processing Time: ${processingTime}ms`);
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;

    orderLogger.error('Error during order processing', {
      shop: SHOP_DOMAIN,
      orderId: ORDER_ID,
      orderName: 'Unknown',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      processingTime
    });

    console.error('\n❌ === ERROR DURING MANUAL ORDER PROCESSING ===');
    console.error(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    console.error(`   Processing Time: ${processingTime}ms`);
    console.error(`   Stack: ${error instanceof Error ? error.stack : 'No stack trace'}`);
  }
}

console.log('🚀 Starting Manual Order Processing...');

manualOrderProcess();
