const API = {
  baseUrl: 'https://script.google.com/macros/s/AKfycbyj_XoIjrio3kokdR-HwZAd53UPra12vVCDEqsZ6W_jvXSLSpmmTxmpvbCC3jeyQkGEqQ/exec',
  
  cache: {
    data: {},
    get(key) { const item = this.data[key]; return (item && Date.now() < item.expiry) ? item.value : (delete this.data[key], null); },
    set(key, value, ttl = 300000) { this.data[key] = { value, expiry: Date.now() + ttl }; },
    clear() { this.data = {}; }
  },
  
  pendingRequests: new Map(),
  
  generateCallback() { return 'jsonp_callback_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); },
  
  async request(action, params = {}, options = {}) {
    const cacheKey = action + '_' + JSON.stringify(params);
    const { skipCache = false, cacheTTL = 300000, timeout = 15000 } = options;
    
    if (!skipCache) { const cached = this.cache.get(cacheKey); if (cached) return cached; }
    if (this.pendingRequests.has(cacheKey)) return this.pendingRequests.get(cacheKey);
    
    const callbackName = this.generateCallback();
    let url = this.baseUrl + '?action=' + encodeURIComponent(action) + '&callback=' + callbackName;
    Object.keys(params).forEach(key => { if (params[key] !== undefined && params[key] !== null) { const value = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key]; url += '&' + key + '=' + encodeURIComponent(value); } });
    
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = url; script.async = true;
      const timeoutId = setTimeout(() => { cleanup(); reject(new Error('Request timeout')); }, timeout);
      const cleanup = () => { clearTimeout(timeoutId); delete window[callbackName]; script.remove(); this.pendingRequests.delete(cacheKey); };
      window[callbackName] = (data) => { cleanup(); if (data?.success && !skipCache) this.cache.set(cacheKey, data, cacheTTL); resolve(data); };
      script.onerror = () => { cleanup(); reject(new Error('Network error')); };
      document.body.appendChild(script);
    });
    
    this.pendingRequests.set(cacheKey, promise);
    return promise;
  },
  
  login: (u, p) => API.request('login', { username: u, password: p }, { skipCache: true, timeout: 10000 }),
  getTeamMembers: () => API.request('getTeam', {}, { cacheTTL: 3600000 }),
  saveActivity: (d) => (API.cache.clear(), API.request('saveActivity', { data: JSON.stringify(d) }, { skipCache: true, timeout: 20000 })),
  getUserActivities: (s, f) => API.request('getActivities', { staffId: s, filter: f }, { cacheTTL: 60000 }),
  getDashboardStats: (s) => API.request('getDashboard', { staffId: s }, { cacheTTL: 30000 }),
  updateActivity: (r, d) => (API.cache.clear(), API.request('updateActivity', { rowId: r, data: JSON.stringify(d) }, { skipCache: true })),
  generateReport: (s, t, f, sd, ed) => API.request('generateReport', { staffId: s, reportType: t, format: f, startDate: sd, endDate: ed }, { cacheTTL: 300000 })
};
