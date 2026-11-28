# Usage

## Cart

Tap a category or custom amount, then open the cart from the total button.

- Quantity buttons adjust item quantities.
- Close returns to the main screen.
- Checkout opens payment selection.
- A successful print clears the cart.
- If printing fails, the transaction remains in History and can be reprinted later.

## Receipt Setup

Open Menu > Setup.

The fields are:

- Store name
- Address line 1
- Address line 2
- Address line 3
- Phone

Each field is limited to a 32-character 58 mm receipt line. Phone text is printed with `Tel:` before it. Values are saved in `localStorage`.

## Printer

The app remembers the most recently authorized printer ID and name. On startup and before printing, it attempts silent reconnect through Web Bluetooth.

Silent reconnect is not guaranteed on every iOS browser or after Bluetooth permissions change. If reconnection fails, tap the printer badge to select it again.

## History

Open Menu > History.

History provides:

- Invoice/item search
- Date range filtering
- Payment-method filtering
- CSV and JSON export
- JSON/CSV import
- Transaction details
- Reprint
- Record a full or partial refund against the transaction
- Delete an open transaction to the Bin

Export uses the iOS share sheet when Web Share supports files. Otherwise, it downloads the file normally.

## Refunds

Open Menu > Refund to record a custom refund without linking it to an earlier sale.
To refund a previous transaction, open it in History and select Refund. Select all
remaining items for a full refund, or choose individual quantities for a partial
refund.

Refunds create separate negative transactions and do not edit or delete the original
sale. Repeated partial refunds cannot exceed the original item quantities. Because
this POS does not track inventory, refunds do not change stock.

## Bin

Open History > Bin.

Transactions in the Bin can be restored. Items in the Bin are permanently removed only when a Z Report closes the shift.

## X Report

An X Report shows the current shift without closing it. It includes:

- Gross sales
- Transaction count
- Item quantity
- Payment-method totals
- Item totals

## Z Report

A Z Report asks for confirmation, creates an immutable shift snapshot, and begins a new shift period.

The Z Report:

- Includes transactions from the current shift
- Permanently removes Bin transactions
- Marks period transactions as Z-closed
- Prevents Z-closed transactions from being deleted

## Delete All

Delete All requires confirmation and permanently removes transaction history and Z reports. It also begins a fresh current shift.

## Import

JSON imports accept either:

- A transaction array
- An object containing a `transactions` array

CSV imports accept files exported by this POS. Imports preserve invoice, date, payment, status, item, quantity, and price fields.
