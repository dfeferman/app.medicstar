import "dotenv/config.js";
import { NS, envelope, postSoap, parseSoapBody } from "../../../lib/soap";

const user = process.env.NAV_USER as string;
const pass = process.env.NAV_PASS as string;
const endpoint = process.env.NAV_ENDPOINT_CONTACT as string;

export type ContactInput = {
  Name: string;
  Address: string;
  City: string;
  Country_Region_Code: string;
  Post_Code: string;
  Phone_No?: string;
  E_Mail: string;
  First_Name: string;
  Surname: string;
  Customer_Template_Code: string;
};

export async function createCustomer(contact: ContactInput): Promise<string> {
  const bodyXml = `
  <tns:CreateContact xmlns:tns="${NS.CONTACT.TNS}">
    <tns:inboundCreateContact>
      <nav:Contact xmlns:nav="${NS.CONTACT.NAV}">
        <nav:Name>${contact.Name}</nav:Name>
        <nav:E-Mail>${contact.E_Mail}</nav:E-Mail>
        <nav:First_Name>${contact.First_Name}</nav:First_Name>
        <nav:Surname>${contact.Surname}</nav:Surname>
        <nav:Online_Login_ID></nav:Online_Login_ID>
        <nav:Online_Password></nav:Online_Password>
        <nav:Customer_Templ_Code>${contact.Customer_Template_Code}</nav:Customer_Templ_Code>
        <nav:No></nav:No>
        <nav:Address>${contact.Address}</nav:Address>
        <nav:City>${contact.City}</nav:City>
        <nav:Post_Code>${contact.Post_Code}</nav:Post_Code>
        <nav:Country_Region_Code>${contact.Country_Region_Code}</nav:Country_Region_Code>
        <nav:Phone_No>${contact.Phone_No}</nav:Phone_No>
      </nav:Contact>
    </tns:inboundCreateContact>
  </tns:CreateContact>
`;

  const xml = envelope({
    action: NS.CONTACT.ACTION,
    endpoint,
    tns: NS.CONTACT.TNS,
    nav: NS.CONTACT.NAV,
    bodyXml,
  });

  const resp = await postSoap({
    endpoint,
    action: NS.CONTACT.ACTION,
    xml,
    user: user,
    pass: pass,
  });

  const body = await parseSoapBody(resp);
  const returned = body?.["tns:CreateContactResponse"]?.["tns:inboundCreateContact"];
  const customerNo = returned?.["nav:Contact"]?.["nav:Customer_No"]
    || returned?.Contact?.Customer_No;
  return String(customerNo ?? "");
}
