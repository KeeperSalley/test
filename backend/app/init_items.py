# Создайте файл backend/app/init_items.py

import sys
import os

# Добавляем путь к родительской директории для корректного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app import models, database

# type
# once
# com
# rare
# class


# bonus_type

# health_restore проценты
# health_restore_full фул хп
# exp_boost проценты от оптыа
# exp_multiplier проценты
# max_health число
# gold_multiplier процентты
# attack целое
# double_points проценты
# protecting_lives  - единица урона при провале
# chains_protecting
# double_gold_bosses - удвоенный бонус голды с боссов

ITEMS_DATA = [
    # Разовые предметы (once)
    {
        "item_id": 1, # +
        "name": "Лепестки исцеления",
        "price": 1000,
        "type": "com",
        "class_id": None,
        "bonus_type": "health_restore",
        "bonus_data": 25,
        "information": " Цветы, что растут на вершинах высоких гор."
    },
    {
        "item_id": 2, # +
        "name": "Восстанавливающий отвар",
        "price": 4000,
        "type": "com",
        "class_id": None,
        "bonus_type": "health_restore_full",
        "bonus_data": 100,
        "information": " Пылающая жидкость, умело приготовленная болотной ведьмой."
    },
    {
        "item_id": 3, # +
        "name": "Свиток древнего разума",
        "price": 1000,
        "type": "com",
        "class_id": None,
        "bonus_type": "exp_boost",
        "bonus_data": 25,
        "information": " Читая его, вы чувствуете, как наполняетесь решимостью."
    },
    {
        "item_id": 4, # +
        "name": "Зелье просветления",
        "price": 4000,
        "type": "com",
        "class_id": None,
        "bonus_type": "exp_boost",
        "bonus_data": 100,
        "information": " После него мир начинает казаться совершенно другим."
    },
    
    # Обычные предметы (com)
    {
        "item_id": 5, # +
        "name": "Таинственная шкатулка",
        "price": 2000,
        "type": "rare",
        "class_id": None,
        "bonus_type": "exp_multiplier",
        "bonus_data": 5,
        "information": "Реликвия, изготовленная опытным мастером. "
    },
    {
        "item_id": 6, # +
        "name": "Драконий браслет",
        "price": 2000,
        "type": "rare",
        "class_id": None,
        "bonus_type": "max_health",
        "bonus_data": 3,
        "information": " Переливающиеся чешуйки придают сил."
    },
    {
        "item_id": 7, # +
        "name": "Сумка торговца",
        "price": 2000,
        "type": "rare",
        "class_id": None,
        "bonus_type": "gold_multiplier",
        "bonus_data": 5,
        "information": " Небольшая, но чрезвычайно вместительная."
    },
    {
        "item_id": 8, # +
        "name": "Талисман скрытой силы",
        "price": 2000,
        "type": "rare",
        "class_id": None,
        "bonus_type": "attack",
        "bonus_data": 5,
        "information": " Кажется, это техника бесконтактного боя."
    },
    {
        "item_id": 9, # +
        "name": "Клыкастый перстень",
        "price": 7000,
        "type": "rare",
        "class_id": 1,  # Воин
        "bonus_type": "double_points",
        "bonus_data": 20,
        "information": " Унаследован от первых вождей далёкого прошлого."
    },
    {
        "item_id": 10, # +
        "name": "Щит спокойствия",
        "price": 7000,
        "type": "rare",
        "class_id": 1,  # Воин
        "bonus_type": "chains_protecting",
        "bonus_data": 10,
        "information": "То, что казалось обладателю провалом, было лишь сном."
    },
    {
        "item_id": 11, # +
        "name": "Амулет архимага",
        "price": 7000,
        "type": "rare",
        "class_id": 2,  # Маг
        "bonus_type": "attack",
        "bonus_data": 10,
        "information": " Ярко мерцает, ослепляя врагов."
    },
    {
        "item_id": 12, # +
        "name": "Лазуритовый свиток",
        "price": 7000,
        "type": "rare",
        "class_id": 2,  # Маг
        "bonus_type": "double_gold",
        "bonus_data": 20,
        "information": " Колдовать золото – непростое заклинание. И очень полезное."
    },
    {
        "item_id": 13, # +
        "name": "Лира благосклонности",
        "price": 7000,
        "type": "rare",
        "class_id": 3,  # Бард
        "bonus_type": "protecting_lives",
        "bonus_data": 1,
        "information": "Одной песней приносит умиротворение."
    },
    {
        "item_id": 14, # +
        "name": " Венок просветления ",
        "price": 7000,
        "type": "rare",
        "class_id": 3,  # Бард
        "bonus_type": "exp_multiplier",
        "bonus_data": 10,
        "information": "Плетён из вечнозелёных ветвей, что не вянут даже в холоде."
    },
    {
        "item_id": 15,
        "name": "Мантия благосостояния",
        "price": 7000,
        "type": "rare",
        "class_id": 4,  # Жрец
        "bonus_type": "double_gold_bosses",
        "bonus_data": 1,
        "information": "Покоем покрывает душу."
    },
    {
        "item_id": 16, # +
        "name": "Клинок жертвоприношений",
        "price": 7000,
        "type": "rare",
        "class_id": 4,  # Жрец
        "bonus_type": "attack",
        "bonus_data": 20,
        "information": " Ритуальная реликвия, покрытая необычными символами»"
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