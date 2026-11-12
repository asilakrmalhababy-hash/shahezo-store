import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SavedAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  city: string;
  district: string;
  details: string;
  isDefault: boolean;
};

export type GuestOrderReference = {
  orderNumber: string;
  idempotencyKey: string;
  createdAt: string;
};

export type GuestCustomerData = {
  name: string;
  phone: string;
  addresses: SavedAddress[];
  orders: GuestOrderReference[];
};

const STORAGE_KEY = "shahezo-customer-browser-v1";
const PENDING_ORDER_KEY = "shahezo-pending-order-idempotency-v1";
const EMPTY_DATA: GuestCustomerData = { name: "", phone: "", addresses: [], orders: [] };
const ORDER_NUMBER_PATTERN = /^(?:SH|OR)-[A-Z0-9]+-[A-Z0-9]{5}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const memoryPendingOrderKeys = new Map<string, string>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function cleanYemeniPhone(raw: unknown): string {
  const str = typeof raw === "string" ? raw : "";
  const latin = str
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0));
  let digits = latin.replace(/\D/g, "");
  if (digits.startsWith("00967") && digits.length >= 14) digits = digits.slice(5);
  else if (digits.startsWith("967") && digits.length >= 12) digits = digits.slice(3);
  else if (digits.startsWith("07") && digits.length === 10) digits = digits.slice(1);
  return digits.slice(0, 9);
}

export function isValidYemeniPhone(raw: unknown): boolean {
  return /^(77|73|78|71|70)\d{7}$/.test(cleanYemeniPhone(raw));
}

