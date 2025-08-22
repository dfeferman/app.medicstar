import prisma from "../db.server";

type WebConnectorRecord = {
	id: string;
	externalAccessToken: string;
};

export async function getExternalAccessToken(): Promise<string | null> {
	const record = await prisma.webConnector.findFirst();
	return record?.externalAccessToken ?? null;
}

export async function hasExternalAccessToken(): Promise<boolean> {
	const token = await getExternalAccessToken();
	return Boolean(token);
}

export async function saveExternalAccessToken(token: string): Promise<WebConnectorRecord> {
	// Single-record table strategy: use a fixed id
	const fixedId = "singleton";
	const record = await prisma.webConnector.upsert({
		where: { id: fixedId },
		update: { externalAccessToken: token },
		create: { id: fixedId, externalAccessToken: token },
	});
	return { id: record.id, externalAccessToken: record.externalAccessToken };
}

export async function ensureExternalAccessToken(): Promise<string> {
	const existing = await getExternalAccessToken();
	if (existing) return existing;
	const fresh = await requestExternalAccessToken();
	await saveExternalAccessToken(fresh);
	return fresh;
}

export async function requestExternalAccessToken(): Promise<string> {
	const oauthUrl = process.env.OAUTH_TOKEN_URL;
	const clientId = process.env.OAUTH_CLIENT_ID;
	const clientSecret = process.env.OAUTH_CLIENT_SECRET;
	const scope = process.env.OAUTH_SCOPE;

	if (!oauthUrl || !clientId || !clientSecret) {
		throw new Error("OAuth2 configuration missing: OAUTH_TOKEN_URL, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET must be set");
	}

	const form = new URLSearchParams();
	form.set("grant_type", "client_credentials");
	form.set("client_id", clientId);
	form.set("client_secret", clientSecret);
	if (scope) form.set("scope", scope);

	const res = await fetch(oauthUrl, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: form.toString(),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`OAuth token request failed: ${res.status} ${text}`);
	}

	const data = (await res.json()) as { access_token?: string };
	if (!data.access_token) {
		throw new Error("OAuth response missing access_token");
	}

	return data.access_token;
}

type SalesOrderInput = any; // TODO: narrow with payload mapping once finalized

type SoapSalesLine = {
	Line_No: number;
	Type: "Item" | "Resource" | "G/L Account";
	No: string;
	Description?: string;
	Quantity: number;
	Unit_Price: number;
};

export function mapShopifyOrderToSalesLines(payload: any): SoapSalesLine[] {
	const salesLines: SoapSalesLine[] = [];
	let lineNo = 10000; // NAV requires increments (10000, 20000, ...)

	//Map products as Items
	for (const item of payload.line_items || []) {
		salesLines.push({
			Line_No: lineNo,
			Type: "Item",
			No: item.sku || String(item.variant_id), // fallback if SKU missing
			Description: item.title,
			Quantity: item.quantity,
			Unit_Price: parseFloat(item.price), // per-unit
		});
		lineNo += 10000;
	}

	//Map shipping as G/L Account
	if (payload.shipping_lines && payload.shipping_lines.length > 0) {
		for (const ship of payload.shipping_lines) {
			salesLines.push({
				Line_No: lineNo,
				Type: "G/L Account",
				No: process.env.TSO_SHIPPING_GL_ACCOUNT_CODE || "8400", // TODO: replace with NAV shipping GL account
				Description: `Shipping: ${ship.title}`,
				Quantity: 1,
				Unit_Price: parseFloat(ship.price),
			});
			lineNo += 10000;
		}
	}

	return salesLines;
}


