#!/usr/bin/env node

/**
 * 🎯 COMPREHENSIVE MONITORING SYSTEM
 * Real-time health status + orderbook monitoring organized by node
 */

const redis = require('redis');

class ComprehensiveMonitor {
    constructor() {
        this.client = null;
        this.subscriber = null;
        
        // Data storage
        this.healthData = new Map();        // nodeId -> health metrics
        this.orderbooksByNode = new Map();  // nodeId -> Map(eventId -> orderbook data)
        this.marketStatus = new Map();      // eventId -> status info
        
        // Display settings
        this.displayInterval = 3000;       // Update display every 3 seconds
        this.lastUpdateTime = new Date();
    }
    
    async start() {
        console.log('\n🎯 COMPREHENSIVE MONITORING SYSTEM');
        console.log('===================================');
        console.log('📡 Connecting to Master Redis: 100.70.127.124:6380\n');
        
        // Create Redis connections (v5+ syntax)
        this.client = redis.createClient({
            url: 'redis://100.70.127.124:6380'
        });
        
        this.client.on('error', (err) => {
            console.error('❌ Redis Error:', err.message);
        });
        
        await this.client.connect();
        console.log('✅ Connected to Redis');
        
        // Create subscriber
        this.subscriber = this.client.duplicate();
        await this.subscriber.connect();
        console.log('✅ Subscriber ready');
        
        // Set up all subscriptions
        await this.setupSubscriptions();
        
        // Start real-time display
        this.startDisplay();
        
        console.log('🎉 Comprehensive monitoring started!\n');
        console.log('📊 Monitoring:');
        console.log('   💓 Health metrics from all nodes');
        console.log('   📊 Orderbook updates from all nodes'); 
        console.log('   🔄 Market status changes');
        console.log('   🗑️  Market closures and removals\n');
        
        // Handle graceful shutdown
        process.on('SIGINT', () => this.stop());
    }
    
    async setupSubscriptions() {
        console.log('📡 Setting up subscriptions...');
        
        // 1. Subscribe to health metrics from all nodes
        await this.subscriber.pSubscribe('metrics:*', (message, channel) => {
            const nodeId = channel.split(':')[1];
            this.handleHealthUpdate(nodeId, message);
        });
        console.log('💓 ✅ Subscribed to health metrics: metrics:*');
        
        // 2. Subscribe to consolidated orderbook updates
        await this.subscriber.subscribe('orderbooks', (message) => {
            this.handleOrderbookUpdate(message);
        });
        console.log('📊 ✅ Subscribed to orderbook updates: orderbooks');
        
        // 3. Subscribe to market status updates (for closures)
        await this.subscriber.pSubscribe('market_status:*', (message, channel) => {
            const eventId = channel.split(':')[1];
            this.handleMarketStatusUpdate(eventId, message);
        });
        console.log('🔄 ✅ Subscribed to market status: market_status:*');
        
        // 4. Subscribe to market discovery (for total counts)
        await this.subscriber.subscribe('market_discovery', (message) => {
            this.handleMarketDiscovery(message);
        });
        console.log('🔍 ✅ Subscribed to market discovery');
        
        console.log('✅ All subscriptions active\n');
    }
    
    handleHealthUpdate(nodeId, message) {
        try {
            const healthData = JSON.parse(message);
            
            this.healthData.set(nodeId, {
                ...healthData,
                lastUpdate: new Date()
            });
            
            this.lastUpdateTime = new Date();
            
        } catch (error) {
            console.error(`❌ Error processing health update from ${nodeId}:`, error.message);
        }
    }
    
    handleOrderbookUpdate(message) {
        try {
            const data = JSON.parse(message);
            
            if (data.type !== 'orderbook_update') return;
            
            const { eventId, nodeId } = data;
            
            // Initialize node's orderbook map if needed
            if (!this.orderbooksByNode.has(nodeId)) {
                this.orderbooksByNode.set(nodeId, new Map());
            }
            
            // Store orderbook data for this node
            this.orderbooksByNode.get(nodeId).set(eventId, {
                ...data,
                lastUpdate: new Date()
            });
            
            this.lastUpdateTime = new Date();
            
        } catch (error) {
            console.error('❌ Error processing orderbook update:', error.message);
        }
    }
    
