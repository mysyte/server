import { globalWebSocketServer } from './global-websocket-server';

export function initializeServer() {
  // This function will be called from your layout.tsx
  // Note: In Next.js App Router, we can't initialize WebSocket server here
  // because layout.tsx runs on the client side in some contexts
  
  console.log('🚀 Server initialization started...');
  
  // For App Router, WebSocket initialization happens in API routes
  // This function can be used for other server-side initializations
  
  return {
    status: 'initialized',
    timestamp: Date.now()
  };
}

// Alternative: WebSocket initialization for Pages Router
export function initializeWebSocketServer(httpServer: any) {
  if (httpServer) {
    globalWebSocketServer.initialize(httpServer);
    console.log('🌍 Global WebSocket Server ACTIVE');
  }
}

// For App Router - use API route instead
export default function initServer() {
  // Client-side initialization logic if needed
  return {
    isServer: typeof window === 'undefined',
    canInitializeWebSocket: typeof window === 'undefined'
  };
}