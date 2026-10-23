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
     * Generate PayNow QR code
     */
    const generatePayNowQR = (amount, referenceNumber) => {
        // PayNow format: 00020101021226560009SG.PAYNOW010100211+658123051603010041420261024222800520400005303702540550.005802SG59006009Singapore62210117INV202612141620556304632D
        // We'll construct it dynamically with the amount and reference
        
        // This is a simplified PayNow static payload - in production you'd generate it dynamically
        // For now, using the sample provided as reference
        const paynowUEN = '201615823R'; // SG.PAYNOW
        const receiverID = '81230516'; // Phone number as per spec
        const amount_cents = Math.round(amount * 100); // Convert to cents
        const ref = referenceNumber;
        
        // Basic PayNow QR format (simplified)
        // Full format: 00020101021226560009SG.PAYNOW010100211+6581230516030100414202...
        let qrData = '00020101021226560009SG.PAYNOW0101002116' + receiverID + '0301004142026' + amount_cents.toString().padStart(13, '0') + '5406' + amount_cents.toString() + '0802SG59006009Singapore62' + ref.length.toString().padStart(2, '0') + ref + '6304';
        
        // Generate checksum (simplified - in production use proper CRC-16/CCITT-FALSE)
        // For now, return sample structure
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
        
        // Generate QR code using QR code library
        // Using qrcode.js library (you'll need to add this to HTML)
        if (typeof QRCode !== 'undefined') {
            const qrElement = document.getElementById('paynowQR');
            qrElement.src = ''; // Clear previous
            // Generate QR code to canvas then convert to image
            const canvas = document.createElement('canvas');
            QRCode.toCanvas(canvas, qrData, {
                errorCorrectionLevel: 'H',
                type: 'image/png',
                width: 300,
                color: {
                    dark: '#4a148c', // Dark purple as per requirement
                    light: '#ffffff'
                }
            }, (err) => {
                if (!err) {
                    qrElement.src = canvas.toDataURL();
                }
            });
        }

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