    handleMarketStatusUpdate(eventId, message) {
        try {
            const statusData = JSON.parse(message);
            
            this.marketStatus.set(eventId, {
                ...statusData,
                lastUpdate: new Date()
            });
            
            // If market is closed/cleared, remove from all nodes
            if (statusData.status === 'CLOSED' || statusData.status === 'CLEARED') {
                console.log(`🗑️  Removing market ${eventId} (status: ${statusData.status})`);
                
                // Remove from all nodes' orderbook maps
                for (const [nodeId, nodeOrderbooks] of this.orderbooksByNode) {
                    if (nodeOrderbooks.has(eventId)) {
                        nodeOrderbooks.delete(eventId);
                        console.log(`   📊 Removed ${eventId} from node ${nodeId}`);
                    }
                }
            }
            
            this.lastUpdateTime = new Date();
            
        } catch (error) {
            console.error(`❌ Error processing market status for ${eventId}:`, error.message);
        }
    }
    
    handleMarketDiscovery(message) {
        try {
            const discoveryData = JSON.parse(message);
            // Store for display in summary
            this.totalMarkets = discoveryData.totalMarkets;
            this.lastUpdateTime = new Date();
        } catch (error) {
            console.error('❌ Error processing market discovery:', error.message);
        }
    }
    
    startDisplay() {
        // Clear and display immediately
        this.displayStatus();
        
        // Then update every few seconds
        setInterval(() => {
            this.displayStatus();
        }, this.displayInterval);
    }
    
    displayStatus() {
        // Clear screen
        console.clear();
        
        const now = new Date();
        
        console.log('🎯 COMPREHENSIVE MONITORING SYSTEM');
        console.log('===================================');
        console.log(`⏰ ${now.toLocaleTimeString()} | Last Update: ${this.lastUpdateTime.toLocaleTimeString()}\n`);
        
        // Health Status Section
        this.displayHealthStatus(now);
        
        // Orderbook Status Section  
        this.displayOrderbookStatus(now);
        
        // System Summary
        this.displaySystemSummary();
    }
    
    displayHealthStatus(now) {
        console.log('💓 NODE HEALTH STATUS');
        console.log('=====================');
        
        if (this.healthData.size === 0) {
            console.log('   ⚠️  No health data received yet...\n');
            return;
        }
        
        // Sort by node type (master first, then workers)
        const sortedNodes = Array.from(this.healthData.entries()).sort(([nodeIdA], [nodeIdB]) => {
            // Put master nodes first
            if (nodeIdA.includes('127.124')) return -1;
            if (nodeIdB.includes('127.124')) return 1;
            return nodeIdA.localeCompare(nodeIdB);
        });
        
        for (const [nodeId, health] of sortedNodes) {
            const age = Math.round((now - health.lastUpdate) / 1000);
            const isHealthy = age < 60 && health.isHealthy;
            const status = isHealthy ? '🟢 HEALTHY' : '🔴 UNHEALTHY';
            const nodeType = nodeId.includes('127.124') ? '(MASTER)' : '(WORKER)';
            
            console.log(`   🖥️  ${nodeId} ${nodeType}: ${status} (${age}s ago)`);
            console.log(`       CPU: ${health.cpuUsage?.toFixed(1)}% | Memory: ${health.memoryUsage?.toFixed(1)}%`);
            console.log(`       Active Markets: ${health.activeMarkets || 0} | Cores: ${health.cpuCores || 'N/A'}`);
            console.log(`       Load Avg: ${health.loadAverage?.toFixed(2) || 'N/A'} | Free Disk: ${health.freeDiskSpaceMB || 'N/A'}MB`);
            console.log('');
        }
    }
    
