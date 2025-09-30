import { unauthenticated } from "../../shopify.server";

export async function tagOrderWithExternalDoc(shopDomain: string, orderGid: string, documentNo: string): Promise<any> {
  if (!shopDomain || !orderGid || !documentNo) return null;

  const { admin: { graphql } } = await unauthenticated.admin(shopDomain);
  const mutation = `
    mutation addTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors {
          field message
          }
        }
    }`;
  const tags = [`${documentNo}`];
  const res = await graphql(mutation, { variables: { id: orderGid, tags } });
  const json = await res.json();
  return json;
}


