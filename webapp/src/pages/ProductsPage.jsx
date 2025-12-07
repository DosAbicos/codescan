import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProducts, downloadExcel } from '../utils/api';
import './ProductsPage.css';

function ProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('no_barcode');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [activeTab]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const hasBarcode = activeTab === 'with_barcode';
      const data = await getProducts({ 
        has_barcode: hasBarcode,
        limit: 1000 
      });
      setProducts(data.products || []);
    } catch (error) {
      console.error('Ошибка загрузки товаров:', error);
    } finally {
      setLoading(false);
    }
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

  const productsWithoutBarcode = products.filter(p => !p.barcode).length;
  const productsWithBarcode = products.filter(p => p.barcode).length;

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
                    {activeTab === 'no_barcode' && (
                      <button
                        className="scan-button"
                        onClick={() => navigate('/scanner')}
                      >
                        📷 Сканировать
                      </button>
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
      </div>
    </div>
  );
}

export default ProductsPage;
