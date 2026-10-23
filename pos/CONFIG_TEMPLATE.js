/**
 * CONFIGURATION TEMPLATE
 * 
 * Copy the relevant sections to customize your POS app before deployment.
 * Instructions are provided for each section.
 */

// ============================================
// 1. STORE INFORMATION (receipt.js)
// ============================================
// Location: receipt.js, around line 90 in generateReceipt() function
// Change these lines to your store details:

const STORE_CONFIG = {
    name: 'St. Thomas @ Surprisesss',
    address_line_1: '211 New Bridge Road',
    address_line_2: 'Lucky Chinatown B1-01 to 05',
    address_line_3: 'Singapore 059432',
    phone: '6323-0337'
};

// HOW TO APPLY:
// In receipt.js, find the header section (around line 90):
/*
receiptBytes.push(stringToBytes('St. Thomas @ Surprisesss'));
receiptBytes.push(COMMANDS.LINEFEED);
receiptBytes.push(stringToBytes('211 New Bridge Road'));
receiptBytes.push(COMMANDS.LINEFEED);
receiptBytes.push(stringToBytes('Lucky Chinatown B1-01 to 05'));
receiptBytes.push(COMMANDS.LINEFEED);
receiptBytes.push(stringToBytes('Singapore 059432'));
receiptBytes.push(COMMANDS.LINEFEED);
receiptBytes.push(stringToBytes('Tel: 6323-0337'));
*/

// Replace with your store details above.


// ============================================
// 2. MENU ITEMS (storage.js)
// ============================================
// Location: storage.js, around line 14
// Change DEFAULT_ITEMS array to match your menu

const MENU_TEMPLATE = [
    { id: 1, name: 'Chicken Rice', price: 5.50 },
    { id: 2, name: 'Pork Noodles', price: 6.00 },
    { id: 3, name: 'Fish Soup', price: 7.50 },
    { id: 4, name: 'Egg Fried Rice', price: 5.00 },
    { id: 5, name: 'Spring Rolls', price: 4.00 },
    { id: 6, name: 'Laksa', price: 6.50 },
    { id: 7, name: 'Teh Tarik', price: 2.50 },
    { id: 8, name: 'Kopi', price: 2.00 }
];

// TIPS:
// - IDs should be sequential (1, 2, 3...)
// - Names should be under 25 characters for proper receipt formatting
// - Prices should be positive numbers with up to 2 decimal places
// - Grid will display up to 8 items (2-4 columns depending on device width)
// - You can add more items; grid will scroll


// ============================================
// 3. UI COLORS (styles.css)
// ============================================
// Location: styles.css, around line 8
// Customize the CSS variable :root section

const COLOR_TEMPLATE = {
    primary: '#1a73e8',          // Main brand color (buttons, headers)
    primary_dark: '#1565c0',     // Darker variant for hover
    secondary: '#34a853',        // Accent color (checkout, success)
    danger: '#d33427',           // Delete/remove actions
    warning: '#fbbc04',          // Warning messages
    background: '#f8f9fa',       // Page background
    surface: '#ffffff',          // Card/modal backgrounds
    text_primary: '#202124',     // Main text
    text_secondary: '#5f6368',   // Secondary text
    border: '#dadce0'            // Borders
};

// HOW TO APPLY:
// In styles.css, find :root { ... } section and update:
/*
:root {
    --primary-color: #your-color;
    --primary-dark: #your-dark-color;
    --secondary-color: #your-accent;
    ... (rest of colors)
}
*/

// RECOMMENDED PALETTE:
// Google Colors (current) - Professional, accessible
// Material Design - Primary: #1976D2, Accent: #F57C00
// Custom Brand - Use your brand's primary color


// ============================================
// 4. PRINT SETTINGS (bluetooth.js)
// ============================================
// Location: bluetooth.js, around line 144 in sendReceipt()

const PRINT_CONFIG = {
    chunk_size: 100,      // Bytes per BLE transmission
    delay_ms: 75          // Milliseconds between chunks
};

// TROUBLESHOOTING GUIDE:
// 
// Problem: Receipt prints fine
// Solution: Keep current settings
//
// Problem: Receipt cuts off mid-way
// Solution: Increase delay_ms (try 100-150ms)
//           Decrease chunk_size (try 50-75 bytes)
//
// Problem: Printer disconnects during print
// Solution: Increase delay_ms to 150-200ms
//           Check printer documentation for buffer size
//
// Problem: Print is slow/takes 30+ seconds
// Solution: This is normal for cheap BLE printers
//           Your printer's buffer is likely very small (~512 bytes)

