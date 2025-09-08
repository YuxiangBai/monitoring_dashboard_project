#!/usr/bin/env node

/**
 * 🌐 DASHBOARD WEBSOCKET SERVER
 * Bridges Redis monitoring data to web dashboard via WebSocket
 */

const redis = require('redis');
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

class DashboardServer {
    constructor() {
        this.redisClient = null;
        this.redisSubscriber = null;
        this.wss = null;
        this.server = null;
        this.clients = new Set();
        
        // Data cache for new connections
        this.healthData = new Map();
        this.orderbooksByNode = new Map();
        this.totalMarkets = 0;
    }
    
    async start() {
        console.log('\n🌐 DASHBOARD WEBSOCKET SERVER');
        console.log('==============================');
        console.log('📡 Connecting to Master Redis: 100.70.127.124:6380');
        console.log('🌐 Starting WebSocket server on port 8080\n');
        
        // Create Redis connections with timeout
        this.redisClient = redis.createClient({
            url: 'redis://100.70.127.124:6380',
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: false
            }
        });
        
        this.redisClient.on('error', (err) => {
            console.error('❌ Redis Error:', err.message);
        });
        
        try {
            console.log('⏳ Attempting to connect to Redis...');
            await this.redisClient.connect();
            console.log('✅ Connected to Redis');
            
            // Create subscriber
            this.redisSubscriber = this.redisClient.duplicate();
            await this.redisSubscriber.connect();
            console.log('✅ Redis subscriber ready');
            
            // Set up Redis subscriptions
            await this.setupRedisSubscriptions();
            
        } catch (error) {
            console.log('⚠️  Failed to connect to Redis, starting in demo mode...');
            console.log(`   Error: ${error.message}`);
            this.startDemoMode();
        }
        
        // Create HTTP server for serving dashboard
        this.server = http.createServer((req, res) => {
            this.handleHttpRequest(req, res);
        });
        
        // Create WebSocket server
        this.wss = new WebSocket.Server({ 
            server: this.server,
            path: '/'
        });
        
