/**
 * Vendor Management System - API Client
 * Clean asynchronous fetch abstraction for REST endpoints.
 */

const API_BASE = '/api';

const api = {
  async request(endpoint, options = {}) {
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP ${response.status}: Request failed`);
      }
      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, err);
      throw err;
    }
  },

  // Stats
  async getStats() {
    return this.request('/stats');
  },

  // Vendors
  async getVendors(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category && params.category !== 'All') query.append('category', params.category);
    if (params.status && params.status !== 'All') query.append('status', params.status);
    if (params.tier && params.tier !== 'All') query.append('tier', params.tier);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/vendors${queryString}`);
  },

  async getVendor(id) {
    return this.request(`/vendors/${id}`);
  },

  async createVendor(vendorData) {
    return this.request('/vendors', {
      method: 'POST',
      body: JSON.stringify(vendorData),
    });
  },

  async updateVendor(id, vendorData) {
    return this.request(`/vendors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(vendorData),
    });
  },

  async updateVendorStatus(id, status, remarks = '') {
    return this.request(`/vendors/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, remarks }),
    });
  },

  async evaluateVendor(id, evalData) {
    return this.request(`/vendors/${id}/evaluate`, {
      method: 'POST',
      body: JSON.stringify(evalData),
    });
  },

  async deleteVendor(id) {
    return this.request(`/vendors/${id}`, {
      method: 'DELETE',
    });
  },

  // Orders
  async getOrders(params = {}) {
    const query = new URLSearchParams();
    if (params.status && params.status !== 'All') query.append('status', params.status);
    if (params.vendorId) query.append('vendorId', params.vendorId);
    if (params.search) query.append('search', params.search);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/orders${queryString}`);
  },

  async getOrder(id) {
    return this.request(`/orders/${id}`);
  },

  async createOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    });
  },

  async updateOrderStatus(id, status, actor, comment) {
    return this.request(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, actor, comment }),
    });
  },

  async deleteOrder(id) {
    return this.request(`/orders/${id}`, {
      method: 'DELETE',
    });
  },

  // Reset Demo Data
  async resetData() {
    return this.request('/reset-data', {
      method: 'POST',
    });
  },

  // Export CSV
  downloadExport(type) {
    window.location.href = `${API_BASE}/export/${type}`;
  },
};
