import "dotenv/config.js";
import { NS, envelope, postSoap, parseSoapBody } from "../../../lib/soap";

const user = process.env.NAV_USER as string;
const pass = process.env.NAV_PASS as string;
const endpoint = process.env.NAV_ENDPOINT_CONTACT_READ as string;

async function getContactsByEmail(email: string): Promise<any[]> {
  const bodyXml = `
    <ReadMultiple xmlns="urn:microsoft-dynamics-schemas/page/contact">
      <filter>
        <Contact_Filter>
          <Field>E_Mail</Field>
          <Criteria>${email}</Criteria>
        </Contact_Filter>
      </filter>
      <bookmarkKey></bookmarkKey>
      <setSize>10</setSize>
    </ReadMultiple>`;

  const xml = envelope({
    action: NS.CONTACT_READ.ACTION,
    endpoint,
    tns: NS.CONTACT_READ.TNS,
    nav: NS.CONTACT_READ.NAV,
    bodyXml,
  });

  const response = await postSoap({ endpoint, action: NS.CONTACT_READ.ACTION, xml, user, pass });
  const body = await parseSoapBody(response);

  const rm = body?.ReadMultipleResponse || body?.["ReadMultipleResponse"];
  const result = rm?.ReadMultipleResult || rm?.["ReadMultipleResult"];
  let contacts = result?.Contact || result?.["contact:Contact"] || result;

  if (!contacts) return [];
  if (!Array.isArray(contacts)) contacts = [contacts];

  const get = (obj: any, key: string) => obj?.[key]?._ ?? obj?.[key] ?? obj?.["contact:" + key]?._ ?? obj?.["contact:" + key];

  return contacts
    .filter((c: any) => {
      const contactEmail = get(c, "E-Mail") || get(c, "E_Mail");
      return contactEmail && contactEmail.toLowerCase() === email.toLowerCase();
    });
}

export async function getContactByEmail(email: string): Promise<any[]> {
  if (!email) {
    throw new Error("Email address is required");
  }

  try {
    const contacts = await getContactsByEmail(email);
    return contacts;
  } catch (error) {
    console.error("Error fetching contact:", error);
    throw error;
  }
}
