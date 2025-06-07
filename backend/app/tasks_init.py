# Создайте файл backend/app/tasks_init.py

import sys
import os

# Добавляем путь к родительской директории для корректного импорта
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app import database

def init_daily_tasks_support():
    """Инициализация поддержки ежедневных задач в базе данных"""
    db = database.SessionLocal()
    
    try:
        print("Инициализация поддержки ежедневных задач...")
        
        # Проверяем, есть ли уже поле parent_task_id
        check_column_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' AND column_name = 'parent_task_id'
        """)
        
        result = db.execute(check_column_query).fetchone()
        
        if result:
            print("Поля для ежедневных задач уже существуют в базе данных.")
            return
        
        print("Добавление новых полей в таблицу tasks...")
        
        # Добавляем новые поля в таблицу tasks
        alter_table_query = text("""
            ALTER TABLE tasks 
            ADD COLUMN parent_task_id INTEGER REFERENCES tasks(task_id) ON DELETE CASCADE,
            ADD COLUMN is_daily_instance BOOLEAN DEFAULT FALSE,
            ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        """)
        
        db.execute(alter_table_query)
        print("✓ Новые поля добавлены")
        
        # Создаем индексы для улучшения производительности
        print("Создание индексов для улучшения производительности...")
        
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id)",
            "CREATE INDEX IF NOT EXISTS idx_tasks_is_daily_instance ON tasks(is_daily_instance)",
            "CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)",
            "CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)"
        ]
        
        for index_query in indexes:
            db.execute(text(index_query))
            print(f"✓ Создан индекс")
        
        # Создаем специальные индексы с условиями (если поддерживается СУБД)
        try:
            # Индекс для быстрого поиска экземпляров ежедневных задач
            daily_instance_index = text("""
                CREATE INDEX IF NOT EXISTS idx_tasks_daily_instance_lookup 
                ON tasks(parent_task_id, deadline, is_daily_instance) 
                WHERE is_daily_instance = TRUE
            """)
            db.execute(daily_instance_index)
            print("✓ Создан индекс для экземпляров ежедневных задач")
        except Exception as e:
            print(f"⚠ Предупреждение: не удалось создать условный индекс для ежедневных задач: {e}")
        
        try:
            # Индекс для поиска просроченных задач
            overdue_index = text("""
                CREATE INDEX IF NOT EXISTS idx_tasks_overdue 
                ON tasks(deadline, completed) 
                WHERE completed = 'false' AND deadline IS NOT NULL
            """)
            db.execute(overdue_index)
            print("✓ Создан индекс для просроченных задач")
        except Exception as e:
            print(f"⚠ Предупреждение: не удалось создать условный индекс для просроченных задач: {e}")
        
        # Добавляем комментарии к новым полям (если поддерживается)
        try:
            comments = [
                "COMMENT ON COLUMN tasks.parent_task_id IS 'Ссылка на родительскую задачу для экземпляров ежедневных задач'",
                "COMMENT ON COLUMN tasks.is_daily_instance IS 'Флаг, указывающий что это экземпляр ежедневной задачи'",
                "COMMENT ON COLUMN tasks.created_at IS 'Время создания задачи или экземпляра'"
            ]
            
            for comment_query in comments:
                db.execute(text(comment_query))
            print("✓ Добавлены комментарии к полям")
        except Exception as e:
            print(f"⚠ Предупреждение: не удалось добавить комментарии (возможно, не поддерживается СУБД): {e}")
        
        # Обновляем существующие записи
        update_existing_query = text("""
            UPDATE tasks 
            SET created_at = CURRENT_TIMESTAMP 
            WHERE created_at IS NULL
        """)
        
        result = db.execute(update_existing_query)
        print(f"✓ Обновлено {result.rowcount} существующих записей")
        
        # Фиксируем все изменения
        db.commit()
        print("Поддержка ежедневных задач успешно инициализирована!")
        
    except Exception as e:
        print(f"Ошибка при инициализации поддержки ежедневных задач: {e}")
        db.rollback()
        raise
    finally:
        db.close()

def check_daily_tasks_support():
    """Проверка наличия поддержки ежедневных задач"""
    db = database.SessionLocal()
    
    try:
        # Проверяем наличие всех необходимых полей
        check_query = text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'tasks' 
            AND column_name IN ('parent_task_id', 'is_daily_instance', 'created_at')
        """)
        
        result = db.execute(check_query).fetchall()
        found_columns = [row[0] for row in result]
        
        required_columns = ['parent_task_id', 'is_daily_instance', 'created_at']
        missing_columns = [col for col in required_columns if col not in found_columns]
        
        if not missing_columns:
            print("✓ Поддержка ежедневных задач полностью настроена")
            return True
        else:
            print(f"✗ Отсутствуют поля: {', '.join(missing_columns)}")
            return False
            
    except Exception as e:
        print(f"Ошибка при проверке поддержки ежедневных задач: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Проверка поддержки ежедневных задач ===")
    
    if not check_daily_tasks_support():
        print("\n=== Инициализация поддержки ежедневных задач ===")
        init_daily_tasks_support()
    else:
        print("Инициализация не требуется.")