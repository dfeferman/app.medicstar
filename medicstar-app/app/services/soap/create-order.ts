import "dotenv/config.js";
import { NS, envelope, postSoap, parseSoapBody } from "../../../lib/soap";
import { formatDate, formatTime } from "../../utils/datetime";

const endpoint = process.env.NAV_ENDPOINT_ORDER as string;
const user = process.env.NAV_USER as string;
const pass = process.env.NAV_PASS as string;

export type OrderProduct = {
  SKU: string;
  quantity: number;
  price: number
  title: string;
  lineAmount?: number;
  lineAmountInclVAT?: number;
};

export type PaymentTransaction = {
  TX_ID: string;
  TX_Code: string;
  TX_Amount: string;
  PmtTransactionAmount: string;
};

export type OrderInput = {
  orderDate: string;
  customerTemplateCode: string;
  orderExternalDocNo: string;
  products: OrderProduct[];
  sellToFirstName?: string;
  sellToSurname: string;
  sellToAddress: string;
  sellToAddress2?: string;
  sellToPostCode: string;
  sellToCity: string;
  sellToCountry: string;
  sellToEmail: string;

  shippingAgentCode: string;
  shipToName: string;
  shipToCustomerFullName: string;
  shipToFirstName?: string;
  shipToSurname: string;
  shipToAddress: string;
  shipToAddress2?: string;
  shipToCompany?: string;
  shipToPostCode: string;
  shipToCity: string;
  shipToCountry: string;

  billToCompany?: string;
  billToFirstName?: string;
  billToCustomerFullName: string;
  billToSurname?: string;
  billToAddress?: string;
  billToAddress2?: string;
  billToPostCode?: string;
  billToCity?: string;
  billToCountry?: string;

  taxPercentage: string;
  taxPercentageFloat: number;
  taxIncluded: boolean;

  paymentTransaction?: PaymentTransaction;
  paymentTransactionCode: string;
};

export type CreateOrderResult = { documentNo?: string };

const SHIPPING_AGENT_SERVICE_CODE = "STANDARD";
const SHIPPING_METHOD_CODE = "WEBSHOP";
const PRODUCT_TYPE = "Item";

