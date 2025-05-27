from sqlalchemy import Column, Integer, String, ForeignKey, Date, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    nickname = Column(String(17), unique=True, index=True, nullable=False)
    class_id = Column(Integer, ForeignKey("classes.class_id"), nullable=True)
    information = Column(String(511), nullable=True)
    level = Column(Integer, default=1)
    lives = Column(Integer, default=100)
    max_lives = Column(Integer, default=100)
    points = Column(Integer, default=0)
    max_points = Column(Integer, default=100)
    gold = Column(Integer, default=0)
    attack = Column(Integer, default=10)
    team_id = Column(Integer, ForeignKey("teams.team_id"), nullable=True)
    img = Column(String(255))

    # Relationships
    class_info = relationship("Class", back_populates="users")
    team = relationship("Team", back_populates="members")
    items = relationship("UserItem", back_populates="user")
    catalogs = relationship("Catalog", back_populates="user")

class Item(Base):
    __tablename__ = "items"

    item_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Integer, default=0)
    information = Column(String, nullable=True)
    type = Column(Enum('com', 'rare', name='item_type'), nullable=False)
    class_id = Column(Integer, ForeignKey("classes.class_id"), nullable=True)
    bonus_type = Column(String(31), nullable=True)
    bonus_data = Column(Integer, default=0)

    # Relationships
    class_info = relationship("Class", back_populates="items")
    user_items = relationship("UserItem", back_populates="item")

class UserItem(Base):
    __tablename__ = "user_items"

    user_id = Column(Integer, ForeignKey("users.user_id"), primary_key=True)
    item_id = Column(Integer, ForeignKey("items.item_id"), primary_key=True)
    active = Column(Enum('true', 'false', name='active_status'), default='false')

    # Relationships
    user = relationship("User", back_populates="items")
    item = relationship("Item", back_populates="user_items")

class Class(Base):
    __tablename__ = "classes"

    class_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    information = Column(String, nullable=True)

    # Relationships
    users = relationship("User", back_populates="class_info")
    items = relationship("Item", back_populates="class_info")

class Team(Base):
    __tablename__ = "teams"

    team_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(63), nullable=False)
    owner = Column(Integer, nullable=False)
    information = Column(String(255), nullable=True)
    boss_id = Column(Integer, ForeignKey("bosses.boss_id"), nullable=True)
    boss_lives = Column(Integer, default=0)

    # Relationships
    members = relationship("User", back_populates="team")
    boss = relationship("Boss", back_populates="teams")

class Boss(Base):
    __tablename__ = "bosses"

    boss_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    base_lives = Column(Integer, nullable=False)
    information = Column(String, nullable=True)
    level = Column(Integer, default=1)

    # Relationships
    teams = relationship("Team", back_populates="boss")

class Catalog(Base):
    __tablename__ = "catalogs"

    catalog_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    name = Column(String(63), nullable=False)

    # Relationships
    user = relationship("User", back_populates="catalogs")
    tasks = relationship("Task", back_populates="catalog", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"

    task_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    catalog_id = Column(Integer, ForeignKey("catalogs.catalog_id"), nullable=False)
    name = Column(String(127), nullable=False)
    complexity = Column(Enum('easy', 'normal', 'hard', name='task_complexity'), nullable=False)
    deadline = Column(Date, nullable=True)
    completed = Column(Enum('true', 'false', name='completed_status'), default='false', nullable=False)
    
    # Relationships
    catalog = relationship("Catalog", back_populates="tasks")
    daily_tasks = relationship("DailyTask", back_populates="task")

class DailyTask(Base):
    __tablename__ = "daily_task"

    daily_task_id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.task_id"), nullable=False)
    day_week = Column(Enum('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', name='day_of_week'), nullable=False)

    # Relationships
    task = relationship("Task", back_populates="daily_tasks")
