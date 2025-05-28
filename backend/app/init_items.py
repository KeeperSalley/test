# Создайте файл backend/app/init_items.py

import sys
import os

# Добавляем путь к родительской директории для корректного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app import models, database

# Данные предметов
ITEMS_DATA = [
    # Разовые предметы (com)
    {
        "item_id": 1,
        "name": "Лепестки исцеления",
        "price": 100,
        "type": "com",
        "class_id": None,
        "bonus_type": "health_restore",
        "bonus_data": 25,
        "information": "Восстанавливает 25% здоровья."
    },
    {
        "item_id": 2,
        "name": "Восстанавливающий отвар",
        "price": 120,
        "type": "com",
        "class_id": None,
        "bonus_type": "health_restore_full",
        "bonus_data": 100,
        "information": "Полностью восстанавливает здоровье."
    },
    {
        "item_id": 3,
        "name": "Свиток древнего разума",
        "price": 150,
        "type": "com",
        "class_id": None,
        "bonus_type": "exp_boost",
        "bonus_data": 25,
        "information": "Дает 25% опыта до следующего уровня."
    },
    {
        "item_id": 4,
        "name": "Зелье просветления",
        "price": 200,
        "type": "com",
        "class_id": None,
        "bonus_type": "exp_boost",
        "bonus_data": 100,
        "information": "Дает столько опыта, сколько не хватает до следующего уровня."
    },
    
    # Редкие предметы (rare)
    {
        "item_id": 5,
        "name": "Таинственная шкатулка",
        "price": 500,
        "type": "rare",
        "class_id": None,
        "bonus_type": "exp_multiplier",
        "bonus_data": 5,
        "information": "Реликвия, изготовленная опытным мастером. +5% к получаемому опыту."
    },
    {
        "item_id": 6,
        "name": "Драконий браслет",
        "price": 600,
        "type": "rare",
        "class_id": None,
        "bonus_type": "max_health",
        "bonus_data": 3,
        "information": "Увеличивает максимальное здоровье на 3 единицы."
    },
    {
        "item_id": 7,
        "name": "Сумка торговца",
        "price": 800,
        "type": "rare",
        "class_id": None,
        "bonus_type": "gold_multiplier",
        "bonus_data": 5,
        "information": "Увеличивает получаемое золото за задачи на 5%."
    },
    {
        "item_id": 8,
        "name": "Талисман скрытой силы",
        "price": 1000,
        "type": "rare",
        "class_id": None,
        "bonus_type": "attack",
        "bonus_data": 5,
        "information": "Увеличивает атаку на 5 единиц."
    },
    
    # Классовые предметы
    {
        "item_id": 9,
        "name": "Амулет архимага",
        "price": 1500,
        "type": "rare",
        "class_id": 1,  # Воин
        "bonus_type": "attack",
        "bonus_data": 10,
        "information": "Увеличивает атаку на 10 единиц."
    },
    {
        "item_id": 10,
        "name": "Клинок жертвоприношений",
        "price": 1500,
        "type": "rare",
        "class_id": 2,  # Маг
        "bonus_type": "attack",
        "bonus_data": 20,
        "information": "Увеличивает атаку на 20 единиц."
    },
    {
        "item_id": 11,
        "name": "Лира благосклонности",
        "price": 1600,
        "type": "rare",
        "class_id": 3,  # Бард
        "bonus_type": "health_regen",
        "bonus_data": 3,
        "information": "Ежедневно восстанавливает 3 здоровья."
    },
    {
        "item_id": 12,
        "name": "Мантия благосклонности",
        "price": 2000,
        "type": "rare",
        "class_id": 4,  # Жрец
        "bonus_type": "boss_gold",
        "bonus_data": 2,
        "information": "Удваивает золото за босса."
    }
]

def init_items():
    """Инициализация предметов в базе данных"""
    db = database.SessionLocal()
    
    try:
        # Проверяем, есть ли уже предметы в базе
        existing_items = db.query(models.Item).count()
        
        if existing_items == 0:
            print("Инициализация предметов...")
            
            for item_data in ITEMS_DATA:
                # Проверяем, существует ли предмет с таким ID
                existing_item = db.query(models.Item).filter(
                    models.Item.item_id == item_data["item_id"]
                ).first()
                
                if not existing_item:
                    item = models.Item(**item_data)
                    db.add(item)
                    print(f"Добавлен предмет: {item_data['name']}")
            
            db.commit()
            print("Предметы успешно инициализированы!")
        else:
            print(f"Предметы уже существуют в базе данных ({existing_items} шт.)")
            
    except Exception as e:
        print(f"Ошибка при инициализации предметов: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_items()