from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import joinedload
from sqlalchemy import func, and_
from . import models, schemas, security
import json
import random
from typing import Optional, List

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
            db_user.max_points = 100 * db_user.level
            
        db.commit()
        db.refresh(db_user)
    return db_user

def leave_team(db: Session, user_id: int):
    """Пользователь покидает команду"""
    db_user = get_user(db, user_id)
    if db_user and db_user.team_id:
        team_id = db_user.team_id
        db_user.team_id = None
        
        # Проверяем, остались ли участники в команде
        remaining_members = db.query(models.User).filter(models.User.team_id == team_id).count()
        
        # Если команда пустая, удаляем её
        if remaining_members == 0:
            delete_team(db, team_id)
        else:
            # Проверяем боссов для оставшихся участников
            update_team_boss(db, team_id)
        
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
    existing_item = get_user_item(db, user_id, item_id)
    if existing_item:
        return existing_item
        
    db_user_item = models.UserItem(user_id=user_id, item_id=item_id, active='false')
    db.add(db_user_item)
    db.commit()
    db.refresh(db_user_item)
    return db_user_item

def get_active_items_count(db: Session, user_id: int):
    return db.query(models.UserItem).filter(
        models.UserItem.user_id == user_id,
        models.UserItem.active == 'true'
    ).count()

def update_user_item_active_status(db: Session, user_id: int, item_id: int, active: str):
    db_user_item = get_user_item(db, user_id, item_id)
    if not db_user_item:
        return None

    if active == 'true':
        active_count = get_active_items_count(db, user_id)
        if active_count >= 3:
            return None
    
    db_user_item.active = active
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
    try:
        return db.query(models.Team).options(
            joinedload(models.Team.boss),
            joinedload(models.Team.owner)
        ).filter(models.Team.team_id == team_id).first()
    except Exception as e:
        print(f"Error in get_team: {e}")
        # Попробуем без joinedload в случае ошибки
        return db.query(models.Team).filter(models.Team.team_id == team_id).first()

def get_team_by_name(db: Session, team_name: str):
    return db.query(models.Team).filter(models.Team.name == team_name).first()

def get_teams(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Team).options(
        joinedload(models.Team.boss),
        joinedload(models.Team.owner)
    ).offset(skip).limit(limit).all()

def get_team_members(db: Session, team_id: int):
    """Получить всех участников команды"""
    try:
        return db.query(models.User).filter(models.User.team_id == team_id).all()
    except Exception as e:
        print(f"Error in get_team_members: {e}")
        return []

def create_team(db: Session, team: schemas.TeamCreate, owner_id: int):
    db_team = models.Team(
        name=team.name,
        information=team.information,
        owner_id=owner_id
    )
    db.add(db_team)
    db.commit()
    db.refresh(db_team)
    
    # Добавляем владельца в команду
    owner = get_user(db, owner_id)
    if owner:
        owner.team_id = db_team.team_id
        db.commit()
    
    return db_team

def update_team(db: Session, team_id: int, team_update: schemas.TeamUpdate):
    db_team = get_team(db, team_id)
    if not db_team:
        return None
    
    update_data = team_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_team, key, value)
    
    db.commit()
    db.refresh(db_team)
    return db_team

def delete_team(db: Session, team_id: int):
    db_team = get_team(db, team_id)
    if db_team:
        # Удаляем всех участников из команды
        db.query(models.User).filter(models.User.team_id == team_id).update({"team_id": None})
        
        # Удаляем сообщения чата
        db.query(models.ChatMessage).filter(models.ChatMessage.team_id == team_id).delete()
        
        # Удаляем команду
        db.delete(db_team)
        db.commit()
    return db_team

def add_member_to_team(db: Session, team_id: int, user_id: int):
    """Добавить участника в команду"""
    user = get_user(db, user_id)
    team = get_team(db, team_id)
    
    if not user or not team:
        return None
        
    if user.team_id is not None:
        return None  # Пользователь уже в команде
    
    user.team_id = team_id
    db.commit()
    
    # Обновляем босса команды
    update_team_boss(db, team_id)
    
    db.refresh(user)
    return user

def remove_member_from_team(db: Session, team_id: int, user_id: int, remover_id: int):
    """Удалить участника из команды"""
    team = get_team(db, team_id)
    user = get_user(db, user_id)
    
    if not team or not user or user.team_id != team_id:
        return None
    
    # Проверяем права на удаление (только владелец может удалять)
    if team.owner_id != remover_id:
        return None
    
    # Нельзя удалить владельца
    if user_id == team.owner_id:
        return None
    
    user.team_id = None
    db.commit()
    
    # Обновляем босса команды
    update_team_boss(db, team_id)
    
    db.refresh(user)
    return user

