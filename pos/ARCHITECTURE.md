# Technical Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      iOS 15+ Device (Bluefy)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Web Bluetooth POS Application               │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │              User Interface Layer                  │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │   │
│  │  │  │  Header  │  │   Grid   │  │  Payment Modal   │ │  │   │
│  │  │  │ (Status) │  │ (Items)  │  │    (Checkout)    │ │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────────────┘ │  │   │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │   │
│  │  │  │  Keypad  │  │   Cart   │  │  Edit Modal      │ │  │   │
│  │  │  │(Custom)  │  │  (List)  │  │   (Items)        │ │  │   │
│  │  │  └──────────┘  └──────────┘  └──────────────────┘ │  │   │
│  │  │  ┌───────────────────────────────────────────────┐ │  │   │
│  │  │  │    Action Bar (Fixed Bottom)                │ │  │   │
│  │  │  │    Total | Clear | Checkout                 │ │  │   │
│  │  │  └───────────────────────────────────────────────┘ │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                         │                                │   │
│  │                         │ DOM Events                     │   │
│  │                         ▼                                │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │         Application Logic Layer (app.js)          │  │   │
│  │  │                                                    │  │   │
│  │  │  Event Handlers:                                  │  │   │
│  │  │  • Item click / long-press                       │  │   │
│  │  │  • Cart operations (add/remove)                  │  │   │
│  │  │  • Checkout flow                                 │  │   │
│  │  │  • Bluetooth connection management               │  │   │
│  │  │  • Payment selection                             │  │   │
│  │  │  • Print job orchestration                       │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                         │                                │   │
│  │                         │ Calls modules                  │   │
│  │                    ┌────┼─────┬───────────┐             │   │
│  │                    │    │     │           │             │   │
│  │                    ▼    ▼     ▼           ▼             │   │
│  │  ┌──────────┐┌──────────┐┌──────────┐┌──────────────┐  │   │
│  │  │ Storage  ││ Receipt  ││Bluetooth ││   Styles    │  │   │
│  │  │ Module   ││  Module  ││ Module   ││  (CSS only) │  │   │
│  │  │          ││          ││          ││             │  │   │
│  │  │•CRUD ops ││•ESC/POS  ││•BLE conn ││•No logic    │  │   │
│  │  │•Serialize││•Formatting││•Chunking ││             │  │   │
│  │  │•Persist  ││•Timestamps││•Printing ││             │  │   │
│  │  └──────────┘└──────────┘└──────────┘└──────────────┘  │   │
│  │       │            │            │                       │   │
│  │       ▼            ▼            ▼                       │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │          localStorage (Browser Storage)          │   │   │
│  │  │                                                  │   │   │
│  │  │  pos_itemLibrary    | Menu items                │   │   │
│  │  │  pos_cart           | Current transaction       │   │   │
│  │  │  pos_pairedPrinterId| Saved device ID           │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │                                                          │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │         Bluetooth Stack & Protocol                │  │   │
│  │  │                                                    │  │   │
│  │  │  • navigator.bluetooth.requestDevice()            │  │   │
│  │  │  • GATT connection & service discovery            │  │   │
│  │  │  • Characteristic write (chunked)                 │  │   │
│  │  │  • 100-byte chunks with 75ms delays               │  │   │
│  │  │  • Error recovery & reconnection                  │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  │                         │                                │   │
│  └─────────────────────────┼────────────────────────────────┘   │
│                            │ BLE Wireless Link                   │
│                            │ (Secure Radio, 2.4GHz)             │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ 58mm Thermal BLE │
                    │     Printer      │
                    │                  │
                    │ Receives:        │
                    │ • ESC/POS bytes  │
                    │ • Print data     │
                    │                  │
                    │ Outputs:         │
                    │ • Receipt paper  │
                    │ • Status events  │
                    └──────────────────┘
```

## Data Flow Diagram

### Add Item to Cart Flow
```
User taps Item Button
    │
    ├─→ app.js: handleItemClick()
    │   │
    │   ├─→ storage.js: addToCart(item)
    │   │   │
    │   │   └─→ localStorage.setItem('pos_cart', JSON.stringify(cart))
    │   │
    │   ├─→ app.js: updateCartDisplay()
    │   │   │
    │   │   └─→ Update DOM with new cart items
    │   │
    │   └─→ app.js: updateTotalDisplay()
    │       │
    │       └─→ Calculate sum and update UI
    │
    └─→ Visual Feedback
