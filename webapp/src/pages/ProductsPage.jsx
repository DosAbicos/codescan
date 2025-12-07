import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getProducts, downloadExcel, updateProductBarcode } from '../utils/api';
import './ProductsPage.css';

function ProductsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('no_barcode');
  const [downloading, setDownloading] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editBarcode, setEditBarcode] = useState('');

  useEffect(() => {
    loadAllProducts();
  }, []);

  useEffect(() => {
    filterProducts();
  }, [activeTab, allProducts]);

  useEffect(() => {
    // Показываем alert ОДИН РАЗ и очищаем state чтобы не повторялся
    if (location.state?.message) {
      const msg = location.state.message;
      // Очищаем state
      window.history.replaceState({}, document.title);
      // Показываем сообщение
      setTimeout(() => {
        alert(msg);
        loadAllProducts();
      }, 100);
    }
    if (location.state?.error) {
      const err = location.state.error;
      // Очищаем state
      window.history.replaceState({}, document.title);
      // Показываем ошибку
      setTimeout(() => {
        alert(err);
        loadAllProducts();
      }, 100);
    }
  }, [location.state]);

  const loadAllProducts = async () => {
    try {
      setLoading(true);
      const dataWithBarcode = await getProducts({ has_barcode: true, limit: 10000 });
      const dataWithoutBarcode = await getProducts({ has_barcode: false, limit: 10000 });
      const all = [...(dataWithBarcode.products || []), ...(dataWithoutBarcode.products || [])];
      setAllProducts(all);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterProducts = () => {
    const hasBarcode = activeTab === 'with_barcode';
    const filtered = allProducts.filter(p => hasBarcode ? p.barcode : !p.barcode);
    setProducts(filtered);
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await downloadExcel();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'updated_products.xls';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка скачивания:', error);
      alert('Не удалось скачать файл');
    } finally {
      setDownloading(false);
    }
  };

  const productsWithoutBarcode = allProducts.filter(p => !p.barcode).length;
  const productsWithBarcode = allProducts.filter(p => p.barcode).length;

  const handleEdit = (product) => {
    setEditingProduct(product);
    setEditQuantity(product.quantity_actual?.toString() || '');
    setEditBarcode(product.barcode || '');
  };

  const handleSaveEdit = async () => {
    if (!editingProduct) return;

    try {
      await updateProductBarcode(editingProduct.id, {
        barcode: editBarcode,
        quantity_actual: editQuantity ? parseFloat(editQuantity) : null,
      });
      setEditingProduct(null);
      await loadAllProducts();
      alert('Товар обновлен!');
    } catch (error) {
      console.error('Ошибка обновления:', error);
      alert('Не удалось обновить товар');
    }
  };

  const handleDelete = async (product) => {
    if (!confirm(`Удалить штрихкод у товара "${product.name}"?`)) return;

    try {
      console.log('Удаление штрихкода для товара:', product.id);
      console.log('Текущий штрихкод:', product.barcode);
      
      // Отправляем запрос на удаление
      const response = await updateProductBarcode(product.id, {
        barcode: null,
        quantity_actual: product.quantity_warehouse, // Сохраняем количество склада
      });
      
      console.log('Ответ от сервера:', response);
      
      // Перезагружаем список товаров
      await loadAllProducts();
      
      // БЕЗ ALERT - просто молча обновляем список
    } catch (error) {
      console.error('Ошибка удаления:', error);
      console.error('Полная ошибка:', JSON.stringify(error, null, 2));
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      alert(`Ошибка: ${error.response?.data?.detail || error.message}`);
    }
  };

  return (
    <div className="products-container">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Назад
        </button>
        <h1 className="header-title">Товары</h1>
        <button 
          className="download-button"
          onClick={handleDownload}
          disabled={downloading}
        >
          {downloading ? '...' : '📥'}
        </button>
      </div>

      <div className="products-content">
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Поиск товара..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'no_barcode' ? 'active' : ''}`}
            onClick={() => setActiveTab('no_barcode')}
          >
            Без штрихкода ({productsWithoutBarcode})
          </button>
          <button
            className={`tab ${activeTab === 'with_barcode' ? 'active' : ''}`}
            onClick={() => setActiveTab('with_barcode')}
          >
            Со штрихкодом ({productsWithBarcode})
          </button>
        </div>

        {loading ? (
          <div className="loading">
            <div className="spinner"></div>
          </div>
        ) : (
          <>
            {filteredProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📦</div>
                <p>Товары не найдены</p>
              </div>
            ) : (
              <div className="products-list">
                {filteredProducts.map((product) => (
                  <div key={product.id} className="product-card">
                    <div className="product-info">
                      <h3 className="product-name">{product.name}</h3>
                      {product.barcode && (
                        <div className="barcode-display">
                          📊 {product.barcode}
                        </div>
                      )}
                      <div className="quantity-info">
                        {product.quantity_warehouse && (
                          <span className="quantity">Склад: {product.quantity_warehouse}</span>
                        )}
                        {product.quantity_actual && (
                          <span className="quantity">Факт: {product.quantity_actual}</span>
                        )}
                      </div>
                    </div>
                    {activeTab === 'with_barcode' && (
                      <div className="product-actions">
                        <button
                          className="edit-button"
                          onClick={() => handleEdit(product)}
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => handleDelete(product)}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'no_barcode' && filteredProducts.length > 0 && (
          <button
            className="button button-success floating-scan-button"
            onClick={() => navigate('/scanner')}
          >
            📷 Сканировать штрихкод
          </button>
        )}

        {editingProduct && (
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Редактировать товар</h2>
                <button 
                  className="close-button"
                  onClick={() => setEditingProduct(null)}
                >
                  ✕
                </button>
              </div>

              <div className="edit-product-info">
                <p className="edit-product-name">{editingProduct.name}</p>
                <p className="edit-product-warehouse">
                  На складе: {editingProduct.quantity_warehouse || 0}
                </p>
              </div>

              <div className="input-group">
                <label>Штрихкод:</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Введите штрихкод"
                  value={editBarcode}
                  onChange={(e) => setEditBarcode(e.target.value)}
                />
                <button
                  className="button button-primary"
                  onClick={() => {
                    setEditingProduct(null);
                    navigate(`/scanner?editProductId=${editingProduct.id}`);
                  }}
                  style={{width: '100%', marginTop: '8px'}}
                >
                  📷 Пересканировать штрихкод
                </button>
              </div>

              <div className="input-group">
                <label>Количество факт:</label>
                <input
                  className="input"
                  type="number"
                  placeholder="Введите количество"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                />
              </div>

              <div className="modal-buttons">
                <button
                  className="button button-outline"
                  onClick={() => setEditingProduct(null)}
                >
                  Отмена
                </button>
                <button
                  className="button button-success"
                  onClick={handleSaveEdit}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProductsPage;
