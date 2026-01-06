// Print Server API Client
const PRINT_SERVER_URL = 'http://localhost:5001'; // Change to your PC IP for LAN access

export async function sendToPrinter(type, data) {
  try {
    const response = await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Print server error:', error);
    // Fallback to browser print if server unavailable
    return { success: false, error: error.message, fallback: true };
  }
}

export async function checkPrintServer() {
  try {
    const response = await fetch(`${PRINT_SERVER_URL}/status`);
    const status = await response.json();
    return status;
  } catch (error) {
    return { status: 'offline' };
  }
}

// WebSocket connection for real-time sync (optional)
export function connectWebSocket(onMessage) {
  const ws = new WebSocket(`ws://${PRINT_SERVER_URL.replace('http://', '')}`);
  
  ws.onopen = () => console.log('Connected to print server');
  ws.onmessage = (event) => onMessage(JSON.parse(event.data));
  ws.onerror = (error) => console.error('WebSocket error:', error);
  
  return ws;
}
