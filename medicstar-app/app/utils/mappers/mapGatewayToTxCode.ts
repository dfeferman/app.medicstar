export function mapGatewayToTxCode(gateway: string): string {
  const gatewayLower = gateway.toLowerCase();

  if (gatewayLower.includes('rechnung')) {
    return 'RECHNUNG';
  } else if (gatewayLower.includes('sepa')) {
    return 'SEPA-LS';
  } else if (gatewayLower.includes('paypal')) {
    return 'PAYPAL';
  } else if (gatewayLower.includes('vorkasse')) {
    return 'VORKASSE';
  } else if (gatewayLower.includes('kreditkarte') || gatewayLower.includes('shopify_payments')) {
    return 'SHOPIFYPAY';
  } else if (gatewayLower.includes('klarna') || gatewayLower.includes('klarna_pay_later')) {
    return 'KLARNA';
  } else {
    return '';
  }
}
