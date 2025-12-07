import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { localData } from '../utils/localData';
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
      const data = await getSession();
      if (data.session) {
        setSession(data.session);
      } else {
        // Автоматически загружаем дефолтный файл
        await loadDefaultFile();
        const newData = await getSession();
        setSession(newData.session);
      }
    } catch (error) {
      console.error('Ошибка загрузки сессии:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      await uploadFile(file);
      await checkSession();
      alert('Файл успешно загружен!');
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

        {session && (
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
        )}

        <div className="features">
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Поддержка .xls файлов</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Сохранение прогресса</span>
          </div>
          <div className="feature-item">
            <span className="feature-icon">✓</span>
            <span>Быстрый поиск товаров</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
