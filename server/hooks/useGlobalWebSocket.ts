import { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';

interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isUp: boolean;
}

interface PriceUpdate {
  price: number;
  change: number;
  timestamp: number;
  currentCandle: Candle;
  candleData: Candle[];
}

// Global price service that connects to Socket.IO server
class GlobalPriceService {
  private static instance: GlobalPriceService;
  private callbacks: ((data: PriceUpdate) => void)[] = [];
  private connected = false;
  private socket: any = null; // Use any to avoid Socket type issues
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  static getInstance(): GlobalPriceService {
    if (!GlobalPriceService.instance) {
      GlobalPriceService.instance = new GlobalPriceService();
    }
    return GlobalPriceService.instance;
  }

  connect() {
    if (this.connected) return;
    
    try {
      // Connect to the Socket.IO server running on port 3001
      this.socket = io('http://localhost:3001');
      
      this.socket.on('connect', () => {
        this.connected = true;
        this.reconnectAttempts = 0;
        console.log('🌍 Connected to Global WebSocket Server');
      });

      this.socket.on('price_update', (data: any) => {
        try {
          // Socket.IO sends the data directly, no need to parse
          if (data.type === 'price_update') {
            // Broadcast to all callbacks
            this.callbacks.forEach(callback => callback(data.payload));
          }
        } catch (error) {
          console.error('Failed to process price update:', error);
        }
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        console.log('🔌 Disconnected from Global WebSocket Server');
        
        // Try to reconnect with exponential backoff
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
          this.reconnectAttempts++;
          console.log(`Reconnecting in ${delay}ms... (attempt ${this.reconnectAttempts})`);
          
          setTimeout(() => {
            this.connect();
          }, delay);
        }
      });

      this.socket.on('connect_error', (error: any) => { // Fixed: added type annotation
        console.error('🌍 Socket.IO connection error:', error);
      });

    } catch (error) {
      console.error('🌍 Failed to connect to Socket.IO:', error);
    }
  }

  onPriceUpdate(callback: (data: PriceUpdate) => void) {
    this.callbacks.push(callback);
  }

  removeCallback(callback: (data: PriceUpdate) => void) {
    this.callbacks = this.callbacks.filter(cb => cb !== callback);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
    this.connected = false;
    this.callbacks = [];
  }

  // Method to place trades
  placeTrade(tradeData: any) {
    if (this.socket && this.connected) {
      this.socket.emit('place_trade', tradeData);
    }
  }
}

export const useGlobalWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [priceUpdate, setPriceUpdate] = useState<PriceUpdate | null>(null);
  const serviceRef = useRef<GlobalPriceService>(GlobalPriceService.getInstance());

  useEffect(() => {
    const service = serviceRef.current;
    
    const handlePriceUpdate = (data: PriceUpdate) => {
      setPriceUpdate(data);
      setIsConnected(true);
    };
    
    service.connect();
    service.onPriceUpdate(handlePriceUpdate);

    return () => {
      service.removeCallback(handlePriceUpdate);
      service.disconnect();
    };
  }, []);

  return {
    isConnected,
    priceUpdate,
    price: priceUpdate?.price ?? 1.00,
    change: priceUpdate?.change ?? 0.00,
    currentCandle: priceUpdate?.currentCandle ?? null,
    candleData: priceUpdate?.candleData ?? [],
    placeTrade: serviceRef.current.placeTrade.bind(serviceRef.current)
  };
};

// Export so other components can use the global prices
export const globalPriceService = GlobalPriceService.getInstance();