# Bluetooth Debugging Guide

Quick reference for troubleshooting when printer arrives.

## 🔍 Debugging Techniques

### 1. Open Browser Console
**Chrome/Edge:** F12 → Console tab  
**Safari:** Develop menu → JavaScript Console  

All Bluetooth events are logged here.

### 2. Key Log Messages to Look For

```
// ✅ Good signs:
"Initializing POS Application"
"Scanning for device..."
"Device selected: [Printer Name] [Device ID]"
"Connecting to device: [Name]"
"GATT connected"
"Found services: [number]"
"Found writable characteristic: [UUID]"
"Device connected successfully: [Name]"
"Sending receipt: [bytes] bytes in chunks of 100"
"Sending chunk 1: 100 bytes"
"Receipt sent successfully"
"Print successful"

// ⚠️ Warning signs:
"No paired printer found"
"Error reconnecting to paired device"
"Error accessing service"
"No writable characteristic found"
"Device disconnected unexpectedly"
"Device disconnected during transmission"

// ❌ Error signs:
"Connection failed"
"Print failed"
"Not connected to printer"
"Empty receipt data"
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Printer not connected" on first use

**Symptoms:**
- Click "Connect" → Device picker opens → Select printer → Message says "Printer not connected"

**Diagnosis:**
```
// Check console for:
"Device selection cancelled" (user cancelled - OK)
OR
"Connecting to device: [Name]" followed by error
```

**Solutions:**
1. **Device picker cancelled:** This is normal if user closes the dialog
2. **Connection failed:** Check if printer is powered on and in BLE mode
3. **No characteristics found:** Printer may use different BLE service UUID - note it in console

**To debug:**
- Add this to console: `Bluetooth.requestDevice()` and check logs
- Verify printer supports these services (check settings):
  - `0x180D` (Heart Rate - fallback UART)
  - `0xFFF0` (Chinese printer service)

---

### Issue 2: Auto-reconnect on app reload doesn't work

**Symptoms:**
- Connect to printer
- Close browser/reload page
- App loads but shows "Disconnected"

**Diagnosis:**
1. Check if printer ID was saved:
   - Open DevTools → Storage/Application → localStorage
   - Look for key: `pos_pairedPrinterId`
   - If missing: connection wasn't stored

2. Check if printer is still paired:
   - Console should show: "Found paired device: [ID]"
   - Or: "No paired printer found" (device forgotten)

**Solutions:**
```javascript
// In console, check stored ID:
localStorage.getItem('pos_pairedPrinterId')

// Check if Bluetooth getDevices() works:
navigator.bluetooth.getDevices().then(d => console.log(d))

// Try manual reconnect:
Bluetooth.requestDevice()  // Manually re-pair
```

---

### Issue 3: Print hangs or doesn't send data

**Symptoms:**
- Click "Print" → loading screen appears → nothing happens or timeout
- No receipt prints

**Diagnosis:**
1. **Is characteristic writable?**
   ```
   // In console, check logs for:
   "Found writable characteristic: [UUID]"
   ```
   If this line is missing, characteristic doesn't support write

2. **Is device still connected?**
   ```
   // In console, check:
   Bluetooth.getStatus()
   // Should show: { isConnected: true, deviceName: "...", deviceId: "..." }
   ```

3. **Is receipt data being generated?**
   ```
   // No console error about receipt generation means it worked
   // If you see "Failed to generate receipt", check cart items
   ```

**Solutions:**
- Verify printer is within BLE range (usually 10 meters)
- Check printer battery level
- Restart printer (power cycle)
- Try different BLE channel: move phone away from WiFi router
- Check if 100-byte chunks with 75ms delays are supported by printer

---

### Issue 4: Quantity calculations wrong on receipt

**Symptoms:**
- Add item twice → Receipt shows two separate lines instead of "x2"
- Receipt total doesn't match cart total

**Diagnosis:**
Check console for item data:
```javascript
// If quantity shows as 1 for each item, check cart structure:
Storage.getCart()  // In console

