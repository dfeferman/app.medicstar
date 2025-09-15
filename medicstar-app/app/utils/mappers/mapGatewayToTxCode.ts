export function mapGatewayToTxCode(gateway: string): string {
  const gatewayLower = gateway.toLowerCase();

  if (gatewayLower.includes('rechnung') || gatewayLower.includes('invoice')) {
    return 'RECHNUNG';
  } else if (gatewayLower.includes('sepa')) {
    return 'SEPA-LS';
  } else if (gatewayLower.includes('paypal')) {
    return 'PAYPAL';
  } else if (gatewayLower.includes('vorkasse') || gatewayLower.includes('prepayment')) {
    return 'VORKASSE';
  } else {
    return '';
  }
}