```

### Print Receipt Flow
```
User selects Payment Method
    │
    ├─→ app.js: handlePayment(method)
    │   │
    │   ├─→ Bluetooth.printReceipt(cartItems, method)
    │   │   │
    │   │   ├─→ receipt.js: generateReceipt()
    │   │   │   │
    │   │   │   ├─→ ESC/POS INIT command
    │   │   │   ├─→ Center-align header text
    │   │   │   ├─→ Left-align items with padding
    │   │   │   ├─→ Bold total line
    │   │   │   ├─→ Timestamp functions
    │   │   │   └─→ Return Uint8Array
    │   │   │
    │   │   └─→ bluetooth.js: sendReceipt(receiptData)
    │   │       │
    │   │       ├─→ Loop through receiptData
    │   │       ├─→ Split into 100-byte chunks
    │   │       ├─→ For each chunk:
    │   │       │   ├─→ characteristic.writeValue(chunk)
    │   │       │   └─→ await setTimeout(75ms)
    │   │       │
    │   │       └─→ Send to printer via BLE
    │   │
    │   ├─→ storage.js: clearCart()
    │   │
    │   └─→ Update UI (close modal, show success)
    │
    └─→ Receipt prints on thermal printer
```

### Bluetooth Connection Flow
```
App Loads
    │
    ├─→ bluetooth.js: tryReconnectPaired()
    │   │
    │   ├─→ Check navigator.bluetooth.getDevices()
    │   ├─→ Find device with matching pairedPrinterId
    │   │
    │   └─→ If found:
    │       └─→ bluetooth.js: connectToDevice(device)
    │           │
    │           ├─→ device.gatt.connect()
    │           ├─→ Get all services
    │           ├─→ Scan each service for characteristics
    │           ├─→ Find first writable characteristic
    │           ├─→ Store reference in connectedCharacteristic
    │           │
    │           └─→ Return true (connected)
    │
    └─→ User sees "Connected to [Device]" status

User taps "Connect" (if not auto-connected)
    │
    ├─→ app.js: handleConnect()
    │   │
    │   └─→ bluetooth.js: requestDevice()
    │       │
    │       ├─→ navigator.bluetooth.requestDevice()
    │       │   (Show native device picker)
    │       │
    │       ├─→ User selects device
    │       │
    │       └─→ bluetooth.js: connectToDevice(selectedDevice)
    │           (Same as above)
    │
    └─→ Print ready!
```

## Module Interfaces

### storage.js API
```javascript
Storage = {
  // Lifecycle
  init(),
  
  // Item Library
  getItemLibrary() → Array
  setItemLibrary(items) → void
  updateItem(id, name, price) → void
  
  // Shopping Cart
  getCart() → Array
  addToCart(item) → void
  removeFromCart(cartItemId) → void
  setCart(items) → void
  clearCart() → void
  
  // Printer Pairing
  getPairedPrinterId() → string
  setPairedPrinterId(deviceId) → void
  clearPairedPrinterId() → void
}
```

### receipt.js API
```javascript
Receipt = {
  // Receipt Generation
  generateReceipt(cartItems, paymentMethod) → Uint8Array
  
  // Utilities
  formatPrice(amount) → string ($X.XX)
  padLine(name, price) → string (32 chars)
  getInvoiceNumber() → string (HHMMSS)
  getDate() → string (DD/MM/YYYY)
  getTime() → string (HH:MM)
}
```

### bluetooth.js API
```javascript
Bluetooth = {
  // Status
  isAvailable() → boolean
  getStatus() → {isConnected, deviceName, deviceId}
  
  // Connection Management
  tryReconnectPaired() → Promise<boolean>
  requestDevice() → Promise<boolean>
  connectToDevice(device) → Promise<boolean>
  disconnect() → void
  
  // Print Operations
  sendReceipt(receiptData) → Promise<boolean>
  printReceipt(cartItems, paymentMethod) → Promise<boolean>
}
```

### app.js (No exported API)
```javascript
// Self-contained module, no public API
// Initialize: App.init() called on DOMContentLoaded
// Event handlers attached to DOM elements
// All logic internal to module
```

## State Management Model

```
┌─────────────────────────────────────────────────────────┐
│              Application State (RAM)                     │
│                                                          │
│  app.js:                                                 │
│  - editingItemId: number | null                         │
│  - No persistent state (read from localStorage)         │
│                                                          │
│  bluetooth.js:                                           │
│  - connectedDevice: BluetoothDevice | null             │
│  - connectedCharacteristic: BluetoothRemoteCharacteristic
│  - isConnected: boolean                                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
                         │
         Every operation syncs to localStorage
                         ▼
┌─────────────────────────────────────────────────────────┐
│          Persistent State (localStorage)                 │
│                                                          │
│  pos_itemLibrary:                                        │
│  [                                                       │
│    { id: 1, name: "Chicken Rice", price: 5.50 },       │
│    { id: 2, name: "Pork Noodles", price: 6.00 },       │
│    ...                                                   │
│  ]                                                       │
│                                                          │
│  pos_cart:                                               │
│  [                                                       │
│    { id: "random-id", name: "Chicken Rice", price: 5.50}
│    { id: "random-id", name: "Custom Item", price: 15.00}
│  ]                                                       │
│                                                          │
│  pos_pairedPrinterId:                                   │
│  "a1b2c3d4-e5f6-7890-abcd-ef1234567890"                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## ESC/POS Print Command Sequence

