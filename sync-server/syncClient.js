// Sync Server Client - Auto adapts to Localhost or Local Wi-Fi IP
export const getSyncBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('sync_server_url')
    if (saved) return saved.replace(/\/api\/?$/, '')
    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:5000`
    }
  }
  return 'http://localhost:5000'
}

export const syncClient = {
  getUrl(path = '') {
    return `${getSyncBaseUrl()}/api${path}`
  },

  // Get network info & detected PC IP
  async getNetworkInfo() {
    try {
      const res = await fetch(this.getUrl('/network-info'))
      return await res.json()
    } catch (err) {
      console.warn('Network info unavailable:', err)
      return null
    }
  },

  // Health check
  async checkStatus() {
    try {
      const res = await fetch(this.getUrl('/health'))
      return await res.json()
    } catch (_) {
      return { status: 'offline' }
    }
  },

  // Get all orders
  async getOrders() {
    try {
      const response = await fetch(this.getUrl('/orders'))
      return await response.json()
    } catch (error) {
      console.error('Error fetching orders:', error)
      return []
    }
  },

  // Get orders for a table
  async getTableOrders(tableId) {
    try {
      const response = await fetch(this.getUrl(`/orders/table/${tableId}`))
      return await response.json()
    } catch (error) {
      console.error('Error fetching table orders:', error)
      return []
    }
  },

  // Create new order
  async createOrder(orderData) {
    try {
      const response = await fetch(this.getUrl('/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      })
      return await response.json()
    } catch (error) {
      console.error('Error creating order:', error)
      throw error
    }
  },

  // Update order
  async updateOrder(orderId, updates) {
    try {
      const response = await fetch(this.getUrl(`/orders/${orderId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      return await response.json()
    } catch (error) {
      console.error('Error updating order:', error)
      throw error
    }
  },

  // Delete order
  async deleteOrder(orderId) {
    try {
      const response = await fetch(this.getUrl(`/orders/${orderId}`), {
        method: 'DELETE',
      })
      return await response.json()
    } catch (error) {
      console.error('Error deleting order:', error)
      throw error
    }
  },

  // Clear all orders for a table
  async clearTableOrders(tableId) {
    try {
      const response = await fetch(this.getUrl(`/orders/table/${tableId}/clear`), {
        method: 'DELETE',
      })
      return await response.json()
    } catch (error) {
      console.error('Error clearing table orders:', error)
      throw error
    }
  },

  // Bills
  async getBills() {
    try {
      const response = await fetch(this.getUrl('/bills'))
      return await response.json()
    } catch (_) {
      return []
    }
  },

  async createBill(billData) {
    try {
      const response = await fetch(this.getUrl('/bills'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(billData),
      })
      return await response.json()
    } catch (error) {
      console.error('Error creating bill:', error)
      throw error
    }
  },

  // Prints
  async getPrints() {
    try {
      const response = await fetch(this.getUrl('/prints'))
      return await response.json()
    } catch (_) {
      return []
    }
  },

  async createPrintJob(jobData) {
    try {
      const response = await fetch(this.getUrl('/prints'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobData),
      })
      return await response.json()
    } catch (error) {
      console.error('Error creating print job:', error)
      throw error
    }
  },

  // Clear All
  async clearAll() {
    try {
      const response = await fetch(this.getUrl('/clear-all'), { method: 'POST' })
      return await response.json()
    } catch (error) {
      console.error('Error clearing all:', error)
      throw error
    }
  },

  // Subscribe to real-time updates
  subscribeToUpdates(callback) {
    const sseUrl = `${getSyncBaseUrl()}/api/sync`
    let eventSource = null

    try {
      eventSource = new EventSource(sseUrl)

      eventSource.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data)
          callback(data)
        } catch (_) {}
      })

      eventSource.addEventListener('error', () => {
        console.warn('Wi-Fi sync disconnected, retrying...')
      })
    } catch (err) {
      console.error('SSE connection failed:', err)
    }

    return eventSource
  },
}
