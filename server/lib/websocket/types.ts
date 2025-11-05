import { Server as SocketIOServer, Socket } from 'socket.io';

export interface WebSocketMessage {
  type: 'price_update' | 'candle_update' | 'market_settings' | 'trade_confirmation';
  data: any;
  timestamp: number;
}

export interface PriceUpdateMessage {
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

export interface CandleUpdateMessage {
  currentCandle: any;
  historicalCandles: any[];
  isNewCandle?: boolean;
}

export interface TradeData {
  type: 'buy' | 'sell';
  amount: number;
  price: number;
  symbol: string;
}

export interface AdminUpdateData {
  marketCap?: number;
  volume24h?: number;
  trendDirection?: 'up' | 'down' | 'stable';
  trendStrength?: number;
  isLocked?: boolean;
}

export interface ClientConnection {
  id: string;
  socket: Socket;
  connectedAt: number;
}