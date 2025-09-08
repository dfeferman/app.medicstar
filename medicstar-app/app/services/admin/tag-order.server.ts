import { unauthenticated } from "../../shopify.server";

export async function tagOrderWithExternalDoc(shopDomain: string, orderGid: string, externalDocumentNo: string): Promise<any> {
  if (!shopDomain || !orderGid || !externalDocumentNo) return null;

  const { admin: { graphql } } = await unauthenticated.admin(shopDomain);
  const mutation = `
    mutation addTags($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        userErrors {
          field message
          }
        }
    }`;
  const tags = [`${externalDocumentNo}`];
  const res = await graphql(mutation, { variables: { id: orderGid, tags } });
  const json = await res.json();
  return json;
}