export async function createSalesOrderWithRetry(payload: SalesOrderInput): Promise<{ status: number; body: string }> {
	try {
		console.log("[TSO] createSalesOrderWithRetry - start");
		let token = await ensureExternalAccessToken();
		console.log("[TSO] Using access token (first attempt)");
		let res = await sendCreateSalesOrder(payload, token);
		if (res.status !== 401) {
			console.log(`[TSO] CreateSalesOrder response status: ${res.status}`);
			return res;
		}
		console.log("[TSO] Received 401. Refreshing access token and retrying...");
		token = await requestExternalAccessToken();
		await saveExternalAccessToken(token);
		res = await sendCreateSalesOrder(payload, token);
		console.log(`[TSO] Retry response status: ${res.status}`);
		return res;
	} catch (error) {
		console.error("[TSO] Error in createSalesOrderWithRetry:", error);
		return {
			status: 500,
			body: JSON.stringify({ error: "Internal server error during sales order creation" })
		};
	}
}

export function buildCreateSalesOrderSoap(payload: any): string {
	// Extract env-configured namespaces and envelope
	const envNs = process.env.TSO_SOAP_ENVELOPE_NS;
	const inboundNs = process.env.TSO_INBOUND_NS;
	const xmlportNs = process.env.TSO_XMLPORT_NS;

	// Build Header_General
	const createdAt: string | undefined = payload?.created_at;
	const created = createdAt ? new Date(createdAt) : new Date();
	const iso = created.toISOString();
	const orderDate = iso.slice(0, 10);
	const orderTime = createdAt ?? iso;

	// Shipping agent mappings - using shipping_lines from Shopify order webhook
	const shippingLine = payload?.shipping_lines?.[0];

	const shippingAgentCode = shippingLine?.carrier_identifier || shippingLine?.code || "NONE";
	const shippingServiceCode = shippingLine?.code || "STANDARD";

	const orderNumber = payload?.order_number ?? payload?.name ?? "";
	const externalDocNo = `SHOP_${orderNumber}`;
	const pricesInclVat = payload?.taxes_included ?? true;

	const headerGeneral = {
		Order_Date: orderDate,
		Shipping_Agent_Code: shippingAgentCode,
		Shipping_Agent_Service_Code: shippingServiceCode,
		External_Document_No: externalDocNo,
		Prices_Incl_VAT: pricesInclVat,
		Order_Time: orderTime,
	};

	// Header_Sell_To_Customer (billing/customer)
	const customer = payload?.customer || {};
	const billing = payload?.billing_address || {};
	const sellToName = customer?.first_name || customer?.last_name ? `${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() : billing?.name || "Guest Customer";
	const templateCodeMap: { [key: string]: string } = {
		CA: "CA MID",
		DE: "DE MID",
		UA: "UA MID",
	};
	const templateCode = templateCodeMap[billing?.country_code] || "DEFAULT";
	const sellTo = {
		Name: sellToName,
		Address: billing?.address1 || "",
		Post_Code: billing?.zip || "",
		City: billing?.city || "",
		Country_Code: billing?.country_code || "",
		Template_Code: templateCode,
		E_Mail_Address: customer?.email || payload?.email || "",
	};

	// Header_Ship_To_Customer (optional)
	const shipping = payload?.shipping_address || null;
	const sameAsBilling = shipping && billing &&
		shipping?.name === billing?.name &&
		shipping?.address1 === billing?.address1 &&
		shipping?.zip === billing?.zip &&
		shipping?.city === billing?.city &&
		shipping?.country_code === billing?.country_code;

	const shipTo = !shipping || sameAsBilling ? null : {
		Name: shipping?.name || "",
		Address: shipping?.address1 || "",
		Post_Code: shipping?.zip || "",
		City: shipping?.city || "",
		Country_Code: shipping?.country_code || "",
	};

	// Sales_Lines from items + shipping
	const lines = mapShopifyOrderToSalesLines(payload);

	const comments = payload?.note ? [{ Comment: String(payload.note) }] : [];

	const xml = `<?xml version="1.0" encoding="utf-8"?>
	<soap:Envelope xmlns:soap="${envNs}" xmlns:inb="${inboundNs}" xmlns:x53="${xmlportNs}">
		<soap:Header xmlns:wsa="http://www.w3.org/2005/08/addressing">
			<wsa:Action>http://tempuri.org/InboundCreateInboundOrderIISWebService/InboundCreateInboundOrderIISWebService/CreateSalesOrder</wsa:Action>
		</soap:Header>
		<soap:Body>
			<inb:CreateSalesOrder>
				<inb:inboundCreateInbOrder>
					<x53:Header_General>
						<x53:Order_Date>${headerGeneral.Order_Date}</x53:Order_Date>
						<x53:Shipping_Agent_Code>${headerGeneral.Shipping_Agent_Code}</x53:Shipping_Agent_Code>
						<x53:Shipping_Agent_Service_Code>${headerGeneral.Shipping_Agent_Service_Code}</x53:Shipping_Agent_Service_Code>
						<x53:External_Document_No>${headerGeneral.External_Document_No}</x53:External_Document_No>
						<x53:Prices_Incl_VAT>${headerGeneral.Prices_Incl_VAT}</x53:Prices_Incl_VAT>
						<x53:Order_Time>${headerGeneral.Order_Time}</x53:Order_Time>
					</x53:Header_General>
					<x53:Header_Sell_To_Customer>
						<x53:Name>${sellTo.Name}</x53:Name>
						<x53:Address>${sellTo.Address}</x53:Address>
						<x53:Post_Code>${sellTo.Post_Code}</x53:Post_Code>
						<x53:City>${sellTo.City}</x53:City>
						<x53:Country_Code>${sellTo.Country_Code}</x53:Country_Code>
						<x53:Template_Code>${sellTo.Template_Code}</x53:Template_Code>
						<x53:E_Mail_Address>${sellTo.E_Mail_Address}</x53:E_Mail_Address>
					</x53:Header_Sell_To_Customer>
					${shipTo ? `<x53:Header_Ship_To_Customer>
						<x53:Name>${shipTo.Name}</x53:Name>
						<x53:Address>${shipTo.Address}</x53:Address>
						<x53:Post_Code>${shipTo.Post_Code}</x53:Post_Code>
						<x53:City>${shipTo.City}</x53:City>
						<x53:Country_Code>${shipTo.Country_Code}</x53:Country_Code>
					</x53:Header_Ship_To_Customer>` : ""}
					<x53:Sales_Lines>
						${lines
							.map(
								(l) => `<x53:Sales_Line>
									<x53:Line_No>${l.Line_No}</x53:Line_No>
									<x53:Type>${l.Type}</x53:Type>
									<x53:No>${l.No}</x53:No>
									${l.Description ? `<x53:Description>${l.Description}</x53:Description>` : ""}
									<x53:Quantity>${l.Quantity}</x53:Quantity>
									<x53:Unit_Price>${l.Unit_Price}</x53:Unit_Price>
								</x53:Sales_Line>`
							)
							.join("")}
					</x53:Sales_Lines>
					${comments.length ? `<x53:Comment_Lines>${comments.map((c) => `<x53:Comment_Line><x53:Comment>${c.Comment}</x53:Comment></x53:Comment_Line>`).join("")}</x53:Comment_Lines>` : ""}
				</inb:inboundCreateInbOrder>
			</inb:CreateSalesOrder>
		</soap:Body>
	</soap:Envelope>`;

  console.log("[TSO] SOAP XML:", xml);
	return xml;
}

export async function sendCreateSalesOrder(payload: SalesOrderInput, accessToken: string): Promise<{ status: number; body: string }>
{
	const url = process.env.TSO_CREATE_SALES_URL;
	if (!url) throw new Error("TSO_CREATE_SALES_URL is not set");

	const soap = buildCreateSalesOrderSoap(payload);
	console.log("[TSO] Sending CreateSalesOrder SOAP:");
	console.log(soap);

	const res = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/soap+xml; charset=utf-8",
			Authorization: `Bearer ${accessToken}`,
		},
		body: soap,
	});

	const body = await res.text();
	console.log("[TSO] CreateSalesOrder response status:", res.status);
	console.log("[TSO] CreateSalesOrder response body:", body);
	return { status: res.status, body };
}




