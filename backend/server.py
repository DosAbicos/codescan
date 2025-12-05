from fastapi import FastAPI, APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import pandas as pd
import xlrd
import io
import base64
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    row_index: int
    name: str
    nomenclature_code: Optional[str] = None  # Код номенклатуры для поиска
    barcode: Optional[str] = None
    quantity_warehouse: Optional[float] = None  # Кол-во на складе (Col 2)
    quantity_actual: Optional[float] = None  # Кол-во по факту (вводится пользователем)
    original_data: dict  # Вся строка из Excel
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class ProductUpdate(BaseModel):
    barcode: Optional[str] = None
    quantity_actual: Optional[float] = None

class WorkSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_file_base64: str
    total_products: int
    products_with_barcode: int
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

# Helper function to parse Excel
def parse_excel_file(file_content: bytes, filename: str):
    """Парсинг Excel файла и извлечение товаров"""
    try:
        # Читаем Excel
        df = pd.read_excel(io.BytesIO(file_content), engine='xlrd')
        
        products = []
        # Начинаем с 8-й строки (индекс 8), где начинаются товары
        # Каждый товар занимает 2 строки: данные и количество
        idx = 8
        while idx < len(df) - 1:  # -1 чтобы не выйти за пределы при чтении следующей строки
            row = df.iloc[idx]
            name = row.iloc[0]  # Первая колонка - наименование
            
            # Пропускаем пустые строки
            if pd.isna(name) or str(name).strip() == '':
                idx += 1
                continue
            
            # Проверяем что это не заголовок или итоговая строка
            name_str = str(name).strip()
            if name_str in ['НaN', 'Номенклатура', 'Счет', 'nan', 'Итого']:
                idx += 1
                continue
            
            # Проверяем что следующая строка содержит "Кол."
            next_row = df.iloc[idx + 1]
            if pd.notna(next_row.iloc[1]) and str(next_row.iloc[1]).strip() == 'Кол.':
                # Проверяем является ли это кодом номенклатуры
                is_nomenclature_code = name_str.replace(' ', '').isdigit()
                
                if is_nomenclature_code:
                    # Это код номенклатуры - пропускаем но пытаемся привязать к предыдущему товару
                    if products and not products[-1].get('nomenclature_code'):
                        products[-1]['nomenclature_code'] = name_str
                    idx += 2
                    continue
                
                # Это товар с количеством
                # Извлекаем штрихкод
                barcode = row.iloc[8] if len(row) > 8 and pd.notna(row.iloc[8]) else None
                if barcode:
                    barcode = str(barcode).strip()
                
                # Извлекаем количество на складе (Col 2 из строки с "Кол.")
                quantity_warehouse = None
                if pd.notna(next_row.iloc[2]):
                    try:
                        quantity_warehouse = float(next_row.iloc[2])
                    except:
                        pass
                
                # Сохраняем всю строку для последующего экспорта
                original_data = {}
                for col_idx, value in enumerate(row):
                    original_data[f"col_{col_idx}"] = str(value) if pd.notna(value) else None
                
                # Сохраняем также данные строки с количеством
                original_data['quantity_row'] = {}
                for col_idx, value in enumerate(next_row):
                    original_data['quantity_row'][f"col_{col_idx}"] = str(value) if pd.notna(value) else None
                
                products.append({
                    "row_index": idx,
                    "name": name_str,
                    "nomenclature_code": None,  # Будет заполнено следующей строкой если есть
                    "barcode": barcode,
                    "quantity_warehouse": quantity_warehouse,
                    "quantity_actual": None,  # Будет заполнено при сканировании
                    "original_data": original_data
                })
                
                # Пропускаем следующую строку (с количеством)
                idx += 2
            else:
                # Строка без количества, пропускаем
                idx += 1
        
        return products
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Ошибка парсинга файла: {str(e)}")

