# 🎯 Comprehensive Monitoring Dashboard

A real-time web dashboard for monitoring master and worker node health metrics, orderbook data, and system status. This system bridges Redis pub/sub data to a beautiful web interface using WebSocket connections.

## 🚀 Features

- **Real-time Health Monitoring**: Live CPU, memory, disk usage, and load averages for all nodes
- **Node Classification**: Automatic detection and display of master vs worker nodes
- **Orderbook Visualization**: Complete orderbook data with bids, asks, spreads, and market depth
- **System Summary**: Total nodes, healthy nodes, active markets, and system metrics
- **Responsive Design**: Modern, mobile-friendly interface with live updates
- **Automatic Reconnection**: Robust WebSocket connection with fallback to demo mode

## 📋 Prerequisites

- Node.js 16.0.0 or higher
- Redis server running on `100.70.127.124:6380`
- Access to the comprehensive monitoring data stream

## 🛠️ Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Ensure all files are in the same directory**:
   - `dashboard.html` - Web interface
   - `dashboard-server.js` - WebSocket server
   - `comprehensive-monitor.js` - Original monitoring script
   - `package.json` - Dependencies
   - `README.md` - This file

## 🎮 Usage

### Option 1: Web Dashboard (Recommended)

1. **Start the dashboard server**:
   ```bash
   npm start
   # or
   node dashboard-server.js
   ```

2. **Open your browser** and navigate to:
   ```
   http://localhost:8080
   ```

3. **View real-time data** in the web interface with:
   - Node health status cards
   - Live orderbook data
   - System summary metrics
   - Connection status indicators

### Option 2: Terminal Monitor

1. **Run the original console monitor**:
   ```bash
   npm run monitor
   # or
   node comprehensive-monitor.js
   ```

## 🔧 Configuration

### Redis Connection
Both scripts connect to Redis at `100.70.127.124:6380`. To change this:

**For dashboard server** (`dashboard-server.js`):
```javascript
this.redisClient = redis.createClient({
    url: 'redis://YOUR_REDIS_HOST:PORT'
});
```

**For console monitor** (`comprehensive-monitor.js`):
```javascript
this.client = redis.createClient({
    url: 'redis://YOUR_REDIS_HOST:PORT'
});
```

### WebSocket Port
To change the dashboard server port (default 8080):

```javascript
this.server.listen(YOUR_PORT, () => {
    console.log(`Server started on http://localhost:${YOUR_PORT}`);
});
```

## 📊 Data Sources

The system subscribes to these Redis channels:

- `metrics:*` - Health metrics from all nodes
- `orderbooks` - Consolidated orderbook updates
- `market_status:*` - Market status changes
- `market_discovery` - Total market counts

## 🎨 Dashboard Features

### Health Status Section
- **Master Nodes**: Red-highlighted cards for master nodes (IP contains '127.124')
- **Worker Nodes**: Green-highlighted cards for worker nodes
- **Health Indicators**: Visual status with green (healthy) or red (unhealthy) indicators
- **Metrics Display**: CPU, memory, active markets, cores, load average, free disk space

### Orderbook Section
- **Node Organization**: Markets grouped by the node serving them
- **Market Data**: Complete orderbook with bids, asks, and spreads
- **Price Levels**: Sorted price levels with quantity and order counts
- **Spread Calculation**: Real-time spread percentage calculations

### System Summary
- **Node Counts**: Total nodes and healthy node counts
- **Market Metrics**: Active markets and total system markets
- **Connection Info**: Data source and update frequency
- **Live Timestamps**: Current time and last update indicators

## 🔄 Real-time Updates

- **WebSocket Connection**: Maintains persistent connection for live updates
- **Automatic Reconnection**: Attempts reconnection if connection is lost
- **Demo Mode**: Falls back to simulated data if Redis is unavailable
- **Update Frequency**: Real-time updates as data arrives from Redis

## 🛡️ Error Handling

- **Connection Monitoring**: Visual indicators for connection status
- **Graceful Degradation**: Continues operation even if some data is missing
- **Error Logging**: Comprehensive error logging to console
- **Fallback Data**: Demo mode provides sample data for testing

## 📱 Mobile Support

The dashboard is fully responsive and works on:
- Desktop browsers
- Tablets
- Mobile phones
- Different screen orientations

## 🐛 Troubleshooting

### Dashboard won't load
1. Ensure `dashboard-server.js` is running
2. Check that port 8080 is not in use
3. Verify `dashboard.html` is in the same directory

### No data appearing
1. Check Redis connection (IP: 100.70.127.124:6380)
2. Verify the monitoring system is publishing data
3. Check browser console for WebSocket errors

### WebSocket connection fails
1. Check firewall settings for port 8080
2. Ensure no proxy blocking WebSocket connections
3. Try refreshing the page to reconnect

## 🎯 Development

### Development Mode
```bash
npm run dev
```
Uses nodemon for automatic server restarts on file changes.

### File Structure
```
project/
├── dashboard.html          # Web interface
├── dashboard-server.js     # WebSocket server
├── comprehensive-monitor.js # Original console monitor
├── package.json           # Dependencies
└── README.md              # Documentation
```

## 📄 License

MIT License - Feel free to use and modify as needed.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**🎉 Happy Monitoring!** 

For support or questions, please check the console logs for detailed error messages and connection status. # monitoring_dashboard_project
