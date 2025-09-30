import { unauthenticated } from "../../shopify.server";

export async function getOrderById(shop: string, orderId: string) {
  const {
    admin: { graphql },
  } = await unauthenticated.admin(shop);

  const orderQuery = `#graphql
    query getOrder($id: ID!) {
      order(id: $id) {
        id
        name
        legacyResourceId
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        email
        createdAt
        totalTax
        taxesIncluded
        customAttributes {
          key
          value
        }
        lineItems(first: 50) {
          edges {
            node {
              id
              sku
              quantity
              originalUnitPriceSet {
                shopMoney {
                  amount
                }
              }
              totalDiscountSet {
                shopMoney {
                  amount
                }
              }
              title
            }
          }
        }
        discountApplications(first: 10) {
          edges {
            node {
              ... on DiscountCodeApplication {
                code
                value {
                  ... on MoneyV2 {
                    amount
                  }
                }
              }
            }
          }
        }
        shippingLines(first: 10) {
          edges {
            node {
              title
              code
            }
          }
        }
        shippingAddress {
          name
          firstName
          lastName
          company
          address1
          address2
          city
          zip
          countryCode
        }
        billingAddress {
          company
          firstName
          lastName
          address1
          address2
          city
          zip
          countryCode
          phone
        }
        customer {
          firstName
          lastName
          phone
          defaultAddress {
            address1
            address2
            city
            zip
            countryCode
          }
        }
        paymentGatewayNames
        taxLines {
          rate
        }
        id
      }
    }`;

  const response = await graphql(orderQuery, {
    variables: { id: `gid://shopify/Order/${orderId}` }
  });

  const orderData = await response.json();

  if (!response.ok) {
    throw new Error(`Failed to get order: ${JSON.stringify(orderData)}`);
  }

  const order = orderData.data?.order;
  if (!order) {
    throw new Error(`Order with ID ${orderId} not found`);
  }

  // Transform the data to match webhook payload format
  return {
    id: orderId,
    name: order.name,
    order_number: order.legacyResourceId,
    total_price: order.totalPriceSet.shopMoney.amount,
    currency: order.totalPriceSet.shopMoney.currencyCode,
    email: order.email,
    created_at: order.createdAt,
    total_tax: order.totalTax,
    taxes_included: order.taxesIncluded,
    note_attributes: order.customAttributes.map((attr: any) => ({
      name: attr.key,
      value: attr.value
    })),
    line_items: order.lineItems.edges.map((edge: any) => ({
      sku: edge.node.sku,
      quantity: edge.node.quantity,
      price: edge.node.originalUnitPriceSet.shopMoney.amount,
      total_discount: edge.node.totalDiscountSet.shopMoney.amount,
      name: edge.node.title
    })),
    discount_codes: order.discountApplications.edges.map((edge: any) => ({
      code: edge.node.code,
      amount: edge.node.value.amount
    })),
    shipping_lines: order.shippingLines.edges.map((edge: any) => ({
      title: edge.node.title,
      code: edge.node.code
    })),
    shipping_address: {
      name: order.shippingAddress?.name,
      first_name: order.shippingAddress?.firstName,
      last_name: order.shippingAddress?.lastName,
      company: order.shippingAddress?.company,
      address1: order.shippingAddress?.address1,
      address2: order.shippingAddress?.address2,
      city: order.shippingAddress?.city,
      zip: order.shippingAddress?.zip,
      country_code: order.shippingAddress?.countryCode,
      phone: order.shippingAddress?.phone
    },
    billing_address: {
      name: order.billingAddress?.name,
      first_name: order.billingAddress?.firstName,
      last_name: order.billingAddress?.lastName,
      company: order.billingAddress?.company,
      address1: order.billingAddress?.address1,
      address2: order.billingAddress?.address2,
      city: order.billingAddress?.city,
      zip: order.billingAddress?.zip,
      country_code: order.billingAddress?.countryCode,
      phone: order.billingAddress?.phone
    },
    customer: {
      first_name: order.customer?.firstName,
      last_name: order.customer?.lastName,
      phone: order.customer?.phone,
      default_address: order.customer?.defaultAddress ? {
        address1: order.customer.defaultAddress.address1,
        address2: order.customer.defaultAddress.address2,
        city: order.customer.defaultAddress.city,
        zip: order.customer.defaultAddress.zip,
        country_code: order.customer.defaultAddress.countryCode
      } : undefined
    },
    payment_gateway_names: order.paymentGatewayNames,
    tax_lines: order.taxLines,
    admin_graphql_api_id: order.id
  };
}