@api_router.post("/upload")
async def upload_excel(file: UploadFile = File(...)):
    """Загрузка Excel файла и создание рабочей сессии"""
    try:
        # Читаем файл
        content = await file.read()
        
        # Конвертируем в base64 для хранения
        file_base64 = base64.b64encode(content).decode('utf-8')
        
        # Парсим файл
        products = parse_excel_file(content, file.filename)
        
        # Создаем рабочую сессию
        session = WorkSession(
            filename=file.filename,
            original_file_base64=file_base64,
            total_products=len(products),
            products_with_barcode=sum(1 for p in products if p.get('barcode'))
        )
        
        # Удаляем старую сессию если есть
        await db.sessions.delete_many({})
        await db.products.delete_many({})
        
        # Сохраняем новую сессию
        await db.sessions.insert_one(session.dict())
        
        # Сохраняем товары
        for product_data in products:
            product = Product(**product_data)
            await db.products.insert_one(product.dict())
        
        return {
            "success": True,
            "session_id": session.id,
            "total_products": len(products),
            "products_with_barcode": session.products_with_barcode
        }
    
    except Exception as e:
        logging.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/session")
async def get_current_session():
    """Получить текущую рабочую сессию"""
    session = await db.sessions.find_one()
    if not session:
        return {"session": None}
    
    # Обновляем статистику
    total = await db.products.count_documents({})
    with_barcode = await db.products.count_documents({"barcode": {"$ne": None}})
    
    session['_id'] = str(session['_id'])
    session['total_products'] = total
    session['products_with_barcode'] = with_barcode
    # Не отправляем base64 файл в основном запросе
    if 'original_file_base64' in session:
        del session['original_file_base64']
    
    return {"session": session}

@api_router.get("/products")
async def get_products(has_barcode: Optional[bool] = None, search: Optional[str] = None, skip: int = 0, limit: int = 50):
    """Получить список товаров с фильтрацией"""
    query = {}
    
    if has_barcode is not None:
        if has_barcode:
            query["barcode"] = {"$ne": None}
        else:
            query["barcode"] = None
    
    if search:
        # Экранируем спецсимволы regex для безопасного поиска
        import re
        escaped_search = re.escape(search)
        # Простой поиск по подстроке
        query["name"] = {"$regex": escaped_search, "$options": "i"}
    
    total = await db.products.count_documents(query)
    products = await db.products.find(query).skip(skip).limit(limit).to_list(limit)
    
    for product in products:
        product['_id'] = str(product['_id'])
    
    return {
        "total": total,
        "products": products
    }

@api_router.put("/products/{product_id}/barcode")
async def update_product_barcode(product_id: str, update: ProductUpdate):
    """Обновить или удалить штрихкод товара"""
    product = await db.products.find_one({"id": product_id})
    if not product:
        raise HTTPException(status_code=404, detail="Товар не найден")
    
    update_data = {
        "barcode": update.barcode,
        "quantity_actual": update.quantity_actual,
        "updated_at": datetime.utcnow()
    }
    
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=500, detail="Не удалось обновить товар")
    
    # Получаем обновленный товар
    updated_product = await db.products.find_one({"id": product_id})
    updated_product['_id'] = str(updated_product['_id'])
    
    return {"success": True, "product": updated_product}

@api_router.get("/download")
async def download_excel():
    """Выгрузить Excel файл с обновленными штрихкодами"""
    try:
        # Получаем сессию
        session = await db.sessions.find_one()
        if not session:
            raise HTTPException(status_code=404, detail="Нет активной сессии")
        
        # Декодируем оригинальный файл
        original_file = base64.b64decode(session['original_file_base64'])
        
        # Читаем оригинальный файл
        df = pd.read_excel(io.BytesIO(original_file), engine='xlrd')
        
        # Получаем все обновленные товары
        products = await db.products.find({}).to_list(None)
        
        # Обновляем штрихкоды в DataFrame
        for product in products:
            if product.get('barcode'):
                row_idx = product['row_index']
                if row_idx < len(df):
                    df.iloc[row_idx, 8] = product['barcode']
        
        # Сохраняем временный файл с использованием openpyxl
        temp_file = ROOT_DIR / "temp_output.xlsx"
        with pd.ExcelWriter(temp_file, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, header=False)
        
        return FileResponse(
            temp_file,
            media_type='application/vnd.ms-excel',
            filename=f"updated_{session['filename']}"
        )
    
    except Exception as e:
        logging.error(f"Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