```
Byte Stream to Printer (Example):

[0x1B, 0x40]              → INIT (Reset printer)
[0x1B, 0x61, 0x01]        → CENTER align
[72, 101, 108, 108, 111]  → "Hello" (ASCII text)
[0x0A]                    → LINEFEED (new line)
[0x1B, 0x61, 0x00]        → LEFT align
[text bytes...]           → Item text
[0x0A]                    → LINEFEED
... (repeat for each item)
[0x1B, 0x45, 0x01]        → BOLD ON
[text bytes...]           → Total text
[0x1B, 0x45, 0x00]        → BOLD OFF
[0x0A, 0x0A, 0x0A]        → 3x LINEFEED
[0x1D, 0x56, 0x42, 0x00]  → CUT PAPER (or fallback to 4x LF)

```

## BLE Chunking Algorithm

```
Input: receiptData (Uint8Array, e.g., 2048 bytes)

CHUNK_SIZE = 100 bytes
DELAY_MS = 75 milliseconds

for i = 0; i < receiptData.length; i += CHUNK_SIZE:
    chunk = receiptData.slice(i, i + CHUNK_SIZE)
    
    await characteristic.writeValue(chunk)
    
    if i + CHUNK_SIZE < receiptData.length:
        await sleep(DELAY_MS)
        
// Example with 250-byte receipt:
// Chunk 1: bytes 0-99 (100 bytes)     → send → wait 75ms
// Chunk 2: bytes 100-199 (100 bytes)  → send → wait 75ms
// Chunk 3: bytes 200-249 (50 bytes)   → send → done (no wait)
```

## Touch Event Handling

```
Item Button:
    touchstart → Set pressTimer = setTimeout(500ms)
    touchend → Clear pressTimer
    
    If pressTimer completed:
        → Long-press detected
        → Open edit modal
    Else:
        → Tap detected
        → Add to cart

Keypad:
    click → Immediate input
    (No delay needed)

Cart Item X Button:
    click → Immediate removal
    (No delay needed)

Modal Background:
    click → Close modal
    (Event delegation on modal div)
```

## Performance Characteristics

```
Operation         Complexity  Time (typical)  Notes
─────────────────────────────────────────────────
Load app          O(1)        500ms          No build, direct load
Render grid       O(n)        20ms           n = 8 items
Add to cart       O(1)        5ms            Direct push
Remove from cart  O(n)        10ms           n = cart size
Print receipt     O(n)        200-300ms      n = chunk count
Update cart UI    O(n)        30ms           n = cart size
Calculate total   O(n)        <5ms           n = cart size
Generate receipt  O(n)        50ms           n = item count
Chunk & send      O(n)        200ms          n = 2000/100 = 20 chunks

Total for checkout: ~500ms (UI) + 250ms (print) = ~750ms

Key: Operation is perceived instantly to users
```

## Error Handling Strategy

```
Bluetooth Errors:
├─ DeviceNotFoundError
│  └─ User message: "Printer not found"
├─ SecurityError (no permission)
│  └─ User message: "Bluetooth access denied"
└─ NetworkError (write failed)
   └─ User message: "Print failed: connection lost"

Storage Errors:
├─ QuotaExceededError (very rare, >5MB)
│  └─ Auto-fallback to defaults
└─ JSON parse error
   └─ Auto-fallback to defaults

Input Errors:
├─ Invalid price (negative/NaN)
│  └─ Validation + alert
├─ Empty item name
│  └─ Validation + alert
└─ Empty cart checkout
   └─ Alert + prevent action

All errors logged to console for debugging
User-facing errors shown via alert/overlay
No silent failures
```

## Security Model

```
Data Security:
├─ localStorage: Client-side only
│  └─ Survives browser close
│  └─ No encryption (encrypted at rest by OS)
├─ Bluetooth: Device pairing
│  └─ BLE is encrypted at radio level
│  └─ Device must be authorized
└─ Network: HTTPS only
   └─ All data transmitted encrypted
   └─ Prevents MITM attacks

Privacy:
├─ No external API calls (completely offline capable)
├─ No analytics or tracking
├─ No user data transmitted
├─ All transaction data stays on device
└─ Printer doesn't store data

Authentication:
├─ No user accounts
├─ No password authentication
├─ Device-level Bluetooth pairing serves as auth
└─ Single-device operation (no multi-user)
```

---

**Last Updated:** October 23, 2026  
**Status:** Architecture Finalized  
**Target:** Bluefy on iOS 15+