function shortText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function createLocalId() {
  try { return window.crypto.randomUUID(); }
  catch { return `address-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
}

function createSecureUuid() {
  if (typeof window === "undefined" || !window.crypto?.getRandomValues) throw new Error("تعذر إنشاء رمز طلب آمن في هذا المتصفح.");
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function pendingScopeKey(signature: string) {
  let hash = 14695981039346656037n;
  for (const character of signature) {
    hash ^= BigInt(character.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return hash.toString(16).padStart(16, "0");
}

function readPendingOrderKeys(): Record<string, string> {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(PENDING_ORDER_KEY) ?? "null");
    if (!isRecord(saved)) return {};
    const entries = Object.entries(saved).filter((entry): entry is [string, string] =>
      /^[0-9a-f]{16}$/.test(entry[0]) && typeof entry[1] === "string" && UUID_PATTERN.test(entry[1]),
    );
    return Object.fromEntries(entries.slice(-25));
  } catch { return {}; }
}

export function getPendingOrderIdempotencyKey(signature: string) {
  const scope = pendingScopeKey(signature);
  const inMemory = memoryPendingOrderKeys.get(scope);
  if (inMemory && UUID_PATTERN.test(inMemory)) return inMemory;
  try {
    const saved = readPendingOrderKeys()[scope];
    if (saved) { memoryPendingOrderKeys.set(scope, saved); return saved; }
    const generated = createSecureUuid();
    const entries = Object.entries(readPendingOrderKeys()).filter(([, key]) => key !== generated);
    entries.push([scope, generated]);
    window.localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(Object.fromEntries(entries.slice(-25))));
    memoryPendingOrderKeys.set(scope, generated);
    return generated;
  } catch {
    const generated = createSecureUuid();
    memoryPendingOrderKeys.set(scope, generated);
    return generated;
  }
}

export function clearPendingOrderIdempotencyKey(key: string) {
  for (const [scope, value] of memoryPendingOrderKeys) if (value === key) memoryPendingOrderKeys.delete(scope);
  try {
    const remaining = Object.fromEntries(Object.entries(readPendingOrderKeys()).filter(([, value]) => value !== key));
    if (Object.keys(remaining).length) window.localStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(remaining));
    else window.localStorage.removeItem(PENDING_ORDER_KEY);
  } catch { /* Browser storage can be disabled. */ }
}

function readCustomerData(): GuestCustomerData {
  if (typeof window === "undefined") return EMPTY_DATA;
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isRecord(saved)) return EMPTY_DATA;
    const addresses = Array.isArray(saved.addresses) ? saved.addresses.flatMap((value): SavedAddress[] => {
      if (!isRecord(value)) return [];
      const id = shortText(value.id, 80);
      const recipientName = shortText(value.recipientName, 160);
      const phone = cleanYemeniPhone(value.phone) || shortText(value.phone, 32);
      const city = shortText(value.city, 100);
      const district = shortText(value.district, 120);
      if (!id || !recipientName || !phone || !city || !district) return [];
      return [{
        id,
        label: shortText(value.label, 80) || "عنوان محفوظ",
        recipientName,
        phone,
        city,
        district,
        details: shortText(value.details, 1000),
        isDefault: value.isDefault === true,
      }];
    }).slice(0, 50) : [];
    const defaultAddressId = addresses.find(address => address.isDefault)?.id ?? addresses[0]?.id;
    const normalizedAddresses = addresses.map(address => ({ ...address, isDefault: address.id === defaultAddressId }));
    const orders = Array.isArray(saved.orders) ? saved.orders.flatMap((value): GuestOrderReference[] => {
      if (!isRecord(value)) return [];
      const orderNumber = shortText(value.orderNumber, 40);
      const idempotencyKey = shortText(value.idempotencyKey, 80);
      const createdAt = shortText(value.createdAt, 40);
      if (!ORDER_NUMBER_PATTERN.test(orderNumber) || !UUID_PATTERN.test(idempotencyKey)) return [];
      return [{ orderNumber, idempotencyKey, createdAt: createdAt || new Date(0).toISOString() }];
    }).slice(0, 50) : [];
    return {
      name: shortText(saved.name, 160),
      phone: cleanYemeniPhone(saved.phone) || shortText(saved.phone, 32),
      addresses: normalizedAddresses,
      orders,
    };
  } catch {
    return EMPTY_DATA;
  }
}

type CustomerContextValue = GuestCustomerData & {
  saveProfile: (name: string, phone: string) => void;
  saveAddress: (address: Omit<SavedAddress, "id"> & { id?: string }) => string;
  removeAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
  rememberOrder: (order: GuestOrderReference) => void;
};

const CustomerContext = createContext<CustomerContextValue | null>(null);

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<GuestCustomerData>(readCustomerData);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch { /* Browser storage can be disabled or full; checkout remains available. */ }
  }, [data]);

  const saveProfile = useCallback((name: string, phone: string) => {
    setData(current => ({ ...current, name: name.trim().slice(0, 160), phone: cleanYemeniPhone(phone) }));
  }, []);

  const saveAddress = useCallback((address: Omit<SavedAddress, "id"> & { id?: string }) => {
    const id = address.id || createLocalId();
    setData(current => {
      const exists = current.addresses.some(item => item.id === id);
      const makeDefault = address.isDefault || current.addresses.length === 0;
      const nextAddress: SavedAddress = {
        ...address,
        id,
        label: address.label.trim().slice(0, 80) || "عنوان محفوظ",
        recipientName: address.recipientName.trim().slice(0, 160),
        phone: cleanYemeniPhone(address.phone),
        city: address.city.trim().slice(0, 100),
        district: address.district.trim().slice(0, 120),
        details: address.details.trim().slice(0, 1000),
        isDefault: makeDefault,
      };
      const others = current.addresses.filter(item => item.id !== id).map(item => ({ ...item, isDefault: makeDefault ? false : item.isDefault }));
      return { ...current, addresses: [nextAddress, ...others].slice(0, 50) };
    });
    return id;
  }, []);

  const removeAddress = useCallback((id: string) => {
    setData(current => {
      const remaining = current.addresses.filter(address => address.id !== id);
      if (remaining.length && !remaining.some(address => address.isDefault)) remaining[0] = { ...remaining[0], isDefault: true };
      return { ...current, addresses: remaining };
    });
  }, []);

  const setDefaultAddress = useCallback((id: string) => {
    setData(current => ({ ...current, addresses: current.addresses.map(address => ({ ...address, isDefault: address.id === id })) }));
  }, []);

  const rememberOrder = useCallback((order: GuestOrderReference) => {
    if (!ORDER_NUMBER_PATTERN.test(order.orderNumber) || !UUID_PATTERN.test(order.idempotencyKey)) return;
    setData(current => ({
      ...current,
      orders: [{ ...order }, ...current.orders.filter(item => item.orderNumber !== order.orderNumber)].slice(0, 50),
    }));
  }, []);

  const value = useMemo<CustomerContextValue>(() => ({ ...data, saveProfile, saveAddress, removeAddress, setDefaultAddress, rememberOrder }), [data, saveProfile, saveAddress, removeAddress, setDefaultAddress, rememberOrder]);
  return <CustomerContext.Provider value={value}>{children}</CustomerContext.Provider>;
}

export function useCustomer() {
  const context = useContext(CustomerContext);
  if (!context) throw new Error("useCustomer must be used inside CustomerProvider");
  return context;
}
