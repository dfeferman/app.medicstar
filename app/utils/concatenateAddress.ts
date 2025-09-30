export function concatenateAddress(address1?: string, address2?: string): string {
  const addr1 = address1?.trim() || '';
  const addr2 = address2?.trim() || '';

  if (addr2) {
    return `${addr1} ${addr2}`.trim();
  }
  return addr1;
}
