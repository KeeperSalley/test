from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime, date

# --- Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# --- Class Schemas ---
class ClassBase(BaseModel):
    name: str
    information: Optional[str] = None

class ClassCreate(ClassBase):
    pass

class Class(ClassBase):
    class_id: int

    class Config:
        orm_mode = True

# --- User Schemas ---
class UserBase(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)
    nickname: str = Field(..., min_length=1, max_length=17)
    information: Optional[str] = Field(None, max_length=511)

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    class_id: Optional[int] = None

class UserUpdate(BaseModel):
    login: Optional[str] = Field(None, min_length=3, max_length=50)
    nickname: Optional[str] = Field(None, min_length=1, max_length=17)
    information: Optional[str] = Field(None, max_length=511)
    class_id: Optional[int] = None
    level: Optional[int] = None
    lives: Optional[int] = None
    max_lives: Optional[int] = None
    points: Optional[int] = None
    max_points: Optional[int] = None
    gold: Optional[int] = None
    attack: Optional[int] = None
    team_id: Optional[int] = None
    img: Optional[str] = Field(None, max_length=511)

class User(UserBase):
    user_id: int
    class_id: Optional[int] = None
    level: int = 1
    lives: int = 100
    max_lives: int = 100
    points: int = 0
    max_points: int = 100
    gold: int = 0
    attack: int = 10
    team_id: Optional[int] = None
    class_info: Optional[Class] = None
    img: Optional[str] = None
    
    class Config:
        orm_mode = True

# --- Item Schemas ---
class ItemBase(BaseModel):
    name: str
    price: int = Field(default=0, ge=0)
    information: Optional[str] = None
    type: Literal['com', 'rare']
    class_id: Optional[int] = None
    bonus_type: Optional[str] = Field(None, max_length=31)
    bonus_data: int = 0

class ItemCreate(ItemBase):
    pass

class Item(ItemBase):
    item_id: int
    class_info: Optional[Class] = None

    class Config:
        orm_mode = True
        
class BuyItemRequest(BaseModel):
    item_id: int

class BuyItemResponse(BaseModel):
    success: bool
    message: str
    user_gold: int
    item: Optional[Dict[str, Any]] = None

# --- UserItem Schemas ---
class UserItemBase(BaseModel):
    user_id: int
    item_id: int
    active: Literal['true', 'false'] = 'false'

class UserItemCreate(UserItemBase):
    pass

class UserItem(UserItemBase):
    item: Optional[Item] = None
    user: Optional[User] = None

    class Config:
        orm_mode = True

class UserItemUpdate(BaseModel):
    active: Optional[Literal['true', 'false']] = None

# --- Team Schemas ---
class TeamBase(BaseModel):
    name: str = Field(..., max_length=63)
    owner: int
    information: Optional[str] = Field(None, max_length=255)
    boss_id: Optional[int] = None
    boss_lives: int = 0

class TeamCreate(TeamBase):
    pass

class Team(TeamBase):
    team_id: int
    boss: Optional['Boss'] = None
    members: List['User'] = []

    class Config:
        orm_mode = True

# --- Boss Schemas ---
class BossBase(BaseModel):
    name: str
    base_lives: int = Field(..., gt=0)
    information: Optional[str] = None
    level: int = 1

class BossCreate(BossBase):
    pass

class Boss(BossBase):
    boss_id: int
    teams: List[Team] = []

    class Config:
        orm_mode = True

# --- Catalog Schemas ---
class CatalogBase(BaseModel):
    user_id: int
    name: str = Field(..., max_length=63)

class CatalogCreate(CatalogBase):
    pass

class Catalog(CatalogBase):
    catalog_id: int
    tasks: List['Task'] = []

    class Config:
        orm_mode = True

# --- Task Schemas ---
class TaskBase(BaseModel):
    catalog_id: int
    name: str = Field(..., max_length=127)
    complexity: Literal['easy', 'normal', 'hard']
    deadline: Optional[date] = None
    completed: Literal['true', 'false'] = 'false'

# Базовая схема для DailyTask без ссылки на Task
class DailyTaskBase(BaseModel):
    task_id: int
    day_week: Literal['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

class DailyTaskCreate(DailyTaskBase):
    pass

# Упрощенная схема DailyTask для использования в Task
class DailyTaskSimple(DailyTaskBase):
    daily_task_id: int

    class Config:
        orm_mode = True

# Полная схема Task с упрощенными DailyTask
class Task(TaskBase):
    task_id: int
    daily_tasks: List[DailyTaskSimple] = []

    class Config:
        orm_mode = True
        
class TaskCreate(TaskBase):
    repeat_days: Optional[List[Literal['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']]] = None
    
class TaskUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=127)
    complexity: Optional[Literal['easy', 'normal', 'hard']] = None
    deadline: Optional[date] = None
    completed: Optional[bool] = None
    completed: Optional[Literal['true', 'false']] = None     

# Упрощенная схема Task для использования в DailyTask
class TaskSimple(TaskBase):
    task_id: int

    class Config:
        orm_mode = True

# Полная схема DailyTask с упрощенной Task
class DailyTask(DailyTaskBase):
    daily_task_id: int
    task: Optional[TaskSimple] = None

    class Config:
        orm_mode = True