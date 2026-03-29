export const PREMIUM_PRODUCT_ID = 'swipesort_premium';

export const PREMIUM_PRODUCT_IDS = [PREMIUM_PRODUCT_ID];

export type BillingProduct = {
  id?: string;
  productId?: string;
  name?: string;
  title?: string;
  description?: string;
  displayPrice?: string;
};

export type BillingPurchase = {
  id?: string;
  productId?: string;
  products?: string[];
  skus?: string[];
};

export function getProductIdentifier(item: BillingProduct | BillingPurchase | null | undefined) {
  if (!item) return '';
  return String(item.productId ?? item.id ?? '').trim();
}

export function getPurchaseProductIds(purchase: BillingPurchase | null | undefined) {
  if (!purchase) return [] as string[];

  const directId = getProductIdentifier(purchase);
  const fromProducts = Array.isArray(purchase.products)
    ? purchase.products.map(String)
    : [];
  const fromSkus = Array.isArray(purchase.skus)
    ? purchase.skus.map(String)
    : [];

  return Array.from(new Set([directId, ...fromProducts, ...fromSkus].filter(Boolean)));
}

export function isPremiumProductId(productId: string | null | undefined) {
  return PREMIUM_PRODUCT_IDS.includes(String(productId ?? '').trim());
}

export function purchaseUnlocksPremium(purchase: BillingPurchase | null | undefined) {
  return getPurchaseProductIds(purchase).some((productId) => isPremiumProductId(productId));
}

export function findPremiumProduct(products: BillingProduct[] | null | undefined) {
  if (!Array.isArray(products)) return null;

  return (
    products.find((product) => isPremiumProductId(getProductIdentifier(product))) ?? null
  );
}

export function getBillingProductTitle(product: BillingProduct | null | undefined) {
  if (!product) return 'Premium';
  return String(product.title ?? product.name ?? 'Premium').trim();
}

export function getBillingProductDescription(product: BillingProduct | null | undefined) {
  return String(product?.description ?? '').trim();
}

export function getBillingProductPrice(product: BillingProduct | null | undefined) {
  return String(product?.displayPrice ?? '').trim();
}