// Should show: { qty: 2 } or { quantity: 2 }
```

**Solution:**
- Items should merge automatically with quantity increment
- Check `storage.js` line 156-161 in `addToCart()` function
- Verify cart display shows quantity controls (−, qty, +)

---

### Issue 5: Device disconnects during print

**Symptoms:**
- Print starts → halfway through, printer disconnects
- Console shows: "Device disconnected during transmission"

**Diagnosis:**
- Could be BLE range issue (printer moved too far)
- Could be power issue (printer going to sleep)
- Could be interference (WiFi, microwave)

**Solutions:**
1. **Keep printer closer** (< 5 meters)
2. **Disable WiFi** temporarily to test (reduce interference)
3. **Printer power settings:** Check if it has sleep timeout → disable
4. **Try with larger delay:** Edit DELAY_MS in bluetooth.js line 187 (increase from 75 to 150ms)

---

### Issue 6: "Bluetooth not supported on this browser"

**Symptoms:**
- Status shows: "Bluetooth not supported on this browser"
- Bluetooth button is grayed out

**Diagnosis:**
Browser doesn't support Web Bluetooth API

**Supported Browsers:**
- ✅ Chrome 56+ (all platforms)
- ✅ Edge 79+ (all platforms)
- ✅ Opera 43+
- ⚠️ Safari 14+ (iOS/macOS, limited support)
- ❌ Firefox (not supported)

**Solutions:**
- Use Chrome or Edge (recommended)
- On iOS, use Chrome or Edge (not Safari)
- Enable Experimental Web Platform Features (if available in browser settings)

---

### Issue 7: Cart items show null price or undefined name

**Symptoms:**
- Click "Add" → nothing happens
- Print fails with "Invalid item"

**Diagnosis:**
- Item wasn't added correctly to cart
- Check in console: `Storage.getCart()`
- Look for missing `price` or `name` field

**Solutions:**
1. Clear cart: `Storage.clearCart()` in console
2. Reload app: `location.reload()`
3. Check app.js `addCustomAmount()` function - verify input validation

---

## 📊 Console Debugging Commands

Copy-paste these in browser DevTools console:

```javascript
// Check Bluetooth status
Bluetooth.getStatus()

// Check cart contents
Storage.getCart()

// Check paired printer ID
Storage.getPairedPrinterId()

// Check selected words
Storage.getSelectedWords()

// Manually trigger print receipt (for testing)
Bluetooth.printReceipt(Storage.getCart(), 'Cash')

// Generate sample receipt
Receipt.generateReceipt(Storage.getCart(), 'Cash')

// Clear everything and restart
Storage.clearCart();
Storage.clearPairedPrinterId();
location.reload();

// Check if device is connected
Bluetooth.getStatus().isConnected

// Get list of available Bluetooth devices
navigator.bluetooth.getDevices().then(d => console.table(d))

// Manually disconnect
Bluetooth.disconnect()

// Try to reconnect to paired
Bluetooth.tryReconnectPaired()
```

---

## 🎯 Step-by-Step Printer Test

### First Time Setup
1. Open app in Chrome/Edge
2. Open DevTools (F12) → Console tab
3. Power on printer, ensure it's in BLE discovery mode
4. Click Bluetooth status in app
5. Device picker opens → Select your printer
6. Wait for: "Device connected successfully: [Name]"
7. Status should change to: "Connected to [Name]"

### First Print Test
1. Add item to cart (enter amount, click +)
2. Click "Checkout"
3. Choose payment method (e.g., "Cash")
4. Watch console for: "Sending receipt", "Chunk 1", "Chunk 2", "Receipt sent successfully"
5. Check printer output tray for receipt
6. App should show "Print successful"

### Error Recovery Test
1. Attempt to print with printer powered OFF
2. Should fail with error message
3. Click "Retry"
4. Power ON printer
5. Click "Retry" again
6. Should now print successfully

---

## 📞 Emergency Console Commands

If app completely freezes:

```javascript
// Open console and run:
location.reload()  // Hard refresh, loses cart

// If that doesn't work:
// Close tab/browser window completely and reopen
```

---

## 🔧 Advanced Debugging

### Increase chunk size for faster printing
In `bluetooth.js` line 187:
```javascript
const CHUNK_SIZE = 150;  // Increase from 100
const DELAY_MS = 50;     // Decrease from 75
```

### Decrease chunk size for unreliable connections
```javascript
const CHUNK_SIZE = 50;   // Decrease from 100
const DELAY_MS = 150;    // Increase from 75
```

### Monitor Bluetooth events
```javascript
// Add this to app.js init() to log all Bluetooth status changes:
setInterval(() => {
    const status = Bluetooth.getStatus();
    console.log('BT Status:', status.isConnected ? '✅ Connected' : '❌ Disconnected');
}, 5000);
```

---

## 📋 Print Failure Decision Tree

```
Print clicked
    ↓
Printer connected?
    ├─ NO → "Printer not connected" alert
    │        └─ User clicks Bluetooth → pair printer
    │
    └─ YES → Generate receipt
             ↓
          Receipt valid?
             ├─ NO → "Failed to generate receipt" error
             │        └─ Check cart items (null price?)
             │
             └─ YES → Send to printer
                      ↓
                   Send successful?
                      ├─ NO → "Print failed: [error]" + retry option
                      │        └─ User retries or clears cart
                      │
                      └─ YES → Clear cart, show success
                              Receipt printed! ✅
```

---

**Remember:** Check the browser console FIRST for detailed error messages! 99% of issues will have helpful debugging info there.

Good luck! 🎉
