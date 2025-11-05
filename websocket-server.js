const { Server } = require('http');
const { Server: SocketIOServer } = require('socket.io');

// True Random Market Engine (Same as your chart expects)
class TrueMarketEngine {
  constructor() {
    this.currentPrice = 1.00;
    this.currentCandle = this.createNewCandle();
    this.historicalCandles = [];
    this.generateHistoricalData();
    console.log('🎲 True Random Market Engine Started on Server');
  }

  createNewCandle() {
    const timestamp = Math.floor(Date.now() / 60000) * 60000;
    return {
      timestamp,
      open: this.currentPrice,
      high: this.currentPrice,
      low: this.currentPrice,
      close: this.currentPrice,
      volume: 0,
      isUp: true
    };
  }

  generateHistoricalData() {
    let price = 1.00;
    for (let i = 23; i >= 0; i--) {
      const timestamp = Date.now() - i * 3600000;
      
      const movement = this.calculateTrueRandomMovement(price, true);
      price = price * (1 + movement);
      
      const volatility = 0.01 + Math.random() * 0.03;
      const open = price;
      const close = price * (1 + (Math.random() - 0.5) * volatility);
      const range = Math.abs(close - open) * (1.5 + Math.random());
      
      this.historicalCandles.push({
        timestamp,
        open,
        high: Math.max(open, close) + range * 0.3,
        low: Math.min(open, close) - range * 0.3,
        close,
        volume: 800 + Math.random() * 1200,
        isUp: close > open
      });
    }
    this.currentPrice = price;
  }

  calculateTrueRandomMovement(currentPrice, isHistorical = false) {
  let movement = 0;
  const direction = Math.random();
  const strength = Math.random() * 0.0050;
  const struggle = Math.random() * 0.0020;
  const fakeout = Math.random() > 0.9 ? (Math.random() - 0.5) * 0.0100 : 0;
  const volatilityBurst = Math.random() > 0.098 ? (Math.random() - 0.5) * 0.002 : 0;
  
  if (direction > 0.55) {  // 45% UP
    movement = strength + struggle + fakeout + volatilityBurst;
  } else if (direction < 0.45) {  // 45% DOWN  
    movement = -strength - struggle + fakeout + volatilityBurst;
  } else {  // 10% SIDEWAYS
    movement = (Math.random() - 0.5) * 0.0003 + fakeout;
  }
  
  const volumeFactor = 1 + (Math.random() * 0.5);
  movement *= volumeFactor;
  
  return movement;
}

  getCurrentData() {
    const timestamp = Date.now();
    const movement = this.calculateTrueRandomMovement(this.currentPrice);
    this.currentPrice = this.currentPrice * (1 + movement);
    this.currentPrice = Math.max(0.10, this.currentPrice);
    
    this.currentCandle.high = Math.max(this.currentCandle.high, this.currentPrice);
    this.currentCandle.low = Math.min(this.currentCandle.low, this.currentPrice);
    this.currentCandle.close = this.currentPrice;
    this.currentCandle.volume += 10 + Math.random() * 40;
    this.currentCandle.isUp = this.currentPrice > this.currentCandle.open;

    const currentMinute = Math.floor(timestamp / 60000);
    if (currentMinute > Math.floor(this.currentCandle.timestamp / 60000)) {
      this.historicalCandles.push({...this.currentCandle});
      if (this.historicalCandles.length > 24) {
        this.historicalCandles.shift();
      }
      this.currentCandle = this.createNewCandle();
    }

    const change = ((this.currentPrice - 1.00) / 1.00) * 100;

    return {
      price: parseFloat(this.currentPrice.toFixed(4)),
      change: parseFloat(change.toFixed(2)),
      timestamp,
      currentCandle: this.currentCandle,
      candleData: [...this.historicalCandles]
    };
  }
}

class GlobalWebSocketServer {
  constructor() {
    this.io = null;
    this.connectedClients = new Map();
    this.marketEngine = new TrueMarketEngine();
    this.isInitialized = false;
  }

  initialize(port = 3001) {
    const httpServer = new Server();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });

    this.setupSocketHandlers();
    
    httpServer.listen(port, () => {
      console.log(`🌍 Global WebSocket Server running on port ${port}`);
      this.isInitialized = true;
      this.startPriceBroadcast();
    });
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      const clientId = socket.id;
      console.log(`🔌 Client connected: ${clientId}`);
      this.connectedClients.set(clientId, socket);

      // Send current price and candle data immediately (matches your hook format)
      const currentData = this.marketEngine.getCurrentData();
      socket.emit('price_update', {
        type: 'price_update',
        payload: currentData
      });

      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${clientId}`);
        this.connectedClients.delete(clientId);
        console.log(`📊 Active clients: ${this.connectedClients.size}`);
      });

      socket.on('place_trade', (tradeData) => {
        this.handleTrade(tradeData);
      });
    });
  }

  startPriceBroadcast() {
    // Update price every second - same for all clients
    setInterval(() => {
      this.broadcastPriceUpdate();
    }, 1000);
  }

  broadcastPriceUpdate() {
    const update = this.marketEngine.getCurrentData();
    
    // Broadcast to ALL connected clients (matches your hook format)
    if (this.io) {
      this.io.emit('price_update', {
        type: 'price_update',
        payload: update
      });
    }
  }

  handleTrade(tradeData) {
    const currentPrice = this.marketEngine.currentPrice;
    const tradeConfirmation = {
      ...tradeData,
      id: `trade_${Date.now()}`,
      executedPrice: currentPrice,
      timestamp: Date.now(),
      status: 'executed',
      isGlobal: true
    };

    // Broadcast trade to all clients
    if (this.io) {
      this.io.emit('trade_executed', tradeConfirmation);
    }

    console.log(`💳 Global trade: ${tradeData.type} ${tradeData.amount} at $${currentPrice}`);
  }

  getConnectedClients() {
    return this.connectedClients.size;
  }

  getMarketData() {
    return {
      currentPrice: this.marketEngine.currentPrice,
      connectedClients: this.connectedClients.size
    };
  }
}

// Start the server
const globalWebSocketServer = new GlobalWebSocketServer();
globalWebSocketServer.initialize(3001);

module.exports = { globalWebSocketServer };