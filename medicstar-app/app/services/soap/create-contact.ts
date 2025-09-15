import "dotenv/config.js";
import { NS, envelope, postSoap, parseSoapBody } from "../../../lib/soap";

const user = process.env.NAV_USER as string;
const pass = process.env.NAV_PASS as string;
const endpoint = process.env.NAV_ENDPOINT_CONTACT as string;

export type ContactInput = {
  company: string;
  fullName: string;
  address: string;
  city: string;
  phoneNumber: string;
  countryRegionCode: string;
  postCode: string;
  email: string;
  customerTemplateCode: string;
};

export async function createContact(contact: ContactInput): Promise<string> {
  const bodyXml = `
  <tns:CreateContact xmlns:tns="${NS.CONTACT_CREATE.TNS}">
    <tns:inboundCreateContact>
      <nav:Contact xmlns:nav="${NS.CONTACT_CREATE.NAV}">
        <nav:Name>${contact.company}</nav:Name>
        <nav:Name_2>${contact.fullName}</nav:Name_2>
        <nav:Address>${contact.address}</nav:Address>
        <nav:City>${contact.city}</nav:City>
        <nav:Phone_No>${contact.phoneNumber}</nav:Phone_No>
        <nav:Country_Region_Code>${contact.countryRegionCode}</nav:Country_Region_Code>
        <nav:Post_Code>${contact.postCode}</nav:Post_Code>
        <nav:E-Mail>${contact.email}</nav:E-Mail>
        <nav:Customer_Templ_Code>${contact.customerTemplateCode}</nav:Customer_Templ_Code>
        <nav:No></nav:No>
      </nav:Contact>
    </tns:inboundCreateContact>
  </tns:CreateContact>
`;

  const xml = envelope({
    action: NS.CONTACT_CREATE.ACTION,
    endpoint,
    tns: NS.CONTACT_CREATE.TNS,
    nav: NS.CONTACT_CREATE.NAV,
    bodyXml,
  });

  const resp = await postSoap({
    endpoint,
    action: NS.CONTACT_CREATE.ACTION,
    xml,
    user: user,
    pass: pass,
  });

  const body = await parseSoapBody(resp);
  console.log("=== CREATE CONTACT RESPONSE ===");
  console.log("Parsed Body:", JSON.stringify(body, null, 2));
  console.log("=== END CREATE CONTACT RESPONSE ===");

  const returned = body?.CreateContactResponse?.inboundCreateContact;
  const customerNo = returned?.Contact?.No;

  console.log("Extracted contact number:", customerNo);
  return String(customerNo ?? "");
}
