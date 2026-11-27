# St. Thomas POS - Bluefy-Compatible iOS Point of Sale Application

A lightning-fast, client-side-only Point of Sale (POS) Single Page Application (SPA) designed for iOS using the Bluefy Web Browser and Web Bluetooth API to connect with 58mm thermal printers.

## Features

✨ **Core Functionality**
- Mobile-first, touch-optimized UI designed for iOS
- Quick-add item grid with 6-8 default items
- Long-press to edit item names and prices (saved to localStorage)
- Manual numeric keypad for custom amounts
- Shopping cart with swipe/tap-to-remove items
- Real-time total calculation
- Payment method selection (Cash, NETS, PayNow, Visa/Mastercard)

🔗 **Bluetooth Integration**
- Web Bluetooth API support for BLE thermal printers (58mm standard)
- Automatic device reconnection to previously paired printer
- Safe chunked transmission (100-byte chunks with 50-100ms delays)
- Full ESC/POS thermal printer command support

💾 **State Management**
- Complete localStorage persistence
- Auto-save on every cart modification
- Survives page reloads and browser close/reopen

📝 **Receipt Generation**
- Professional 32-character format for 58mm thermal printers
- Dynamic invoice numbers (HHMMSS format)
- Date and time stamps
- Smart string padding (left-align names, right-align prices)
- ESC/POS formatted output with bold, centering, line feeds
- Built-in paper cut commands

## Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, ES6+ JavaScript
- **No build tools:** Runs directly in browser (no Webpack, Vite, or frameworks)
- **Storage:** Browser localStorage for all state persistence
- **Target Browser:** Bluefy Web Browser on iOS 15+
- **Connectivity:** Web Bluetooth API (requires iOS 15+)

## File Structure

```
index.html          - Main HTML structure and UI markup
styles.css          - Mobile-first responsive styling
storage.js          - localStorage state management module
receipt.js          - Receipt generation & ESC/POS encoding
bluetooth.js        - Web Bluetooth API wrapper & print logic
app.js              - Main application controller
```

## Quick Start

### Prerequisites
- iOS 15+ device with Bluefy Web Browser installed
- 58mm BLE (Bluetooth Low Energy) thermal printer
- Printer must be discoverable and support standard BLE GATT

### Installation

1. **Copy files to web server:**
   ```bash
   # Place all files on a publicly accessible HTTPS web server
   # (HTTPS is required for Web Bluetooth API)
   ```

2. **Open in Bluefy:**
   - Launch Bluefy Web Browser on iOS
   - Navigate to your server URL (must be HTTPS)
   - Allow Bluetooth permissions when prompted

3. **First Use:**
   - Tap "Connect" button to scan for available BLE devices
   - Select your 58mm thermal printer
   - Device ID will be saved for automatic reconnection

## Usage

### Adding Items to Cart

**Quick Add:**
- Tap any item button (6-8 grid) to add to cart

**Long-Press Edit:**
- Press and hold (500ms) on any item to edit name and price
- Changes are saved to localStorage and applied immediately

**Custom Amount:**
- Use numeric keypad (0-9, decimal)
- Tap "Add" to add custom amount as "Custom Item"
- Backspace button (⌫) to delete last digit

### Checkout & Payment

1. **View Cart:**
   - Current items display with individual prices
   - Total amount shown in action bar
   - Tap X button on any item to remove

2. **Checkout:**
   - Tap "Checkout" button to open payment modal
   - Select payment method: Cash, NETS, PayNow, or Visa/Mastercard
   - Receipt automatically prints to connected printer
   - Cart clears after successful print

3. **Disconnect:**
   - Tap "Connect" button (changes to "Disconnect" when connected)
   - Status indicator shows connection state

## Receipt Format

Default receipt includes:
```
         St. Thomas @ Surprisesss
         211 New Bridge Road
         Lucky Chinatown B1-01 to 05
         Singapore 059432
         Tel: 6323-0337

Invoice: HHMMSS
Date: DD/MM/YYYY
Time: HH:MM

Item Name             Price
--------------------------------
[Item 1]              $X.XX
[Item 2]              $X.XX
...
--------------------------------
Total $               $XXX.XX
Paid via [Method]
```

## localStorage Schema

### `pos_itemLibrary`
Array of item objects with `id`, `name`, and `price` properties.
```javascript
[
  { id: 1, name: "Chicken Rice", price: 5.50 },
  { id: 2, name: "Pork Noodles", price: 6.00 },
  // ... more items
]
```