// PRINTER-SPECIFIC SETTINGS:
const PRINTER_PROFILES = {
    generic_chinese: {
        chunk_size: 100,
        delay_ms: 75
    },
    cheap_buffer: {
        chunk_size: 50,
        delay_ms: 150
    },
    fast_printer: {
        chunk_size: 200,
        delay_ms: 50
    },
    ultra_slow: {
        chunk_size: 25,
        delay_ms: 200
    }
};

// HOW TO APPLY:
// In bluetooth.js, find sendReceipt() function around line 144:
/*
const CHUNK_SIZE = 100;
const DELAY_MS = 75;
*/
// Update these values based on your printer's behavior


// ============================================
// 5. ADVANCED: PAYMENT METHODS (index.html)
// ============================================
// Location: index.html, around line 96 in checkout modal
// Current payment methods: Cash, NETS, PayNow, Visa/Mastercard

// To add/remove payment methods:
// In index.html, find:
/*
<button class="btn btn-payment" data-payment="Cash">Cash</button>
<button class="btn btn-payment" data-payment="NETS">NETS</button>
<button class="btn btn-payment" data-payment="PayNow">PayNow</button>
<button class="btn btn-payment" data-payment="Visa/Mastercard">Visa/Mastercard</button>
*/

// EXAMPLES:
// Add QR code payment:
// <button class="btn btn-payment" data-payment="QR Code">QR Code</button>
//
// Remove Visa/Mastercard:
// (Simply delete that button line)
//
// Rename a payment method:
// data-payment="Alipay"  (change the text in both places)

// NOTE: data-payment value will appear on receipt as "Paid via [Value]"


// ============================================
// 6. ADVANCED: RECEIPT HEADER FORMAT
// ============================================
// Location: receipt.js, generateReceipt() function

// Current receipt structure:
/*
[CENTER] Store Name
[CENTER] Address Line 1
[CENTER] Address Line 2
[CENTER] Address Line 3
[CENTER] Phone Number
[BLANK LINE]
[LEFT] Invoice: HHMMSS
[LEFT] Date: DD/MM/YYYY
[LEFT] Time: HH:MM
[BLANK LINE]
[LEFT] Item Name             Price
[LEFT] --------------------------------
[LEFT] [Item 1]    $Price
[LEFT] [Item 2]    $Price
[LEFT] --------------------------------
[BOLD] Total $              $Amount
[LEFT] Paid via [Payment]
[3x BLANK LINES]
[CUT PAPER]
*/

// To customize:
// - Edit header text (lines 90-100)
// - Add/remove blank lines (LINEFEED commands)
// - Change text alignment (CENTER/LEFT commands)
// - Modify separator lines (adjust dashes as needed)
// - Change total formatting (remove/add BOLD commands)


// ============================================
// 7. DEPLOYMENT CHECKLIST
// ============================================

const DEPLOYMENT_CHECKLIST = {
    customization: {
        'Store name updated': false,
        'Menu items configured': false,
        'UI colors (optional)': false,
        'Print settings tuned': false,
        'Payment methods verified': false
    },
    technical: {
        'HTTPS certificate valid': false,
        'Files uploaded to server': false,
        'MIME types configured': false,
        'Browser cached properly': false
    },
    testing: {
        'UI displays correctly': false,
        'Add items works': false,
        'Edit items works': false,
        'Cart operations work': false,
        'Bluetooth scanner works': false,
        'Printer connects': false,
        'Receipt prints': false,
        'Cart persists after reload': false
    },
    production: {
        'Monitor error logs': false,
        'Track print success rate': false,
        'Document printer quirks': false,
        'Create backup procedure': false
    }
};


// ============================================
// 8. QUICK COPY-PASTE SECTIONS
// ============================================

// STORE DETAILS SECTION (for receipt.js):
const STORE_DETAILS_SNIPPET = `
receiptBytes.push(COMMANDS.CENTER);
receiptBytes.push(stringToBytes('YOUR STORE NAME HERE'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('ADDRESS LINE 1'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('ADDRESS LINE 2'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('CITY, STATE ZIP'));
receiptBytes.push(COMMANDS.LINEFEED);

receiptBytes.push(stringToBytes('Tel: YOUR-PHONE-NUMBER'));
receiptBytes.push(COMMANDS.LINEFEED);
`;

