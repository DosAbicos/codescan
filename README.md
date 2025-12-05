# Приложение для присвоения штрихкодов товарам

Мобильное приложение на Expo (React Native) для присвоения штрихкодов товарам из Excel файлов с сохранением всего форматирования.

## Описание

Приложение позволяет:
- Загружать Excel файлы (.xls) с товарами (более 12,000 позиций)
- Сканировать штрихкоды через камеру устройства
- Присваивать штрихкоды товарам с указанием количества
- Искать товары по названию и коду номенклатуры
- Редактировать штрихкоды и количество
- Выгружать обновлённый Excel файл с сохранением форматирования

## Технологии

### Frontend
- **Expo** (React Native)
- **TypeScript**
- **Expo Router** - навигация
- **Expo Camera** - сканирование штрихкодов
- **Expo Document Picker** - загрузка файлов
- **React Native** - UI компоненты

### Backend
- **FastAPI** (Python)
- **MongoDB** - хранение данных
- **Pandas** - работа с Excel
- **xlrd/xlutils** - чтение/запись .xls с форматированием

## Структура проекта

```
/app
├── backend/
│   ├── server.py           # FastAPI сервер
│   ├── requirements.txt    # Python зависимости
│   └── .env               # Переменные окружения
├── frontend/
│   ├── app/               # Expo Router страницы
│   │   ├── index.tsx      # Главный экран
│   │   ├── products.tsx   # Список товаров
│   │   ├── scanner.tsx    # Сканер штрихкодов
│   │   └── edit-product.tsx # Редактирование
│   ├── app.json           # Expo конфигурация
│   ├── package.json       # npm зависимости
│   └── .env              # Переменные окружения
└── sample_file.xls        # Пример Excel файла
```

## Установка и запуск

### Backend
```bash
cd backend
pip install -r requirements.txt
python server.py
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

## API Endpoints

- `POST /api/upload` - Загрузка Excel файла
- `GET /api/session` - Получение текущей сессии
- `GET /api/products` - Список товаров (с фильтрами)
- `PUT /api/products/{id}/barcode` - Обновление штрихкода
- `GET /api/download` - Выгрузка Excel файла

## Особенности

- **Сохранение форматирования**: Excel файл выгружается с полным сохранением цветов, шрифтов и границ
- **Изоляция сессий**: Каждая загрузка файла создаёт отдельную сессию
- **Поиск по коду номенклатуры**: Автоматическое связывание кодов с товарами
- **Оффлайн работа**: Данные сохраняются локально в MongoDB
- **Кросс-платформенность**: Работает на iOS и Android

## Сборка APK

Для создания APK файла используйте EAS Build:

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview
```

## Лицензия

Proprietary
