import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { localData } from '../utils/localData';
import { getSampleFile } from '../utils/api';
import './HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      await localData.init();
      const savedSession = await localData.getSession();
      if (savedSession) {
        setSession(savedSession);
      } else {
        // Если сессии нет, автоматически загружаем sample_file.xls
        await loadDefaultSampleFile();
      }
    } catch (error) {
      console.error('Ошибка загрузки сессии:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDefaultSampleFile = async () => {
    try {
      console.log('Загрузка sample_file.xls...');
      
      // Получаем файл с сервера
      const blob = await getSampleFile();
      
      // Создаем File объект из blob
      const file = new File([blob], 'sample_file.xls', { 
        type: 'application/vnd.ms-excel' 
      });
      
      // Парсим и сохраняем файл
      const { filename, products } = await localData.parseExcelFile(file);
      
      await localData.saveProducts(products);
      
      const newSession = {
        filename,
        total_products: products.length,
        products_with_barcode: products.filter(p => p.barcode).length,
      };
      
      await localData.saveSession(newSession);
      setSession(newSession);
      
      console.log(`sample_file.xls успешно загружен! ${products.length} товаров`);
    } catch (error) {
      console.error('Ошибка автоматической загрузки sample_file.xls:', error);
      // Не показываем ошибку пользователю, просто оставляем возможность загрузить вручную
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      
      const { filename, products } = await localData.parseExcelFile(file);
      
      await localData.saveProducts(products);
      
      const newSession = {
        filename,
        total_products: products.length,
        products_with_barcode: products.filter(p => p.barcode).length,
      };
      
      await localData.saveSession(newSession);
      setSession(newSession);
      
      alert(`Файл загружен! ${products.length} товаров`);
    } catch (error) {
      console.error('Ошибка загрузки файла:', error);
      alert('Не удалось загрузить файл');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <div className="icon">📦</div>
          <h1>Штрихкоды</h1>
          <p className="subtitle">Присвоение штрихкодов товарам</p>
        </div>

        {session ? (
          <div className="card session-card">
            <p className="session-label">Текущая сессия</p>
            <h2 className="session-filename">{session.filename}</h2>
            
            <div className="stats">
              <div className="stat-item">
                <div className="stat-value">{session.total_products}</div>
                <div className="stat-label">Всего товаров</div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-value stat-success">{session.products_with_barcode}</div>
                <div className="stat-label">Со штрихкодом</div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-value stat-warning">
                  {session.total_products - session.products_with_barcode}
                </div>
                <div className="stat-label">Без штрихкода</div>
              </div>
            </div>

            <button 
              className="button button-primary full-width"
              onClick={() => navigate('/products')}
            >
              Продолжить работу →
            </button>

            <label className="button button-outline full-width" style={{marginTop: '12px'}}>
              {uploading ? 'Загрузка...' : '☁️ Загрузить новый файл'}
              <input 
                type="file" 
                accept=".xls,.xlsx" 
                onChange={handleFileUpload}
                disabled={uploading}
                style={{display: 'none'}}
              />
            </label>
          </div>
        ) : (
          <div className="card session-card">
            <p className="session-label">Начните работу</p>
            <p style={{marginBottom: '20px'}}>Загрузите Excel файл с товарами</p>
            
            <label className="button button-success full-width">
              {uploading ? 'Загрузка...' : '📁 Загрузить Excel файл'}
              <input 
                type="file" 
                accept=".xls,.xlsx" 
                onChange={handleFileUpload}
                disabled={uploading}
                style={{display: 'none'}}
              />
            </label>
          </div>
        )}

        <div className="features">
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Поддержка .xls и .xlsx файлов</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Работает полностью в браузере</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Все данные хранятся локально</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
