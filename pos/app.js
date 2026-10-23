/**
 * Main Application Logic
 * Orchestrates UI interactions, state management, and Bluetooth operations
 */

const App = (() => {
    let selectedLine1 = 'Perfume';
    let selectedLine2 = 'N/A';

    /**
     * Initialize the application on page load
     */
    const init = () => {
        console.log('Initializing POS Application');

        // Initialize storage
        Storage.init();

        // Load selected words
        const selected = Storage.getSelectedWords();
        selectedLine1 = selected.line1;
        selectedLine2 = selected.line2;

        // Render UI
        renderWordClouds();
        updateCartDisplay();
        updateTotalDisplay();

        // Try to reconnect to paired printer
        checkBluetoothStatus();

        // Attach event listeners
        attachEventListeners();
    };

    /**
     * Render both word cloud lines
     */
    const renderWordClouds = () => {
        renderWordCloudLine('line1', Storage.getWordCloudLine1());
        renderWordCloudLine('line2', Storage.getWordCloudLine2());
    };

    /**
     * Render a single word cloud line
     */
    const renderWordCloudLine = (lineId, words) => {
        const line = document.getElementById(lineId);
        line.innerHTML = '';

        words.forEach(word => {
            const button = document.createElement('button');
            button.className = 'word-button';
            if (lineId === 'line1' && word === selectedLine1) {
                button.classList.add('selected');
            } else if (lineId === 'line2' && word === selectedLine2) {
                button.classList.add('selected');
            }

            button.textContent = word;

            // Click to select
            button.addEventListener('click', () => {
                selectWord(lineId, word);
            });

            // Long-press to delete
            let pressTimer = null;
            button.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => {
                    deleteWord(lineId, word);
                }, 500);
            });

            button.addEventListener('touchend', () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                }
            });

            button.addEventListener('mousedown', () => {
                pressTimer = setTimeout(() => {
                    deleteWord(lineId, word);
                }, 500);
            });

            button.addEventListener('mouseup', () => {
                if (pressTimer) {
                    clearTimeout(pressTimer);
                }
            });

            line.appendChild(button);
        });

        // Add "+" button
        const addBtn = document.createElement('button');
        addBtn.className = 'word-button-add';
        addBtn.textContent = '+';
        addBtn.addEventListener('click', () => {
            addNewWord(lineId);
        });
        line.appendChild(addBtn);
    };

    /**
     * Select a word
     */
    const selectWord = (lineId, word) => {
        if (lineId === 'line1') {
            selectedLine1 = word;
        } else if (lineId === 'line2') {
            selectedLine2 = word;
        }
        Storage.setSelectedWord(lineId, word);
        renderWordClouds();
        showFeedback(`Selected: ${word}`);
    };

    /**
     * Add new word via prompt
     */
    const addNewWord = (lineId) => {
        const word = prompt(`Add new word for ${lineId === 'line1' ? 'Line 1' : 'Line 2'}:`);
        if (word && word.trim()) {
            Storage.addWordToLine(lineId, word.trim());
            renderWordClouds();
            showFeedback(`Added: ${word.trim()}`);
        }
    };

    /**
     * Delete word with confirmation
     */
    const deleteWord = (lineId, word) => {
        if (lineId === 'line2' && word === 'N/A') {
            alert('Cannot delete "N/A"');
            return;
        }
        if (confirm(`Delete "${word}"?`)) {
            const success = Storage.removeWordFromLine(lineId, word);
            if (success) {
                renderWordClouds();
                showFeedback(`Deleted: ${word}`);
            }
        }
    };

    /**
     * Update cart display
     */
    const updateCartDisplay = () => {
        const cartList = document.getElementById('cartList');
        const cart = Storage.getCart();

        cartList.innerHTML = '';

        if (cart.length === 0) {
            cartList.innerHTML = '<div class="cart-empty">Cart is empty</div>';
            return;
        }

        cart.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'cart-item';

            const detailsDiv = document.createElement('div');
            detailsDiv.className = 'cart-item-details';

            const nameSpan = document.createElement('span');
            nameSpan.className = 'cart-item-name';
            nameSpan.textContent = escapeHtml(item.name);

            const qty = item.quantity || 1;
            const unitPrice = parseFloat(item.price);
            const lineTotal = unitPrice * qty;

            const priceSpan = document.createElement('span');
            priceSpan.className = 'cart-item-price';
            priceSpan.textContent = '$' + lineTotal.toFixed(2);

            detailsDiv.appendChild(nameSpan);
            detailsDiv.appendChild(priceSpan);

            // Quantity controls
            const qtyDiv = document.createElement('div');
            qtyDiv.className = 'cart-item-quantity';

            const decBtn = document.createElement('button');
            decBtn.className = 'qty-btn';
            decBtn.textContent = '−';
            decBtn.addEventListener('click', () => {
                const newQty = (item.quantity || 1) - 1;
                if (newQty <= 0) {
                    Storage.removeFromCart(item.id);
                } else {
                    Storage.updateItemQuantity(item.id, newQty);
                }
                updateCartDisplay();
                updateTotalDisplay();
            });

            const qtySpan = document.createElement('span');
            qtySpan.className = 'qty-display';
            qtySpan.textContent = qty;

            const incBtn = document.createElement('button');
            incBtn.className = 'qty-btn';
            incBtn.textContent = '+';
            incBtn.addEventListener('click', () => {
                const newQty = (item.quantity || 1) + 1;
                Storage.updateItemQuantity(item.id, newQty);
                updateCartDisplay();
                updateTotalDisplay();
            });

            qtyDiv.appendChild(decBtn);
            qtyDiv.appendChild(qtySpan);
            qtyDiv.appendChild(incBtn);

            const removeBtn = document.createElement('button');
            removeBtn.className = 'cart-item-remove';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
                Storage.removeFromCart(item.id);
                updateCartDisplay();
                updateTotalDisplay();
                showFeedback('Item removed');
            });

            detailsDiv.appendChild(qtyDiv);
            itemDiv.appendChild(detailsDiv);
            itemDiv.appendChild(removeBtn);
            cartList.appendChild(itemDiv);
        });
    };

    /**
     * Update total display at bottom
     */
    const updateTotalDisplay = () => {
        const cart = Storage.getCart();
        let total = 0;

        cart.forEach(item => {
            const qty = item.quantity || 1;
            total += (parseFloat(item.price) || 0) * qty;
        });

        document.getElementById('totalAmount').textContent = '$' + total.toFixed(2);
    };

    /**
     * Handle keypad input for custom amount
     */
    const handleKeypadInput = (key) => {
        const input = document.getElementById('customAmount');
        let value = input.value;

        if (key === 'backspace') {
            value = value.slice(0, -1);
        } else if (key === '.') {
            // Only add decimal if there's already a value and no decimal exists
            if (value && !value.includes('.')) {
                value += '.';
            } else if (!value) {
                value = '0.';
            }
        } else if (key >= '0' && key <= '9') {
            // If value is "0.00" or just "0", replace it with the new digit
            if (value === '0.00' || value === '0') {
                value = key;
            } else {
                value += key;
            }
        }

        input.value = value || '0.00';
    };

    /**
     * Add custom amount to cart
     */
    const addCustomAmount = () => {
        const input = document.getElementById('customAmount');
        const value = input.value.trim();
        const price = parseFloat(value);

        if (!value || isNaN(price) || price <= 0) {
            alert('Please enter a valid amount');
            return;
        }

        // Build item name from selected word cloud words
        let itemName = selectedLine1 || 'Perfume';
        if (selectedLine2 && selectedLine2 !== 'N/A') {
            itemName += ' ' + selectedLine2;
        }

        Storage.addToCart({
            name: itemName,
            price: price
        });

        input.value = '';
        updateCartDisplay();
        updateTotalDisplay();
        showFeedback('Custom item added');
    };

    /**
     * Open checkout modal
     */
    const openCheckout = () => {
        const cart = Storage.getCart();

        if (cart.length === 0) {
            alert('Cart is empty');
            return;
        }

        let total = 0;
        cart.forEach(item => {
            const qty = item.quantity || 1;
            total += (parseFloat(item.price) || 0) * qty;
        });

        document.getElementById('checkoutAmount').textContent = '$' + total.toFixed(2);
        document.getElementById('checkoutModal').classList.add('active');
    };

    /**
     * Close checkout modal
     */
    const closeCheckout = () => {
        document.getElementById('checkoutModal').classList.remove('active');
    };

    /**
     * Open cart modal (triggered by clicking Total)
     */
    const openCartModal = () => {
        updateCartDisplay();
        document.getElementById('cartModal').classList.add('active');
    };

    /**
     * Close cart modal
     */
    const closeCartModal = () => {
        document.getElementById('cartModal').classList.remove('active');
    };

    /**
     * Handle payment button click
     */
    const handlePayment = async (paymentMethod) => {
        const cart = Storage.getCart();

        if (cart.length === 0) {
            alert('Cart is empty');
            return;
        }

        // Special handling for PayNow - show QR code instead of printing immediately
        if (paymentMethod === 'PayNow') {
            showPayNowQR(cart);
            return;
        }

        // For other payment methods, print directly
        const status = Bluetooth.getStatus();
        if (!status.isConnected) {
            alert('Printer not connected. Please connect first.');
            return;
        }

        showLoading('Printing receipt...');

        try {
            await Bluetooth.printReceipt(cart, paymentMethod);
            showLoading('Print successful', 1000);
            setTimeout(() => {
                Storage.clearCart();
                updateCartDisplay();
                updateTotalDisplay();
                closeCheckout();
                showFeedback('Transaction completed');
            }, 1000);
        } catch (e) {
            console.error('Print error:', e);
            hideLoading();
            alert('Print failed: ' + e.message);
        }
    };

    /**
     * CRC-16/CCITT calculation for PayNow QR checksum
     */
    const crc16 = (s) => {
        const crcTable = [0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50a5, 0x60c6, 0x70e7, 0x8108, 0x9129, 0xa14a, 0xb16b, 0xc18c, 0xd1ad, 0xe1ce, 0xf1ef, 0x1231, 0x0210, 0x3273, 0x2252, 0x52b5, 0x4294, 0x72f7, 0x62d6, 0x9339, 0x8318, 0xb37b, 0xa35a, 0xd3bd, 0xc39c, 0xf3ff, 0xe3de, 0x2462, 0x3443, 0x0420, 0x1401, 0x64e6, 0x74c7, 0x44a4, 0x5485, 0xa56a, 0xb54b, 0x8528, 0x9509, 0xe5ee, 0xf5cf, 0xc5ac, 0xd58d, 0x3653, 0x2672, 0x1611, 0x0630, 0x76d7, 0x66f6, 0x5695, 0x46b4, 0xb75b, 0xa77a, 0x9719, 0x8738, 0xf7df, 0xe7fe, 0xd79d, 0xc7bc, 0x48c4, 0x58e5, 0x6886, 0x78a7, 0x0840, 0x1861, 0x2802, 0x3823, 0xc9cc, 0xd9ed, 0xe98e, 0xf9af, 0x8948, 0x9969, 0xa90a, 0xb92b, 0x5af5, 0x4ad4, 0x7ab7, 0x6a96, 0x1a71, 0x0a50, 0x3a33, 0x2a12, 0xdbfd, 0xcbdc, 0xfbbf, 0xeb9e, 0x9b79, 0x8b58, 0xbb3b, 0xab1a, 0x6ca6, 0x7c87, 0x4ce4, 0x5cc5, 0x2c22, 0x3c03, 0x0c60, 0x1c41, 0xedae, 0xfd8f, 0xcdec, 0xddcd, 0xad2a, 0xbd0b, 0x8d68, 0x9d49, 0x7e97, 0x6eb6, 0x5ed5, 0x4ef4, 0x3e13, 0x2e32, 0x1e51, 0x0e70, 0xff9f, 0xefbe, 0xdfdd, 0xcffc, 0xbf1b, 0xaf3a, 0x9f59, 0x8f78, 0x9188, 0x81a9, 0xb1ca, 0xa1eb, 0xd10c, 0xc12d, 0xf14e, 0xe16f, 0x1080, 0x00a1, 0x30c2, 0x20e3, 0x5004, 0x4025, 0x7046, 0x6067, 0x83b9, 0x9398, 0xa3fb, 0xb3da, 0xc33d, 0xd31c, 0xe37f, 0xf35e, 0x02b1, 0x1290, 0x22f3, 0x32d2, 0x4235, 0x5214, 0x6277, 0x7256, 0xb5ea, 0xa5cb, 0x95a8, 0x8589, 0xf56e, 0xe54f, 0xd52c, 0xc50d, 0x34e2, 0x24c3, 0x14a0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405, 0xa7db, 0xb7fa, 0x8799, 0x97b8, 0xe75f, 0xf77e, 0xc71d, 0xd73c, 0x26d3, 0x36f2, 0x0691, 0x16b0, 0x6657, 0x7676, 0x4615, 0x5634, 0xd94c, 0xc96d, 0xf90e, 0xe92f, 0x99c8, 0x89e9, 0xb98a, 0xa9ab, 0x5844, 0x4865, 0x7806, 0x6827, 0x18c0, 0x08e1, 0x3882, 0x28a3, 0xcb7d, 0xdb5c, 0xeb3f, 0xfb1e, 0x8bf9, 0x9bd8, 0xabbb, 0xbb9a, 0x4a75, 0x5a54, 0x6a37, 0x7a16, 0x0af1, 0x1ad0, 0x2ab3, 0x3a92, 0xfd2e, 0xed0f, 0xdd6c, 0xcd4d, 0xbdaa, 0xad8b, 0x9de8, 0x8dc9, 0x7c26, 0x6c07, 0x5c64, 0x4c45, 0x3ca2, 0x2c83, 0x1ce0, 0x0cc1, 0xef1f, 0xff3e, 0xcf5d, 0xdf7c, 0xaf9b, 0xbfba, 0x8fd9, 0x9ff8, 0x6e17, 0x7e36, 0x4e55, 0x5e74, 0x2e93, 0x3eb2, 0x0ed1, 0x1ef0];
        
        let crc = 0xFFFF;
        for (let i = 0; i < s.length; i++) {
            const c = s.charCodeAt(i);
            if (c > 255) throw new RangeError();
            const j = (c ^ (crc >> 8)) & 0xFF;
            crc = crcTable[j] ^ (crc << 8);
        }
        
        return ((crc ^ 0) & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    };

    /**
     * Generate PayNow QR code string following EMV/SGQR spec
     */
    const generatePayNowQR = (amount, referenceNumber) => {
        // Pad reference number length with leading zero if needed
        const padLeft = (str, len, pad = '0') => {
            return str.length >= len ? str : Array(len - str.length + 1).join(pad) + str;
        };

        // Build nested merchant account info (ID 26)
        const merchantAccountInfo = [
            { id: '00', value: 'SG.PAYNOW' },
            { id: '01', value: '0' }, // 0 for mobile number, 2 for UEN
            { id: '02', value: '+6581230516' }, // Mobile number with +65 prefix
            { id: '03', value: '0' }, // 0 = amount not editable
            { id: '04', value: '' } // Expiry date (empty = no expiry)
        ];

        // Build merchant account info string
        let merchantStr = '';
        merchantAccountInfo.forEach(field => {
            merchantStr += field.id + padLeft(field.value.length.toString(), 2) + field.value;
        });

        // Build additional data field (ID 62)
        const additionalDataField = [
            { id: '01', value: referenceNumber } // Bill number
        ];

        let additionalStr = '';
        additionalDataField.forEach(field => {
            additionalStr += field.id + padLeft(field.value.length.toString(), 2) + field.value;
        });

        // Build root level data objects
        const rootData = [
            { id: '00', value: '01' }, // Payload Format Indicator (version 1)
            { id: '01', value: '12' }, // Point of Initiation Method (12 = dynamic)
            { id: '26', value: merchantStr }, // Merchant Account Information
            { id: '52', value: '0000' }, // Merchant Category Code
            { id: '53', value: '702' }, // Currency (702 = SGD)
            { id: '54', value: amount.toFixed(2) }, // Transaction Amount
            { id: '58', value: 'SG' }, // Country Code
            { id: '59', value: 'POS' }, // Merchant Name
            { id: '60', value: 'Singapore' }, // Merchant City
            { id: '62', value: additionalStr } // Additional Data Field
        ];

        // Build QR data string
        let qrData = '';
        rootData.forEach(field => {
            qrData += field.id + padLeft(field.value.length.toString(), 2) + field.value;
        });

        // Add CRC placeholder and calculate checksum
        qrData += '6304';
        const checksum = crc16(qrData);
        qrData += checksum;

        return qrData;
    };

    /**
     * Show PayNow QR code modal
     */
    const showPayNowQR = (cart) => {
        let total = 0;
        cart.forEach(item => {
            const qty = item.quantity || 1;
            total += (parseFloat(item.price) || 0) * qty;
        });

        // Generate receipt number (timestamp based)
        const now = new Date();
        const receiptNumber = 'INV' + now.getFullYear() + 
                            String(now.getMonth() + 1).padStart(2, '0') + 
                            String(now.getDate()).padStart(2, '0') + 
                            String(now.getHours()).padStart(2, '0') + 
                            String(now.getMinutes()).padStart(2, '0') + 
                            String(now.getSeconds()).padStart(2, '0');

        // Generate PayNow QR code
        const qrData = generatePayNowQR(total, receiptNumber);

        // Display in modal
        document.getElementById('paynowAmount').textContent = '$' + total.toFixed(2);
        document.getElementById('paynowReference').textContent = receiptNumber;
        
        // Generate QR code using canvas and html5-qrcode
        setTimeout(() => {
            try {
                // Use html5-qrcode's QRCode generation capability
                const qrElement = document.getElementById('paynowQR');
                
                // Create a simple QR code using a public QR generation API as fallback
                // This ensures it works even without complex libraries
                const encodedData = encodeURIComponent(qrData);
                qrElement.src = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedData}&color=4a148c&bgcolor=ffffff`;
                qrElement.onerror = () => {
                    // Fallback if API fails
                    console.error('QR code generation failed');
                    qrElement.alt = 'QR Code (generation failed - please try again)';
                };
            } catch (e) {
                console.error('QR code error:', e);
            }
        }, 100);

        // Show modal and hide checkout
        closeCheckout();
        document.getElementById('paynowModal').classList.add('active');

        // Store cart for use when printing
        window.paynowCart = cart;
        window.paynowMethod = 'PayNow';
    };

    /**
     * Handle print receipt after PayNow payment
     */
    const handlePrintReceiptPayNow = async () => {
        const status = Bluetooth.getStatus();
        if (!status.isConnected) {
            alert('Printer not connected. Please connect first.');
            return;
        }

        showLoading('Printing receipt...');

        try {
            await Bluetooth.printReceipt(window.paynowCart, window.paynowMethod);
            showLoading('Print successful', 1000);
            setTimeout(() => {
                Storage.clearCart();
                updateCartDisplay();
                updateTotalDisplay();
                document.getElementById('paynowModal').classList.remove('active');
                showFeedback('Transaction completed');
                window.paynowCart = null;
            }, 1000);
        } catch (e) {
            console.error('Print error:', e);
            hideLoading();
            alert('Print failed: ' + e.message);
        }
    };

    /**
     * Close PayNow modal
     */
    const closePayNowModal = () => {
        document.getElementById('paynowModal').classList.remove('active');
    };

    /**
     * Clear cart
     */
    const clearCart = () => {
        if (confirm('Clear cart?')) {
            Storage.clearCart();
            updateCartDisplay();
            updateTotalDisplay();
            showFeedback('Cart cleared');
        }
    };

    /**
     * Check Bluetooth status and try to reconnect
     */
    const checkBluetoothStatus = async () => {
        if (!Bluetooth.isAvailable()) {
            console.error('Web Bluetooth not available');
            return;
        }

        // Try to reconnect to paired device
        const reconnected = await Bluetooth.tryReconnectPaired();
        updateBluetoothUI();
    };

    /**
     * Handle connect button click
     */
    const handleConnect = async () => {
        showLoading('Scanning for device...');

        try {
            const connected = await Bluetooth.requestDevice();
            if (connected) {
                updateBluetoothUI();
                showLoading('Connected', 1000);
                setTimeout(() => hideLoading(), 1000);
            } else {
                hideLoading();
                alert('Connection failed');
            }
        } catch (e) {
            hideLoading();
            console.error('Connection error:', e);
        }
    };

    /**
     * Update Bluetooth UI based on connection status
     */
    const updateBluetoothUI = () => {
        const status = Bluetooth.getStatus();
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.getElementById('statusText');
        const bluetoothStatus = document.getElementById('bluetoothStatus');

        if (status.isConnected) {
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Connected to ' + (status.deviceName || 'Printer');
            // Make status clickable to disconnect
            if (bluetoothStatus) {
                bluetoothStatus.style.cursor = 'pointer';
                bluetoothStatus.onclick = () => {
                    Bluetooth.disconnect();
                    updateBluetoothUI();
                    showFeedback('Disconnected');
                };
            }
        } else {
            statusIndicator.classList.remove('connected');
            statusIndicator.classList.add('disconnected');
            statusText.textContent = 'Disconnected';
            // Make status clickable to connect
            if (bluetoothStatus) {
                bluetoothStatus.style.cursor = 'pointer';
                bluetoothStatus.onclick = handleConnect;
            }
        }
    };

    /**
     * Show loading overlay
     */
    const showLoading = (text = 'Processing...', autoHideMs = null) => {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');
        loadingText.textContent = text;
        overlay.classList.add('active');

        if (autoHideMs) {
            setTimeout(() => {
                overlay.classList.remove('active');
            }, autoHideMs);
        }
    };

    /**
     * Hide loading overlay
     */
    const hideLoading = () => {
        const overlay = document.getElementById('loadingOverlay');
        overlay.classList.remove('active');
    };

    /**
     * Show feedback toast
     */
    const showFeedback = (message) => {
        // Simple console feedback, could be enhanced with toast UI
        console.log('Feedback:', message);
    };

    /**
     * Escape HTML to prevent XSS
     */
    const escapeHtml = (text) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    };

    /**
     * Attach all event listeners
     */
    const attachEventListeners = () => {
        // Keypad
        document.querySelectorAll('.key').forEach(key => {
            key.addEventListener('click', (e) => {
                handleKeypadInput(e.target.getAttribute('data-key'));
            });
        });

        document.getElementById('addCustomBtn').addEventListener('click', addCustomAmount);

        // Cart Modal
        const totalDisplay = document.getElementById('totalDisplay');
        if (totalDisplay) {
            totalDisplay.addEventListener('click', (e) => {
                e.preventDefault();
                openCartModal();
            });
        }
        const closeCartBtn = document.getElementById('closeCartBtn');
        if (closeCartBtn) {
            closeCartBtn.addEventListener('click', closeCartModal);
        }
        const cartModal = document.getElementById('cartModal');
        if (cartModal) {
            cartModal.addEventListener('click', (e) => {
                if (e.target.id === 'cartModal') {
                    closeCartModal();
                }
            });
        }

        // Clear cart
        document.getElementById('clearBtn').addEventListener('click', clearCart);

        // Checkout
        document.getElementById('checkoutBtn').addEventListener('click', openCheckout);
        document.getElementById('cancelCheckoutBtn').addEventListener('click', closeCheckout);

        document.querySelectorAll('.btn-payment').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const paymentMethod = e.target.getAttribute('data-payment');
                handlePayment(paymentMethod);
            });
        });

        document.getElementById('checkoutModal').addEventListener('click', (e) => {
            if (e.target.id === 'checkoutModal') {
                closeCheckout();
            }
        });

        // PayNow QR Modal
        const printReceiptBtn = document.getElementById('printReceiptBtn');
        if (printReceiptBtn) {
            printReceiptBtn.addEventListener('click', handlePrintReceiptPayNow);
        }
        const cancelPaynowBtn = document.getElementById('cancelPaynowBtn');
        if (cancelPaynowBtn) {
            cancelPaynowBtn.addEventListener('click', closePayNowModal);
        }
        const paynowModal = document.getElementById('paynowModal');
        if (paynowModal) {
            paynowModal.addEventListener('click', (e) => {
                if (e.target.id === 'paynowModal') {
                    closePayNowModal();
                }
            });
        }
    };

    // Public API
    return {
        init
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
