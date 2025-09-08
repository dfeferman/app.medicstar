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
};

export type ShippingLine = {
  code?: string;
  carrier_identifier?: string;
};

export type OrderInput = {
  orderDate: string;
  customerTemplateCode: string;
  orderExternalDocNo: string;
  products: OrderProduct[];
  sellToName: string;
  sellToAddress: string;
  sellToPostCode: string;
  sellToCity: string;
  sellToCountry: string;
  sellToEmail: string;
  shippingLines: ShippingLine[];
  shipToName: string;
  shipToAddress: string;
  shipToPostCode: string;
  shipToCity: string;
  shipToCountry: string;
};

export type CreateOrderResult = { documentNo?: string };

export async function createOrder(order: OrderInput): Promise<CreateOrderResult> {
  const shippingAgentCode = order.shippingLines?.[0]?.carrier_identifier || "";
  const shippingAgentServiceCode = order.shippingLines?.[0]?.code || "";

  const formattedOrderDate = formatDate(order.orderDate);
  const formattedOrderTime = formatTime(order.orderDate);

  let lineNo = 10000;
  const salesLines = (order.products).map((p) => {
    const xml = `
      <x53:Sales_Line>
        <x53:Line_No>${lineNo}</x53:Line_No>
        <x53:Type>Item</x53:Type>
        <x53:No>${p.SKU}</x53:No>
        <x53:Quantity>${p.quantity}</x53:Quantity>
        <x53:Unit_Price>${p.price}</x53:Unit_Price>
      </x53:Sales_Line>`;
    lineNo += 10000;
    return xml;
  }).join("");

  const bodyXml = `
<tns:CreateSalesOrder xmlns:tns="${NS.ORDER.TNS}">
  <tns:inboundCreateInbOrder xmlns:x53="${NS.ORDER.NAV}">

    <x53:Header_General>
      <x53:Order_Date>${formattedOrderDate}</x53:Order_Date>
      <x53:Shipping_Agent_Code>${shippingAgentCode}</x53:Shipping_Agent_Code>
      <x53:External_Document_No>${order.orderExternalDocNo}</x53:External_Document_No>
      <x53:Prices_Incl_VAT>true</x53:Prices_Incl_VAT>
      <x53:Order_Time>${formattedOrderTime}</x53:Order_Time>
    </x53:Header_General>

    <x53:Header_Sell_To_Customer>
      <x53:Name>${order.sellToName}</x53:Name>
      <x53:Address>${order.sellToAddress}</x53:Address>
      <x53:Post_Code>${order.sellToPostCode}</x53:Post_Code>
      <x53:City>${order.sellToCity}</x53:City>
      <x53:Country_Code>${order.sellToCountry}</x53:Country_Code>
      <x53:Templ_Code>${order.customerTemplateCode}</x53:Templ_Code>
      <x53:E_Mail_Address>${order.sellToEmail}</x53:E_Mail_Address>
    </x53:Header_Sell_To_Customer>


    <x53:Header_Ship_To_Customer>
      <x53:Name>${order.shipToName}</x53:Name>
      <x53:Address>${order.shipToAddress}</x53:Address>
      <x53:Post_Code>${order.shipToPostCode}</x53:Post_Code>
      <x53:City>${order.shipToCity}</x53:City>
      <x53:Country_Code>${order.shipToCountry}</x53:Country_Code>
    </x53:Header_Ship_To_Customer>

    <x53:Sales_Lines>
      ${salesLines}
    </x53:Sales_Lines>

  </tns:inboundCreateInbOrder>
</tns:CreateSalesOrder>`;

  const xml = envelope({
    action: NS.ORDER.ACTION,
    endpoint,
    tns: NS.ORDER.TNS,
    nav: NS.ORDER.NAV,
    bodyXml,
  });

  const resp = await postSoap({ endpoint, action: NS.ORDER.ACTION, xml, user, pass });
  const body = await parseSoapBody(resp);

  const documentNo = body.CreateSalesOrderResponse?.inboundCreateInbOrder?.Header_General?.Document_No;
  return { documentNo };
}
