# St. Thomas POS

A mobile-first, browser-based POS for iOS and other supported browsers. It uses Web Bluetooth for 58 mm receipt printers and browser storage for carts, setup, and transaction history.

## Run

Serve the project from an HTTPS origin:

```text
https://your-host.example/
```

Web Bluetooth requires a compatible browser and secure context. Bluefy is the supported iOS browser for this app.

Open `index.html` from the server and:

1. Open the cart and tap the Bluetooth badge.
2. Select the thermal printer.
3. Configure receipt details under Menu > Setup.
4. Add items and complete checkout.

## Core Features

- Word-cloud and custom amount cart entry
- Cash, NETS, PayNow, Visa/Mastercard, Alipay, and UnionPay payment selection
- 32-character, 58 mm ESC/POS receipt formatting
- PayNow UEN QR checkout
- Printer reconnect by remembered printer ID and name
- IndexedDB transaction history
- Search and date/payment filtering
- CSV and JSON export, including iOS share sheet support where available
- JSON/CSV history import
- Receipt reprinting
- Full, partial, and custom refunds
- X and Z sales reports
- Transaction Bin and restore

## File Map

```text
index.html    Application markup and modals
styles.css    Mobile-responsive layout and modal styling
app.js        Application workflows and UI event handling
storage.js    localStorage preferences and cart persistence
history.js    IndexedDB history, Bin, reports, and migration logic
receipt.js    Receipt and sales-report ESC/POS generation
bluetooth.js  Printer discovery, reconnection, and transmission
docs/         Detailed documentation
```

## Storage

- `localStorage` holds the cart, printer ID/name, receipt setup, word-cloud settings, and selected options.
- IndexedDB database `st_thomas_pos` holds versioned transaction, shift, and Z-report records.

## Documentation

- [Usage and operations](docs/USAGE.md)
- [Architecture and configuration](docs/ARCHITECTURE.md)
