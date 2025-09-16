import { unauthenticated } from "../../shopify.server";

const SHOP_DOMAIN = process.env.SHOP_DOMAIN!;

/**
 * Get the primary location ID for the store
 */
export const getStoreLocationId = async (): Promise<string> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(SHOP_DOMAIN);
 //TODO: IF add location rewrite here
  const query = `#graphql
    query getLocations {
      locations(first: 1) {
        nodes {
          id
          name
          isPrimary
        }
      }
    }`;

  const response = await graphql(query);
  const responseJson = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get locations: ${JSON.stringify(responseJson)}`);
  }

  const locations = responseJson.data.locations.nodes;
  console.log(`locations>>>>>`, locations);
  const primaryLocation = locations.find((loc: any) => loc.isPrimary) || locations[0];

  if (!primaryLocation) {
    throw new Error("No location found for the store");
  }

  console.log(`[getStoreLocationId] Found ${locations.length} locations:`);
  locations.forEach((loc: any, index: number) => {
    console.log(`[getStoreLocationId] Location ${index + 1}: ID=${loc.id}, Name="${loc.name}", isPrimary=${loc.isPrimary}`);
  });
  console.log(`[getStoreLocationId] Using location: ID=${primaryLocation.id}, Name="${primaryLocation.name}"`);

  return primaryLocation.id;
};
