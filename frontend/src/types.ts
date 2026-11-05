// The shapes of the API's JSON. Each one mirrors a Pydantic schema in app/schemas.py.
import type { Role } from './user';

/** UserOut */
export type User = {
  id: number;
  full_name: string;
  username: string;
  role: Role;
  is_locked: boolean;
  is_active: boolean;
};

/** LoginResponse */
export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

/** SummaryOut / SummaryOwnerOut: GET /summary/today. sales_total only exists for the owner. */
export type Summary = {
  date: string; // "2026-11-05", depot time
  items_sold: number;
  low_stock_count: number;
  last_restock: string | null; // "2026-11-01", or null if no deliveries yet
  sales_total?: number; // whole TSh, owner only (the key is missing for shopkeepers)
};

export type StockStatus = 'OK' | 'LOW' | 'OUT';

/** StockLineOut: GET /stock, GET /stock/low */
export type StockLine = {
  product_id: number;
  product: string;
  group_id: number;
  group: string;
  quantity_in_store: number;
  min_level: number;
  stock_status: StockStatus;
  is_active: boolean;
};

/** ReceiptLine */
export type ReceiptLine = {
  product_id: number;
  product: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

/** Receipt: GET /sales, GET /sales/{id}, POST /sales */
export type Receipt = {
  id: number;
  sold_at: string; // "2026-11-05T14:32:00", already depot time
  sold_by: string;
  payment_method: 'cash' | 'mobile_money';
  items: ReceiptLine[];
  total: number;
};

/** GroupOut: an item (product group), e.g. Soda. */
export type Group = {
  id: number;
  name: string;
  current_price: number; // the item price, whole TSh
  is_active: boolean;
};

/** ProductOut: a sub-item, e.g. Fanta. */
export type Product = {
  id: number;
  name: string;
  group_id: number;
  group: string;
  own_price: number | null; // null = uses the item price
  effective_price: number; // the price a sale charges
  quantity_in_store: number;
  min_level: number;
  stock_status: StockStatus;
  is_active: boolean;
};

/** PriceChangeOut */
export type PriceChange = {
  old_price: number | null;
  new_price: number | null;
  changed: boolean; // false when the new price was the same as the old one
};

/** PriceHistoryOut */
export type PriceHistoryEntry = {
  target: 'item' | 'sub-item';
  name: string;
  price: number | null; // null = a sub-item's own price was removed
  changed_at: string;
  changed_by: string;
};

/** DeliveryLineOut / DeliveryLineOwnerOut. buying_price exists only in the owner's answer. */
export type DeliveryLine = {
  product_id: number;
  product: string;
  quantity: number;
  buying_price?: number | null;
};

/** DeliveryOut / DeliveryOwnerOut: GET /deliveries, POST /deliveries */
export type Delivery = {
  id: number;
  delivered_at: string; // "2026-11-05", the date on the paperwork
  received_by: string;
  note: string | null;
  items: DeliveryLine[];
  corrections: unknown[]; // shown in Restock history (F9)
};
