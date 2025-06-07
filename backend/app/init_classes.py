# Создайте файл backend/app/init_classes.py

import sys
import os

# Добавляем путь к родительской директории для корректного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from app import models, database

# Данные классов
CLASSES_DATA = [
    {
        "class_id": 1,
        "name": "Воин",
        "information": "Сильный и решительный, Воин быстрее побеждает мощных врагов вместе с командой и получает больше наград для себя. Имеет бонус к атаке и увеличенный шанс получить вещь после победы над боссом."
    },
    {
        "class_id": 2,
        "name": "Маг",
        "information": "Любознательный и амбициозный, Маг стремится к знаниям и быстро прогрессирует, чтобы достичь новых высот. Получает больше опыта за выполнение задач."
    },
    {
        "class_id": 3,
        "name": "Бард",
        "information": "Харизматичный и удачливый, Бард умеет превращать успех в богатство, которое можно потратить на полезные вещи. Получает больше золота за задачи и победы над боссами."
    },
    {
        "class_id": 4,
        "name": "Жрец",
        "information": "Спокойный и стойкий, Жрец прощает ошибки и помогает преодолевать трудности даже в самые загруженные дни. Получает меньше урона при провале задач."
    }
]

def init_classes():
    """Инициализация классов в базе данных"""
    db = database.SessionLocal()
    
    try:
        # Проверяем, есть ли уже классы в базе
        existing_classes = db.query(models.Class).count()
        
        if existing_classes == 0:
            print("Инициализация классов...")
            
            for class_data in CLASSES_DATA:
                # Проверяем, существует ли класс с таким ID
                existing_class = db.query(models.Class).filter(
                    models.Class.class_id == class_data["class_id"]
                ).first()
                
                if not existing_class:
                    class_obj = models.Class(**class_data)
                    db.add(class_obj)
                    print(f"Добавлен класс: {class_data['name']}")
            
            db.commit()
            print("Классы успешно инициализированы!")
        else:
            print(f"Классы уже существуют в базе данных ({existing_classes} шт.)")
            
    except Exception as e:
        print(f"Ошибка при инициализации классов: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_classes()