import { calculateDiscountedPrice } from "./calculateDiscountedPrice";
import { calculateShippingPriceWithVAT } from "./calculateShippingPriceWithVAT";

const SHIPPING_LINE_ITEM = {
  SKU: "V001",
  quantity: 1,
  title: "Versandart",
};

const PROMO_CODE_LINE_ITEM = {
  SKU: "G1000",
  quantity: 1,
};

type LineItem = {
  sku?: string;
  quantity?: number;
  price?: string;
  total_discount?: string;
  name?: string;
};

type DiscountCode = {
  code: string;
  amount: string;
};

type TaxLine = {
  rate?: number;
};

type OrderPayload = {
  line_items?: LineItem[];
  discount_codes?: DiscountCode[];
  tax_lines?: TaxLine[];
  total_shipping_price_set?: {
    shop_money?: {
      amount?: string;
    };
  };
};

export const createOrderProducts = (payload: OrderPayload) => {
  const shippingPrice = payload.total_shipping_price_set?.shop_money?.amount || "0.00";
  const taxRate = payload.tax_lines?.[0]?.rate || 0;

  return [
    ...(payload?.line_items || [])
      .map((li: LineItem) => {
        const basePrice = parseFloat(li?.price || "0");
        const totalDiscount = parseFloat(li?.total_discount || "0");
        const quantity = li?.quantity || 0;

        const discountedPrice = calculateDiscountedPrice(basePrice, totalDiscount, quantity);
        const lineAmount = basePrice * quantity;
        const lineAmountInclVAT = lineAmount * (1 + taxRate);

        return {
          SKU: li?.sku,
          quantity: li?.quantity,
          price: discountedPrice,
          title: li?.name,
          lineAmount: lineAmount,
          lineAmountInclVAT: lineAmountInclVAT
        };
      }),

    {
      ...SHIPPING_LINE_ITEM,
      price: parseFloat(shippingPrice),
      lineAmount: parseFloat(shippingPrice),
      lineAmountInclVAT: calculateShippingPriceWithVAT(shippingPrice, taxRate)
    },

    ...(payload.discount_codes && payload.discount_codes.length > 0 ? [{
      ...PROMO_CODE_LINE_ITEM,
      price: -parseFloat(payload.discount_codes[0].amount),
      title: `Rabattcode - ${payload.discount_codes[0].code}`,
      lineAmount: 0,
      lineAmountInclVAT: 0
    }] : [])
  ];
};
