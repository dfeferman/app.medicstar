export function mapShippingAgentCode(shippingLines: any[]): string {
  const title = shippingLines[0]?.title?.toLowerCase() || "";

  if (title.includes("dhl")) {
    return "DHL";
  } else if (title.includes("dpd")) {
    return "DPD";
  } else if (title.includes("international") || title.includes("Internationales")) {
    return "DHL_INT";
  }

  return "";
}
