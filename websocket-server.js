const { Server } = require('http');
const { Server: SocketIOServer } = require('socket.io');
const fs = require('fs');

const PRICE_FILE = 'price_state.json';

// True Random Market Engine
class TrueMarketEngine {
  constructor() {
    this.currentPrice = 1.00;
    this.basePrice = 1.00;
    this.currentCandle = this.createNewCandle();
    this.historicalCandles = [];
    this.userPositions = new Map();
    
    // ✅ LOAD PERSISTED PRICE
    this.loadPriceState();
    
    this.generateHistoricalData();
    console.log('🎲 True Random Market Engine Started on Server');
  }

  // ✅ LOAD PRICE FROM FILE
  loadPriceState() {
    try {
      if (fs.existsSync(PRICE_FILE)) {
        const data = JSON.parse(fs.readFileSync(PRICE_FILE, 'utf8'));
        this.currentPrice = data.currentPrice || 1.00;
        this.basePrice = data.basePrice || 1.00;
        console.log('💰 Loaded persisted price: $' + this.currentPrice.toFixed(4));
      }
    } catch (error) {
      console.log('❌ No persisted price found, starting at $1.00');
    }
  }

  // ✅ SAVE PRICE TO FILE
  savePriceState() {
    try {
      const data = {
        currentPrice: this.currentPrice,
        basePrice: this.basePrice,
        timestamp: Date.now()
      };
      fs.writeFileSync(PRICE_FILE, JSON.stringify(data));
    } catch (error) {
      console.log('❌ Failed to save price state');
    }
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
    let price = this.currentPrice; // ✅ USE PERSISTED PRICE
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
    
    // Wealthsimple-style: Small, realistic movements
    const strength = Math.random() * 0.0015;
    const struggle = Math.random() * 0.0008;
    const fakeout = Math.random() > 0.92 ? (Math.random() - 0.5) * 0.0030 : 0;
    const volatilityBurst = Math.random() > 0.96 ? (Math.random() - 0.5) * 0.0020 : 0;
    
    if (direction > 0.52) {
      movement = strength + struggle + fakeout + volatilityBurst;
    } else if (direction < 0.48) {
      movement = -strength - struggle + fakeout + volatilityBurst;
    } else {
      movement = (Math.random() - 0.5) * 0.0003 + fakeout;
    }
    
    const volumeFactor = 1 + (Math.random() * 0.2);
    movement *= volumeFactor;
    movement = Math.max(-0.015, Math.min(0.015, movement));
    
    return movement;
  }

  // Track user positions for Wealthsimple-style profit calculation
  addUserPosition(userId, entryPrice, amount) {
    this.userPositions.set(userId, {
      entryPrice,
      amount,
      entryTime: Date.now()
    });
  }

  // Calculate actual profit/loss based on entry price
  getUserProfitLoss(userId) {
    const position = this.userPositions.get(userId);
    if (!position) return null;
    
    const currentValue = (position.amount / position.entryPrice) * this.currentPrice;
    const profitLoss = currentValue - position.amount;
    const profitLossPercent = (profitLoss / position.amount) * 100;
    
    return {
      entryPrice: position.entryPrice,
      currentPrice: this.currentPrice,
      amount: position.amount,
      currentValue,
      profitLoss,
      profitLossPercent
    };
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
      
      // ✅ SAVE PRICE EVERY NEW CANDLE (EVERY MINUTE)
      this.savePriceState();
    }

    // Calculate percentage change from base price $1.00
    const change = ((this.currentPrice - this.basePrice) / this.basePrice) * 100;

    return {
      price: parseFloat(this.currentPrice.toFixed(4)),
      change: parseFloat(change.toFixed(2)), // Percentage from $1.00
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

  initialize() {
    const port = process.env.PORT || 10000;
    const httpServer = require("http").createServer();
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
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
        this.handleTrade(clientId, tradeData);
      });

      socket.on('get_position_value', () => {
        const position = this.marketEngine.getUserProfitLoss(clientId);
        socket.emit('position_update', position);
      });
    });
  }

  startPriceBroadcast() {
    setInterval(() => {
      this.broadcastPriceUpdate();
    }, 1000);
  }

  broadcastPriceUpdate() {
    const update = this.marketEngine.getCurrentData();
    
    if (this.io) {
      this.io.emit('price_update', {
        type: 'price_update',
        payload: update
      });

      // Also broadcast position updates to all clients
      this.connectedClients.forEach((socket, clientId) => {
        const position = this.marketEngine.getUserProfitLoss(clientId);
        if (position) {
          socket.emit('position_update', position);
        }
      });
    }
  }

  handleTrade(clientId, tradeData) {
    const currentPrice = this.marketEngine.currentPrice;
    
    // Record user position for Wealthsimple-style tracking
    this.marketEngine.addUserPosition(clientId, currentPrice, tradeData.amount);
    
    const tradeConfirmation = {
      ...tradeData,
      id: `trade_${Date.now()}`,
      executedPrice: currentPrice,
      timestamp: Date.now(),
      status: 'executed',
      isGlobal: true
    };

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
globalWebSocketServer.initialize();

module.exports = { globalWebSocketServer };