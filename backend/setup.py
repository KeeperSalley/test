# Создайте файл backend/setup.py

import os
import sys

# Добавляем путь к текущей директории для импорта app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.init_bosses import init_bosses
from app.init_classes import init_classes
from app.init_items import init_items
from app.tasks_init import init_daily_tasks_support, check_daily_tasks_support

def setup_project():
    """Инициализация проекта"""
    
    # Создаем директорию для чатов
    chat_dir = os.path.join(os.path.dirname(__file__), "app", "chats")
    if not os.path.exists(chat_dir):
        os.makedirs(chat_dir)
        print(f"Создана директория для чатов: {chat_dir}")
    else:
        print(f"Директория для чатов уже существует: {chat_dir}")
    
    # Инициализируем базовые данные в правильном порядке
    print("\n=== Инициализация базовых данных ===")
    
    # 1. Сначала классы (нужны для предметов)
    print("1. Инициализация классов...")
    init_classes()
    
    # 2. Затем предметы (зависят от классов)
    print("\n2. Инициализация предметов...")
    init_items()
    
    # 3. Потом боссы (независимы)
    print("\n3. Инициализация боссов...")
    init_bosses()
    
    # 4. Инициализация поддержки ежедневных задач
    print("\n4. Проверка поддержки ежедневных задач...")
    
    try:
        if not check_daily_tasks_support():
            print("Поддержка ежедневных задач не настроена. Выполняется инициализация...")
            init_daily_tasks_support()
        else:
            print("✓ Поддержка ежедневных задач уже настроена")
    except Exception as e:
        print(f"⚠ Ошибка при инициализации ежедневных задач: {e}")
        print("Пожалуйста, выполните миграцию базы данных вручную:")
        print("""
        ALTER TABLE tasks 
        ADD COLUMN parent_task_id INTEGER REFERENCES tasks(task_id) ON DELETE CASCADE,
        ADD COLUMN is_daily_instance BOOLEAN DEFAULT FALSE,
        ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
        
        CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);
        CREATE INDEX idx_tasks_is_daily_instance ON tasks(is_daily_instance);
        CREATE INDEX idx_tasks_deadline ON tasks(deadline);
        CREATE INDEX idx_tasks_created_at ON tasks(created_at);
        
        UPDATE tasks SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;
        """)
    
    print("\n=== Настройка проекта завершена! ===")
    print("\nДля запуска сервера выполните:")
    print("cd backend")
    print("uvicorn app.main:app --reload --host 0.0.0.0 --port 8000")

def check_database_connection():
    """Проверка подключения к базе данных"""
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        # Простой запрос для проверки соединения
        db.execute("SELECT 1")
        db.close()
        print("✓ Подключение к базе данных успешно")
        return True
    except Exception as e:
        print(f"✗ Ошибка подключения к базе данных: {e}")
        print("Убедитесь, что:")
        print("1. PostgreSQL запущен")
        print("2. База данных создана")
        print("3. Настройки подключения в DATABASE_URL корректны")
        return False

def verify_setup():
    """Проверка корректности настройки"""
    print("\n=== Проверка настройки ===")
    
    # Проверяем подключение к БД
    if not check_database_connection():
        return False
    
    # Проверяем наличие основных таблиц
    try:
        from app.database import SessionLocal
        from sqlalchemy import text
        
        db = SessionLocal()
        
        # Проверяем основные таблицы
        tables_to_check = ['users', 'tasks', 'catalogs', 'classes', 'items', 'bosses']
        
        for table in tables_to_check:
            result = db.execute(text(f"SELECT COUNT(*) FROM {table}")).fetchone()
            print(f"✓ Таблица {table}: {result[0]} записей")
        
        # Проверяем поля для ежедневных задач
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' 
            AND column_name IN ('parent_task_id', 'is_daily_instance', 'created_at')
        """)).fetchall()
        
        if len(result) == 3:
            print("✓ Поддержка ежедневных задач настроена")
        else:
            print("⚠ Поддержка ежедневных задач настроена частично")
        
        db.close()
        return True
        
    except Exception as e:
        print(f"✗ Ошибка при проверке таблиц: {e}")
        return False

if __name__ == "__main__":
    print("=== Настройка проекта Gamify Planner ===")
    
    # Выполняем базовую настройку
    setup_project()
    
    # Проверяем корректность настройки
    if verify_setup():
        print("\n🎉 Проект успешно настроен и готов к запуску!")
    else:
        print("\n⚠ Настройка завершена с предупреждениями. Проверьте сообщения выше.")