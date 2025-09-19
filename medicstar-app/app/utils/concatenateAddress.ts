export function concatenateAddress(address1?: string, address2?: string): string {
  if (address2) {
    return `${address1 || ''} ${address2}`.trim();
  }
  return address1 || '';
}
