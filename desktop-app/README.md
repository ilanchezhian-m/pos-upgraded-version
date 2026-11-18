# 🖥️ Topi Vappa POS - Windows Desktop Edition

Desktop edition of the Topi Vappa POS built with **Electron + React + Vite**.

## ✨ Key Advantage: Silent Direct Printing
In regular web browsers (Chrome, Edge, Firefox), calling `window.print()` forces a popup dialog asking:
> *"Destination... Pages... [Print] [Cancel]"*

Every single bill or KOT ticket requires pressing Enter or clicking "Print".

**In this Desktop Edition:**
- The app communicates directly with Windows printer drivers via Electron.
- Receipts and KOTs are dispatched **silently in the background** directly to the thermal printer spooler.
- **Zero popups, zero browser permission prompts, instant one-tap billing.**

---

## 🚀 How to Run the Desktop App

### Quick Start (Double Click):
Double-click `desktop-app/start-desktop.bat` (or `START-DESKTOP.bat` in the root folder).

### From Terminal:
```bash
cd desktop-app
npm run build
npm start
```

### Development Mode (with Live Reload):
```bash
cd desktop-app
npm run electron:dev
```

---

## 🖨️ How to Select Your Thermal Printer
1. Open the Desktop POS App.
2. Navigate to **Print Center** (`/print-center`).
3. In the preview toolbar, you will see a dropdown:
   `[ 🖨️ Windows Default Printer ▾ ]`
4. The dropdown automatically lists **all physical & USB thermal printers installed on your Windows PC** (e.g. `POS-80`, `EPSON TM-T82`, `TVS RP-3200`, etc.).
5. Select your preferred receipt printer. Your selection is automatically saved in `localStorage`.
6. Click **⚡ Print (Silent)**. The receipt prints immediately without any dialog.

---

## 📦 Building a Standalone Windows Installer (`.exe`)
To generate an installable Windows `.exe` file that can be distributed to any billing PC without needing Node.js or terminal:

```bash
cd desktop-app
npm run dist
```
The output installer will be generated in `desktop-app/release/`.
