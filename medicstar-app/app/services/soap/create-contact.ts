import "dotenv/config.js";
import { NS, envelope, postSoap, parseSoapBody } from "../../../lib/soap";
import { escapeXml } from "../../utils/escapeXml";

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
  vatRegistrationNo?: string;
};

export async function createContact(contact: ContactInput): Promise<string> {
  const bodyXml = `
  <tns:CreateContact xmlns:tns="${NS.CONTACT_CREATE.TNS}">
    <tns:inboundCreateContact>
      <nav:Contact xmlns:nav="${NS.CONTACT_CREATE.NAV}">
        <nav:Name>${escapeXml(contact.company)}</nav:Name>
        <nav:Name_2>${escapeXml(contact.fullName)}</nav:Name_2>
        <nav:Address>${escapeXml(contact.address)}</nav:Address>
        <nav:City>${escapeXml(contact.city)}</nav:City>
        <nav:Phone_No>${escapeXml(contact.phoneNumber)}</nav:Phone_No>
        <nav:Country_Region_Code>${escapeXml(contact.countryRegionCode)}</nav:Country_Region_Code>
        <nav:Post_Code>${escapeXml(contact.postCode)}</nav:Post_Code>
        <nav:E-Mail>${escapeXml(contact.email)}</nav:E-Mail>
        <nav:Customer_Templ_Code>${escapeXml(contact.customerTemplateCode)}</nav:Customer_Templ_Code>
        <nav:VAT_Registration_No>${escapeXml(contact.vatRegistrationNo || '')}</nav:VAT_Registration_No>
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
  const returned = body?.CreateContactResponse?.inboundCreateContact;
  const customerNo = returned?.Contact?.No;

  return String(customerNo ?? "");
}
