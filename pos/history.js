/**
 * IndexedDB transaction history module
 * Keeps records stable and extensible across app updates.
 */

const TransactionHistory = (() => {
    const DB_NAME = 'st_thomas_pos';
    const DB_VERSION = 2;
    const STORE_NAME = 'transactions';
    const REPORT_STORE = 'salesReports';
    const SHIFT_STORE = 'shiftState';
    let dbPromise = null;

    const open = () => {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('IndexedDB is not supported on this browser'));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                let store;

                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                } else {
                    store = request.transaction.objectStore(STORE_NAME);
                }

                if (!store.indexNames.contains('createdAt')) {
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
                if (!store.indexNames.contains('paymentMethod')) {
                    store.createIndex('paymentMethod', 'paymentMethod', { unique: false });
                }
                if (!store.indexNames.contains('status')) {
                    store.createIndex('status', 'status', { unique: false });
                }
                if (!store.indexNames.contains('invoiceNumber')) {
                    store.createIndex('invoiceNumber', 'invoiceNumber', { unique: false });
                }

                if (!db.objectStoreNames.contains(SHIFT_STORE)) {
                    db.createObjectStore(SHIFT_STORE, { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains(REPORT_STORE)) {
                    const reportStore = db.createObjectStore(REPORT_STORE, { keyPath: 'id' });
                    reportStore.createIndex('closedAt', 'closedAt', { unique: false });
                    reportStore.createIndex('type', 'type', { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not open transaction history'));
            request.onblocked = () => reject(new Error('Transaction history is being used by an older app tab'));
        });

        return dbPromise;
    };

    const newId = () => {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'tx-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
    };

    const toCents = (value) => Math.round((Number(value) || 0) * 100);
    const normalizeText = (value) => typeof value === 'string' ? value : '';

    const normalizeRecord = (record) => {
        if (!record || typeof record !== 'object') return null;

        const rawItems = Array.isArray(record.items) ? record.items : [];
        const items = rawItems.map((item) => {
            const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
            const unitPriceCents = Number.isInteger(item.unitPriceCents)
                ? item.unitPriceCents
                : toCents(item.price);
            const lineTotalCents = Number.isInteger(item.lineTotalCents)
                ? item.lineTotalCents
                : unitPriceCents * quantity;

            return {
                name: normalizeText(item.name),
                quantity,
                unitPriceCents,
                lineTotalCents
            };
        });

        const totalCents = Number.isInteger(record.totalCents)
            ? record.totalCents
            : items.reduce((sum, item) => sum + item.lineTotalCents, 0);

        return {
            schemaVersion: 1,
            id: normalizeText(record.id) || newId(),
            invoiceNumber: normalizeText(record.invoiceNumber),
            createdAt: normalizeText(record.createdAt) || new Date().toISOString(),
            completedAt: normalizeText(record.completedAt) || null,
            updatedAt: normalizeText(record.updatedAt) || new Date().toISOString(),
            paymentMethod: normalizeText(record.paymentMethod) || 'Unknown',
            status: normalizeText(record.status) || 'completed',
            printStatus: normalizeText(record.printStatus) || 'not_printed',
            printCount: Number.isInteger(record.printCount) ? record.printCount : 0,
            reprintCount: Number.isInteger(record.reprintCount) ? record.reprintCount : 0,
            lastReprintedAt: normalizeText(record.lastReprintedAt) || null,
            bin: record.bin === true,
            deletedAt: normalizeText(record.deletedAt) || null,
            zClosed: record.zClosed === true,
            zReportId: normalizeText(record.zReportId) || null,
            zClosedAt: normalizeText(record.zClosedAt) || null,
            items,
            totalCents,
            currency: normalizeText(record.currency) || 'SGD',
            receiptConfig: record.receiptConfig && typeof record.receiptConfig === 'object'
                ? record.receiptConfig
                : {}
        };
    };

    const createRecord = (cartItems, paymentMethod, invoiceNumber) => {
        const now = new Date().toISOString();
        const items = cartItems.map((item) => {
            const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
            const unitPriceCents = toCents(item.price);
            return {
                name: normalizeText(item.name),
                quantity,
                unitPriceCents,
                lineTotalCents: unitPriceCents * quantity
            };
        });

        return normalizeRecord({
            schemaVersion: 1,
            id: newId(),
            invoiceNumber: normalizeText(invoiceNumber),
            createdAt: now,
            completedAt: null,
            updatedAt: now,
            paymentMethod: normalizeText(paymentMethod),
            status: 'pending',
            printStatus: 'not_printed',
            printCount: 0,
            reprintCount: 0,
            lastReprintedAt: null,
            bin: false,
            deletedAt: null,
            zClosed: false,
            zReportId: null,
            zClosedAt: null,
            items,
            totalCents: items.reduce((sum, item) => sum + item.lineTotalCents, 0),
            currency: 'SGD',
            receiptConfig: Storage.getReceiptConfig()
        });
    };

    const runTransaction = async (mode, operation) => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, mode);
            const store = tx.objectStore(STORE_NAME);
            let result;

            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(tx.error || new Error('Transaction history operation failed'));
            tx.onabort = () => reject(tx.error || new Error('Transaction history operation was cancelled'));

            try {
                result = operation(store, tx);
            } catch (error) {
                tx.abort();
                reject(error);
            }
        });
    };

    const save = async (record) => {
        const normalized = normalizeRecord(record);
        await runTransaction('readwrite', (store) => {
            store.put(normalized);
        });
        return normalized;
    };

    const getById = async (id) => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.get(id);
            request.onsuccess = () => resolve(normalizeRecord(request.result));
            request.onerror = () => reject(request.error || new Error('Could not read transaction'));
        });
    };

    const patch = async (id, changes) => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                if (!getRequest.result) {
                    reject(new Error('Transaction was not found'));
                    return;
                }

                const updated = normalizeRecord({
                    ...getRequest.result,
                    ...changes,
                    updatedAt: new Date().toISOString()
                });
                store.put(updated);
                tx.oncomplete = () => resolve(updated);
            };
            tx.onerror = () => reject(tx.error || new Error('Could not update transaction'));
            tx.onabort = () => reject(tx.error || new Error('Transaction update was cancelled'));
        });
    };

    const query = async (filters = {}) => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.index('createdAt').openCursor(null, 'prev');
            const records = [];
            const search = (filters.search || '').trim().toLowerCase();
            const limit = Number.isInteger(filters.limit) ? filters.limit : 50;
            const offset = Number.isInteger(filters.offset) ? filters.offset : 0;
            let skipped = 0;

            request.onerror = () => reject(request.error || new Error('Could not read transaction history'));
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    resolve(records);
                    return;
                }

                const record = normalizeRecord(cursor.value);
                if (record) {
                    if (record.bin) {
                        cursor.continue();
                        return;
                    }
                    const createdTime = new Date(record.createdAt).getTime();
                    const fromTime = filters.from ? new Date(filters.from + 'T00:00:00').getTime() : null;
                    const toTime = filters.to ? new Date(filters.to + 'T23:59:59.999').getTime() : null;
                    const matchesFrom = fromTime === null || createdTime >= fromTime;
                    const matchesTo = toTime === null || createdTime <= toTime;
                    const matchesPayment = !filters.paymentMethod || record.paymentMethod === filters.paymentMethod;
                    const matchesStatus = !filters.status || record.status === filters.status;
                    const searchable = [
                        record.invoiceNumber,
                        record.paymentMethod,
                        record.status,
                        record.items.map((item) => item.name).join(' ')
                    ].join(' ').toLowerCase();

                    if (matchesFrom && matchesTo && matchesPayment && matchesStatus &&
                        (!search || searchable.includes(search))) {
                        if (skipped < offset) {
                            skipped++;
                        } else if (records.length < limit) {
                            records.push(record);
                        }
                    }
                }

                if (records.length < limit) {
                    cursor.continue();
                } else {
                    resolve(records);
                }
            };
        });
    };

    const getAll = async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(
                request.result.map(normalizeRecord).filter((record) => record && !record.bin)
            );
            request.onerror = () => reject(request.error || new Error('Could not export transaction history'));
        });
    };

    const ensureShift = async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(SHIFT_STORE, 'readwrite');
            const store = tx.objectStore(SHIFT_STORE);
            const request = store.get('current');

            request.onsuccess = () => {
                if (request.result) {
                    resolve(request.result);
                    return;
                }

                const opened = {
                    id: 'current',
                    schemaVersion: 1,
                    openedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                store.put(opened);
                tx.oncomplete = () => resolve(opened);
            };
            tx.onerror = () => reject(tx.error || new Error('Could not open sales shift'));
            tx.onabort = () => reject(tx.error || new Error('Could not open sales shift'));
        });
    };

    const isIncludedSale = (record) =>
        record.status !== 'void' &&
        record.status !== 'pending' &&
        record.status !== 'deleted' &&
        record.bin !== true;

    const buildReport = async (type, asOf = new Date()) => {
        await ensureShift();
        const db = await open();
        const shift = await new Promise((resolve, reject) => {
            const tx = db.transaction(SHIFT_STORE, 'readonly');
            const request = tx.objectStore(SHIFT_STORE).get('current');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not read sales shift'));
        });

        const records = await getAll();
        const openedTime = shift && shift.openedAt
            ? new Date(shift.openedAt).getTime()
            : 0;
        const closedTime = asOf.getTime();
        const periodRecords = records.filter((record) => {
            const createdTime = new Date(record.createdAt).getTime();
            return createdTime >= openedTime && createdTime <= closedTime && isIncludedSale(record);
        });

        const payments = {};
        const items = {};
        let transactionCount = 0;
        let itemCount = 0;
        let grossCents = 0;

        periodRecords.forEach((record) => {
            transactionCount++;
            grossCents += Number(record.totalCents) || 0;
            const payment = normalizeText(record.paymentMethod) || 'Unknown';
            payments[payment] = (payments[payment] || 0) + (Number(record.totalCents) || 0);

            record.items.forEach((item) => {
                itemCount += item.quantity;
                const name = normalizeText(item.name) || 'Unnamed item';
                if (!items[name]) {
                    items[name] = { name, quantity: 0, totalCents: 0 };
                }
                items[name].quantity += item.quantity;
                items[name].totalCents += item.lineTotalCents;
            });
        });

        return {
            schemaVersion: 1,
            id: type === 'Z'
                ? 'Z-' + asOf.toISOString()
                : 'X-' + asOf.toISOString(),
            type,
            openedAt: shift ? shift.openedAt : new Date(openedTime).toISOString(),
            closedAt: type === 'Z' ? asOf.toISOString() : null,
            generatedAt: asOf.toISOString(),
            currency: 'SGD',
            transactionCount,
            itemCount,
            grossCents,
            payments,
            items: Object.values(items).sort((a, b) => b.quantity - a.quantity),
            periodRecordIds: periodRecords.map((record) => record.id)
        };
    };

    const closeShift = async () => {
        const now = new Date();
        const report = await buildReport('Z', now);
        report.id = 'Z-' + now.toISOString();

        const db = await open();
        await new Promise((resolve, reject) => {
            const tx = db.transaction([REPORT_STORE, SHIFT_STORE, STORE_NAME], 'readwrite');
            tx.objectStore(REPORT_STORE).put(report);
            tx.objectStore(SHIFT_STORE).put({
                id: 'current',
                schemaVersion: 1,
                openedAt: now.toISOString(),
                updatedAt: now.toISOString(),
                previousZReportId: report.id
            });

            const transactionStore = tx.objectStore(STORE_NAME);
            const getAllRequest = transactionStore.getAll();
            getAllRequest.onsuccess = () => {
                getAllRequest.result.forEach((rawRecord) => {
                    const record = normalizeRecord(rawRecord);
                    if (record.bin) {
                        transactionStore.delete(record.id);
                    } else if (report.periodRecordIds.includes(record.id)) {
                        transactionStore.put({
                            ...record,
                            zClosed: true,
                            zReportId: report.id,
                            zClosedAt: now.toISOString(),
                            updatedAt: now.toISOString()
                        });
                    }
                });
            };
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Could not close sales shift'));
            tx.onabort = () => reject(tx.error || new Error('Could not close sales shift'));
        });
        return report;
    };

    const getZReports = async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(REPORT_STORE, 'readonly');
            const request = tx.objectStore(REPORT_STORE).getAll();
            request.onsuccess = () => resolve(request.result.filter((report) => report.type === 'Z'));
            request.onerror = () => reject(request.error || new Error('Could not read Z reports'));
        });
    };

    const moveToBin = async (id) => {
        const record = await getById(id);
        if (!record) throw new Error('Transaction was not found');
        if (record.zClosed) throw new Error('Closed transactions cannot be deleted');

        return patch(id, {
            bin: true,
            deletedAt: new Date().toISOString(),
            status: 'deleted'
        });
    };

    const restoreFromBin = async (id) => {
        const record = await getById(id);
        if (!record) throw new Error('Transaction was not found');

        return patch(id, {
            bin: false,
            deletedAt: null,
            status: record.printStatus === 'printed' ? 'completed' : 'print_failed'
        });
    };

    const getBin = async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const request = tx.objectStore(STORE_NAME).getAll();
            request.onsuccess = () => resolve(
                request.result.map(normalizeRecord).filter((record) => record && record.bin)
                    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt))
            );
            request.onerror = () => reject(request.error || new Error('Could not read transaction bin'));
        });
    };

    const deleteOpenToday = async () => {
        const db = await open();
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const shift = await new Promise((resolve, reject) => {
            const tx = db.transaction(SHIFT_STORE, 'readonly');
            const request = tx.objectStore(SHIFT_STORE).get('current');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('Could not read current shift'));
        });
        const periodStart = shift && shift.openedAt
            ? new Date(shift.openedAt).getTime()
            : startOfToday.getTime();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            let deleted = 0;

            request.onsuccess = () => {
                request.result.forEach((rawRecord) => {
                    const record = normalizeRecord(rawRecord);
                    const createdTime = new Date(record.createdAt).getTime();
                    if (createdTime >= startOfToday.getTime() &&
                        createdTime >= periodStart &&
                        record.status !== 'void' &&
                        record.status !== 'pending') {
                        store.delete(record.id);
                        deleted++;
                    }
                });
            };
            tx.oncomplete = () => resolve(deleted);
            tx.onerror = () => reject(tx.error || new Error('Could not delete open transactions'));
            tx.onabort = () => reject(tx.error || new Error('Could delete open transactions'));
        });
    };

    const clearAll = async () => {
        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME, REPORT_STORE, SHIFT_STORE], 'readwrite');
            tx.objectStore(STORE_NAME).clear();
            tx.objectStore(REPORT_STORE).clear();
            tx.objectStore(SHIFT_STORE).put({
                id: 'current',
                schemaVersion: 1,
                openedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Could not clear transaction history'));
            tx.onabort = () => reject(tx.error || new Error('Could not clear transaction history'));
        });
    };

    const importRecords = async (records) => {
        if (!Array.isArray(records)) {
            throw new Error('Import data must contain a transaction array');
        }

        const db = await open();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            let imported = 0;

            records.forEach((rawRecord) => {
                const record = normalizeRecord(rawRecord);
                if (record) {
                    store.put(record);
                    imported++;
                }
            });

            tx.oncomplete = () => resolve(imported);
            tx.onerror = () => reject(tx.error || new Error('Could not import transaction history'));
            tx.onabort = () => reject(tx.error || new Error('Could not import transaction history'));
        });
    };

    return {
        open,
        createRecord,
        save,
        getById,
        patch,
        query,
        getAll,
        ensureShift,
        buildReport,
        closeShift,
        getZReports,
        deleteOpenToday,
        moveToBin,
        restoreFromBin,
        getBin,
        clearAll,
        importRecords
    };
})();
