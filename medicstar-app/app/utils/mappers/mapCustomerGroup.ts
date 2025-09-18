export const mapCustomerGroup = (groupName: string): string => {
  const groupMap: Record<string, string> = {
    "Zahnarzt": "ZAP",
    "Tierarzt": "VETERINÄR",
    "Tätowierer": "TATTOO",
    "sonstiges Gewerbe": "GEWERBE",
    "Schule": "SCHULE",
    "Sanitätshaus": "SANITÄTSHA",
    "öffentliche Einrichtung": "ÖFFENTLICH",
    "Lebensmittelbranche": "FOOD",
    "Kosmetic / Beauty": "KOSMETIK",
    "Kosmetic/Beauty": "KOSMETIK",
    "Kindergarten": "KITAS",
    "Fußpflege": "FUßPFLEGE",
    "Apotheke": "APOTHEKEN",
    "Pflegebranche": "PFLEGE",
    "Arztpraxis": "ARZ",
    "Privatkunde": "PRIVAT",
  };

  // Normalize the input: trim whitespace
  const normalizedInput = groupName?.trim();

  // Direct lookup first
  if (groupMap[normalizedInput]) {
    return groupMap[normalizedInput];
  }

  // Case-insensitive lookup
  const lowerInput = normalizedInput?.toLowerCase();
  const lowerKey = Object.keys(groupMap).find(key => key.toLowerCase() === lowerInput);
  if (lowerKey) {
    return groupMap[lowerKey];
  }

  // Default fallback
  console.warn(`[mapCustomerGroup] Unknown customer group: "${groupName}", defaulting to "ONLINESHOP"`);
  return "ONLINESHOP";
};
