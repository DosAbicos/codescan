import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { getProducts, updateProductBarcode } from '../utils/api';
import './ScannerPage.css';

function ScannerPage() {
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(window.location.search);
  const editProductId = searchParams.get('editProductId');
  const isEditMode = !!editProductId;
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState(null);
  const [manualBarcode, setManualBarcode] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showProductSelector, setShowProductSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showQuantityInput, setShowQuantityInput] = useState(false);
  const [quantity, setQuantity] = useState('');
  const scannerRef = useRef(null);
  const html5QrcodeRef = useRef(null);

  useEffect(() => {
    startScanner();
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (searchQuery.length > 0) {
      searchProducts();
    }
  }, [searchQuery]);

  const startScanner = async () => {
    try {
      const html5Qrcode = new Html5Qrcode('scanner-container');
      html5QrcodeRef.current = html5Qrcode;

      await html5Qrcode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        onScanError
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Ошибка запуска сканера:', err);
      alert('Не удалось запустить камеру. Используйте ручной ввод.');
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.error('Ошибка остановки сканера:', err);
      }
    }
    setIsScanning(false);
  };

  const onScanSuccess = (decodedText) => {
    if (scannedBarcode) return;
    
    setScannedBarcode(decodedText);
    stopScanner();
    
    if (isEditMode) {
      // Режим редактирования - сразу обновляем товар и возвращаемся
      applyBarcodeToEditProduct(decodedText);
    } else {
      setShowProductSelector(true);
    }
  };

  const applyBarcodeToEditProduct = async (barcode) => {
    try {
      // Получаем информацию о редактируемом товаре
      const dataWithBarcode = await getProducts({ has_barcode: true, limit: 10000 });
      const dataWithoutBarcode = await getProducts({ has_barcode: false, limit: 10000 });
      const allProducts = [...(dataWithBarcode.products || []), ...(dataWithoutBarcode.products || [])];
      const product = allProducts.find(p => p.id === editProductId);
      
      if (!product) {
        alert('Товар не найден');
        navigate('/products');
        return;
      }

      // Обновляем штрихкод
      await updateProductBarcode(editProductId, {
        barcode: barcode,
        quantity_actual: product.quantity_actual,
      });

      alert(`Штрихкод обновлен!\n${barcode}`);
      navigate('/products');
    } catch (error) {
      console.error('Ошибка обновления штрихкода:', error);
      alert('Не удалось обновить штрихкод');
      navigate('/products');
    }
  };

  const onScanError = (err) => {
    // Игнорируем ошибки сканирования
  };

  const searchProducts = async () => {
    try {
      const data = await getProducts({
        has_barcode: false,
        search: searchQuery,
        limit: 50,
      });
      setProducts(data.products || []);
    } catch (error) {
      console.error('Ошибка поиска:', error);
    }
  };

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      const barcode = manualBarcode.trim();
      setScannedBarcode(barcode);
      setShowManualInput(false);
      setManualBarcode('');
      
      if (isEditMode) {
        applyBarcodeToEditProduct(barcode);
      } else {
        setShowProductSelector(true);
      }
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setQuantity(product.quantity_warehouse?.toString() || '');
    setShowProductSelector(false);
    setShowQuantityInput(true);
  };

  const handleConfirm = async () => {
    if (!selectedProduct) return;

    try {
      const quantityActual = quantity ? parseFloat(quantity) : null;
      
      // Сначала останавливаем сканер
      await stopScanner();
      
      // Затем обновляем данные
      await updateProductBarcode(selectedProduct.id, {
        barcode: scannedBarcode,
        quantity_actual: quantityActual,
      });

      // Возвращаемся на страницу товаров
      navigate('/products', { 
        state: { 
          message: `Штрихкод ${scannedBarcode} присвоен! Количество: ${quantityActual || 'не указано'}` 
        } 
      });
    } catch (error) {
      console.error('Ошибка присвоения штрихкода:', error);
      await stopScanner();
      navigate('/products', { state: { error: 'Не удалось присвоить штрихкод' } });
    }
  };

  return (
    <div className="scanner-container-wrapper">
      <div className="header">
        <button className="back-button" onClick={() => navigate('/products')}>
          ← Назад
        </button>
        <h1 className="header-title">Сканирование</h1>
        <button 
          className="manual-button"
          onClick={() => setShowManualInput(true)}
        >
          ⌨️
        </button>
      </div>

      <div className="scanner-content">
        {!showProductSelector && !showQuantityInput && (
          <>
            <div id="scanner-container" className="scanner-view"></div>
            <div className="scanner-instruction">
              <p>📸 Наведите камеру на штрихкод</p>
            </div>
          </>
        )}

        {showProductSelector && (
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Выберите товар</h2>
                <button 
                  className="close-button"
                  onClick={() => {
                    setShowProductSelector(false);
                    setScannedBarcode(null);
                    startScanner();
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="barcode-badge">
                📊 {scannedBarcode}
              </div>

              <input
                className="input"
                placeholder="Поиск товара..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />

              <div className="products-search-list">
                {products.length === 0 ? (
                  <div className="empty-state">
                    <p>Начните вводить название товара</p>
                  </div>
                ) : (
                  products.map((product) => (
                    <div
                      key={product.id}
                      className="product-search-item"
                      onClick={() => handleProductSelect(product)}
                    >
                      <div className="product-search-name">{product.name}</div>
                      <div className="product-search-arrow">→</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {showQuantityInput && selectedProduct && (
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Укажите количество</h2>
                <button 
                  className="close-button"
                  onClick={() => {
                    setShowQuantityInput(false);
                    setShowProductSelector(true);
                  }}
                >
                  ✕
                </button>
              </div>

              <div className="selected-product-info">
                <p className="selected-product-name">{selectedProduct.name}</p>
                <p className="selected-product-warehouse">
                  На складе: {selectedProduct.quantity_warehouse || 0}
                </p>
              </div>

              <input
                className="input"
                type="number"
                placeholder="Введите количество"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                autoFocus
              />

              <div className="modal-buttons">
                <button
                  className="button button-outline"
                  onClick={() => {
                    setShowQuantityInput(false);
                    setShowProductSelector(true);
                  }}
                >
                  Отмена
                </button>
                <button
                  className="button button-success"
                  onClick={handleConfirm}
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {showManualInput && (
          <div className="modal">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Ввести штрихкод</h2>
                <button 
                  className="close-button"
                  onClick={() => setShowManualInput(false)}
                >
                  ✕
                </button>
              </div>

              <input
                className="input"
                type="text"
                placeholder="Введите цифры штрихкода"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                autoFocus
              />

              <div className="modal-buttons">
                <button
                  className="button button-outline"
                  onClick={() => {
                    setShowManualInput(false);
                    setManualBarcode('');
                  }}
                >
                  Отмена
                </button>
                <button
                  className="button button-primary"
                  onClick={handleManualSubmit}
                >
                  Продолжить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScannerPage;
