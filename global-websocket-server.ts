import { Server as NetServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { PriceBroadcaster } from './price-broadcaster';
import { priceEngine } from './price-engine';
import { TradeData, AdminUpdateData } from './types';

export class GlobalWebSocketServer {
  private static instance: GlobalWebSocketServer;
  private io: SocketIOServer | null = null;
  private broadcaster: PriceBroadcaster;
  private isInitialized: boolean = false;
  private lastPriceUpdate: number = Date.now();
  private updateInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.broadcaster = new PriceBroadcaster();
  }

  static getInstance(): GlobalWebSocketServer {
    if (!GlobalWebSocketServer.instance) {
      GlobalWebSocketServer.instance = new GlobalWebSocketServer();
    }
    return GlobalWebSocketServer.instance;
  }

  initialize(httpServer: NetServer) {
    if (this.isInitialized) return;

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? process.env.NEXTAUTH_URL 
          : "http://localhost:3000",
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    this.setupSocketHandlers();
    this.startGlobalPriceUpdates();
    this.isInitialized = true;

    console.log('🎯 Global WebSocket Server Initialized - GLOBAL PRICING ACTIVE');
  }

  private setupSocketHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket: Socket) => {
      const clientId = socket.id;
      const clientLocation = socket.handshake.headers['x-forwarded-for'] || socket.conn.remoteAddress;
      
      console.log(`🔌 Client connected: ${clientId} from ${clientLocation}`);
      this.broadcaster.addClient(clientId, socket);

      // Send current global state immediately
      this.sendGlobalState(socket);

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.broadcaster.removeClient(clientId);
      });

      socket.on('place_trade', (tradeData: TradeData) => {
        this.handleTradeRequest(clientId, tradeData);
      });

      socket.on('admin_update', (updateData: AdminUpdateData) => {
        this.handleAdminUpdate(clientId, updateData);
      });

      // CLIENT CANNOT SEND PRICE UPDATES - SERVER ONLY
      socket.on('price_update', (priceData: any) => {
        console.log('🚫 REJECTED: Client attempted price update from:', clientLocation);
        socket.emit('error', {
          message: 'Price updates are server-controlled only',
          code: 'PRICE_UPDATE_REJECTED'
        });
      });

      socket.on('get_global_state', () => {
        this.sendGlobalState(socket);
      });

      socket.on('ping', () => {
        socket.emit('pong', {
          serverTime: Date.now(),
          connectedClients: this.getConnectedClients(),
          serverUptime: Date.now() - this.lastPriceUpdate
        });
      });
    });
  }

  private startGlobalPriceUpdates() {
    // Global price updates every second - same for all users worldwide
    this.updateInterval = setInterval(() => {
      this.broadcastGlobalPriceUpdate();
    }, 1000);

    console.log('🌍 Started global price updates - same for all users');
  }

  private broadcastGlobalPriceUpdate() {
    if (!this.io) return;

    const currentData = priceEngine.getCurrentData();
    this.lastPriceUpdate = Date.now();

    // Broadcast to ALL connected clients simultaneously
    this.io.emit('price_update', {
      price: currentData.price,
      change: currentData.change,
      changePercent: currentData.change,
      timestamp: this.lastPriceUpdate,
      serverId: process.env.SERVER_ID || 'global-1',
      isGlobal: true
    });

    // Broadcast candle updates when minute changes
    const currentMinute = Math.floor(Date.now() / 60000);
    const lastMinute = Math.floor((this.lastPriceUpdate - 1000) / 60000);
    
    if (currentMinute !== lastMinute) {
      this.io.emit('candle_update', {
        currentCandle: currentData.currentCandle,
        historicalCandles: currentData.historicalCandles,
        isNewCandle: true,
        timestamp: this.lastPriceUpdate
      });
    }
  }

  private sendGlobalState(socket: Socket) {
    const currentData = priceEngine.getCurrentData();
    
    socket.emit('global_state', {
      price: currentData.price,
      change: currentData.change,
      currentCandle: currentData.currentCandle,
      historicalCandles: currentData.historicalCandles,
      marketSettings: currentData.marketSettings,
      serverInfo: {
        id: process.env.SERVER_ID || 'global-1',
        startTime: this.lastPriceUpdate,
        connectedClients: this.getConnectedClients(),
        region: 'global'
      },
      timestamp: Date.now()
    });

    console.log(`📊 Sent global state to client: ${socket.id}`);
  }

  private handleTradeRequest(clientId: string, tradeData: TradeData) {
    const tradeConfirmation = {
      ...tradeData,
      id: `trade_${Date.now()}_${clientId}`,
      timestamp: Date.now(),
      status: 'executed',
      // Use current global price, not client-provided price
      executedPrice: priceEngine.getCurrentData().price,
      serverValidated: true
    };

    this.broadcaster.broadcastTradeConfirmation(tradeConfirmation);
    
    console.log(`💳 Trade executed globally: ${tradeData.type} ${tradeData.amount} at $${tradeConfirmation.executedPrice}`);
  }

  private handleAdminUpdate(clientId: string, updateData: AdminUpdateData) {
    console.log(`🛠️ Global admin update from ${clientId}:`, updateData);
    
    // Update global market settings
    priceEngine.updateMarketSettings(updateData);
    
    // Broadcast to ALL clients
    this.broadcaster.broadcastMarketSettings();
    
    // Log the global change
    this.io?.emit('admin_notification', {
      message: `Market settings updated globally by admin`,
      changes: Object.keys(updateData),
      timestamp: Date.now()
    });
  }

  getSocketServer(): SocketIOServer {
    if (!this.io) {
      throw new Error('Socket.io server not initialized');
    }
    return this.io;
  }

  getBroadcaster(): PriceBroadcaster {
    return this.broadcaster;
  }

  triggerGlobalPriceUpdate() {
    this.broadcastGlobalPriceUpdate();
  }

  broadcastMarketSettingsUpdate() {
    this.broadcaster.broadcastMarketSettings();
  }

  getConnectedClients(): number {
    return this.broadcaster.getConnectedClientsCount();
  }

  getGlobalStats() {
    return {
      connectedClients: this.getConnectedClients(),
      lastUpdate: this.lastPriceUpdate,
      serverUptime: Date.now() - this.lastPriceUpdate,
      isGlobal: true,
      regions: ['global']
    };
  }

  shutdown() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.broadcaster.stopBroadcasting();
    this.broadcaster.disconnectAll();
    
    if (this.io) {
      this.io.emit('server_shutdown', {
        message: 'Global server shutting down',
        timestamp: Date.now()
      });
      
      this.io.close();
      this.io = null;
    }
    
    this.isInitialized = false;
    console.log('🔴 Global WebSocket Server Shutdown');
  }
}

export const globalWebSocketServer = GlobalWebSocketServer.getInstance();