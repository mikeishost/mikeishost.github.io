/**
 * Storage Management Module
 * Handles all localStorage operations for POS state
 */

const Storage = (() => {
    const KEYS = {
        WORD_CLOUD_LINE1: 'pos_wordCloudLine1',
        WORD_CLOUD_LINE2: 'pos_wordCloudLine2',
        SELECTED_WORDS: 'pos_selectedWords',
        CART: 'pos_cart',
        PAIRED_PRINTER_ID: 'pos_pairedPrinterId'
    };

    // Default word cloud lines
    const DEFAULT_LINE1 = ['Perfume', 'Skincare', 'Generic', 'Dior', 'Tom Ford', 'Gucci'];
    const DEFAULT_LINE2 = ['N/A', 'Products', '100ml', '50ml', '30ml', 'Tester', 'Set'];
    
    // Default selected words
    const DEFAULT_SELECTED = {
        line1: 'Perfume',
        line2: 'N/A'
    };

    /**
     * Initialize localStorage with default data if empty
     */
    const init = () => {
        if (!localStorage.getItem(KEYS.WORD_CLOUD_LINE1)) {
            localStorage.setItem(KEYS.WORD_CLOUD_LINE1, JSON.stringify(DEFAULT_LINE1));
        }
        if (!localStorage.getItem(KEYS.WORD_CLOUD_LINE2)) {
            localStorage.setItem(KEYS.WORD_CLOUD_LINE2, JSON.stringify(DEFAULT_LINE2));
        }
        if (!localStorage.getItem(KEYS.SELECTED_WORDS)) {
            localStorage.setItem(KEYS.SELECTED_WORDS, JSON.stringify(DEFAULT_SELECTED));
        }
        if (!localStorage.getItem(KEYS.CART)) {
            localStorage.setItem(KEYS.CART, JSON.stringify([]));
        }
    };

    /**
     * Get word cloud line 1
     */
    const getWordCloudLine1 = () => {
        try {
            const line = localStorage.getItem(KEYS.WORD_CLOUD_LINE1);
            return line ? JSON.parse(line) : DEFAULT_LINE1;
        } catch (e) {
            console.error('Error parsing word cloud line 1:', e);
            return DEFAULT_LINE1;
        }
    };

    /**
     * Get word cloud line 2
     */
    const getWordCloudLine2 = () => {
        try {
            const line = localStorage.getItem(KEYS.WORD_CLOUD_LINE2);
            return line ? JSON.parse(line) : DEFAULT_LINE2;
        } catch (e) {
            console.error('Error parsing word cloud line 2:', e);
            return DEFAULT_LINE2;
        }
    };

    /**
     * Get selected words
     */
    const getSelectedWords = () => {
        try {
            const selected = localStorage.getItem(KEYS.SELECTED_WORDS);
            return selected ? JSON.parse(selected) : DEFAULT_SELECTED;
        } catch (e) {
            console.error('Error parsing selected words:', e);
            return DEFAULT_SELECTED;
        }
    };

    /**
     * Set selected word for a line
     */
    const setSelectedWord = (line, word) => {
        const selected = getSelectedWords();
        selected[line] = word;
        localStorage.setItem(KEYS.SELECTED_WORDS, JSON.stringify(selected));
    };

    /**
     * Add word to a line
     */
    const addWordToLine = (line, word) => {
        if (line === 'line1') {
            const words = getWordCloudLine1();
            if (!words.includes(word)) {
                words.push(word);
                localStorage.setItem(KEYS.WORD_CLOUD_LINE1, JSON.stringify(words));
            }
        } else if (line === 'line2') {
            const words = getWordCloudLine2();
            if (!words.includes(word)) {
                words.push(word);
                localStorage.setItem(KEYS.WORD_CLOUD_LINE2, JSON.stringify(words));
            }
        }
    };

    /**
     * Remove word from a line
     */
    const removeWordFromLine = (line, word) => {
        if (line === 'line1') {
            const words = getWordCloudLine1();
            const index = words.indexOf(word);
            if (index > -1) {
                words.splice(index, 1);
                localStorage.setItem(KEYS.WORD_CLOUD_LINE1, JSON.stringify(words));
            }
        } else if (line === 'line2') {
            // Cannot delete 'N/A' from line2
            if (word === 'N/A') {
                return false;
            }
            const words = getWordCloudLine2();
            const index = words.indexOf(word);
            if (index > -1) {
                words.splice(index, 1);
                localStorage.setItem(KEYS.WORD_CLOUD_LINE2, JSON.stringify(words));
                return true;
            }
        }
        return true;
    };

    /**
     * Get current cart
     */
    const getCart = () => {
        try {
            const cart = localStorage.getItem(KEYS.CART);
            return cart ? JSON.parse(cart) : [];
        } catch (e) {
            console.error('Error parsing cart:', e);
            return [];
        }
    };

    /**
     * Add item to cart
     */
    const addToCart = (item) => {
        const cart = getCart();
        const existingItem = cart.find(i => i.name === item.name && i.price === item.price);
        if (existingItem) {
            existingItem.quantity = (existingItem.quantity || 1) + (item.quantity || 1);
        } else {
            cart.push({
                id: Math.random().toString(36).substr(2, 9),
                name: item.name,
                price: item.price,
                quantity: item.quantity || 1
            });
        }
        setCart(cart);
    };

    /**
     * Update item quantity in cart
     */
    const updateItemQuantity = (cartItemId, quantity) => {
        const cart = getCart();
        const item = cart.find(i => i.id === cartItemId);
        if (item) {
            if (quantity <= 0) {
                removeFromCart(cartItemId);
            } else {
                item.quantity = quantity;
                setCart(cart);
            }
        }
    };

    /**
     * Remove item from cart by cart item ID
     */
    const removeFromCart = (cartItemId) => {
        const cart = getCart();
        const filtered = cart.filter(item => item.id !== cartItemId);
        setCart(filtered);
    };

    /**
     * Set entire cart
     */
    const setCart = (items) => {
        localStorage.setItem(KEYS.CART, JSON.stringify(items));
    };

    /**
     * Clear cart
     */
    const clearCart = () => {
        localStorage.setItem(KEYS.CART, JSON.stringify([]));
    };

    /**
     * Get paired printer ID
     */
    const getPairedPrinterId = () => {
        return localStorage.getItem(KEYS.PAIRED_PRINTER_ID);
    };

    /**
     * Set paired printer ID
     */
    const setPairedPrinterId = (deviceId) => {
        if (deviceId) {
            localStorage.setItem(KEYS.PAIRED_PRINTER_ID, deviceId);
        }
    };

    /**
     * Clear paired printer ID
     */
    const clearPairedPrinterId = () => {
        localStorage.removeItem(KEYS.PAIRED_PRINTER_ID);
    };

    // Public API
    return {
        init,
        getWordCloudLine1,
        getWordCloudLine2,
        getSelectedWords,
        setSelectedWord,
        addWordToLine,
        removeWordFromLine,
        getCart,
        addToCart,
        updateItemQuantity,
        removeFromCart,
        setCart,
        clearCart,
        getPairedPrinterId,
        setPairedPrinterId,
        clearPairedPrinterId
    };
})();
