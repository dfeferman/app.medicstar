import { unauthenticated } from "../../shopify.server";

export const getStoreLocationId = async (shopDomain: string): Promise<string> => {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(shopDomain);
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
  const primaryLocation = locations.find((loc: any) => loc.isPrimary) || locations[0];

  if (!primaryLocation) {
    throw new Error("No location found for the store");
  }

  return primaryLocation.id;
};
