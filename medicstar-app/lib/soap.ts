import { parseStringPromise } from "xml2js";
import crypto from "node:crypto";

export const NS = {
  ORDER: {
    TNS: "http://tempuri.org/InboundCreateInboundOrderIISWebService/",
    NAV: "urn:microsoft-dynamics-nav/xmlports/x5371218",
    ACTION: "http://tempuri.org/InboundCreateInboundOrderIISWebService/InboundCreateInboundOrderIISWebService/CreateSalesOrder"
  },
   CONTACT: {
    TNS: "http://tempuri.org/InboundCreateContactIISWebService/",
    NAV: "urn:microsoft-dynamics-nav/xmlports/x5371217",
    ACTION: "http://tempuri.org/InboundCreateContactIISWebService/InboundCreateContactIISWebService/CreateContact",
  },
} as const;

export const authHeader = (user: string, pass: string): string =>
  "Basic " + Buffer.from(`${user}:${pass}`, "ascii").toString("base64");

export const uuidURN = (): string => "urn:uuid:" + crypto.randomUUID();

export function envelope({ action, endpoint, tns, nav, bodyXml }: { action: string; endpoint: string; tns: string; nav?: string; bodyXml: string; }): string {
  const msgId = uuidURN();
  const navAttr = nav ? `xmlns:nav="${nav}"` : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
            xmlns:wsa="http://www.w3.org/2005/08/addressing"
            xmlns:tns="${tns}"
            ${navAttr}>
  <s:Header>
    <wsa:Action>${action}</wsa:Action>
    <wsa:To>${endpoint}</wsa:To>
    <wsa:MessageID>${msgId}</wsa:MessageID>
  </s:Header>
  <s:Body>
    ${bodyXml}
  </s:Body>
</s:Envelope>`;
}

export async function postSoap({ endpoint, action, xml, user, pass }: { endpoint: string; action: string; xml: string; user: string; pass: string; }): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    console.log("SOAP POST ->", { endpoint, action, xmlBytes: Buffer.byteLength(xml, "utf8") });
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authHeader(user, pass),
        "Content-Type": `application/soap+xml; charset=utf-8; action="${action}"`,
      },
      body: xml,
      signal: controller.signal,
    });
    const text = await res.text();
    console.log("SOAP RESP <-", { status: res.status, ok: res.ok, bytes: Buffer.byteLength(text, "utf8") });
    if (!res.ok) {
      console.error("SOAP Error Body:", text.slice(0, 2000));
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return text;
  } catch (err) {
    console.error("SOAP Request Failed:", err);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function parseSoapBody(xml: string): Promise<any> {
  const obj = await parseStringPromise(xml, { explicitArray: false });
  return obj?.["s:Envelope"]?.["s:Body"] ?? obj?.Envelope?.Body ?? obj;
}

