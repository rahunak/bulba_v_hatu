import { Context as TelegrafContext } from 'telegraf';

export interface SessionData {
  cart?: Array<{ productId: string; quantity: number }>;
  orderStep?: string;
  phone?: string;
  address?: string;
  editingProduct?: string;
  editingField?: 'price' | 'stock';
  addingProduct?: {
    step: 'name' | 'price' | 'stock';
    name?: string;
    price?: number;
    stock?: number;
  };
  addingAdmin?: boolean;
  [key: string]: unknown;
}

export interface BotContext extends TelegrafContext {
  session: SessionData;
}
