// Локальная база данных IndexedDB для офлайн работы
const DB_NAME = 'BarcodeAppDB';
const DB_VERSION = 1;
const STORES = {
  SESSION: 'session',
  PRODUCTS: 'products'
};

class LocalDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Создаем store для сессии
        if (!db.objectStoreNames.contains(STORES.SESSION)) {
          db.createObjectStore(STORES.SESSION, { keyPath: 'id' });
        }

        // Создаем store для товаров
        if (!db.objectStoreNames.contains(STORES.PRODUCTS)) {
          const productStore = db.createObjectStore(STORES.PRODUCTS, { keyPath: 'id' });
          productStore.createIndex('barcode', 'barcode', { unique: false });
          productStore.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  async getSession() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.SESSION], 'readonly');
      const store = transaction.objectStore(STORES.SESSION);
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSession(session) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.SESSION], 'readwrite');
      const store = transaction.objectStore(STORES.SESSION);
      const request = store.put({ ...session, id: 'current' });

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllProducts() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.PRODUCTS], 'readonly');
      const store = transaction.objectStore(STORES.PRODUCTS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getProductById(id) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.PRODUCTS], 'readonly');
      const store = transaction.objectStore(STORES.PRODUCTS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProduct(product) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.PRODUCTS], 'readwrite');
      const store = transaction.objectStore(STORES.PRODUCTS);
      const request = store.put(product);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveProducts(products) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.PRODUCTS], 'readwrite');
      const store = transaction.objectStore(STORES.PRODUCTS);

      products.forEach(product => {
        store.put(product);
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearProducts() {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.PRODUCTS], 'readwrite');
      const store = transaction.objectStore(STORES.PRODUCTS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const localDB = new LocalDB();
