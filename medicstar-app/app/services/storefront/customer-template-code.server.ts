export async function getCustomerTemplateCodeFromCart(shopDomain: string, cartToken: string): Promise<string> {
  try {
    const sfToken: string | undefined = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;
    const sfVersion: string = process.env.SHOPIFY_STOREFRONT_API_VERSION || "2025-07";
    if (!sfToken) {
      console.error("SHOPIFY_STOREFRONT_ACCESS_TOKEN is not set");
      return "";
    };

    const endpoint = `https://${shopDomain}/api/${sfVersion}/graphql.json`;
    const query = `
    query CartAttr($id: ID!) {
      cart(id: $id) {
        attributes {
          key value }
        }
    }`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": sfToken,
      },
      body: JSON.stringify({ query, variables: { id: String(cartToken) } }),
    });
    const data = await res.json() as { data?: { cart?: { attributes?: Array<{ key: string; value: string }> } } };
    const attrs = data?.data?.cart?.attributes || [];
    const template = (attrs.find((a) => a.key === "customer_template_code")?.value || "").trim();
    return template || "";
  } catch (e) {
    console.error("[Storefront] Failed to fetch cart attributes:", e);
    return "";
  }
}


