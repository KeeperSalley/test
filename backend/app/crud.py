from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from . import models, schemas, security
import json
import random # For boss attack simulation

# --- User CRUD --- 
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.user_id == user_id).first()

def get_user_by_nickname(db: Session, nickname: str):
    return db.query(models.User).filter(models.User.nickname == nickname).first()

def get_user_by_login(db: Session, login: str):
    return db.query(models.User).filter(models.User.login == login).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    hashed_password = security.get_password_hash(user.password)
    db_user = models.User(
        login=user.login, 
        nickname=user.nickname, 
        hashed_password=hashed_password,
        information=user.information,
        class_id=user.class_id
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_profile(db: Session, user_id: int, user_update: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user_gold_xp(db: Session, user_id: int, gold_change: int = 0, points_change: int = 0):
    db_user = get_user(db, user_id)
    if db_user:
        db_user.gold += gold_change
        db_user.points += points_change
        
        # Level up if points exceed max_points
        while db_user.points >= db_user.max_points:
            db_user.points -= db_user.max_points
            db_user.level += 1
            db_user.max_points = 100 * db_user.level  # Формула опыта для уровней
            
        db.commit()
        db.refresh(db_user)
    return db_user

# --- Class CRUD ---
def get_class(db: Session, class_id: int):
    return db.query(models.Class).filter(models.Class.class_id == class_id).first()

def get_classes(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Class).offset(skip).limit(limit).all()

def create_class(db: Session, class_data: schemas.ClassCreate):
    db_class = models.Class(**class_data.dict())
    db.add(db_class)
    db.commit()
    db.refresh(db_class)
    return db_class

# --- Item CRUD ---
def create_item(db: Session, item: schemas.ItemCreate):
    db_item = models.Item(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_item(db: Session, item_id: int):
    return db.query(models.Item).filter(models.Item.item_id == item_id).first()

def get_items(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Item).offset(skip).limit(limit).all()

# --- UserItem (Inventory) CRUD ---
def get_user_item(db: Session, user_id: int, item_id: int):
    return db.query(models.UserItem).filter(
        models.UserItem.user_id == user_id,
        models.UserItem.item_id == item_id
    ).first()

def get_user_items(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.UserItem).options(
        joinedload(models.UserItem.item)
    ).filter(models.UserItem.user_id == user_id).offset(skip).limit(limit).all()

def add_item_to_user_inventory(db: Session, user_id: int, item_id: int):
    # Check if user already has this item
    existing_item = get_user_item(db, user_id, item_id)
    if existing_item:
        return existing_item
        
    db_user_item = models.UserItem(user_id=user_id, item_id=item_id, active='false')
    db.add(db_user_item)
    db.commit()
    db.refresh(db_user_item)
    return db_user_item

def get_active_items_count(db: Session, user_id: int):
    """Получить количество активных предметов у пользователя"""
    return db.query(models.UserItem).filter(
        models.UserItem.user_id == user_id,
        models.UserItem.active == 'true'
    ).count()


def update_user_item_active_status(db: Session, user_id: int, item_id: int, active: str):
    db_user_item = get_user_item(db, user_id, item_id)
    if not db_user_item:
        return None

    # Если активируем предмет, проверяем количество уже активных предметов
    if active == 'true':
        # Получаем количество активных предметов
        active_count = get_active_items_count(db, user_id)
        
        # Если уже 3 активных предмета, не позволяем активировать еще один
        if active_count >= 3:
            return None
    
    # Устанавливаем статус активности
    db_user_item.active = active
    
    db.commit()
    db.refresh(db_user_item)
    return db_user_item


    # If activating an item, deactivate other items of the same type
    if active == 'true':
        item = get_item(db, item_id)
        if item:
            currently_active = db.query(models.UserItem).join(models.Item).filter(
                models.UserItem.user_id == user_id,
                models.UserItem.active == 'true',
                models.Item.type == item.type,
                models.UserItem.item_id != item_id
            ).all()
            
            for old_item in currently_active:
                old_item.active = 'false'
                # Apply item bonus removal logic here if needed
    
    db_user_item.active = active
    # Apply item bonus logic here if needed
    
    db.commit()
    db.refresh(db_user_item)
    return db_user_item

def remove_user_item(db: Session, user_id: int, item_id: int):
    db_user_item = get_user_item(db, user_id, item_id)
    if db_user_item:
        db.delete(db_user_item)
        db.commit()
    return db_user_item

# --- Team CRUD ---
def get_team(db: Session, team_id: int):
    return db.query(models.Team).filter(models.Team.team_id == team_id).first()

def get_teams(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Team).offset(skip).limit(limit).all()

def create_team(db: Session, team: schemas.TeamCreate):
    db_team = models.Team(**team.dict())
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    return db_team

def update_team_boss_lives(db: Session, team_id: int, lives_change: int):
    db_team = get_team(db, team_id)
    if db_team:
        db_team.boss_lives += lives_change
        if db_team.boss_lives < 0:
            db_team.boss_lives = 0
        db.commit()
        db.refresh(db_team)
    return db_team

# --- Boss CRUD ---
def create_boss(db: Session, boss: schemas.BossCreate):
    db_boss = models.Boss(**boss.dict())
    db.add(db_boss)
    db.commit()
    db.refresh(db_boss)
    return db_boss

def get_boss(db: Session, boss_id: int):
    return db.query(models.Boss).filter(models.Boss.boss_id == boss_id).first()

def get_bosses(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Boss).offset(skip).limit(limit).all()

# --- Catalog CRUD ---
def get_catalog(db: Session, catalog_id: int):
    return db.query(models.Catalog).filter(models.Catalog.catalog_id == catalog_id).first()

def get_user_catalogs(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Catalog).filter(models.Catalog.user_id == user_id).offset(skip).limit(limit).all()

def create_catalog(db: Session, catalog: schemas.CatalogCreate):
    db_catalog = models.Catalog(**catalog.dict())
    db.add(db_catalog)
    db.commit()
    db.refresh(db_catalog)
    return db_catalog

def delete_catalog(db: Session, catalog_id: int):
    db_catalog = get_catalog(db, catalog_id)
    if db_catalog:
        db.delete(db_catalog)
        db.commit()
    return db_catalog

# --- Task CRUD ---
def get_task(db: Session, task_id: int):
    return db.query(models.Task).filter(models.Task.task_id == task_id).first()

def get_catalog_tasks(db: Session, catalog_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Task).filter(models.Task.catalog_id == catalog_id).offset(skip).limit(limit).all()

def create_task(db: Session, task: schemas.TaskCreate):
    # Исключаем поля experience_reward и gold_reward, которых нет в модели Task
    task_data = task.dict(exclude={"experience_reward", "gold_reward", "repeat_days"})
    db_task = models.Task(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task(db: Session, task_id: int, task_update: schemas.TaskUpdate):
    db_task = get_task(db, task_id=task_id)
    if not db_task:
        return None
    
    update_data = task_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task_completion(db: Session, task_id: int, completed: str):
    db_task = get_task(db, task_id=task_id)
    if not db_task:
        return None
    
    db_task.completed = completed
    db.commit()
    db.refresh(db_task)
    return db_task


def delete_task(db: Session, task_id: int):
    db_task = get_task(db, task_id)
    if db_task:
        # First delete any associated daily tasks
        db.query(models.DailyTask).filter(models.DailyTask.task_id == task_id).delete()
        db.delete(db_task)
        db.commit()
    return db_task

# --- DailyTask CRUD ---
def get_daily_task(db: Session, daily_task_id: int):
    return db.query(models.DailyTask).filter(models.DailyTask.daily_task_id == daily_task_id).first()

def get_task_daily_tasks(db: Session, task_id: int):
    return db.query(models.DailyTask).filter(models.DailyTask.task_id == task_id).all()

def create_daily_task(db: Session, daily_task: schemas.DailyTaskCreate):
    db_daily_task = models.DailyTask(**daily_task.dict())
    db.add(db_daily_task)
    db.commit()
    db.refresh(db_daily_task)
    return db_daily_task

def delete_daily_task(db: Session, daily_task_id: int):
    db_daily_task = get_daily_task(db, daily_task_id)
    if db_daily_task:
        db.delete(db_daily_task)
        db.commit()
    return db_daily_task