### `pos_cart`
Array of items in current transaction, each with unique cart item ID.
```javascript
[
  { id: "abc123xyz", name: "Chicken Rice", price: 5.50 },
  { id: "def456uvw", name: "Pork Noodles", price: 6.00 }
]
```

### `pos_pairedPrinterId`
String storing the device ID of the last paired printer for fast reconnection.

## ESC/POS Commands Supported

| Command | Code | Purpose |
|---------|------|---------|
| INIT | `[0x1B, 0x40]` | Initialize printer |
| CENTER | `[0x1B, 0x61, 0x01]` | Center align text |
| LEFT | `[0x1B, 0x61, 0x00]` | Left align text |
| BOLD_ON | `[0x1B, 0x45, 0x01]` | Enable bold font |
| BOLD_OFF | `[0x1B, 0x45, 0x00]` | Disable bold font |
| LINEFEED | `[0x0A]` | Add line feed |
| CUT | `[0x1D, 0x56, 0x42, 0x00]` | Cut paper (or 4 line feeds) |

## Printer Compatibility

Tested compatible with:
- Generic Chinese 58mm BLE thermal printers
- Printers supporting standard Generic Access services
- Devices with GATT write characteristics

**Note:** Some printers may use custom UART UUIDs. The application automatically scans all available services and characteristics to find the first writable endpoint.

## Print Transmission Details

- **Chunk Size:** 100 bytes per transmission
- **Delay Between Chunks:** 75ms (adjustable 50-100ms)
- **Anti-Crash Feature:** Prevents buffer overflow on cheap BLE printers with small buffers (typically 512 bytes)

## Browser Compatibility

| Browser | iOS | Support |
|---------|-----|---------|
| Bluefy | 15+ | ✅ Full |
| Safari | 15+ | ⚠️ Limited (no prompt API) |
| Chrome | 48+ | ✅ On Android |

**Important:** Standard Safari on iOS does not support Web Bluetooth due to Apple's restrictions. Use Bluefy instead.

## Configuration & Customization

### Change Receipt Header
Edit the hardcoded header in `receipt.js` line ~90:
```javascript
receiptBytes.push(stringToBytes('Your Store Name'));
```

### Adjust Chunk Size
In `bluetooth.js` line ~144, change `CHUNK_SIZE`:
```javascript
const CHUNK_SIZE = 100; // Increase for faster printers, decrease for slower
```

### Change Delay Between Chunks
In `bluetooth.js` line ~145, adjust `DELAY_MS`:
```javascript
const DELAY_MS = 75; // Increase if printer cuts off, decrease if timeout
```

### Modify Default Item Library
Edit the `DEFAULT_ITEMS` array in `storage.js` starting at line ~14.

## Troubleshooting

### "Web Bluetooth not available"
- Confirm you're using Bluefy or compatible browser with Web Bluetooth support
- Check iOS version is 15+
- Verify HTTPS connection (Web Bluetooth requires secure context)

### Printer not found during scan
- Ensure printer is powered on and in pairing mode
- Check printer BLE is enabled
- Try moving closer to device
- Restart Bluefy and retry

### Print cuts off or prints incomplete
- Increase `DELAY_MS` in `bluetooth.js` (50-150ms range)
- Decrease `CHUNK_SIZE` if experiencing repeated cutoffs
- Check printer buffer size documentation

### Cannot reconnect to paired printer
- Printer may have reset pairing
- Tap "Connect" to rescan and pair again
- Clear browser data to reset `pos_pairedPrinterId` in localStorage

### Receipt format looks off
- Verify printer supports standard ESC/POS commands
- Check if printer uses non-standard character encoding
- Test print with different item names/amounts

## Performance Considerations

- **Lightweight:** All JavaScript is vanilla, no dependencies
- **Fast Startup:** No build process or bundling needed
- **Instant Print:** Direct BLE connection, no server round-trips
- **Offline Ready:** Fully functional without internet connection (once loaded)

## Security & Privacy

- All data stored locally on device via localStorage
- No data sent to external servers
- Bluetooth connection is local-only (not transmitted)
- No tracking, analytics, or telemetry

## License & Support

This application is provided as-is for point-of-sale operations. For issues or feature requests, refer to the technical specification document.

---

**Built for:** St. Thomas @ Surprisesss  
**Tech Stack:** Vanilla HTML5 + CSS3 + ES6+ JavaScript  
**Target:** Bluefy Web Browser on iOS 15+
