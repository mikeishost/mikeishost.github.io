/**
 * Web Bluetooth Module
 * Handles BLE connection, device pairing, and print job execution
 */

const Bluetooth = (() => {
    let connectedDevice = null;
    let connectedCharacteristic = null;
    let isConnected = false;

    /**
     * Check if Web Bluetooth API is available
     */
    const isAvailable = () => {
        return !!(navigator.bluetooth);
    };

    /**
     * Try to reconnect to previously paired device
     */
    const tryReconnectPaired = async () => {
        if (!isAvailable()) {
            console.error('Web Bluetooth not available');
            return false;
        }

        const pairedId = Storage.getPairedPrinterId();
        if (!pairedId) {
            console.log('No paired printer found');
            return false;
        }

        try {
            // Check if getDevices() is supported
            if (navigator.bluetooth.getDevices) {
                const devices = await navigator.bluetooth.getDevices();
                const paired = devices.find(d => d.id === pairedId);

                if (paired) {
                    console.log('Found paired device:', pairedId);
                    
                    // If device is not already connected, connect to it
                    if (!paired.gatt.connected) {
                        console.log('Reconnecting to paired device:', pairedId);
                        return await connectToDevice(paired);
                    } else {
                        // Device already connected, update state
                        console.log('Device already connected');
                        connectedDevice = paired;
                        isConnected = true;
                        return true;
                    }
                }
            }
        } catch (e) {
            console.error('Error reconnecting to paired device:', e);
        }

        return false;
    };

    /**
     * Request new device via Bluetooth scanning
     */
    const requestDevice = async () => {
        if (!isAvailable()) {
            console.error('Web Bluetooth not available');
            return false;
        }

        try {
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [
                    '000018f0-0000-1000-8000-00805f9b34fb', // Generic UART service
                    '0000fff0-0000-1000-8000-00805f9b34fb'  // Common Chinese printer service
                ]
            });

            console.log('Device selected:', device.name, device.id);
            return await connectToDevice(device);
        } catch (e) {
            console.error('Device selection cancelled or failed:', e);
            return false;
        }
    };

    /**
     * Connect to a specific BLE device and find write characteristic
     */
    const connectToDevice = async (device) => {
        try {
            console.log('Connecting to device:', device.name);
            const gatt = await device.gatt.connect();
            console.log('GATT connected');

            // Get all services
            const services = await gatt.getPrimaryServices();
            console.log('Found services:', services.length);

            let writeCharacteristic = null;

            // Iterate through services to find a writable characteristic
            for (let service of services) {
                try {
                    const characteristics = await service.getCharacteristics();

                    for (let char of characteristics) {
                        // Check if characteristic supports write or writeWithoutResponse
                        if (
                            char.properties.write ||
                            char.properties.writeWithoutResponse
                        ) {
                            console.log('Found writable characteristic:', char.uuid);
                            writeCharacteristic = char;
                            break;
                        }
                    }

                    if (writeCharacteristic) break;
                } catch (e) {
                    // Some services may not be accessible, continue
                    console.warn('Error accessing service:', e);
                }
            }

            if (!writeCharacteristic) {
                console.error('No writable characteristic found');
                return false;
            }

            connectedDevice = device;
            connectedCharacteristic = writeCharacteristic;
            isConnected = true;

            // Store paired printer ID
            Storage.setPairedPrinterId(device.id);

            // Add disconnection listener to track device state
            device.addEventListener('gattserverdisconnected', () => {
                console.log('Device disconnected: ' + device.name);
                isConnected = false;
                connectedDevice = null;
                connectedCharacteristic = null;
                
                // Optionally trigger UI update callback here if available
                console.warn('Bluetooth device lost connection. Please reconnect.');
            });

            console.log('Device connected successfully:', device.name);
            return true;
        } catch (e) {
            console.error('Connection failed:', e);
            isConnected = false;
            return false;
        }
    };

    /**
     * Disconnect from device
     */
    const disconnect = () => {
        try {
            if (connectedDevice && connectedDevice.gatt.connected) {
                connectedDevice.gatt.disconnect();
                console.log('Disconnected from device');
            }
        } catch (e) {
            console.error('Disconnect error:', e);
        }

        connectedDevice = null;
        connectedCharacteristic = null;
        isConnected = false;
    };

    /**
     * Get connection status
     */
    const getStatus = () => {
        return {
            isConnected,
            deviceName: connectedDevice ? connectedDevice.name : null,
            deviceId: connectedDevice ? connectedDevice.id : null
        };
    };

    /**
     * Send receipt to printer with chunking and delays
     * CRITICAL: Splits into 100-byte chunks with 75ms delays
     * SAFETY: Validates device connection before and during transmission
     */
    const sendReceipt = async (receiptData) => {
        if (!isConnected || !connectedCharacteristic || !connectedDevice) {
            console.error('Not connected to printer');
            throw new Error('Printer not connected');
        }

        // Verify device is still connected
        if (!connectedDevice.gatt.connected) {
            isConnected = false;
            connectedCharacteristic = null;
            throw new Error('Device disconnected unexpectedly');
        }

        if (!receiptData || receiptData.length === 0) {
            console.error('Empty receipt data');
            throw new Error('No data to print');
        }

        const CHUNK_SIZE = 100; // 100 bytes per chunk
        const DELAY_MS = 75; // 75ms delay between chunks

        try {
            console.log(`Sending receipt: ${receiptData.length} bytes in chunks of ${CHUNK_SIZE}`);

            // Send receipt in chunks
            for (let i = 0; i < receiptData.length; i += CHUNK_SIZE) {
                // Check connection before each chunk
                if (!connectedDevice.gatt.connected) {
                    isConnected = false;
                    throw new Error('Device disconnected during transmission');
                }

                const chunk = receiptData.slice(i, i + CHUNK_SIZE);
                console.log(`Sending chunk ${Math.floor(i / CHUNK_SIZE) + 1}: ${chunk.length} bytes`);

                await connectedCharacteristic.writeValue(chunk);

                // Delay between chunks
                if (i + CHUNK_SIZE < receiptData.length) {
                    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
                }
            }

            console.log('Receipt sent successfully');
            return true;
        } catch (e) {
            console.error('Error sending receipt:', e);
            isConnected = false;
            throw e;
        }
    };

    /**
     * Print receipt: generate, validate, and send
     */
    const printReceipt = async (cartItems, paymentMethod) => {
        try {
            // Validate input
            if (!cartItems || !Array.isArray(cartItems)) {
                throw new Error('Invalid cart items');
            }

            if (cartItems.length === 0) {
                throw new Error('Cart is empty');
            }

            // Validate each item
            for (let item of cartItems) {
                if (!item.name || item.name.trim() === '') {
                    throw new Error('Invalid item: missing name');
                }
                if (item.price === null || item.price === undefined || isNaN(item.price)) {
                    throw new Error(`Invalid item "${item.name}": missing or invalid price`);
                }
                if (item.quantity && item.quantity < 1) {
                    throw new Error(`Invalid item "${item.name}": quantity must be >= 1`);
                }
            }

            // Generate receipt as Uint8Array
            const receiptData = Receipt.generateReceipt(cartItems, paymentMethod);
            if (!receiptData || receiptData.length === 0) {
                throw new Error('Failed to generate receipt');
            }

            // Send to printer
            await sendReceipt(receiptData);

            return true;
        } catch (e) {
            console.error('Print failed:', e);
            throw e;
        }
    };

    // Public API
    return {
        isAvailable,
        tryReconnectPaired,
        requestDevice,
        connectToDevice,
        disconnect,
        getStatus,
        sendReceipt,
        printReceipt
    };
})();
