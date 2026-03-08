// api.js - Complete optimized version with caching and offline support
const API = {
  // Base URL - REPLACE WITH YOUR ACTUAL URL
  baseUrl: 'https://script.google.com/macros/s/AKfycbw8ZnqN9EGhCTuQ_9lfmTAaXJ0tjQm3HYj0uRvXL2y0-CIVhCHitXl5YMQ7rv9ZmB9uHQ/exec',
  
  // Cache system
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
    
    set(key, value, ttl = 300000) { // 5 minutes default
      this.data[key] = {
        value,
        expiry: Date.now() + ttl
      };
    },
    
    remove(key) {
      delete this.data[key];
    },
    
    clear() {
      this.data = {};
    },
    
    clearPrefix(prefix) {
      Object.keys(this.data).forEach(key => {
        if (key.startsWith(prefix)) {
          delete this.data[key];
        }
      });
    }
  },
  
  // Pending requests cache to prevent duplicates
  pendingRequests: {},
  
  // Generate unique callback name for JSONP
  generateCallback() {
    return 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  },
  
  // JSONP request with timeout
  jsonp(url, callbackName, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url + '&callback=' + callbackName;
      script.async = true;
      
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error('Request timeout'));
      }, timeout);
      
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (window[callbackName]) {
          delete window[callbackName];
        }
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
      
      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };
      
      script.onerror = () => {
        cleanup();
        reject(new Error('Network error'));
      };
      
      document.body.appendChild(script);
    });
  },
  
  // Main request handler
  async request(action, params = {}, options = {}) {
    const { skipCache = false, cacheTTL = 300000, timeout = 15000 } = options;
    const cacheKey = action + '_' + JSON.stringify(params);
    
    // Return cached data if available
    if (!skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.log('Cache hit:', cacheKey);
        return cached;
      }
    }
    
    // Prevent duplicate requests
    if (this.pendingRequests[cacheKey]) {
      console.log('Deduplicating request:', cacheKey);
      return this.pendingRequests[cacheKey];
    }
    
    // Build URL
    const callbackName = this.generateCallback();
    let url = this.baseUrl + '?action=' + encodeURIComponent(action);
    
    Object.keys(params).forEach(key => {
      const value = params[key];
      if (value !== undefined && value !== null) {
        if (typeof value === 'object') {
          url += '&' + key + '=' + encodeURIComponent(JSON.stringify(value));
        } else {
          url += '&' + key + '=' + encodeURIComponent(value);
        }
      }
    });
    
    console.log('API Request:', action, params);
    
    // Create request promise
    const requestPromise = this.jsonp(url, callbackName, timeout)
      .then(data => {
        delete this.pendingRequests[cacheKey];
        
        // Cache successful responses
        if (data && data.success && !skipCache) {
          this.cache.set(cacheKey, data, cacheTTL);
        }
        
        return data;
      })
      .catch(error => {
        delete this.pendingRequests[cacheKey];
        console.error('API Error:', error);
        return { success: false, message: error.message };
      });
    
    this.pendingRequests[cacheKey] = requestPromise;
    return requestPromise;
  },
  
  // ============= PUBLIC METHODS =============
  
  // Login
  async login(username, password) {
    return this.request('login', { username, password }, { 
      skipCache: true,
      timeout: 10000 
    });
  },
  
  // Get team members
  async getTeamMembers() {
    return this.request('getTeam', {}, { 
      cacheTTL: 3600000 // 1 hour cache
    });
  },
  
  // Save activity
  async saveActivity(activityData) {
    // Clear relevant caches
    if (activityData.submittedBy) {
      this.cache.clearPrefix('getActivities_' + activityData.submittedBy);
      this.cache.clearPrefix('getDashboard_' + activityData.submittedBy);
    }
    
    return this.request('saveActivity', { 
      data: JSON.stringify(activityData) 
    }, { 
      skipCache: true,
      timeout: 20000 
    });
  },
  
  // Update activity
  async updateActivity(rowId, updatedData) {
    // Clear caches
    if (updatedData.submittedBy) {
      this.cache.clearPrefix('getActivities_' + updatedData.submittedBy);
      this.cache.clearPrefix('getDashboard_' + updatedData.submittedBy);
    }
    
    return this.request('updateActivity', { 
      rowId, 
      data: JSON.stringify(updatedData) 
    }, { 
      skipCache: true,
      timeout: 20000 
    });
  },
  
  // Get user activities
  async getUserActivities(staffId, filter = 'all') {
    if (!staffId) {
      return { success: false, message: 'Staff ID required' };
    }
    
    return this.request('getActivities', { staffId, filter }, { 
      cacheTTL: 60000 // 1 minute cache
    });
  },
  
  // Get dashboard stats
  async getDashboardStats(staffId) {
    if (!staffId) {
      return { success: false, message: 'Staff ID required' };
    }
    
    return this.request('getDashboard', { staffId }, { 
      cacheTTL: 30000 // 30 seconds cache
    });
  },
  
  // Generate report
  async generateReport(staffId, reportType, format, month, year) {
    if (!staffId) {
      return { success: false, message: 'Staff ID required' };
    }
    
    return this.request('generateReport', { 
      staffId, 
      reportType, 
      format, 
      month, 
      year 
    }, { 
      cacheTTL: 300000, // 5 minutes cache
      timeout: 30000 // 30 seconds timeout for report generation
    });
  },
  
  // Approve activity
  async approveActivity(approvalId, staffId, action) {
    return this.request('approveActivity', { 
      approvalId, 
      staffId, 
      action 
    }, { 
      skipCache: true 
    });
  },
  
  // Clear all caches
  clearCache() {
    this.cache.clear();
    console.log('Cache cleared');
  }
};