    displayOrderbookStatus(now) {
        console.log('📊 ORDERBOOK STATUS BY NODE');
        console.log('============================');
        
        if (this.orderbooksByNode.size === 0) {
            console.log('   ⚠️  No orderbook data received yet...\n');
            return;
        }
        
        // Display orderbooks organized by node
        for (const [nodeId, nodeOrderbooks] of this.orderbooksByNode) {
            const nodeType = nodeId.includes('127.124') ? 'MASTER' : 'WORKER';
            const marketCount = nodeOrderbooks.size;
            
            console.log(`🖥️  NODE ${nodeId} (${nodeType}) - ${marketCount} markets`);
            console.log('─'.repeat(50));
            
            if (marketCount === 0) {
                console.log('   📭 No active markets on this node\n');
                continue;
            }
            
            // Display each market on this node
            for (const [eventId, orderbook] of nodeOrderbooks) {
                const age = Math.round((now - orderbook.lastUpdate) / 1000);
                
                console.log(`   📈 ${eventId} (${age}s ago)`);
                console.log('   ─'.repeat(40));
                
                // Display Market A complete orderbook
                this.displayCompleteMarketOrderbook(orderbook.marketA, '      ');
                
                console.log('');
                
                // Display Market B complete orderbook
                this.displayCompleteMarketOrderbook(orderbook.marketB, '      ');
                
                console.log('');
            }
        }
    }
    
    displayCompleteMarketOrderbook(market, indent = '') {
        const { marketId, bids = [], asks = [], bestBid, bestAsk, totalOrders } = market;
        
        console.log(`${indent}📊 ${marketId.toUpperCase()} (${totalOrders} orders)`);
        console.log(`${indent}   Best: ${bestBid}¢ bid / ${bestAsk}¢ ask`);
        
        // Display ASK levels (sorted high to low for traditional orderbook view)
        if (asks.length > 0) {
            console.log(`${indent}   🔴 ASKS (${asks.length} levels):`);
            const sortedAsks = [...asks].sort((a, b) => b.price - a.price);
            for (const ask of sortedAsks) {
                console.log(`${indent}      ${ask.price}¢ │ ${ask.quantity.toLocaleString()} shares │ ${ask.count} orders`);
            }
        } else {
            console.log(`${indent}   🔴 ASKS: No ask orders`);
        }
        
        // Spread indicator
        if (bestBid > 0 && bestAsk > 0) {
            const spread = bestAsk - bestBid;
            const spreadPercent = ((spread / bestBid) * 100).toFixed(1);
            console.log(`${indent}   ⚡ SPREAD: ${spread}¢ (${spreadPercent}%)`);
        } else {
            console.log(`${indent}   ⚡ SPREAD: Market gap`);
        }
        
        // Display BID levels (sorted high to low)
        if (bids.length > 0) {
            console.log(`${indent}   🟢 BIDS (${bids.length} levels):`);
            const sortedBids = [...bids].sort((a, b) => b.price - a.price);
            for (const bid of sortedBids) {
                console.log(`${indent}      ${bid.price}¢ │ ${bid.quantity.toLocaleString()} shares │ ${bid.count} orders`);
            }
        } else {
            console.log(`${indent}   🟢 BIDS: No bid orders`);
        }
    }
    
    displaySystemSummary() {
        console.log('📊 SYSTEM SUMMARY');
        console.log('=================');
        
        const totalNodes = this.healthData.size;
        const healthyNodes = Array.from(this.healthData.values()).filter(h => {
            const age = (new Date() - h.lastUpdate) / 1000;
            return age < 60 && h.isHealthy;
        }).length;
        
        let totalActiveMarkets = 0;
        for (const nodeOrderbooks of this.orderbooksByNode.values()) {
            totalActiveMarkets += nodeOrderbooks.size;
        }
        
        console.log(`   🖥️  Total Nodes: ${totalNodes} (${healthyNodes} healthy)`);
        console.log(`   📊 Active Markets: ${totalActiveMarkets}`);
        console.log(`   🔄 Total Markets in System: ${this.totalMarkets || 'N/A'}`);
        console.log(`   📡 Data Source: Master Redis (100.70.127.124:6380)`);
        console.log(`   ⚡ Update Frequency: ${this.displayInterval/1000}s`);
        
        console.log('\n💡 Commands: Ctrl+C to stop monitoring');
    }
    
    async stop() {
        console.log('\n🛑 Shutting down comprehensive monitor...');
        
        if (this.subscriber) {
            await this.subscriber.quit();
        }
        if (this.client) {
            await this.client.quit();
        }
        
        console.log('✅ Monitor stopped');
        console.log('🎉 Comprehensive monitoring session complete!');
        process.exit(0);
    }
}

// Start the comprehensive monitor
const monitor = new ComprehensiveMonitor();
monitor.start().catch(console.error);