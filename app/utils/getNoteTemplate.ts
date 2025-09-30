import { mapCustomerGroup } from './mappers/mapCustomerGroup';

interface NoteAttribute {
  name?: string;
  value?: string;
}

export function getNoteTemplate(
  noteAttrs: NoteAttribute[],
  billToCountry?: string,
  taxesIncluded: boolean = false
): string {
  const rawCustomerGroup = noteAttrs.find((a) => a?.name === "kundengruppe")?.value || "ONLINESHOP";

  switch (billToCountry) {
    case "AT":
      return taxesIncluded === true ? "ATMIT" : "ATOHNE";
    case "NL":
      return taxesIncluded === true ? "NLMIT" : "NLOHNE";
    default:
      return mapCustomerGroup(rawCustomerGroup);
  }
}