def get_team_members_count(db: Session, team_id: int):
    """Получить количество участников команды"""
    return db.query(models.User).filter(models.User.team_id == team_id).count()

def update_team_boss_lives(db: Session, team_id: int, lives_change: int):
    db_team = get_team(db, team_id)
    if db_team:
        db_team.boss_lives += lives_change
        if db_team.boss_lives < 0:
            db_team.boss_lives = 0
        db.commit()
        db.refresh(db_team)
    return db_team

def update_team_boss(db: Session, team_id: int):
    """Обновить босса команды на основе количества участников и их уровней"""
    team = get_team(db, team_id)
    if not team:
        return None
    
    # Получаем всех участников команды
    members = get_team_members(db, team_id)
    
    if len(members) < 2:
        # Если участников меньше 2, убираем босса
        team.boss_id = None
        team.boss_lives = 0
    else:
        # Вычисляем средний уровень участников
        avg_level = sum(member.level for member in members) / len(members)
        avg_level = int(round(avg_level))
        
        # Определяем ID босса на основе среднего уровня
        boss_id = get_boss_id_by_level(avg_level)
        
        # Если босс изменился или его нет, назначаем нового
        if team.boss_id != boss_id:
            boss = get_boss(db, boss_id)
            if boss:
                team.boss_id = boss_id
                team.boss_lives = boss.base_lives
    
    db.commit()
    db.refresh(team)
    return team

def get_boss_id_by_level(avg_level: int) -> int:
    """Определить ID босса на основе среднего уровня команды"""
    if avg_level <= 10:
        return 1
    elif avg_level <= 20:
        return 2
    elif avg_level <= 30:
        return 3
    elif avg_level <= 40:
        return 4
    elif avg_level <= 50:
        return 5
    elif avg_level <= 60:
        return 6
    elif avg_level <= 70:
        return 7
    else:
        return 8

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

def defeat_boss(db: Session, team_id: int):
    """Обработка победы над боссом"""
    team = get_team(db, team_id)
    if not team or not team.boss_id:
        return None
    
    boss = team.boss
    if not boss:
        return None
    
    # Выдаем награду всем участникам команды
    members = db.query(models.User).filter(models.User.team_id == team_id).all()
    for member in members:
        update_user_gold_xp(db, member.user_id, gold_change=boss.gold_reward)
    
    # Обновляем босса команды (появляется новый)
    update_team_boss(db, team_id)
    
    return {"boss_defeated": True, "gold_reward": boss.gold_reward, "members_count": len(members)}

# --- Chat CRUD ---
def create_chat_message(db: Session, team_id: int, user_id: int, message: str):
    """Создать сообщение в чате команды"""
    db_message = models.ChatMessage(
        team_id=team_id,
        user_id=user_id,
        message=message
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_team_chat_messages(db: Session, team_id: int, skip: int = 0, limit: int = 50):
    """Получить сообщения чата команды"""
    return db.query(models.ChatMessage).options(
        joinedload(models.ChatMessage.user)
    ).filter(
        models.ChatMessage.team_id == team_id
    ).order_by(models.ChatMessage.timestamp.desc()).offset(skip).limit(limit).all()

def delete_team_chat_messages(db: Session, team_id: int):
    """Удалить все сообщения чата команды"""
    db.query(models.ChatMessage).filter(models.ChatMessage.team_id == team_id).delete()
    db.commit()

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
    task_data = task.dict(exclude={"repeat_days"})
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

def update_task_completion(db: Session, task_id: int, completed: str, user_id: int):
    """Обновить статус выполнения задачи и нанести урон боссу"""
    db_task = get_task(db, task_id=task_id)
    if not db_task:
        return None
    
    # Получаем пользователя
    user = get_user(db, user_id)
    if not user:
        return None
    
    # Если задача выполнена и пользователь в команде, наносим урон боссу
    if completed == 'true' and user.team_id:
        team = get_team(db, user.team_id)
        if team and team.boss_id and team.boss_lives > 0:
            # Урон зависит от атаки пользователя и сложности задачи
            complexity_multiplier = {'easy': 1, 'normal': 1.5, 'hard': 2}
            damage = int(user.attack * complexity_multiplier.get(db_task.complexity, 1))
            
            # Наносим урон боссу
            new_lives = max(0, team.boss_lives - damage)
            team.boss_lives = new_lives
            
            # Если босс побежден
            if new_lives == 0:
                defeat_boss(db, team.team_id)
    
    db_task.completed = completed
    db.commit()
    db.refresh(db_task)
    return db_task

def delete_task(db: Session, task_id: int):
    db_task = get_task(db, task_id)
    if db_task:
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