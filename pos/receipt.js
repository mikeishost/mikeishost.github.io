/**
 * Receipt Generation & ESC/POS Formatting Module
 * Handles receipt layout, string padding, and ESC/POS command encoding
 */

const Receipt = (() => {
    // ESC/POS Command Codes
    const COMMANDS = {
        INIT: [0x1b, 0x40],
        CENTER: [0x1b, 0x61, 0x01],
        LEFT: [0x1b, 0x61, 0x00],
        BOLD_ON: [0x1b, 0x45, 0x01],
        BOLD_OFF: [0x1b, 0x45, 0x00],
        LINEFEED: [0x0a],
        CUT: [0x1d, 0x56, 0x42, 0x00]
    };

    // 32-character line width for standard 58mm thermal printers
    const LINE_WIDTH = 32;

    /**
     * Convert string to Uint8Array
     */
    const stringToBytes = (str) => {
        const bytes = [];
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i));
        }
        return bytes;
    };

    /**
     * Pad string to left-align name and right-align price
     * Logic: 32 - (item.name.length + item.price.length) = spaces
     */
    const padLine = (name, price) => {
        // Truncate name if too long
        let displayName = name;
        if (displayName.length + price.length >= LINE_WIDTH) {
            displayName = displayName.substring(0, LINE_WIDTH - price.length - 1);
        }

        const spaces = LINE_WIDTH - (displayName.length + price.length);
        return displayName + ' '.repeat(Math.max(1, spaces)) + price;
    };

    /**
     * Format currency as string
     */
    const formatPrice = (price) => {
        return '$' + price.toFixed(2);
    };

    /**
     * Get current time in HHMMSS format for invoice number
     */
    const getInvoiceNumber = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return hours + minutes + seconds;
    };

    /**
     * Get current date in DD/MM/YYYY format
     */
    const getDate = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        return day + '/' + month + '/' + year;
    };

    /**
     * Get current time in HH:MM format
     */
    const getTime = () => {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return hours + ':' + minutes;
    };

    /**
     * Merge arrays of bytes
     */
    const mergeBytes = (arrays) => {
        let total = 0;
        for (let i = 0; i < arrays.length; i++) {
            total += arrays[i].length;
        }
        const result = new Uint8Array(total);
        let offset = 0;
        for (let i = 0; i < arrays.length; i++) {
            result.set(arrays[i], offset);
            offset += arrays[i].length;
        }
        return result;
    };

    /**
     * Generate complete receipt as Uint8Array
     * Including ESC/POS commands, headers, items, total, etc.
     */
    const generateReceipt = (cartItems, paymentMethod) => {
        if (!cartItems || cartItems.length === 0) {
            console.error('No items in cart');
            return null;
        }

        const receiptBytes = [];

        // Initialize printer
        receiptBytes.push(COMMANDS.INIT);

        // Header - Center aligned
        receiptBytes.push(COMMANDS.CENTER);
        receiptBytes.push(stringToBytes('St. Thomas @ Surprisesss'));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('211 New Bridge Road'));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('Lucky Chinatown B1-01 to 05'));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('Singapore 059432'));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('Tel: 6323-0337'));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Blank line
        receiptBytes.push(COMMANDS.LINEFEED);

        // Invoice and Date/Time info - Left aligned
        receiptBytes.push(COMMANDS.LEFT);
        receiptBytes.push(stringToBytes('Invoice: ' + getInvoiceNumber()));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('Date: ' + getDate()));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('Time: ' + getTime()));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Blank line
        receiptBytes.push(COMMANDS.LINEFEED);

        // Item header
        receiptBytes.push(stringToBytes('Item Name             Price'));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Separator line (32 dashes)
        receiptBytes.push(stringToBytes('--------------------------------'));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Items
        let total = 0;
        for (let i = 0; i < cartItems.length; i++) {
            const item = cartItems[i];
            const qty = item.quantity || 1;
            const unitPrice = parseFloat(item.price) || 0;
            const lineTotal = unitPrice * qty;
            total += lineTotal;

            // Format item name with quantity if > 1
            const itemName = qty > 1 ? `${item.name} x${qty}` : item.name;
            const priceStr = formatPrice(lineTotal);
            const line = padLine(itemName, priceStr);
            receiptBytes.push(stringToBytes(line));
            receiptBytes.push(COMMANDS.LINEFEED);
        }

        // Separator line
        receiptBytes.push(stringToBytes('--------------------------------'));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Total line with bold
        receiptBytes.push(COMMANDS.BOLD_ON);
        const totalStr = formatPrice(total);
        const totalLine = padLine('Total', totalStr);
        receiptBytes.push(stringToBytes(totalLine));
        receiptBytes.push(COMMANDS.BOLD_OFF);
        receiptBytes.push(COMMANDS.LINEFEED);

        // Payment method
        receiptBytes.push(stringToBytes('Paid via ' + paymentMethod));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Blank lines for tear-off
        receiptBytes.push(COMMANDS.LINEFEED);
        receiptBytes.push(COMMANDS.LINEFEED);
        receiptBytes.push(COMMANDS.LINEFEED);

        // Cut command (or fallback to line feeds)
        receiptBytes.push(COMMANDS.CUT);

        // Merge all bytes into single Uint8Array
        return mergeBytes(receiptBytes);
    };

    // Public API
    return {
        generateReceipt,
        formatPrice,
        padLine,
        getInvoiceNumber,
        getDate,
        getTime
    };
})();
