// api.js - Optimized with request deduplication and caching
const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycby9mZGt2G9CI9HZqel8YTmExiR2HWqDb2iEk7McgYYp5Iz2eWXkrcZFhNAPdu9HQtHE/exec',
  
  // Memory cache
  cache: {
    data: {},
    get(key) {
      const item = this.data[key];
      if (item && Date.now() < item.expiry) {
        return item.value;
      }
      delete this.data[key];
      return null;
    },
    set(key, value, ttl = 300000) {
      this.data[key] = {
        value,
        expiry: Date.now() + ttl
      };
    },
    clear() {
      this.data = {};
    }
  },
  
  // Request deduplication
  pendingRequests: new Map(),
  
  generateCallback() {
    return 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
  
  async request(action, params = {}, options = {}) {
    const cacheKey = action + '_' + JSON.stringify(params);
    const { skipCache = false, cacheTTL = 300000, timeout = 15000 } = options;
    
    // Check cache
    if (!skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) return cached;
    }
    
    // Deduplicate in-flight requests
    if (this.pendingRequests.has(cacheKey)) {
      return this.pendingRequests.get(cacheKey);
    }
    
    const callbackName = this.generateCallback();
    let url = this.baseUrl + '?action=' + encodeURIComponent(action);
    url += '&callback=' + callbackName;
    
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
        url += '&' + key + '=' + encodeURIComponent(value);
      }
    });
    
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Request timeout'));
      }, timeout);
      
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (window[callbackName]) delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        this.pendingRequests.delete(cacheKey);
      };
      
      window[callbackName] = (data) => {
        cleanup();
        if (data && data.success && !skipCache) {
          this.cache.set(cacheKey, data, cacheTTL);
        }
        resolve(data);
      };
      
      script.onerror = () => {
        cleanup();
        reject(new Error('Network error'));
      };
      
      document.body.appendChild(script);
    });
    
    this.pendingRequests.set(cacheKey, promise);
    return promise;
  },
  
  // API Methods
  async login(username, password) {
    return this.request('login', { username, password }, { skipCache: true, timeout: 10000 });
  },
  
  async getTeamMembers() {
    return this.request('getTeam', {}, { cacheTTL: 3600000 }); // 1 hour
  },
  
  async saveActivity(activityData) {
    this.cache.clear(); // Clear cache on write
    return this.request('saveActivity', { data: JSON.stringify(activityData) }, { skipCache: true, timeout: 20000 });
  },
  
  async getUserActivities(staffId, filter = 'all') {
    return this.request('getActivities', { staffId, filter }, { cacheTTL: 60000 }); // 1 minute
  },
  
  async getDashboardStats(staffId) {
    return this.request('getDashboard', { staffId }, { cacheTTL: 30000 }); // 30 seconds
  },
  
  async updateActivity(rowId, updatedData) {
    this.cache.clear();
    return this.request('updateActivity', { rowId, data: JSON.stringify(updatedData) }, { skipCache: true });
  },
  
  async generateReport(staffId, reportType, format, startDate, endDate) {
    return this.request('generateReport', { staffId, reportType, format, startDate, endDate }, { cacheTTL: 300000 }); // 5 minutes
  }
};
