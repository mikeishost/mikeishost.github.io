# Architecture

## Runtime

This is a dependency-free client application:

- HTML/CSS/ES6 JavaScript
- No build step
- No server-side application or database
- HTTPS required for Web Bluetooth

## Modules

### `storage.js`

Manages:

- Cart state
- Receipt setup
- Printer ID and name
- Word-cloud configuration
- Selected words

### `history.js`

Manages IndexedDB database `st_thomas_pos`:

- `transactions` object store
- `salesReports` object store
- `shiftState` object store

Transaction values use integer cents. Records include stable IDs, invoice numbers, timestamps, payment status, print status, reprint metadata, item snapshots, receipt configuration, Bin state, and Z-close metadata.

Refunds are separate negative transactions. Linked refunds retain the original
transaction/invoice reference and source item index; previous sales are
not modified. Item quantities are signed so refund totals and payment summaries
can distinguish refunds from sales.

The database uses the IndexedDB upgrade mechanism. Missing fields are normalized when records are read, so older records remain usable.

### `receipt.js`

Generates ESC/POS receipt bytes, including:

- Centered and left-aligned text
- Bold totals
- 32-character line formatting
- Paper cut commands
- X/Z sales reports
- Original transaction date and setup for reprints

### `bluetooth.js`

Manages:

- Browser Bluetooth availability
- Printer scanning and pairing
- GATT characteristic discovery
- Printer reconnection
- Chunked receipt transmission
- Device disconnection state

### `app.js`

Coordinates UI workflows, confirmation prompts, history actions, checkout, and printer/report operations.

## Reliability Rules

- Save sales history before clearing the cart or final checkout state.
- Store item snapshots and cents, not live mutable item references.
- Mark print failures instead of discarding sales.
- Do not add a transaction twice during retry flows.
- Reprint without changing the original invoice or transaction data.
- Keep Bin moves separate from permanent deletion.
- Only Z close permanently removes Bin transactions.

## Browser Support

Web Bluetooth support varies. Bluefy is the intended iOS browser. Safari does not provide the same Web Bluetooth API. IndexedDB and Web Share availability are also browser-dependent.
