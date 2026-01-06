// Sync Server Client
const SYNC_SERVER_URL = 'http://localhost:5000/api'

export const syncClient = {
  // Get all orders
  async getOrders() {
    try {
      const response = await fetch(`${SYNC_SERVER_URL}/orders`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching orders:', error)
      return []
    }
  },

  // Get orders for a table
  async getTableOrders(tableId) {
    try {
      const response = await fetch(`${SYNC_SERVER_URL}/orders/table/${tableId}`)
      return await response.json()
    } catch (error) {
      console.error('Error fetching table orders:', error)
      return []
    }
  },

  // Create new order
  async createOrder(orderData) {
    try {
      const response = await fetch(`${SYNC_SERVER_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
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
      const response = await fetch(`${SYNC_SERVER_URL}/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
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
      const response = await fetch(`${SYNC_SERVER_URL}/orders/${orderId}`, {
        method: 'DELETE'
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
      const response = await fetch(`${SYNC_SERVER_URL}/orders/table/${tableId}/clear`, {
        method: 'DELETE'
      })
      return await response.json()
    } catch (error) {
      console.error('Error clearing table orders:', error)
      throw error
    }
  },

  // Subscribe to real-time updates
  subscribeToUpdates(callback) {
    const eventSource = new EventSource(`${SYNC_SERVER_URL.replace('/api', '')}/api/sync`)
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        callback(data)
      } catch (error) {
        console.error('Error parsing update:', error)
      }
    })

    eventSource.addEventListener('error', () => {
      console.log('Sync connection lost, retrying...')
      setTimeout(() => {
        eventSource.close()
        // Reconnect after delay
        this.subscribeToUpdates(callback)
      }, 3000)
    })

    return eventSource
  },

  // Check server status
  async checkStatus() {
    try {
      const response = await fetch(`${SYNC_SERVER_URL}/health`)
      return await response.json()
    } catch (error) {
      return { status: 'offline' }
    }
  }
}
