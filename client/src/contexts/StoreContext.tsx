import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type StoreProduct = {
  id: number;
  name: string;
  price: number;
  unit: string;
  imageUrl?: string | null;
  minQuantity?: number;
  quantityStep?: number;
  stock?: number | null;
  variant?: string;
  customAmount?: number;
};
export type CartLine = StoreProduct & { quantity: number };

type StoreContextValue = {
  cart: CartLine[];
  favoriteIds: number[];
  isFavorite: (id: number) => boolean;
  toggleFavorite: (id: number) => void;
  add: (product: StoreProduct, quantity?: number) => void;
  setQuantity: (id: number, quantity: number, variant?: string) => void;
  remove: (id: number, variant?: string) => void;
  clear: () => void;
  syncCatalogProducts?: (products: StoreProduct[]) => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const CART_STORAGE_KEY = "shahezo-store-cart-v1";
const FAVORITES_STORAGE_KEY = "shahezo-store-favorites-v1";

function getLineKey(id: number, variant?: string) {
  return variant ? id + "::" + variant : String(id);
}

function readCart(): CartLine[] {
  try {
    const value = localStorage.getItem(CART_STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is CartLine => Boolean(item && Number.isInteger(item.id) && Number.isInteger(item.quantity) && item.quantity > 0 && typeof item.name === "string" && Number.isInteger(item.price)));
  } catch { return []; }
}

function readFavorites(): number[] {
  try {
    const value = localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id): id is number => Number.isInteger(id) && id > 0))].slice(0, 500);
  } catch { return []; }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartLine[]>(readCart);
  const [favoriteIds, setFavoriteIds] = useState<number[]>(readFavorites);
  useEffect(() => {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch {}
  }, [cart]);
  useEffect(() => {
    try { localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds)); } catch {}
  }, [favoriteIds]);

  const value = useMemo<StoreContextValue>(() => ({
    cart,
    favoriteIds,
    isFavorite: id => favoriteIds.includes(id),
    toggleFavorite: id => setFavoriteIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id].slice(-500)),
    add: (product, quantity = product.minQuantity ?? 1) => setCart(current => {
      const targetKey = getLineKey(product.id, product.variant);
      const found = current.find(line => getLineKey(line.id, line.variant) === targetKey);
      if (!found) return [...current, { ...product, quantity }];
      if (product.customAmount && found.customAmount) {
        const combinedAmt = found.customAmount * found.quantity + product.customAmount * quantity;
        return current.map(line => getLineKey(line.id, line.variant) === targetKey ? { ...line, ...product, price: combinedAmt, customAmount: combinedAmt, quantity: 1 } : line);
      }
      return current.map(line => getLineKey(line.id, line.variant) === targetKey ? { ...line, ...product, quantity: line.quantity + quantity } : line);
    }),
    setQuantity: (id, quantity, variant) => setCart(current => {
      const targetKey = getLineKey(id, variant);
      return quantity <= 0
        ? current.filter(line => getLineKey(line.id, line.variant) !== targetKey)
        : current.map(line => getLineKey(line.id, line.variant) === targetKey ? { ...line, quantity } : line);
    }),
    remove: (id, variant) => setCart(current => {
      const targetKey = getLineKey(id, variant);
      return current.filter(line => getLineKey(line.id, line.variant) !== targetKey);
    }),
    clear: () => setCart([]),
    syncCatalogProducts: (catalogProducts: StoreProduct[]) => {
      if (!Array.isArray(catalogProducts) || !catalogProducts.length) return;
      const byId = new Map(catalogProducts.map(p => [p.id, p]));
      setCart(current => {
        let changed = false;
        const next: CartLine[] = [];
        for (const line of current) {
          const fresh = byId.get(line.id);
          if (!fresh) {
            changed = true;
            continue;
          }
          if (line.customAmount && line.customAmount > 0) {
            if (fresh.imageUrl !== line.imageUrl || fresh.stock !== line.stock) {
              changed = true;
              next.push({ ...line, imageUrl: fresh.imageUrl, stock: fresh.stock });
            } else {
              next.push(line);
            }
            continue;
          }
          const expectedName = line.variant ? fresh.name + " (" + line.variant + ")" : fresh.name;
          if (fresh.price !== line.price || expectedName !== line.name || fresh.unit !== line.unit || fresh.imageUrl !== line.imageUrl || fresh.stock !== line.stock) {
            changed = true;
            next.push({ ...line, name: expectedName, price: fresh.price, unit: fresh.unit, imageUrl: fresh.imageUrl, stock: fresh.stock });
          } else {
            next.push(line);
          }
        }
        return changed ? next : current;
      });
    },
  }), [cart, favoriteIds]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
