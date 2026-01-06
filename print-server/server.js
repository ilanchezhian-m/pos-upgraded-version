const express = require('express');
const cors = require('cors');
const { WebSocketServer } = require('ws');
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

// Configure your printers - UPDATE THESE PATHS
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100', // or 'usb://VID:PID' for USB
  characterSet: 'PC437_USA',
  width: 48,
});

const counterPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.101', // or USB path
  characterSet: 'PC437_USA',
  width: 48,
});

// Print KOT
async function printKOT(order) {
  try {
    kitchenPrinter.alignCenter();
    kitchenPrinter.bold(true);
    kitchenPrinter.setTextSize(1, 1);
    kitchenPrinter.println('KITCHEN ORDER TICKET');
    kitchenPrinter.bold(false);
    kitchenPrinter.drawLine();
    
    kitchenPrinter.alignLeft();
    kitchenPrinter.println(`Order No: ${order.orderNumber || 'N/A'}`);
    kitchenPrinter.println(`Table: ${order.table}`);
    if (order.customer) kitchenPrinter.println(`Customer: ${order.customer}`);
    kitchenPrinter.println(`Time: ${new Date().toLocaleString()}`);
    kitchenPrinter.drawLine();
    
    kitchenPrinter.bold(true);
    kitchenPrinter.println('Items:');
    kitchenPrinter.bold(false);
    
    order.items.forEach(item => {
      kitchenPrinter.println(`${item.name}`);
      kitchenPrinter.println(`  Qty: ${item.qty}`);
    });
    
    kitchenPrinter.drawLine();
    kitchenPrinter.alignCenter();
    kitchenPrinter.println('** PREPARE IMMEDIATELY **');
    kitchenPrinter.cut();
    
    await kitchenPrinter.execute();
    console.log('KOT printed successfully');
    return { success: true };
  } catch (error) {
    console.error('KOT print failed:', error);
    return { success: false, error: error.message };
  }
}

// Print Bill
async function printBill(bill) {
  try {
    counterPrinter.alignCenter();
    counterPrinter.bold(true);
    counterPrinter.setTextSize(1, 1);
    counterPrinter.println('TOPI VAPPA BIRIYANI');
    counterPrinter.bold(false);
    counterPrinter.println('INVOICE / BILL');
    counterPrinter.drawLine();
    
    counterPrinter.alignLeft();
    counterPrinter.println(`Order No: ${bill.orderNumber || 'N/A'}`);
    counterPrinter.println(`Customer: ${bill.customer}`);
    counterPrinter.println(`Table: ${bill.table}`);
    counterPrinter.println(`Date: ${new Date().toLocaleString()}`);
    counterPrinter.drawLine();
    
    counterPrinter.bold(true);
    counterPrinter.tableCustom([
      { text: 'Item', align: 'LEFT', width: 0.5 },
      { text: 'Qty', align: 'CENTER', width: 0.15 },
      { text: 'Price', align: 'RIGHT', width: 0.15 },
      { text: 'Total', align: 'RIGHT', width: 0.2 },
    ]);
    counterPrinter.bold(false);
    counterPrinter.drawLine();
    
    bill.items.forEach(item => {
      counterPrinter.tableCustom([
        { text: item.name, align: 'LEFT', width: 0.5 },
        { text: item.qty.toString(), align: 'CENTER', width: 0.15 },
        { text: `₹${item.price}`, align: 'RIGHT', width: 0.15 },
        { text: `₹${item.price * item.qty}`, align: 'RIGHT', width: 0.2 },
      ]);
    });
    
    counterPrinter.drawLine();
    counterPrinter.bold(true);
    counterPrinter.tableCustom([
      { text: 'TOTAL AMOUNT:', align: 'LEFT', width: 0.7 },
      { text: `₹${bill.total}`, align: 'RIGHT', width: 0.3 },
    ]);
    counterPrinter.bold(false);
    counterPrinter.drawLine();
    
    counterPrinter.println(`Payment Method: ${bill.paymentMethod || 'Cash'}`);
    counterPrinter.println(`Amount Paid: ₹${bill.total}`);
    counterPrinter.drawLine();
    counterPrinter.alignLeft();
    counterPrinter.println(`FSSAI No: 12421018001075`);
    counterPrinter.println(`GST No: 33BZGPG7879D1Z7`);
    counterPrinter.drawLine();
    counterPrinter.alignCenter();
    counterPrinter.println('Thank you for visiting!');
    counterPrinter.cut();
    
    await counterPrinter.execute();
    console.log('Bill printed successfully');
    return { success: true };
  } catch (error) {
    console.error('Bill print failed:', error);
    return { success: false, error: error.message };
  }
}

// REST API endpoint
app.post('/print', async (req, res) => {
  const { type, data } = req.body;
  
  try {
    let result;
    if (type === 'KOT') {
      result = await printKOT(data);
    } else if (type === 'BILL') {
      result = await printBill(data);
    } else {
      return res.status(400).json({ error: 'Invalid print type' });
    }
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/status', (req, res) => {
  res.json({ 
    status: 'online',
    printers: {
      kitchen: 'connected',
      counter: 'connected'
    }
  });
});

// WebSocket for real-time sync
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🖨️  Print server running on http://localhost:${PORT}`);
  console.log(`📡 Accessible on LAN at http://YOUR_PC_IP:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Client connected');
  
  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    
    if (data.type === 'PRINT') {
      const result = data.printType === 'KOT' 
        ? await printKOT(data.data)
        : await printBill(data.data);
      ws.send(JSON.stringify(result));
    }
  });
  
  ws.on('close', () => console.log('Client disconnected'));
});

console.log('🎯 Configure your printer paths in server.js');
console.log('📝 To find USB printer: Use "lsusb" (Linux) or Device Manager (Windows)');
