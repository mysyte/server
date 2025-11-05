export interface TradeData {
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  userId?: string;
}

export interface AdminUpdateData {
  marketCap?: number;
  volume24h?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  trendStrength?: number;
  isLocked?: boolean;
}

export interface PriceUpdate {
  price: number;
  change: number;
  timestamp: number;
  serverId: string;
  isGlobal: boolean;
}