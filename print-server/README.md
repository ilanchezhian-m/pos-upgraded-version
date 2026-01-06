# PetPooja Print Server

Auto-print server for thermal KOT and Bill printers.

## Setup

1. **Install dependencies:**
```bash
cd print-server
npm install
```

2. **Configure printers in `server.js`:**

For **USB printers**:
- Windows: Find in Device Manager → Ports → Note COM port
- Linux: `ls /dev/usb/lp*` or `lsusb`
```javascript
interface: 'usb://0x04b8:0x0e15' // Example: Epson VID:PID
// or
interface: '\\\\.\\COM3' // Windows COM port
```

For **Network printers**:
```javascript
interface: 'tcp://192.168.1.100' // Printer IP
```

3. **Start server:**
```bash
npm start
# or for development:
npm run dev
```

4. **Update POS app:**
Set print server URL in your POS system to:
```
http://YOUR_PC_IP:5001
```

## Testing

Test print endpoint:
```bash
curl -X POST http://localhost:5001/print \
  -H "Content-Type: application/json" \
  -d '{"type":"KOT","data":{"orderNumber":"1001","table":"A1","items":[{"name":"Chicken Biryani","qty":2}]}}'
```

## Auto-start on PC boot

**Windows:**
- Create shortcut to `start-server.bat`
- Place in `C:\Users\USERNAME\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

**Linux:**
```bash
sudo nano /etc/systemd/system/petpooja-print.service
# Add service config, then:
sudo systemctl enable petpooja-print
sudo systemctl start petpooja-print
```