export async function createOrder(order: OrderInput): Promise<CreateOrderResult> {
  const formattedOrderDate = formatDate(order.orderDate);
  const formattedOrderTime = formatTime(order.orderDate);

  let lineNo = 10000;
  const salesLines = (order.products).map((p) => {
    const quantity = p.quantity;
    const unitPrice = p.price;
    const lineAmount = p.lineAmount !== undefined ? p.lineAmount : quantity * unitPrice;
    const lineAmountInclVAT = p.lineAmountInclVAT !== undefined ? p.lineAmountInclVAT : lineAmount * (1 + (order.taxPercentageFloat));

    const xml = `
      <x53:Sales_Line>
        <x53:Line_No>${lineNo}</x53:Line_No>
        <x53:Type>${PRODUCT_TYPE}</x53:Type>
        <x53:No>${p.SKU}</x53:No>
        <x53:Description>${p.title}</x53:Description>
        <x53:Quantity>${quantity}</x53:Quantity>
        <x53:Line_Amount>${lineAmount}</x53:Line_Amount>
        <x53:Line_Amount_Incl_VAT>${lineAmountInclVAT}</x53:Line_Amount_Incl_VAT>
        <x53:Unit_Price>${unitPrice}</x53:Unit_Price>
      </x53:Sales_Line>`;
    lineNo += 10000;
    return xml;
  }).join("");

  const bodyXml = `
<tns:CreateSalesOrder xmlns:tns="${NS.ORDER_CREATE.TNS}">
  <tns:inboundCreateInbOrder xmlns:x53="${NS.ORDER_CREATE.NAV}">

    <x53:Amount></x53:Amount>
    <x53:Total_Amount></x53:Total_Amount>
    <x53:Invoice_Discount_Amount></x53:Invoice_Discount_Amount>
    <x53:VAT_Amount>${order.taxPercentage}</x53:VAT_Amount>
    <x53:Amount_Incl_VAT>${order.taxPercentage}</x53:Amount_Incl_VAT>

    <x53:Header_General>
      <x53:Order_Date>${formattedOrderDate}</x53:Order_Date>
      <x53:Shipment_Method_Code>${SHIPPING_METHOD_CODE}</x53:Shipment_Method_Code>
      <x53:Shipping_Agent_Code>${order.shippingAgentCode}</x53:Shipping_Agent_Code>
      <x53:Shipping_Agent_Service_Code>${SHIPPING_AGENT_SERVICE_CODE}</x53:Shipping_Agent_Service_Code>
      <x53:External_Document_No>${order.orderExternalDocNo}</x53:External_Document_No>
      <x53:Payment_Method_Code>${order.paymentTransactionCode}</x53:Payment_Method_Code>
      <x53:Prices_Incl_VAT>${order.taxIncluded}</x53:Prices_Incl_VAT>
      <x53:Order_Time>${formattedOrderTime}</x53:Order_Time>
    </x53:Header_General>

    <x53:Header_Sell_To_Customer>
      <x53:Name>${order.billToCompany}</x53:Name>
      <x53:Name_2>${order.billToCustomerFullName}</x53:Name_2>
      <x53:Address>${order.billToAddress}</x53:Address>
      <x53:Post_Code>${order.billToPostCode}</x53:Post_Code>
      <x53:City>${order.billToCity}</x53:City>
      <x53:Country_Code>${order.billToCountry}</x53:Country_Code>
      <x53:Templ_Code>${order.customerTemplateCode}</x53:Templ_Code>
      <x53:E_Mail_Address>${order.sellToEmail}</x53:E_Mail_Address>
    </x53:Header_Sell_To_Customer>

    <x53:Header_Bill_To_Customer>
      <x53:Name>${order.billToCompany}</x53:Name>
      <x53:Name_2>${order.billToCustomerFullName}</x53:Name_2>
      <x53:Address>${order.billToAddress}</x53:Address>
      <x53:Post_Code>${order.billToPostCode}</x53:Post_Code>
      <x53:City>${order.billToCity}</x53:City>
      <x53:Country_Code>${order.billToCountry}</x53:Country_Code>
    </x53:Header_Bill_To_Customer>

    <x53:Header_Ship_To_Customer>
    <x53:Name>${order.shipToCompany}</x53:Name>
    <x53:Name_2>${order.shipToCustomerFullName}</x53:Name_2>
    <x53:Address>${order.shipToAddress}</x53:Address>
    <x53:Post_Code>${order.shipToPostCode}</x53:Post_Code>
    <x53:City>${order.shipToCity}</x53:City>
    <x53:Country_Code>${order.shipToCountry}</x53:Country_Code>
    </x53:Header_Ship_To_Customer>

    <x53:Header_Payment>
      <x53:TX_ID>${order.paymentTransaction?.TX_ID}</x53:TX_ID>
      <x53:TX_Code>${order.paymentTransactionCode}</x53:TX_Code>
      <x53:TX_Amount>${order.taxPercentage}</x53:TX_Amount>
      <x53:PmtTransactionAmount>${order.paymentTransaction?.PmtTransactionAmount}</x53:PmtTransactionAmount>
    </x53:Header_Payment>

    <x53:Sales_Lines>
      ${salesLines}
    </x53:Sales_Lines>

  </tns:inboundCreateInbOrder>
</tns:CreateSalesOrder>`;

  const xml = envelope({
    action: NS.ORDER_CREATE.ACTION,
    endpoint,
    tns: NS.ORDER_CREATE.TNS,
    nav: NS.ORDER_CREATE.NAV,
    bodyXml,
  });

  console.log("=== CREATE ORDER REQUEST ===");
  console.log("Endpoint:", endpoint);
  console.log("Action:", NS.ORDER_CREATE.ACTION);
  console.log("XML Request:", xml);

  const resp = await postSoap({ endpoint, action: NS.ORDER_CREATE.ACTION, xml, user, pass });
  const body = await parseSoapBody(resp);

  console.log("=== CREATE ORDER RESPONSE ===");
  console.log(JSON.stringify(body, null, 2));

  const documentNo = body.CreateSalesOrderResponse?.inboundCreateInbOrder?.Header_General?.Document_No;
  return { documentNo };
}
