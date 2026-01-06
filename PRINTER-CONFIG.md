# 🖨️ Printer Configuration Examples

## Finding Your Printer

### Windows USB Printer

**Step 1:** Open Device Manager
```
1. Press Win + X → Device Manager
2. Expand "Ports (COM & LPT)"
3. Look for your printer (e.g., "USB Serial Port (COM3)")
```

**Step 2:** In `print-server/server.js`, use:
```javascript
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '\\\\.\\COM3',  // Replace COM3 with your port
  characterSet: 'PC437_USA',
  width: 48,
});
```

---

### Windows Network Printer

**Step 1:** Find printer IP
```
1. Print test page from printer settings
2. Note IP address (e.g., 192.168.1.100)
OR
3. Router admin page → Connected devices
```

**Step 2:** In `print-server/server.js`, use:
```javascript
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.100',
  characterSet: 'PC437_USA',
  width: 48,
});
```

---

### Linux USB Printer

**Step 1:** Find printer device
```bash
ls /dev/usb/lp*
# Output: /dev/usb/lp0

# OR
lsusb
# Output: Bus 001 Device 003: ID 04b8:0e15 Epson Corp.
```

**Step 2:** In `print-server/server.js`, use:
```javascript
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '/dev/usb/lp0',
  characterSet: 'PC437_USA',
  width: 48,
});
```

---

## Complete Example: 2 Printers

Edit `print-server/server.js` lines 11-29:

```javascript
// KITCHEN PRINTER (USB)
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '\\\\.\\COM3',  // ← Change this to your port
  characterSet: 'PC437_USA',
  width: 48,
  removeSpecialCharacters: false,
  lineCharacter: '=',
});

// COUNTER PRINTER (Network)
const counterPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: 'tcp://192.168.1.101',  // ← Change this to your printer IP
  characterSet: 'PC437_USA',
  width: 48,
  removeSpecialCharacters: false,
  lineCharacter: '=',
});
```

---

## Printer Type Reference

### Epson (Most Common)
```javascript
type: PrinterTypes.EPSON
```

### Star Micronics
```javascript
type: PrinterTypes.STAR
```

### Generic ESC/POS
```javascript
type: PrinterTypes.EPSON  // Works for most thermal printers
```

---

## Paper Width Settings

| Physical Width | Width Setting | Description |
|---------------|---------------|-------------|
| 58mm (2.3") | 32 | Small receipt paper |
| 72mm (3") | 48 | **Most common** |
| 80mm (3.15") | 48 | Standard thermal |

**Our default:** 48 (works for 72mm and 80mm)

---

## Testing Individual Printer

### Test Kitchen Printer
```javascript
// Add this to server.js temporarily, before app.listen()
async function testKitchenPrinter() {
  kitchenPrinter.alignCenter();
  kitchenPrinter.bold(true);
  kitchenPrinter.println('KITCHEN TEST');
  kitchenPrinter.bold(false);
  kitchenPrinter.println('Printer working!');
  kitchenPrinter.cut();
  await kitchenPrinter.execute();
}

testKitchenPrinter();
```

Run:
```bash
node server.js
```

**Expected:** Kitchen printer prints test page

---

## Common Printer Models & Settings

### Epson TM-T20II
```javascript
type: PrinterTypes.EPSON,
interface: 'tcp://192.168.1.100',  // Network
// OR
interface: '\\\\.\\COM3',  // USB
characterSet: 'PC437_USA',
width: 48,
```

### Epson TM-U220
```javascript
type: PrinterTypes.EPSON,
interface: '\\\\.\\COM3',
characterSet: 'PC437_USA',
width: 48,
```

### Star TSP650II
```javascript
type: PrinterTypes.STAR,
interface: 'tcp://192.168.1.100',
characterSet: 'PC437_USA',
width: 48,
```

### Generic 58mm Printer
```javascript
type: PrinterTypes.EPSON,
interface: '\\\\.\\COM3',
characterSet: 'PC437_USA',
width: 32,  // Smaller width for 58mm
```

---

## Troubleshooting

### Error: "Cannot connect to printer"

**USB Printer:**
- ✅ Check USB cable connected
- ✅ Driver installed? (Windows Update or manufacturer website)
- ✅ COM port correct in Device Manager?
- ✅ Try different USB port

**Network Printer:**
- ✅ Printer on same network?
- ✅ Ping printer: `ping 192.168.1.100`
- ✅ Firewall blocking?
- ✅ Static IP or DHCP? (recommend static)

### Error: "Printer not responding"

```bash
# Windows - check COM port
mode COM3

# Test printer with manufacturer utility
# Epson: https://epson.com/Support/wa00821
```

### Print Quality Issues

```javascript
// Add to printer config:
encoding: 'GB18030',  // For special characters
removeSpecialCharacters: true,  // Remove unsupported chars
```

---

## Multiple Printers Same Type

If you have 2 USB Epson printers:

```javascript
// Kitchen: COM3
const kitchenPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '\\\\.\\COM3',
  characterSet: 'PC437_USA',
  width: 48,
});

// Counter: COM4
const counterPrinter = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '\\\\.\\COM4',  // Different port!
  characterSet: 'PC437_USA',
  width: 48,
});
```

**Tip:** Label the USB ports on your PC!

---

## Network Printer Static IP Setup

**Why:** Prevents IP changes after router restart

**How:**
1. Access printer web interface (http://printer-ip)
2. Network Settings → Static IP
3. Set IP: `192.168.1.100` (choose unused IP)
4. Gateway: `192.168.1.1` (your router)
5. Subnet: `255.255.255.0`
6. Save & restart printer

---

## Bluetooth Printers (Not Recommended)

Bluetooth thermal printers are **not recommended** due to:
- ❌ Connection reliability issues
- ❌ Requires pairing each device
- ❌ Slower than USB/Network

**Alternative:** Use Network or USB printers

---

## Quick Diagnostic Script

Save as `test-printer.js` in print-server folder:

```javascript
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: '\\\\.\\COM3',  // ← Change this
  characterSet: 'PC437_USA',
  width: 48,
});

async function test() {
  try {
    printer.alignCenter();
    printer.println('PRINTER TEST');
    printer.println(new Date().toLocaleString());
    printer.cut();
    await printer.execute();
    console.log('✅ Print successful!');
  } catch (error) {
    console.error('❌ Print failed:', error.message);
  }
}

test();
```

Run:
```bash
node test-printer.js
```

---

## ✅ Configuration Checklist

Before running print server:

- [ ] Printers powered on
- [ ] Cables connected (USB or network)
- [ ] Paper loaded
- [ ] Driver installed (Windows)
- [ ] COM port or IP address identified
- [ ] `server.js` updated with correct interface
- [ ] Test print successful

**Then:** `npm start` in print-server folder

---

**Need help?** See [SETUP-GUIDE.md](./SETUP-GUIDE.md)