// MENU ITEMS SECTION (for storage.js):
const MENU_ITEMS_SNIPPET = `
const DEFAULT_ITEMS = [
    { id: 1, name: 'Item Name 1', price: 5.50 },
    { id: 2, name: 'Item Name 2', price: 6.00 },
    { id: 3, name: 'Item Name 3', price: 7.50 },
    { id: 4, name: 'Item Name 4', price: 5.00 },
    { id: 5, name: 'Item Name 5', price: 4.00 },
    { id: 6, name: 'Item Name 6', price: 6.50 },
    { id: 7, name: 'Item Name 7', price: 2.50 },
    { id: 8, name: 'Item Name 8', price: 2.00 }
];
`;

// PRINT CONFIG SECTION (for bluetooth.js):
const PRINT_CONFIG_SNIPPET = `
const CHUNK_SIZE = 100;  // Adjust: 50-200 bytes
const DELAY_MS = 75;     // Adjust: 50-200 ms
`;

// COLOR CONFIG SECTION (for styles.css):
const COLOR_CONFIG_SNIPPET = `
:root {
    --primary-color: #1a73e8;
    --primary-dark: #1565c0;
    --secondary-color: #34a853;
    --danger-color: #d33427;
    --warning-color: #fbbc04;
    --background: #f8f9fa;
    --surface: #ffffff;
    --text-primary: #202124;
    --text-secondary: #5f6368;
    --border-color: #dadce0;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.2);
}
`;


// ============================================
// 9. TROUBLESHOOTING COMMON ISSUES
// ============================================

const COMMON_ISSUES = {
    'Web Bluetooth not available': {
        cause: 'Using Safari or unsupported browser',
        solution: 'Use Bluefy Web Browser on iOS 15+'
    },
    'Printer not found': {
        cause: 'Printer not powered or not in pairing mode',
        solution: 'Restart printer, ensure Bluetooth is enabled, try again'
    },
    'Receipt cuts off': {
        cause: 'Printer buffer overflow, chunks too large or too fast',
        solution: 'Increase DELAY_MS to 100-150ms, decrease CHUNK_SIZE to 50-75'
    },
    'Print is very slow': {
        cause: 'Small printer buffer (normal for cheap printers)',
        solution: 'This is expected; 30-60 seconds per receipt is normal'
    },
    'Cannot reconnect to printer': {
        cause: 'Printer reset or pairing cleared',
        solution: 'Tap Connect and re-pair the printer'
    },
    'Cart not persisting': {
        cause: 'Browser storage disabled or private mode',
        solution: 'Check browser settings, use normal browsing mode'
    }
};


// ============================================
// 10. FILE REFERENCES
// ============================================

const FILE_EDIT_LOCATIONS = {
    'Store Name': 'receipt.js, line ~90',
    'Menu Items': 'storage.js, line ~14',
    'UI Colors': 'styles.css, line ~8',
    'Print Speed': 'bluetooth.js, line ~144',
    'Payment Methods': 'index.html, line ~96',
    'Receipt Format': 'receipt.js, generateReceipt() function'
};

const DOCUMENTATION_FILES = {
    'README.md': 'Feature overview, usage guide',
    'DEPLOYMENT.md': 'Server setup, SSL/HTTPS, production config',
    'SETUP.html': 'Interactive setup guide, troubleshooting',
    'QUICK_REFERENCE.md': 'Developer reference, API docs',
    'PROJECT_SUMMARY.md': 'Project overview, implementation details',
    'CONFIG_TEMPLATE.md': 'This file - customization guide'
};

// ============================================
// END OF CONFIGURATION TEMPLATE
// ============================================

console.log(`
╔════════════════════════════════════════════╗
║  St. Thomas POS - Configuration Template   ║
╚════════════════════════════════════════════╝

START HERE:
1. Read PROJECT_SUMMARY.md
2. Review this CONFIG_TEMPLATE.md
3. Edit each section in your files
4. Deploy to HTTPS server
5. Test on iOS with Bluefy

QUICK LINKS:
- Store Info: receipt.js, line ~90
- Menu Items: storage.js, line ~14
- UI Colors: styles.css, line ~8
- Print Speed: bluetooth.js, line ~144

For detailed help, see:
- DEPLOYMENT.md - Server setup
- SETUP.html - Interactive guide
- QUICK_REFERENCE.md - API docs
`);
