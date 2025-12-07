# 🚀 Инструкция по хостингу веб-приложения

## 📋 Содержание
1. [Подготовка к хостингу](#подготовка-к-хостингу)
2. [Вариант 1: Vercel (Рекомендуется)](#вариант-1-vercel-рекомендуется)
3. [Вариант 2: Netlify](#вариант-2-netlify)
4. [Вариант 3: VPS (DigitalOcean, AWS, etc)](#вариант-3-vps)
5. [Настройка домена](#настройка-домена)

---

## 🎯 Что будет размещено:

- **Frontend:** React веб-приложение (PWA)
- **Backend:** FastAPI сервер
- **База данных:** MongoDB

**Примечание:** Приложение работает полностью локально в браузере. Backend нужен только для начальной загрузки файла и экспорта Excel.

---

## 📦 Подготовка к хостингу

### 1. Соберите фронтенд для production

```bash
cd /app/webapp
npm run build
```

Это создаст папку `dist/` с готовыми файлами.

### 2. Настройте переменные окружения

Создайте файл `/app/webapp/.env.production`:

```bash
VITE_API_URL=https://ваш-домен-backend.com/api
```

---

## 🌐 Вариант 1: Vercel (Рекомендуется - БЕСПЛАТНО)

### Преимущества:
- ✅ Бесплатный план
- ✅ Автоматические деплои из GitHub
- ✅ HTTPS из коробки
- ✅ CDN по всему миру
- ✅ Поддержка SSR

### Шаги:

#### 1. Создайте аккаунт на Vercel
- Зайдите на https://vercel.com
- Регистрация через GitHub

#### 2. Подключите репозиторий
- Dashboard → New Project
- Import GitHub Repository
- Выберите ваш репозиторий

#### 3. Настройте проект

**Root Directory:** `webapp`

**Build Command:** `npm run build`

**Output Directory:** `dist`

**Install Command:** `npm install`

#### 4. Настройте переменные окружения

В настройках проекта → Environment Variables:

```
VITE_API_URL=https://ваш-backend.vercel.app/api
```

#### 5. Deploy!

Нажмите "Deploy" - Vercel автоматически:
- Установит зависимости
- Соберет приложение
- Разместит на CDN
- Даст вам URL: `https://ваш-проект.vercel.app`

---

## 🌐 Вариант 2: Netlify (Альтернатива - БЕСПЛАТНО)

### Преимущества:
- ✅ Бесплатный план
- ✅ Простой интерфейс
- ✅ HTTPS автоматически
- ✅ Формы и функции

### Шаги:

#### 1. Создайте аккаунт на Netlify
- https://netlify.com
- Регистрация через GitHub

#### 2. New Site from Git
- Import from GitHub
- Выберите репозиторий

#### 3. Build settings

**Base directory:** `webapp`

**Build command:** `npm run build`

**Publish directory:** `webapp/dist`

#### 4. Environment variables

Settings → Environment Variables:

```
VITE_API_URL=https://ваш-backend.com/api
```

#### 5. Deploy!

Netlify автоматически деплоит и дает URL.

---

## 💻 Вариант 3: VPS (Полный контроль)

### Подходит для:
- Большая нагрузка
- Нужен полный контроль
- Кастомные настройки

### Провайдеры:
- DigitalOcean ($5/месяц)
- Linode ($5/месяц)
- AWS Lightsail ($3.50/месяц)
- Hetzner (€3/месяц)

### Шаги:

#### 1. Создайте VPS

Выберите:
- **OS:** Ubuntu 22.04 LTS
- **RAM:** Минимум 1GB
- **Storage:** 25GB

#### 2. Подключитесь по SSH

```bash
ssh root@ваш-ip-адрес
```

#### 3. Установите необходимое ПО

```bash
# Обновите систему
apt update && apt upgrade -y

# Установите Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Установите Python 3.10+
apt install -y python3 python3-pip

# Установите MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
apt update
apt install -y mongodb-org
systemctl start mongod
systemctl enable mongod

# Установите Nginx
apt install -y nginx

# Установите Supervisor
apt install -y supervisor
```

#### 4. Скопируйте код на сервер

```bash
# На вашем компьютере
scp -r /app root@ваш-ip:/var/www/
```

Или клонируйте из GitHub:

```bash
cd /var/www
git clone https://github.com/ваш-репозиторий.git app
```

#### 5. Настройте Backend

```bash
cd /var/www/app/backend
pip3 install -r requirements.txt

# Создайте .env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017/barcode_app
EOF
```

#### 6. Создайте service для Backend

```bash
cat > /etc/systemd/system/barcode-backend.service << EOF
[Unit]
Description=Barcode Backend
After=network.target mongod.service

[Service]
User=root
WorkingDirectory=/var/www/app/backend
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

systemctl enable barcode-backend
systemctl start barcode-backend
```

#### 7. Соберите Frontend

```bash
cd /var/www/app/webapp
npm install
npm run build
```

#### 8. Настройте Nginx

```bash
cat > /etc/nginx/sites-available/barcode << 'EOF'
server {
    listen 80;
    server_name ваш-домен.com;

    # Frontend
    root /var/www/app/webapp/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:8001/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Включите сайт
ln -s /etc/nginx/sites-available/barcode /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

#### 9. Настройте SSL (Let's Encrypt)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d ваш-домен.com
```

Certbot автоматически настроит HTTPS.

#### 10. Готово!

Приложение доступно по адресу: `https://ваш-домен.com`

---

## 🌍 Настройка домена

### Если у вас есть домен:

#### 1. Добавьте DNS записи

В панели вашего регистратора домена:

**Для Vercel/Netlify:**
```
Type: CNAME
Name: @
Value: ваш-проект.vercel.app
```

**Для VPS:**
```
Type: A
Name: @
Value: ваш-ip-адрес
```

#### 2. Подождите распространения DNS (5-30 минут)

#### 3. Настройте SSL

Vercel/Netlify - автоматически
VPS - используйте certbot (см. выше)

---

## 📊 Мониторинг и обслуживание

### Vercel/Netlify:

- Логи доступны в dashboard
- Автоматические деплои при push в GitHub
- Rollback в 1 клик

### VPS:

#### Просмотр логов:

```bash
# Backend логи
journalctl -u barcode-backend -f

# Nginx логи
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# MongoDB логи
tail -f /var/log/mongodb/mongod.log
```

#### Перезапуск сервисов:

```bash
systemctl restart barcode-backend
systemctl reload nginx
systemctl restart mongod
```

#### Обновление кода:

```bash
cd /var/www/app
git pull
cd webapp
npm install
npm run build
systemctl restart barcode-backend
```

---

## 💰 Сравнение стоимости

| Платформа | Стоимость | Плюсы | Минусы |
|-----------|-----------|-------|--------|
| **Vercel** | $0 (Hobby) | Простота, автодеплой | Лимиты на бесплатном |
| **Netlify** | $0 (Starter) | Простота | Меньше функций |
| **DigitalOcean** | $5/мес | Полный контроль | Нужно настраивать |
| **AWS Lightsail** | $3.50/мес | Дешево | AWS сложный |
| **Hetzner** | €3/мес | Очень дешево | EU серверы |

---

## 🎯 Рекомендации

### Для MVP / Тестирования:
→ **Vercel** (бесплатно, просто)

### Для малого бизнеса:
→ **Vercel Pro** ($20/мес) или **DigitalOcean** ($5/мес)

### Для enterprise:
→ **VPS** с резервированием и мониторингом

---

## ✅ Чек-лист перед деплоем

- [ ] Собрали фронтенд (`npm run build`)
- [ ] Настроили переменные окружения
- [ ] Протестировали локально
- [ ] Загрузили sample_file.xls на сервер
- [ ] Настроили домен (если есть)
- [ ] Настроили SSL
- [ ] Проверили PWA (устанавливается ли)
- [ ] Протестировали сканирование
- [ ] Протестировали экспорт Excel

---

## 🆘 Помощь

### Vercel:
- Документация: https://vercel.com/docs
- Discord: https://vercel.com/discord

### Netlify:
- Документация: https://docs.netlify.com
- Forum: https://answers.netlify.com

### VPS:
- DigitalOcean: https://www.digitalocean.com/community/tutorials
- Stack Overflow: https://stackoverflow.com

---

## 🎉 Готово!

После деплоя ваше приложение будет доступно по URL и можно:
- Открыть в браузере
- Установить как PWA
- Работать офлайн
- Сканировать штрихкоды

Удачи с хостингом! 🚀