        this.wss.on('connection', (ws, req) => {
            console.log(`🔌 New client connected from ${req.socket.remoteAddress}`);
            this.clients.add(ws);
            
            // Send cached data to new client
            this.sendCachedDataToClient(ws);
            
            ws.on('close', () => {
                console.log('🔌 Client disconnected');
                this.clients.delete(ws);
            });
            
            ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
        
        // Start HTTP server
        this.server.listen(8080, () => {
            console.log('✅ HTTP/WebSocket server started on http://localhost:8080');
            console.log('🎉 Dashboard server ready!\n');
            console.log('📊 Open http://localhost:8080 in your browser to view dashboard');
            console.log('🔄 Broadcasting real-time data from Redis to connected clients\n');
        });
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
    }
    
    handleHttpRequest(req, res) {
        const url = req.url === '/' ? '/dashboard.html' : req.url;
        
        // Serve dashboard.html from public directory
        if (url === '/dashboard.html') {
            const filePath = path.join(__dirname, '../public/dashboard.html');
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(content);
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Dashboard file not found. Please ensure dashboard.html is in the public directory.');
            }
            return;
        }
        
        // For all other requests, return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
    
    async setupRedisSubscriptions() {
        console.log('📡 Setting up Redis subscriptions...');
        
        // 1. Subscribe to health metrics from all nodes
        await this.redisSubscriber.pSubscribe('metrics:*', (message, channel) => {
            const nodeId = channel.split(':')[1];
            this.handleHealthUpdate(nodeId, message);
        });
        console.log('💓 ✅ Subscribed to health metrics: metrics:*');
        
        // 2. Subscribe to consolidated orderbook updates
        await this.redisSubscriber.subscribe('orderbooks', (message) => {
            this.handleOrderbookUpdate(message);
        });
        console.log('📊 ✅ Subscribed to orderbook updates: orderbooks');
        
        // 3. Subscribe to market status updates
        await this.redisSubscriber.pSubscribe('market_status:*', (message, channel) => {
            const eventId = channel.split(':')[1];
            this.handleMarketStatusUpdate(eventId, message);
        });
        console.log('🔄 ✅ Subscribed to market status: market_status:*');
        
        // 4. Subscribe to market discovery
        await this.redisSubscriber.subscribe('market_discovery', (message) => {
            this.handleMarketDiscovery(message);
        });
        console.log('🔍 ✅ Subscribed to market discovery');
        
        console.log('✅ All Redis subscriptions active\n');
    }
    
    handleHealthUpdate(nodeId, message) {
        try {
            const healthData = JSON.parse(message);
            
            // Cache the data
            this.healthData.set(nodeId, {
                ...healthData,
                lastUpdate: new Date()
            });
            
            // Broadcast to all connected clients
            this.broadcast({
                type: 'health_update',
                nodeId: nodeId,
                health: healthData,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`❌ Error processing health update from ${nodeId}:`, error.message);
        }
    }
    
    handleOrderbookUpdate(message) {
        try {
            const data = JSON.parse(message);
            
            if (data.type !== 'orderbook_update') return;
            
            const { eventId, nodeId } = data;
            
            // Cache the data
            if (!this.orderbooksByNode.has(nodeId)) {
                this.orderbooksByNode.set(nodeId, new Map());
            }
            
            this.orderbooksByNode.get(nodeId).set(eventId, {
                ...data,
                lastUpdate: new Date()
            });
            
            // Broadcast to all connected clients
            this.broadcast({
                type: 'orderbook_update',
                eventId: eventId,
                nodeId: nodeId,
                marketA: data.marketA,
                marketB: data.marketB,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error processing orderbook update:', error.message);
        }
    }
    
    handleMarketStatusUpdate(eventId, message) {
        try {
            const statusData = JSON.parse(message);
            
            // If market is closed/cleared, remove from cache
            if (statusData.status === 'CLOSED' || statusData.status === 'CLEARED') {
                console.log(`🗑️  Removing market ${eventId} (status: ${statusData.status})`);
                
                // Remove from all nodes' orderbook maps
                for (const [nodeId, nodeOrderbooks] of this.orderbooksByNode) {
                    if (nodeOrderbooks.has(eventId)) {
                        nodeOrderbooks.delete(eventId);
                        console.log(`   📊 Removed ${eventId} from node ${nodeId}`);
                    }
                }
                
                // Broadcast market removal
                this.broadcast({
                    type: 'market_removed',
                    eventId: eventId,
                    status: statusData.status,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error(`❌ Error processing market status for ${eventId}:`, error.message);
        }
    }
    
    handleMarketDiscovery(message) {
        try {
            const discoveryData = JSON.parse(message);
            this.totalMarkets = discoveryData.totalMarkets;
            
            // Broadcast market discovery update
            this.broadcast({
                type: 'market_discovery',
                totalMarkets: this.totalMarkets,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('❌ Error processing market discovery:', error.message);
        }
    }
    
    broadcast(data) {
        const message = JSON.stringify(data);
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    console.error('❌ Error sending message to client:', error.message);
                    this.clients.delete(client);
                }
            }
        });
    }
    
    sendCachedDataToClient(client) {
        try {
            // Send cached health data
            for (const [nodeId, healthData] of this.healthData) {
                client.send(JSON.stringify({
                    type: 'health_update',
                    nodeId: nodeId,
                    health: healthData,
                    timestamp: new Date().toISOString()
                }));
            }
            
            // Send cached orderbook data
            for (const [nodeId, nodeOrderbooks] of this.orderbooksByNode) {
                for (const [eventId, orderbookData] of nodeOrderbooks) {
                    client.send(JSON.stringify({
                        type: 'orderbook_update',
                        eventId: eventId,
                        nodeId: nodeId,
                        marketA: orderbookData.marketA,
                        marketB: orderbookData.marketB,
                        timestamp: new Date().toISOString()
                    }));
                }
            }
            
            // Send market discovery data
            if (this.totalMarkets > 0) {
                client.send(JSON.stringify({
                    type: 'market_discovery',
                    totalMarkets: this.totalMarkets,
                    timestamp: new Date().toISOString()
                }));
            }
            
            console.log('📤 Sent cached data to new client');
            
        } catch (error) {
            console.error('❌ Error sending cached data to client:', error.message);
        }
    }
    
    startDemoMode() {
        console.log('🎭 Starting demo mode with simulated data...');
        
        // Generate demo health data
        this.healthData.set('100.70.127.124', {
            cpuUsage: 45.2,
            memoryUsage: 67.8,
            activeMarkets: 12,
            cpuCores: 8,
            loadAverage: 2.34,
            freeDiskSpaceMB: 45000,
            isHealthy: true,
            lastUpdate: new Date()
        });

        this.healthData.set('100.70.127.125', {
            cpuUsage: 32.1,
            memoryUsage: 54.3,
            activeMarkets: 8,
            cpuCores: 4,
            loadAverage: 1.87,
            freeDiskSpaceMB: 32000,
            isHealthy: true,
            lastUpdate: new Date()
        });

        this.healthData.set('192.168.1.100', {
            cpuUsage: 28.5,
            memoryUsage: 42.1,
            activeMarkets: 6,
            cpuCores: 4,
            loadAverage: 1.22,
            freeDiskSpaceMB: 28000,
            isHealthy: true,
            lastUpdate: new Date()
        });

        // Generate demo orderbook data
        const sampleOrderbook = {
            eventId: 'DEMO_EVENT_001',
            nodeId: '100.70.127.124',
            marketA: {
                marketId: 'YES',
                bids: [
                    { price: 45, quantity: 1000, count: 3 },
                    { price: 44, quantity: 1500, count: 5 },
                    { price: 43, quantity: 800, count: 2 }
                ],
                asks: [
                    { price: 47, quantity: 800, count: 2 },
                    { price: 48, quantity: 1200, count: 4 },
                    { price: 49, quantity: 600, count: 1 }
                ],
                bestBid: 45,
                bestAsk: 47,
                totalOrders: 14
            },
            marketB: {
                marketId: 'NO',
                bids: [
                    { price: 52, quantity: 900, count: 2 },
                    { price: 51, quantity: 1100, count: 3 },
                    { price: 50, quantity: 700, count: 2 }
                ],
                asks: [
                    { price: 54, quantity: 700, count: 2 },
                    { price: 55, quantity: 1000, count: 3 },
                    { price: 56, quantity: 500, count: 1 }
                ],
                bestBid: 52,
                bestAsk: 54,
                totalOrders: 10
            },
            lastUpdate: new Date()
        };

        const sampleOrderbook2 = {
            eventId: 'DEMO_EVENT_002',
            nodeId: '100.70.127.125',
            marketA: {
                marketId: 'YES',
                bids: [
                    { price: 62, quantity: 750, count: 2 },
                    { price: 61, quantity: 900, count: 4 }
                ],
                asks: [
                    { price: 64, quantity: 650, count: 3 },
                    { price: 65, quantity: 800, count: 2 }
                ],
                bestBid: 62,
                bestAsk: 64,
                totalOrders: 11
            },
            marketB: {
                marketId: 'NO',
                bids: [
                    { price: 35, quantity: 1200, count: 3 },
                    { price: 34, quantity: 800, count: 2 }
                ],
                asks: [
                    { price: 37, quantity: 900, count: 2 },
                    { price: 38, quantity: 1100, count: 4 }
                ],
                bestBid: 35,
                bestAsk: 37,
                totalOrders: 11
            },
            lastUpdate: new Date()
        };

        // Set up demo orderbooks
        this.orderbooksByNode.set('100.70.127.124', new Map([
            ['DEMO_EVENT_001', sampleOrderbook]
        ]));
        
        this.orderbooksByNode.set('100.70.127.125', new Map([
            ['DEMO_EVENT_002', sampleOrderbook2]
        ]));

        this.totalMarkets = 25;

        // Update demo data periodically
        setInterval(() => {
            this.updateDemoData();
        }, 5000);
        
        console.log('✅ Demo mode ready with sample data');
    }
    
    updateDemoData() {
        // Update health metrics with random variations
        for (const [nodeId, health] of this.healthData) {
            health.cpuUsage += (Math.random() - 0.5) * 10;
            health.cpuUsage = Math.max(0, Math.min(100, health.cpuUsage));
            health.memoryUsage += (Math.random() - 0.5) * 5;
            health.memoryUsage = Math.max(0, Math.min(100, health.memoryUsage));
            health.lastUpdate = new Date();
            
            // Broadcast updated health data
            this.broadcast({
                type: 'health_update',
                nodeId: nodeId,
                health: health,
                timestamp: new Date().toISOString()
            });
        }

        // Occasionally update orderbook prices
        if (Math.random() < 0.3) {
            for (const [nodeId, nodeOrderbooks] of this.orderbooksByNode) {
                for (const [eventId, orderbook] of nodeOrderbooks) {
                    // Update some bid/ask prices
                    if (orderbook.marketA.bids.length > 0) {
                        orderbook.marketA.bids[0].price += Math.random() > 0.5 ? 1 : -1;
                        orderbook.marketA.bestBid = orderbook.marketA.bids[0].price;
                    }
                    if (orderbook.marketA.asks.length > 0) {
                        orderbook.marketA.asks[0].price += Math.random() > 0.5 ? 1 : -1;
                        orderbook.marketA.bestAsk = orderbook.marketA.asks[0].price;
                    }
                    
                    orderbook.lastUpdate = new Date();
                    
                    // Broadcast updated orderbook
                    this.broadcast({
                        type: 'orderbook_update',
                        eventId: eventId,
                        nodeId: nodeId,
                        marketA: orderbook.marketA,
                        marketB: orderbook.marketB,
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
    }
    
    async stop() {
        console.log('\n🛑 Shutting down dashboard server...');
        
        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }
        
        // Close HTTP server
        if (this.server) {
            this.server.close();
        }
        
        // Close Redis connections
        try {
            if (this.redisSubscriber && this.redisSubscriber.isOpen) {
                await this.redisSubscriber.quit();
            }
            if (this.redisClient && this.redisClient.isOpen) {
                await this.redisClient.quit();
            }
        } catch (error) {
            console.log('⚠️  Redis connections already closed');
        }
        
        console.log('✅ Dashboard server stopped');
        console.log('🎉 Server shutdown complete!');
        process.exit(0);
    }
}

// Start the dashboard server
const server = new DashboardServer();
server.start().catch(console.error); 