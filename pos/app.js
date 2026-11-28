/**
 * Main Application Logic
 * Orchestrates UI interactions, state management, and Bluetooth operations
 */

const App = (() => {
    let selectedLine1 = 'Perfume';
    let selectedLine2 = 'N/A';
    let historyOffset = 0;
    let historyRecords = [];
    let historyDetailId = null;
    let historyBinMode = false;
    let activeReport = null;

    /**
     * Initialize the application on page load
     */
    const init = () => {
        console.log('Initializing POS Application');

        // Initialize storage
        Storage.init();
        TransactionHistory.open().catch((error) => {
            console.error('IndexedDB history unavailable:', error);
        });
        TransactionHistory.ensureShift().catch((error) => {
            console.error('Could not initialize sales shift:', error);
        });

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
     * Open menu dashboard
     */
    const openMenuModal = () => {
        document.getElementById('menuModal').classList.add('active');
    };

    /**
     * Close menu dashboard
     */
    const closeMenuModal = () => {
        document.getElementById('menuModal').classList.remove('active');
    };

    /**
     * Open receipt setup
     */
    const openSetupModal = () => {
        const config = Storage.getReceiptConfig();
        document.getElementById('receiptName').value = config.name;
        document.getElementById('receiptAddress1').value = config.addressLine1;
        document.getElementById('receiptAddress2').value = config.addressLine2;
        document.getElementById('receiptAddress3').value = config.addressLine3;
        document.getElementById('receiptPhone').value = config.phone;
        document.getElementById('setupModal').classList.add('active');
    };

    /**
     * Close receipt setup
     */
    const closeSetupModal = () => {
        document.getElementById('setupModal').classList.remove('active');
    };

    /**
     * Save receipt setup
     */
    const saveSetup = () => {
        const config = Storage.setReceiptConfig({
            name: document.getElementById('receiptName').value,
            addressLine1: document.getElementById('receiptAddress1').value,
            addressLine2: document.getElementById('receiptAddress2').value,
            addressLine3: document.getElementById('receiptAddress3').value,
            phone: document.getElementById('receiptPhone').value
        });

        document.getElementById('receiptName').value = config.name;
        document.getElementById('receiptAddress1').value = config.addressLine1;
        document.getElementById('receiptAddress2').value = config.addressLine2;
        document.getElementById('receiptAddress3').value = config.addressLine3;
        document.getElementById('receiptPhone').value = config.phone;
        closeSetupModal();
        showFeedback('Receipt setup saved');
    };

    const formatReportDateTime = (iso) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return normalizeText(iso);
        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const renderReport = (report) => {
        activeReport = report;
        document.getElementById('reportTitle').textContent = report.type + ' Report';
        document.getElementById('reportGeneratedAt').textContent =
            'Generated ' + formatReportDateTime(report.generatedAt);
        document.getElementById('reportPeriodStart').textContent =
            formatReportDateTime(report.openedAt);
        document.getElementById('reportGross').textContent =
            formatMoneyFromCents(report.grossCents);
        document.getElementById('reportTransactions').textContent =
            String(report.transactionCount);
        document.getElementById('reportItems').textContent =
            String(report.itemCount);

        const paymentEntries = Object.entries(report.payments || {}).sort((a, b) => b[1] - a[1]);
        document.getElementById('reportPayments').innerHTML = paymentEntries.length
            ? paymentEntries.map(([payment, cents]) => `
                <div class="report-line">
                    <span>${escapeHtml(payment)}</span>
                    <strong>${formatMoneyFromCents(cents)}</strong>
                </div>
            `).join('')
            : '<div class="report-line"><span>No sales</span><strong>$0.00</strong></div>';

        document.getElementById('reportItemSummary').innerHTML = report.items.length
            ? report.items.map((item) => `
                <div class="report-line">
                    <span>${item.quantity} × ${escapeHtml(item.name)}</span>
                    <strong>${formatMoneyFromCents(item.totalCents)}</strong>
                </div>
            `).join('')
            : '<div class="report-line"><span>No items</span><strong>$0.00</strong></div>';
    };

    const openXReport = async () => {
        closeMenuModal();
        try {
            const report = await TransactionHistory.buildReport('X', new Date());
            renderReport(report);
            document.getElementById('reportModal').classList.add('active');
        } catch (error) {
            console.error('Could not generate X report:', error);
            alert('Could not generate the X Report');
        }
    };

    const openZReport = async () => {
        closeMenuModal();
        if (!confirm('Close the current shift and create a Z Report? This begins a new sales period.')) {
            return;
        }

        try {
            showLoading('Creating Z Report...');
            const report = await TransactionHistory.closeShift();
            hideLoading();
            renderReport(report);
            document.getElementById('reportModal').classList.add('active');
        } catch (error) {
            hideLoading();
            console.error('Could not create Z report:', error);
            alert('Could not create the Z Report');
        }
    };

    const closeReportModal = () => {
        document.getElementById('reportModal').classList.remove('active');
        activeReport = null;
    };

    const printActiveReport = async () => {
        if (!activeReport) return;
        const status = Bluetooth.getStatus();
        if (!status.isConnected) {
            alert('Printer not connected. Please connect first.');
            return;
        }

        const printButton = document.getElementById('printReportBtn');
        printButton.disabled = true;
        printButton.textContent = 'Printing...';

        try {
            showLoading('Printing report...');
            const reportBytes = Receipt.generateSalesReport(activeReport);
            await Bluetooth.sendReceipt(reportBytes);
            showLoading(activeReport.type + ' Report printed', 1000);
        } catch (error) {
            hideLoading();
            console.error('Report print failed:', error);
            alert('Report print failed: ' + error.message);
        } finally {
            printButton.disabled = false;
            printButton.textContent = 'Print report';
        }
    };

    /**
     * Generate a unique, readable invoice number
     */
    const createInvoiceNumber = () => {
        const now = new Date();
        const stamp = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');
        const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
        return 'INV' + stamp + '-' + suffix;
    };

    /**
     * Open transaction history
     */
    const openHistoryModal = async () => {
        closeMenuModal();
        document.getElementById('historyModal').classList.add('active');
        historyOffset = 0;
        historyRecords = [];
        historyBinMode = false;
        document.querySelector('#historyModal h2').textContent = 'History';
        document.getElementById('historyBinBtn').textContent = 'Bin';
        await refreshHistory();
    };

    /**
     * Close transaction history
     */
    const closeHistoryModal = () => {
        document.getElementById('historyModal').classList.remove('active');
    };

    const formatMoneyFromCents = (cents) => '$' + ((Number(cents) || 0) / 100).toFixed(2);

    const formatHistoryDate = (iso) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return normalizeText(iso);
        return date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const normalizeText = (value) => typeof value === 'string' ? value : '';

    /**
     * Read current history filters
     */
    const getHistoryFilters = () => ({
        search: document.getElementById('historySearch').value,
        from: document.getElementById('historyFrom').value,
        to: document.getElementById('historyTo').value,
        paymentMethod: document.getElementById('historyPayment').value,
        limit: 50,
        offset: historyOffset
    });

    /**
     * Render transaction history rows
     */
    const refreshHistory = async (append = false) => {
        const list = document.getElementById('historyList');
        try {
            const records = historyBinMode
                ? await TransactionHistory.getBin()
                : await TransactionHistory.query(getHistoryFilters());
            historyRecords = append ? historyRecords.concat(records) : records;

            if (!historyRecords.length) {
                list.innerHTML = '<div class="history-empty">No transactions found</div>';
            } else {
                list.innerHTML = historyRecords.map((record) => {
                    const statusClass = 'history-status-' + record.status.replace(/[^a-z0-9_-]/gi, '_');
                    return `
                        <button class="history-row" type="button" data-history-id="${escapeHtml(record.id)}">
                            <div class="history-row-main">
                                <span class="history-row-invoice">${escapeHtml(record.invoiceNumber || record.id)}</span>
                                <span class="history-row-date">${escapeHtml(formatHistoryDate(record.createdAt))}</span>
                            </div>
                            <div class="history-row-meta">
                                <span class="history-row-payment">${escapeHtml(record.paymentMethod)}</span>
                                <span class="history-status ${statusClass}">${escapeHtml(record.status.replace(/_/g, ' '))}</span>
                            </div>
                            <span class="history-row-total">${formatMoneyFromCents(record.totalCents)}</span>
                        </button>
                    `;
                }).join('');
            }

            document.getElementById('historyLoadMoreBtn').hidden =
                historyBinMode || records.length < 50;

            const allRecords = await TransactionHistory.getAll();
            const binRecords = await TransactionHistory.getBin();
            const totalCents = allRecords.reduce((sum, record) => sum + (Number(record.totalCents) || 0), 0);
            document.getElementById('historySummary').textContent =
                allRecords.length + ' transaction' + (allRecords.length === 1 ? '' : 's') +
                ' · ' + formatMoneyFromCents(totalCents) +
                (historyBinMode ? ' · Bin: ' + binRecords.length : '');

            list.querySelectorAll('[data-history-id]').forEach((row) => {
                row.addEventListener('click', () => openHistoryDetail(row.dataset.historyId));
            });
        } catch (error) {
            console.error('Could not load transaction history:', error);
            list.innerHTML = '<div class="history-empty">History is unavailable</div>';
        }
    };

    /**
     * Open one transaction detail
     */
    const openHistoryDetail = async (id) => {
        try {
            const record = await TransactionHistory.getById(id);
            if (!record) {
                alert('Transaction was not found');
                return;
            }

            historyDetailId = id;
            document.getElementById('historyDetailInvoice').textContent =
                record.invoiceNumber || 'Transaction';
            document.getElementById('historyDetailDate').textContent =
                formatHistoryDate(record.createdAt);
            document.getElementById('historyDetailPayment').textContent =
                record.paymentMethod;
            document.getElementById('historyDetailStatus').textContent =
                record.status.replace(/_/g, ' ');
            document.getElementById('historyDetailPrintStatus').textContent =
                record.printStatus.replace(/_/g, ' ');
            document.getElementById('historyDetailReprintCount').textContent =
                String(record.reprintCount || 0);
            document.getElementById('historyDetailTotal').textContent =
                formatMoneyFromCents(record.totalCents);

            document.getElementById('historyDetailItems').innerHTML =
                record.items.map((item) => `
                    <div class="history-detail-item">
                        <div class="history-detail-item-name">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span>${item.quantity} × ${formatMoneyFromCents(item.unitPriceCents)}</span>
                        </div>
                        <strong>${formatMoneyFromCents(item.lineTotalCents)}</strong>
                    </div>
                `).join('');

            const deleteButton = document.getElementById('deleteHistoryBtn');
            const restoreButton = document.getElementById('restoreHistoryBtn');
            const toCartButton = document.getElementById('toCartHistoryBtn');
            const reprintButton = document.getElementById('reprintHistoryBtn');

            const closed = record.zClosed === true || !!record.zReportId;
            if (historyBinMode) {
                deleteButton.hidden = true;
                restoreButton.hidden = false;
                toCartButton.hidden = true;
                reprintButton.hidden = true;
            } else {
                restoreButton.hidden = true;
                deleteButton.hidden = closed;
                toCartButton.hidden = false;
                reprintButton.hidden = false;
            }

            document.getElementById('historyDetailModal').classList.add('active');
        } catch (error) {
            console.error('Could not open transaction:', error);
            alert('Could not open this transaction');
        }
    };

    const closeHistoryDetail = () => {
        document.getElementById('historyDetailModal').classList.remove('active');
        historyDetailId = null;
    };

    const deleteHistoryTransaction = async () => {
        if (!historyDetailId) return;
        if (!confirm('Move this transaction to the Bin? It will be permanently removed when the shift is closed by a Z Report.')) {
            return;
        }

        try {
            await TransactionHistory.moveToBin(historyDetailId);
            closeHistoryDetail();
            await refreshHistory();
            showFeedback('Transaction moved to Bin');
        } catch (error) {
            console.error('Could not move transaction to Bin:', error);
            alert(error.message || 'Could not move transaction to Bin');
        }
    };

    const restoreHistoryTransaction = async () => {
        if (!historyDetailId) return;
        try {
            await TransactionHistory.restoreFromBin(historyDetailId);
            closeHistoryDetail();
            await refreshHistory();
            showFeedback('Transaction restored');
        } catch (error) {
            console.error('Could not restore transaction:', error);
            alert(error.message || 'Could not restore transaction');
        }
    };

    const toCartHistoryTransaction = async () => {
        if (!historyDetailId) return;

        try {
            const record = await TransactionHistory.getById(historyDetailId);
            const cart = Storage.getCart();

            record.items.forEach((item) => {
                const unitPrice = (item.unitPriceCents / 100).toFixed(2);
                const existing = cart.find((cartItem) =>
                    cartItem.name === item.name &&
                    parseFloat(cartItem.price).toFixed(2) === unitPrice
                );
                if (existing) {
                    existing.quantity = (existing.quantity || 1) + item.quantity;
                } else {
                    cart.push({
                        id: Math.random().toString(36).substr(2, 9),
                        name: item.name,
                        price: unitPrice,
                        quantity: item.quantity
                    });
                }
            });

            Storage.setCart(cart);
            updateCartDisplay();
            updateTotalDisplay();
            closeHistoryDetail();
            closeHistoryModal();
            openCartModal();
            showFeedback('Transaction added to cart');
        } catch (error) {
            console.error('Could not add transaction to cart:', error);
            alert('Could not add transaction to cart');
        }
    };

    /**
     * Reprint a historical transaction
     */
    const reprintHistoryTransaction = async () => {
        if (!historyDetailId) return;
        const status = Bluetooth.getStatus();
        if (!status.isConnected) {
            alert('Printer not connected. Please connect first.');
            return;
        }

        const reprintButton = document.getElementById('reprintHistoryBtn');
        reprintButton.disabled = true;
        reprintButton.textContent = 'Printing...';

        try {
            const record = await TransactionHistory.getById(historyDetailId);
            const cartItems = record.items.map((item) => ({
                name: item.name,
                price: (item.unitPriceCents / 100).toFixed(2),
                quantity: item.quantity
            }));

            showLoading('Printing receipt...');
            await Bluetooth.printReceipt(
                cartItems,
                record.paymentMethod,
                record.invoiceNumber,
                {
                    createdAt: record.createdAt,
                    receiptConfig: record.receiptConfig,
                    reprint: true
                }
            );
            await TransactionHistory.patch(record.id, {
                printStatus: 'printed',
                printCount: record.printCount + 1,
                reprintCount: (record.reprintCount || 0) + 1,
                lastReprintedAt: new Date().toISOString(),
                status: record.status === 'void' ? 'void' : 'completed'
            });
            showLoading('Receipt reprinted', 1000);
            closeHistoryDetail();
            await refreshHistory();
        } catch (error) {
            hideLoading();
            console.error('Reprint failed:', error);
            await TransactionHistory.patch(historyDetailId, {
                printStatus: 'failed',
                status: 'print_failed'
            }).catch((historyError) => {
                console.error('Could not record reprint failure:', historyError);
            });
            alert('Reprint failed: ' + error.message);
        } finally {
            reprintButton.disabled = false;
            reprintButton.textContent = 'Reprint receipt';
        }
    };

    const csvEscape = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';

    const parseCsvRows = (text) => {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                if (quoted && text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    quoted = !quoted;
                }
            } else if (char === ',' && !quoted) {
                row.push(field);
                field = '';
            } else if ((char === '\n' || char === '\r') && !quoted) {
                if (char === '\r' && text[i + 1] === '\n') i++;
                row.push(field);
                if (row.some((value) => value !== '')) rows.push(row);
                row = [];
                field = '';
            } else {
                field += char;
            }
        }

        row.push(field);
        if (row.some((value) => value !== '')) rows.push(row);
        return rows;
    };

    const importHistoryFile = async (file) => {
        if (!file) return;
        if (!confirm('Import this file into transaction history? Existing transactions with the same ID or invoice may be replaced.')) {
            return;
        }

        try {
            const text = await file.text();
            let records = [];

            if (file.name.toLowerCase().endsWith('.json') || text.trim().startsWith('[')) {
                const parsed = JSON.parse(text);
                records = Array.isArray(parsed) ? parsed : (parsed.transactions || []);
            } else {
                const rows = parseCsvRows(text);
                if (rows.length < 2) throw new Error('CSV contains no transaction rows');

                const headers = rows[0].map((header) => header.trim());
                const grouped = new Map();
                rows.slice(1).forEach((values) => {
                    const row = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index] || '';
                    });

                    const invoice = row['Invoice'] || '';
                    if (!invoice) return;
                    if (!grouped.has(invoice)) {
                        grouped.set(invoice, {
                            id: 'import-' + invoice,
                            invoiceNumber: invoice,
                            createdAt: row['Created At'] || new Date().toISOString(),
                            paymentMethod: row['Payment Method'] || 'Unknown',
                            status: row['Status'] || 'completed',
                            printStatus: row['Print Status'] || 'not_printed',
                            printCount: 0,
                            reprintCount: 0,
                            items: [],
                            totalCents: Math.round((parseFloat(row['Transaction Total SGD']) || 0) * 100),
                            currency: 'SGD',
                            receiptConfig: {}
                        });
                    }

                    const record = grouped.get(invoice);
                    const quantity = Math.max(1, parseInt(row['Quantity'], 10) || 1);
                    const unitPriceCents = Math.round((parseFloat(row['Unit Price SGD']) || 0) * 100);
                    const lineTotalCents = Math.round((parseFloat(row['Line Total SGD']) ||
                        unitPriceCents * quantity / 100) * 100);
                    record.items.push({
                        name: row['Item'] || 'Unnamed item',
                        quantity,
                        unitPriceCents,
                        lineTotalCents
                    });
                });
                records = Array.from(grouped.values());
            }

            if (!records.length) throw new Error('No transactions found in the file');
            const imported = await TransactionHistory.importRecords(records);
            await refreshHistory();
            alert(imported + ' transaction' + (imported === 1 ? '' : 's') + ' imported');
        } catch (error) {
            console.error('Could not import history:', error);
            alert('Could not import history: ' + error.message);
        } finally {
            const input = document.getElementById('historyImportFile');
            if (input) input.value = '';
        }
    };

    const toggleHistoryBin = async () => {
        historyBinMode = !historyBinMode;
        historyOffset = 0;
        historyRecords = [];
        document.querySelector('#historyModal h2').textContent =
            historyBinMode ? 'History Bin' : 'History';
        document.getElementById('historyBinBtn').textContent =
            historyBinMode ? 'Back to History' : 'Bin';
        await refreshHistory();
    };

    const deleteAllHistory = async () => {
        if (!confirm('Permanently delete all transaction history and Z reports? This cannot be undone.')) {
            return;
        }
        if (!confirm('Confirm final deletion of the entire history?')) {
            return;
        }

        try {
            await TransactionHistory.clearAll();
            await refreshHistory();
            alert('Entire history deleted');
        } catch (error) {
            console.error('Could not delete entire history:', error);
            alert('Could not delete history: ' + error.message);
        }
    };

    /**
     * Export the currently filtered history
     */
    const exportHistory = async (format) => {
        try {
            const allRecords = await TransactionHistory.getAll();
            const filters = getHistoryFilters();
            const search = normalizeText(filters.search).trim().toLowerCase();
            const fromTime = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : null;
            const toTime = filters.to ? new Date(filters.to + 'T23:59:59.999').getTime() : null;

            const filtered = allRecords.filter((record) => {
                const createdTime = new Date(record.createdAt).getTime();
                const searchable = [
                    record.invoiceNumber,
                    record.paymentMethod,
                    record.status,
                    record.items.map((item) => item.name).join(' ')
                ].join(' ').toLowerCase();
                return (!search || searchable.includes(search)) &&
                    (!filters.paymentMethod || record.paymentMethod === filters.paymentMethod) &&
                    (fromTime === null || createdTime >= fromTime) &&
                    (toTime === null || createdTime <= toTime);
            }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            if (!filtered.length) {
                alert('No transactions match the current filters');
                return;
            }

            const dateStamp = new Date().toISOString().slice(0, 10);
            let content;
            let mimeType;
            let extension;

            if (format === 'json') {
                content = JSON.stringify(filtered, null, 2);
                mimeType = 'application/json';
                extension = 'json';
            } else {
                const rows = [[
                    'Invoice',
                    'Created At',
                    'Payment Method',
                    'Status',
                    'Print Status',
                    'Item',
                    'Quantity',
                    'Unit Price SGD',
                    'Line Total SGD',
                    'Transaction Total SGD'
                ]];

                filtered.forEach((record) => {
                    record.items.forEach((item) => {
                        rows.push([
                            record.invoiceNumber,
                            record.createdAt,
                            record.paymentMethod,
                            record.status,
                            record.printStatus,
                            item.name,
                            item.quantity,
                            (item.unitPriceCents / 100).toFixed(2),
                            (item.lineTotalCents / 100).toFixed(2),
                            (record.totalCents / 100).toFixed(2)
                        ]);
                    });
                });

                content = rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
                mimeType = 'text/csv;charset=utf-8';
                extension = 'csv';
            }

            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'pos-history-' + dateStamp + '.' + extension;

            const file = typeof File === 'function'
                ? new File([blob], link.download, { type: mimeType })
                : null;
            if (navigator.share && file) {
                try {
                    const canShare = !navigator.canShare || navigator.canShare({ files: [file] });
                    if (canShare) {
                        await navigator.share({
                            title: 'POS transaction history',
                            text: 'POS history export',
                            files: [file]
                        });
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        return;
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                        return;
                    }
                    console.warn('Mobile share unavailable, using download:', error);
                }
            }

            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            console.error('Could not export history:', error);
            alert('Could not export transaction history');
        }
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

        let transaction;
        try {
            if (!window.activeTransactionId) {
                transaction = TransactionHistory.createRecord(cart, paymentMethod, createInvoiceNumber());
                await TransactionHistory.save(transaction);
                window.activeTransactionId = transaction.id;
            } else {
                transaction = await TransactionHistory.getById(window.activeTransactionId);
            }
        } catch (error) {
            console.error('Could not save transaction:', error);
            alert('Could not save transaction history. The cart was kept so you can retry.');
            return;
        }

        // For other payment methods, print directly
        const status = Bluetooth.getStatus();
        if (!status.isConnected) {
            await TransactionHistory.patch(transaction.id, {
                status: 'print_failed',
                printStatus: 'failed'
            });
            alert('Printer not connected. The sale is saved in History with a print-failed status.');
            return;
        }

        showLoading('Printing receipt...');

        try {
            await Bluetooth.printReceipt(cart, paymentMethod, transaction.invoiceNumber);
            await TransactionHistory.patch(transaction.id, {
                status: 'completed',
                printStatus: 'printed',
                printCount: (transaction.printCount || 0) + 1,
                completedAt: new Date().toISOString()
            });
            showLoading('Print successful', 1000);
            setTimeout(() => {
                Storage.clearCart();
                updateCartDisplay();
                updateTotalDisplay();
                closeCheckout();
                window.activeTransactionId = null;
                showFeedback('Transaction completed');
            }, 1000);
        } catch (e) {
            hideLoading();
            console.error('Print error:', e);
            await TransactionHistory.patch(transaction.id, {
                status: 'print_failed',
                printStatus: 'failed'
            }).catch((historyError) => {
                console.error('Could not update failed print status:', historyError);
            });
            
            // Offer retry or recovery options
            if (confirm('Print failed: ' + e.message + '\n\nRetry?')) {
                handlePayment(paymentMethod);  // Retry
            } else {
                // Ask if user wants to keep items for manual retry or start over
                closeCheckout();  // Close dialog to see cart
                if (confirm('Keep items in cart for another retry, or clear and start over?\n\nOK = Keep items\nCancel = Clear cart')) {
                    // User chose to keep items
                    showFeedback('Cart retained. Try connecting printer again.');
                } else {
                    // User chose to clear
                    Storage.clearCart();
                    updateCartDisplay();
                    updateTotalDisplay();
                    window.activeTransactionId = null;
                    showFeedback('Cart cleared');
                }
            }
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
            { id: '01', value: '2' }, // 0 for mobile number, 2 for UEN
            { id: '02', value: '53138257E' }, // Merchant UEN
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
        window.paynowInvoice = receiptNumber;
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
            let transaction;
            if (!window.paynowTransactionId) {
                transaction = TransactionHistory.createRecord(
                    window.paynowCart,
                    window.paynowMethod,
                    window.paynowInvoice
                );
                await TransactionHistory.save(transaction);
                window.paynowTransactionId = transaction.id;
            } else {
                transaction = await TransactionHistory.getById(window.paynowTransactionId);
            }

            await Bluetooth.printReceipt(
                window.paynowCart,
                window.paynowMethod,
                window.paynowInvoice
            );
            await TransactionHistory.patch(transaction.id, {
                status: 'completed',
                printStatus: 'printed',
                printCount: (transaction.printCount || 0) + 1,
                completedAt: new Date().toISOString()
            });
            showLoading('Print successful', 1000);
            setTimeout(() => {
                Storage.clearCart();
                updateCartDisplay();
                updateTotalDisplay();
                document.getElementById('paynowModal').classList.remove('active');
                showFeedback('Transaction completed');
                window.paynowCart = null;
                window.paynowTransactionId = null;
                window.paynowInvoice = null;
            }, 1000);
        } catch (e) {
            console.error('Print error:', e);
            hideLoading();
            if (window.paynowTransactionId) {
                await TransactionHistory.patch(window.paynowTransactionId, {
                    status: 'print_failed',
                    printStatus: 'failed'
                }).catch((historyError) => {
                    console.error('Could not update failed print status:', historyError);
                });
            }
            alert('Print failed: ' + e.message);
        }
    };

    /**
     * Close PayNow modal
     */
    const closePayNowModal = () => {
        document.getElementById('paynowModal').classList.remove('active');
        window.paynowCart = null;
        window.paynowTransactionId = null;
        window.paynowInvoice = null;
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
            
            // Update UI to show Bluetooth is not supported
            const statusText = document.getElementById('statusText');
            if (statusText) {
                statusText.textContent = 'Bluetooth not supported on this browser';
                statusText.style.color = '#d33427';  // danger red
                statusText.title = 'Bluetooth not supported on this browser';
            }
            
            const bluetoothStatus = document.getElementById('bluetoothStatus');
            if (bluetoothStatus) {
                bluetoothStatus.style.cursor = 'not-allowed';
                bluetoothStatus.title = 'Web Bluetooth not supported. Use Chrome, Edge, or Opera on Android/iOS.';
                bluetoothStatus.onclick = null;
                bluetoothStatus.setAttribute('aria-disabled', 'true');
                bluetoothStatus.classList.remove('status-connected', 'status-disconnected');
                bluetoothStatus.classList.add('status-unavailable');
            }
            const statusIndicator = document.querySelector('.status-indicator');
            if (statusIndicator) {
                statusIndicator.classList.remove('connected');
                statusIndicator.classList.add('disconnected');
            }
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
                // User likely cancelled, no need for alert
            }
        } catch (e) {
            hideLoading();
            
            // Only show alert for actual errors, not user cancellations
            if (e.name !== 'NotFoundError') {
                console.error('Connection error:', e);
                alert('Connection error: ' + e.message);
            }
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

        statusText.style.color = '';
        statusText.removeAttribute('title');
        bluetoothStatus.removeAttribute('aria-disabled');
        bluetoothStatus.classList.remove('status-unavailable');

        if (status.isConnected) {
            statusIndicator.classList.remove('disconnected');
            statusIndicator.classList.add('connected');
            statusText.textContent = 'Connected to ' + (status.deviceName || 'Printer');
            bluetoothStatus.title = 'Connected to ' + (status.deviceName || 'Printer');
            bluetoothStatus.classList.remove('status-disconnected');
            bluetoothStatus.classList.add('status-connected');
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
            const rememberedPrinterName = Storage.getPairedPrinterName();
            statusText.textContent = rememberedPrinterName
                ? 'Disconnected · ' + rememberedPrinterName
                : 'Disconnected';
            bluetoothStatus.title = rememberedPrinterName
                ? 'Last printer: ' + rememberedPrinterName + '. Tap to reconnect.'
                : 'Tap to connect a printer';
            bluetoothStatus.classList.remove('status-connected');
            bluetoothStatus.classList.add('status-disconnected');
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

        // Menu / Dashboard
        const menuBtn = document.getElementById('menuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', openMenuModal);
        }
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', closeMenuModal);
        }
        const menuModal = document.getElementById('menuModal');
        if (menuModal) {
            menuModal.addEventListener('click', (e) => {
                if (e.target.id === 'menuModal') {
                    closeMenuModal();
                }
            });
        }
        const setupMenuBtn = document.getElementById('setupMenuBtn');
        if (setupMenuBtn) {
            setupMenuBtn.addEventListener('click', openSetupModal);
        }
        const closeSetupBtn = document.getElementById('closeSetupBtn');
        if (closeSetupBtn) {
            closeSetupBtn.addEventListener('click', closeSetupModal);
        }
        const saveSetupBtn = document.getElementById('saveSetupBtn');
        if (saveSetupBtn) {
            saveSetupBtn.addEventListener('click', saveSetup);
        }
        const setupModal = document.getElementById('setupModal');
        if (setupModal) {
            setupModal.addEventListener('click', (e) => {
                if (e.target.id === 'setupModal') {
                    closeSetupModal();
                }
            });
        }

        // X / Z Reports
        const xReportMenuBtn = document.getElementById('xReportMenuBtn');
        if (xReportMenuBtn) {
            xReportMenuBtn.addEventListener('click', openXReport);
        }
        const zReportMenuBtn = document.getElementById('zReportMenuBtn');
        if (zReportMenuBtn) {
            zReportMenuBtn.addEventListener('click', openZReport);
        }
        const closeReportBtn = document.getElementById('closeReportBtn');
        const closeReportFooterBtn = document.getElementById('closeReportFooterBtn');
        if (closeReportBtn) {
            closeReportBtn.addEventListener('click', closeReportModal);
        }
        if (closeReportFooterBtn) {
            closeReportFooterBtn.addEventListener('click', closeReportModal);
        }
        const printReportBtn = document.getElementById('printReportBtn');
        if (printReportBtn) {
            printReportBtn.addEventListener('click', printActiveReport);
        }
        const reportModal = document.getElementById('reportModal');
        if (reportModal) {
            reportModal.addEventListener('click', (e) => {
                if (e.target.id === 'reportModal') {
                    closeReportModal();
                }
            });
        }

        // Transaction History
        const historyMenuBtn = document.getElementById('historyMenuBtn');
        if (historyMenuBtn) {
            historyMenuBtn.addEventListener('click', openHistoryModal);
        }
        const closeHistoryBtn = document.getElementById('closeHistoryBtn');
        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', closeHistoryModal);
        }
        const historyModal = document.getElementById('historyModal');
        if (historyModal) {
            historyModal.addEventListener('click', (e) => {
                if (e.target.id === 'historyModal') {
                    closeHistoryModal();
                }
            });
        }
        ['historySearch', 'historyFrom', 'historyTo', 'historyPayment'].forEach((id) => {
            const control = document.getElementById(id);
            if (control) {
                control.addEventListener(id === 'historySearch' ? 'input' : 'change', () => {
                    historyOffset = 0;
                    historyRecords = [];
                    refreshHistory();
                });
            }
        });
        const historyLoadMoreBtn = document.getElementById('historyLoadMoreBtn');
        if (historyLoadMoreBtn) {
            historyLoadMoreBtn.addEventListener('click', () => {
                historyOffset += 50;
                refreshHistory(true);
            });
        }
        const closeHistoryDetailBtn = document.getElementById('closeHistoryDetailBtn');
        const closeHistoryDetailFooterBtn = document.getElementById('closeHistoryDetailFooterBtn');
        if (closeHistoryDetailBtn) {
            closeHistoryDetailBtn.addEventListener('click', closeHistoryDetail);
        }
        if (closeHistoryDetailFooterBtn) {
            closeHistoryDetailFooterBtn.addEventListener('click', closeHistoryDetail);
        }
        const historyDetailModal = document.getElementById('historyDetailModal');
        if (historyDetailModal) {
            historyDetailModal.addEventListener('click', (e) => {
                if (e.target.id === 'historyDetailModal') {
                    closeHistoryDetail();
                }
            });
        }
        const reprintHistoryBtn = document.getElementById('reprintHistoryBtn');
        if (reprintHistoryBtn) {
            reprintHistoryBtn.addEventListener('click', reprintHistoryTransaction);
        }
        const deleteHistoryBtn = document.getElementById('deleteHistoryBtn');
        if (deleteHistoryBtn) {
            deleteHistoryBtn.addEventListener('click', deleteHistoryTransaction);
        }
        const restoreHistoryBtn = document.getElementById('restoreHistoryBtn');
        if (restoreHistoryBtn) {
            restoreHistoryBtn.addEventListener('click', restoreHistoryTransaction);
        }
        const toCartHistoryBtn = document.getElementById('toCartHistoryBtn');
        if (toCartHistoryBtn) {
            toCartHistoryBtn.addEventListener('click', toCartHistoryTransaction);
        }
        const exportHistoryCsvBtn = document.getElementById('exportHistoryCsvBtn');
        if (exportHistoryCsvBtn) {
            exportHistoryCsvBtn.addEventListener('click', () => exportHistory('csv'));
        }
        const exportHistoryJsonBtn = document.getElementById('exportHistoryJsonBtn');
        if (exportHistoryJsonBtn) {
            exportHistoryJsonBtn.addEventListener('click', () => exportHistory('json'));
        }
        const importHistoryBtn = document.getElementById('importHistoryBtn');
        const historyImportFile = document.getElementById('historyImportFile');
        if (importHistoryBtn && historyImportFile) {
            importHistoryBtn.addEventListener('click', () => historyImportFile.click());
            historyImportFile.addEventListener('change', () => {
                importHistoryFile(historyImportFile.files[0]);
            });
        }
        const deleteAllHistoryBtn = document.getElementById('deleteAllHistoryBtn');
        if (deleteAllHistoryBtn) {
            deleteAllHistoryBtn.addEventListener('click', deleteAllHistory);
        }
        const historyBinBtn = document.getElementById('historyBinBtn');
        if (historyBinBtn) {
            historyBinBtn.addEventListener('click', toggleHistoryBin);
        }

        document.querySelectorAll('[data-menu-action]').forEach(button => {
            button.addEventListener('click', () => {
                showFeedback(`${button.dataset.menuAction} is coming soon`);
            });
        });

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
