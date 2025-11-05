import { Socket } from 'socket.io';
import { priceEngine, PriceData } from '@/lib/price-engine';

export class PriceBroadcaster {
  private clients: Map<string, Socket> = new Map();
  private isBroadcasting: boolean = false;

  addClient(clientId: string, socket: Socket) {
    this.clients.set(clientId, socket);
    console.log(`📡 Client ${clientId} added to global broadcast`);
  }

  removeClient(clientId: string) {
    this.clients.delete(clientId);
    console.log(`📡 Client ${clientId} removed from global broadcast`);
  }

  startBroadcasting() {
    if (this.isBroadcasting) return;
    
    this.isBroadcasting = true;
    console.log('📡 Starting global price broadcasts');
  }

  stopBroadcasting() {
    this.isBroadcasting = false;
    console.log('📡 Stopped global price broadcasts');
  }

  broadcastToAll(event: string, data: any) {
    this.clients.forEach((socket, clientId) => {
      try {
        socket.emit(event, data);
      } catch (error) {
        console.error(`📡 Failed to broadcast to ${clientId}:`, error);
        this.clients.delete(clientId);
      }
    });
  }

  broadcastPriceUpdate() {
    const priceData = priceEngine.getCurrentData();
    
    this.broadcastToAll('price_update', {
      price: priceData.price,
      change: priceData.change,
      timestamp: Date.now(),
      serverId: 'global-1',
      isGlobal: true
    });
  }

  broadcastTradeConfirmation(tradeData: any) {
    this.broadcastToAll('trade_executed', {
      ...tradeData,
      broadcasted: true,
      global: true
    });
  }

  broadcastMarketSettings() {
    const priceData = priceEngine.getCurrentData();
    
    this.broadcastToAll('market_settings', {
      ...priceData.marketSettings,
      timestamp: Date.now(),
      updatedBy: 'server'
    });
  }

  handlePriceUpdateFromClient(priceData: any) {
    // Reject all client price updates - server only
    console.log('🚫 Rejected client price update attempt');
  }

  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  disconnectAll() {
    this.clients.forEach((socket) => {
      socket.disconnect(true);
    });
    this.clients.clear();
  }
}