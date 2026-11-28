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
        return (price < 0 ? '-$' : '$') + Math.abs(price).toFixed(2);
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
     * Generate an ESC/POS X or Z sales report
     */
    const generateSalesReport = (report) => {
        const receiptConfig = Storage.getReceiptConfig();
        const bytes = [];
        const formatMoney = (cents) => '$' + ((Number(cents) || 0) / 100).toFixed(2);
        const formatDateTime = (iso) => {
            const date = new Date(iso);
            return Number.isNaN(date.getTime())
                ? normalizeText(iso)
                : date.toLocaleString([], {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
        };
        const normalizeText = (value) => typeof value === 'string' ? value : '';
        const pushLine = (text) => {
            bytes.push(stringToBytes(normalizeText(text)));
            bytes.push(COMMANDS.LINEFEED);
        };

        bytes.push(COMMANDS.INIT);
        bytes.push(COMMANDS.CENTER);
        pushLine(receiptConfig.name);
        pushLine(receiptConfig.addressLine1);
        pushLine(receiptConfig.addressLine2);
        pushLine(receiptConfig.addressLine3);
        pushLine('Tel: ' + receiptConfig.phone);
        bytes.push(COMMANDS.LINEFEED);
        bytes.push(COMMANDS.BOLD_ON);
        pushLine(report.type + ' REPORT');
        bytes.push(COMMANDS.BOLD_OFF);
        bytes.push(COMMANDS.LEFT);
        pushLine('Period start: ' + formatDateTime(report.openedAt));
        pushLine('Generated: ' + formatDateTime(report.generatedAt));
        pushLine('--------------------------------');

        bytes.push(COMMANDS.BOLD_ON);
        pushLine(padLine('Gross sales', formatMoney(report.grossCents)));
        const refundCents = Number(report.refundCents) || 0;
        const netCents = Number.isInteger(report.netCents)
            ? report.netCents
            : (Number(report.grossCents) || 0);
        pushLine(padLine('Refunds', '-' + formatMoney(refundCents)));
        pushLine(padLine('Net sales', formatMoney(netCents)));
        pushLine(padLine('Transactions', String(report.transactionCount)));
        pushLine(padLine('Refund count', String(report.refundCount || 0)));
        pushLine(padLine('Items sold', String(report.itemCount)));
        bytes.push(COMMANDS.BOLD_OFF);
        pushLine('--------------------------------');

        pushLine('Payment summary');
        Object.entries(report.payments || {}).forEach(([payment, cents]) => {
            pushLine(padLine(payment, formatMoney(cents)));
        });
        pushLine('--------------------------------');

        pushLine('Item summary');
        (report.items || []).forEach((item) => {
            const label = item.quantity + ' x ' + item.name;
            pushLine(padLine(label, formatMoney(item.totalCents)));
        });

        pushLine('--------------------------------');
        pushLine(report.type === 'Z' ? 'Shift closed' : 'Shift remains open');
        bytes.push(COMMANDS.LINEFEED);
        bytes.push(COMMANDS.LINEFEED);
        bytes.push(COMMANDS.CUT);
        return mergeBytes(bytes);
    };

    /**
     * Generate complete receipt as Uint8Array
     * Including ESC/POS commands, headers, items, total, etc.
     */
    const generateReceipt = (cartItems, paymentMethod, invoiceNumber = null, options = {}) => {
        if (!cartItems || cartItems.length === 0) {
            console.error('No items in cart');
            return null;
        }

        const receiptBytes = [];
        const isRefund = options.refund === true;
        const receiptConfig = options.receiptConfig && typeof options.receiptConfig === 'object'
            ? options.receiptConfig
            : Storage.getReceiptConfig();
        const receiptDate = options.createdAt ? new Date(options.createdAt) : null;
        const originalDate = receiptDate && !Number.isNaN(receiptDate.getTime())
            ? receiptDate
            : new Date();

        // Initialize printer
        receiptBytes.push(COMMANDS.INIT);

        // Header - Center aligned
        receiptBytes.push(COMMANDS.CENTER);
        receiptBytes.push(stringToBytes(receiptConfig.name));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes(receiptConfig.addressLine1));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes(receiptConfig.addressLine2));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes(receiptConfig.addressLine3));
        receiptBytes.push(COMMANDS.LINEFEED);

        receiptBytes.push(stringToBytes('Tel: ' + receiptConfig.phone));
        receiptBytes.push(COMMANDS.LINEFEED);

        // Blank line
        receiptBytes.push(COMMANDS.LINEFEED);

        // Invoice and Date/Time info - Left aligned
        receiptBytes.push(COMMANDS.LEFT);
        if (isRefund) {
            receiptBytes.push(COMMANDS.BOLD_ON);
            receiptBytes.push(stringToBytes('REFUND'));
            receiptBytes.push(COMMANDS.BOLD_OFF);
            receiptBytes.push(COMMANDS.LINEFEED);
        }
        receiptBytes.push(stringToBytes('Invoice: ' + (invoiceNumber || getInvoiceNumber())));
        receiptBytes.push(COMMANDS.LINEFEED);

        const originalDay = String(originalDate.getDate()).padStart(2, '0');
        const originalMonth = String(originalDate.getMonth() + 1).padStart(2, '0');
        const originalYear = originalDate.getFullYear();
        receiptBytes.push(stringToBytes('Date: ' + `${originalDay}/${originalMonth}/${originalYear}`));
        receiptBytes.push(COMMANDS.LINEFEED);

        const originalHours = String(originalDate.getHours()).padStart(2, '0');
        const originalMinutes = String(originalDate.getMinutes()).padStart(2, '0');
        receiptBytes.push(stringToBytes('Time: ' + `${originalHours}:${originalMinutes}`));
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
            const qty = Math.abs(item.quantity || 1);
            const unitPrice = Math.abs(parseFloat(item.price) || 0);
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
        const totalStr = formatPrice(isRefund ? -total : total);
        const totalLine = padLine(isRefund ? 'Refund total' : 'Total', totalStr);
        receiptBytes.push(stringToBytes(totalLine));
        receiptBytes.push(COMMANDS.BOLD_OFF);
        receiptBytes.push(COMMANDS.LINEFEED);

        // Payment method
        receiptBytes.push(stringToBytes((isRefund ? 'Refunded via ' : 'Paid via ') + paymentMethod));
        receiptBytes.push(COMMANDS.LINEFEED);

        if (isRefund && options.originalInvoice) {
            receiptBytes.push(stringToBytes('Original: ' + options.originalInvoice));
            receiptBytes.push(COMMANDS.LINEFEED);
        }

        if (options.reprint) {
            receiptBytes.push(stringToBytes('REPRINT'));
            receiptBytes.push(COMMANDS.LINEFEED);
        }

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
        generateSalesReport,
        formatPrice,
        padLine,
        getInvoiceNumber,
        getDate,
        getTime
    };
})();
