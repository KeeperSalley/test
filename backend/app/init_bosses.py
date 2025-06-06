# Создайте файл backend/app/init_bosses.py

from sqlalchemy.orm import Session
from . import models, database

# Данные боссов согласно таблице
BOSSES_DATA = [
    {
        "boss_id": 1,
        "name": "Слабый Гоблин",
        "base_lives": 1000,
        "level": 1,
        "gold_reward": 100,
        "information": "Маленький зеленый вредитель из темных пещер.",
        "img_url": "images/boss1.png"
    },
    {
        "boss_id": 2,
        "name": "Орк-Воин",
        "base_lives": 2000,
        "level": 2,
        "gold_reward": 200,
        "information": "Сильный воин орков с большим топором.",
        "img_url": "images/boss2.png"
    },
    {
        "boss_id": 3,
        "name": "Тролль-Берсерк",
        "base_lives": 3000,
        "level": 3,
        "gold_reward": 300,
        "information": "Огромный тролль в состоянии ярости.",
        "img_url": "images/boss3.png"
    },
    {
        "boss_id": 4,
        "name": "Каменный Голем",
        "base_lives": 4000,
        "level": 4,
        "gold_reward": 400,
        "information": "Древний страж, созданный из магического камня.",
        "img_url": "images/boss4.png"
    },
    {
        "boss_id": 5,
        "name": "Серебряный дракон",
        "base_lives": 5000,
        "level": 5,
        "gold_reward": 500,
        "information": "Молодой дракон с огненным дыханием.",
        "img_url": "images/boss5.png"
    },
    {
        "boss_id": 6,
        "name": "Демон-Стражник",
        "base_lives": 6000,
        "level": 6,
        "gold_reward": 600,
        "information": "Могущественный демон из преисподней.",
        "img_url": "images/boss6.png"
    },
    {
        "boss_id": 7,
        "name": "Пожиратель Душ",
        "base_lives": 7000,
        "level": 7,
        "gold_reward": 700,
        "information": "Опасное существо из глубин подземелья.",
        "img_url": "images/boss7.png"
    },
    {
        "boss_id": 8,
        "name": "Повелитель Тьмы",
        "base_lives": 8000,
        "level": 8,
        "gold_reward": 800,
        "information": "Древний владыка темных сил.",
        "img_url": "images/boss8.png"
    }
]

def init_bosses():
    """Инициализация боссов в базе данных"""
    db = database.SessionLocal()
    
    try:
        # Проверяем, есть ли уже боссы в базе
        existing_bosses = db.query(models.Boss).count()
        
        if existing_bosses == 0:
            print("Инициализация боссов...")
            
            for boss_data in BOSSES_DATA:
                # Проверяем, существует ли босс с таким ID
                existing_boss = db.query(models.Boss).filter(
                    models.Boss.boss_id == boss_data["boss_id"]
                ).first()
                
                if not existing_boss:
                    boss = models.Boss(**boss_data)
                    db.add(boss)
                    print(f"Добавлен босс: {boss_data['name']}")
            
            db.commit()
            print("Боссы успешно инициализированы!")
        else:
            print(f"Боссы уже существуют в базе данных ({existing_bosses} шт.)")
            
    except Exception as e:
        print(f"Ошибка при инициализации боссов: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_bosses()