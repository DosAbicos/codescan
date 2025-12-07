// Работа с локальным хранилищем БЕЗ backend
import * as XLSX from 'xlsx';

const DB_NAME = 'BarcodeAppDB';
const DB_VERSION = 1;

class LocalDataManager {
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

        if (!db.objectStoreNames.contains('products')) {
          const store = db.createObjectStore('products', { keyPath: 'id' });
          store.createIndex('barcode', 'barcode', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }

        if (!db.objectStoreNames.contains('session')) {
          db.createObjectStore('session', { keyPath: 'id' });
        }
      };
    });
  }

  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

          // Парсим данные
          const products = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row[0]) {
              products.push({
                id: `product-${i}`,
                name: row[0] || '',
                barcode: row[1] || null,
                quantity_warehouse: row[2] || 0,
                quantity_actual: row[3] || null,
              });
            }
          }

          resolve({ filename: file.name, products });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  async saveProducts(products) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readwrite');
      const store = transaction.objectStore('products');

      // Очищаем старые данные
      store.clear();

      // Сохраняем новые
      products.forEach(product => store.put(product));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAllProducts() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readonly');
      const store = transaction.objectStore('products');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async updateProduct(id, updates) {
    if (!this.db) await this.init();

    return new Promise(async (resolve, reject) => {
      const transaction = this.db.transaction(['products'], 'readwrite');
      const store = transaction.objectStore('products');
      
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const product = getRequest.result;
        if (product) {
          Object.assign(product, updates);
          const updateRequest = store.put(product);
          updateRequest.onsuccess = () => resolve(product);
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error('Product not found'));
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async saveSession(session) {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['session'], 'readwrite');
      const store = transaction.objectStore('session');
      const request = store.put({ ...session, id: 'current' });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSession() {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['session'], 'readonly');
      const store = transaction.objectStore('session');
      const request = store.get('current');

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async exportToExcel(products) {
    const data = [
      ['Название', 'Штрихкод', 'Количество склад', 'Количество факт']
    ];

    products.forEach(product => {
      data.push([
        product.name,
        product.barcode || '',
        product.quantity_warehouse || 0,
        product.quantity_actual || ''
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    XLSX.writeFile(workbook, 'updated_products.xlsx');
  }
}

export const localData = new LocalDataManager();
