# Создайте файл backend/setup.py

import os
import sys

# Добавляем путь к текущей директории для импорта app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.init_bosses import init_bosses
from app.init_classes import init_classes
from app.init_items import init_items

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
    print("=== Инициализация базовых данных ===")
    
    # # 1. Сначала классы (нужны для предметов)
    # print("1. Инициализация классов...")
    # init_classes()
    
    # 2. Затем предметы (зависят от классов)
    print("2. Инициализация предметов...")
    init_items()
    
    # # 3. Потом боссы (независимы)
    # print("3. Инициализация боссов...")
    # init_bosses()
    
    print("=== Настройка проекта завершена! ===")

if __name__ == "__main__":
    setup_project()