from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect, Request, APIRouter
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates 
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional, Literal
from datetime import timedelta, date
import random 
import os 

from . import crud, models, schemas, security
from .database import SessionLocal, engine, get_db

BACKEND_APP_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT_DIR = os.path.abspath(os.path.join(BACKEND_APP_DIR, "..")) 
FRONTEND_DIR = os.path.abspath(os.path.join(PROJECT_ROOT_DIR, "..", "frontend")) 

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Gamify Planner API",
    description="Backend for the Gamified Planner application with FastAPI, OAuth2, and PostgreSQL, also serving frontend.",
    version="0.1.1"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = security.jwt.decode(token, security.JWT_SECRET_KEY, algorithms=[security.ALGORITHM])
        login: str = payload.get("sub")
        if login is None:
            raise credentials_exception
        token_data = schemas.TokenData(username=login)
    except security.jwt.PyJWTError:
        raise credentials_exception
    user = crud.get_user_by_login(db, login=token_data.username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    return current_user

api_router = APIRouter()

@api_router.post("/auth/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user_by_nickname = crud.get_user_by_nickname(db, nickname=user.nickname)
    if db_user_by_nickname:
        raise HTTPException(status_code=400, detail="Nickname already registered")
    db_user_by_login = crud.get_user_by_login(db, login=user.login)
    if db_user_by_login:
        raise HTTPException(status_code=400, detail="Login already taken")
    return crud.create_user(db=db, user=user)

@api_router.post("/auth/token", response_model=schemas.Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = crud.get_user_by_login(db, login=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect login or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        subject=user.login, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/users/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_active_user)):
    return current_user

@api_router.put("/users/me", response_model=schemas.User)
async def update_user_me(
    user_update: schemas.UserUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    if user_update.login and user_update.login != current_user.login:
        existing_user = crud.get_user_by_login(db, login=user_update.login)
        if existing_user:
            raise HTTPException(status_code=400, detail="Login already taken")
    if user_update.nickname and user_update.nickname != current_user.nickname:
        existing_user = crud.get_user_by_nickname(db, nickname=user_update.nickname)
        if existing_user:
            raise HTTPException(status_code=400, detail="Nickname already registered")
    updated_user = crud.update_user_profile(db=db, user_id=current_user.user_id, user_update=user_update)
    if not updated_user:
        raise HTTPException(status_code=404, detail="User not found or update failed")
    return updated_user

@api_router.patch("/users/me", response_model=schemas.User)
def update_current_user_lives(
    user_update: schemas.User,
    current_user: models.User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Если передано обновление жизней
    if user_update.lives is not None:
        # Проверяем, что значение целое число
        if not isinstance(user_update.lives, int):
            try:
                user_update.lives = int(user_update.lives)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Lives must be an integer value"
                )
        
        # Обновляем значение жизней
        current_user.lives = user_update.lives
        print(current_user.lives)
        
        return crud.decrease_user_lives(db, current_user.user_id, current_user.lives)

# --- Class endpoints ---
@api_router.get("/classes/", response_model=List[schemas.Class])
def get_all_classes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_classes(db, skip=skip, limit=limit)

@api_router.get("/classes/{class_id}", response_model=schemas.Class)
def get_class_details(class_id: int, db: Session = Depends(get_db)):
    db_class = crud.get_class(db, class_id=class_id)
    if db_class is None:
        raise HTTPException(status_code=404, detail="Class not found")
    return db_class

# --- Item endpoints ---

@api_router.get("/items", response_model=List[schemas.Item])
def get_all_items_in_shop(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_items(db, skip=skip, limit=limit)

@api_router.get("/items/{item_id}", response_model=schemas.Item)
def get_shop_item_details(item_id: int, db: Session = Depends(get_db)):
    db_item = crud.get_item(db, item_id=item_id)
    if db_item is None:
        raise HTTPException(status_code=404, detail="Item not found in shop")
    return db_item

@api_router.post("/items/buy", response_model=schemas.BuyItemResponse)
async def buy_item(
    buy_request: schemas.BuyItemRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Получаем предмет из базы данных
    item_to_buy = crud.get_item(db, item_id=buy_request.item_id)
    item_data = {
    "item_id": item_to_buy.item_id,
    "name": item_to_buy.name,
    "price": item_to_buy.price,
    "information": item_to_buy.information,
    "type": item_to_buy.type,
    "class_id": item_to_buy.class_id,
    "bonus_type": item_to_buy.bonus_type,
    "bonus_data": item_to_buy.bonus_data
    }
    if item_to_buy is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found in shop"
        )
    
    # Проверяем, есть ли у пользователя уже этот предмет
    existing_user_item = crud.get_user_item(db, user_id=current_user.user_id, item_id=buy_request.item_id)
    if existing_user_item:
        return schemas.BuyItemResponse(
            success=True,
            message=f"Successfully purchased {item_to_buy.name}",
            user_gold=current_user.gold,
            item=item_data
        )
    
    # Проверяем, достаточно ли у пользователя золота
    if current_user.gold < item_to_buy.price:
        return schemas.BuyItemResponse(
            success=True,
            message=f"Successfully purchased {item_to_buy.name}",
            user_gold=current_user.gold,
            item=item_data
        )
    
    # Проверяем, соответствует ли предмет классу пользователя (если это классовый предмет)
    if item_to_buy.class_id is not None and item_to_buy.class_id != current_user.class_id:
        return schemas.BuyItemResponse(
            success=True,
            message=f"Successfully purchased {item_to_buy.name}",
            user_gold=current_user.gold,
            item=item_data
        )
    
    try:
        # Списываем золото у пользователя
        updated_user = crud.update_user_gold_xp(
            db, 
            user_id=current_user.user_id, 
            gold_change=-item_to_buy.price
        )
        
        # Добавляем предмет в инвентарь пользователя
        user_item = crud.add_item_to_user_inventory(
            db, 
            user_id=current_user.user_id, 
            item_id=buy_request.item_id
        )
        
        # Обновляем данные пользователя
        db.refresh(current_user)
        
        return schemas.BuyItemResponse(
            success=True,
            message=f"Successfully purchased {item_to_buy.name}",
            user_gold=current_user.gold,
            item=item_data
        )
    
    except Exception as e:
        # В случае ошибки откатываем транзакцию
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to purchase item: {str(e)}"
        )

# --- UserItem endpoints ---
@api_router.get("/user-items", response_model=List[schemas.UserItem])
def get_my_items(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_user_items(db, user_id=current_user.user_id, skip=skip, limit=limit)

@api_router.post("/user-items/buy/{item_id}", response_model=schemas.UserItem)
def buy_item_from_shop(item_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    item_to_buy = crud.get_item(db, item_id=item_id)
    if item_to_buy is None:
        raise HTTPException(status_code=404, detail="Item not found in shop")
    if current_user.gold < item_to_buy.price:
        raise HTTPException(status_code=400, detail="Not enough gold")
    crud.update_user_gold_xp(db, user_id=current_user.user_id, gold_change=-item_to_buy.price)
    user_item = crud.add_item_to_user_inventory(db, user_id=current_user.user_id, item_id=item_id)
    db.refresh(current_user)
    return user_item

@api_router.put("/user-items/{item_id}/toggle-active", response_model=schemas.UserItem)
def toggle_item_active_status(
    item_id: int, 
    active_status: schemas.UserItemUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    user_item = crud.get_user_item(db, user_id=current_user.user_id, item_id=item_id)
    if user_item is None:
        raise HTTPException(status_code=404, detail="Item not found in your inventory")
    if active_status.active is None:
        raise HTTPException(status_code=400, detail="Active status must be provided ('true' or 'false')")
    updated_user_item = crud.update_user_item_active_status(
        db=db, user_id=current_user.user_id, item_id=item_id, active=active_status.active
    )
    db.refresh(current_user)
    return updated_user_item

@api_router.get("/teams/my-team", response_model=schemas.TeamResponse)
def get_my_team(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    if not current_user.team_id:
        raise HTTPException(status_code=404, detail="You are not in a team")
    
    team = crud.get_team(db, current_user.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Получаем участников команды
    members = crud.get_team_members(db, team.team_id)
    
    # Создаем объект TeamResponse
    team_response = schemas.TeamResponse(
        team_id=team.team_id,
        name=team.name,
        owner_id=team.owner_id,
        information=team.information,
        boss_id=team.boss_id,
        boss_lives=team.boss_lives,
        created_at=team.created_at,
        boss=team.boss,
        owner=team.owner,
        members=[schemas.UserSimple.from_orm(member) for member in members]
    )
    
    return team_response

@api_router.post("/teams", response_model=schemas.Team, status_code=status.HTTP_201_CREATED)
def create_team(
    team: schemas.TeamCreate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    # Проверяем, что пользователь не в команде
    if current_user.team_id is not None:
        raise HTTPException(status_code=400, detail="You are already in a team")
    
    # Проверяем, что команда с таким именем не существует
    existing_team = crud.get_team_by_name(db, team.name)
    if existing_team:
        raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    return crud.create_team(db=db, team=team, owner_id=current_user.user_id)

@api_router.get("/teams", response_model=List[schemas.Team])
def get_all_teams(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_teams(db, skip=skip, limit=limit)

@api_router.get("/teams/{team_id}", response_model=schemas.Team)
def get_team_details(team_id: int, db: Session = Depends(get_db)):
    db_team = crud.get_team(db, team_id=team_id)
    if db_team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return db_team

@api_router.put("/teams/{team_id}", response_model=schemas.Team)
def update_team(
    team_id: int,
    team_update: schemas.TeamUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем, что пользователь - владелец команды
    if team.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can update team details")
    
    # Проверяем уникальность имени команды, если оно изменяется
    if team_update.name and team_update.name != team.name:
        existing_team = crud.get_team_by_name(db, team_update.name)
        if existing_team:
            raise HTTPException(status_code=400, detail="Team with this name already exists")
    
    updated_team = crud.update_team(db, team_id, team_update)
    return updated_team

@api_router.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем, что пользователь - владелец команды
    if team.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can delete team")
    
    crud.delete_team(db, team_id)
    return {"detail": "Team deleted successfully"}

@api_router.post("/teams/join")
def join_team(
    join_request: schemas.JoinTeamRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Проверяем, что пользователь не в команде
    if current_user.team_id is not None:
        raise HTTPException(status_code=400, detail="You are already in a team")
    
    # Ищем команду по имени
    team = crud.get_team_by_name(db, join_request.team_name)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Добавляем пользователя в команду
    result = crud.add_member_to_team(db, team.team_id, current_user.user_id)
    if not result:
        raise HTTPException(status_code=400, detail="Failed to join team")
    
    return {"message": f"Successfully joined team '{team.name}'"}

@api_router.post("/teams/{team_id}/leave")
def leave_team(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Проверяем, что пользователь в этой команде
    if current_user.team_id != team_id:
        raise HTTPException(status_code=400, detail="You are not in this team")
    
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Если пользователь - владелец команды, нужно передать права или удалить команду
    if team.owner_id == current_user.user_id:
        # Проверяем, есть ли другие участники
        members_count = crud.get_team_members_count(db, team_id)
        if members_count > 1:
            raise HTTPException(
                status_code=400, 
                detail="As team owner, you must either transfer ownership or delete the team"
            )
        else:
            # Если владелец единственный участник, удаляем команду
            crud.delete_team(db, team_id)
            return {"message": "Team deleted as you were the only member"}
    
    # Пользователь покидает команду
    crud.leave_team(db, current_user.user_id)
    return {"message": "Successfully left the team"}

@api_router.post("/teams/{team_id}/add-member")
def add_member(
    team_id: int,
    add_request: schemas.AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем, что пользователь - владелец команды
    if team.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can add members")
    
    # Ищем пользователя по никнейму
    user_to_add = crud.get_user_by_nickname(db, add_request.nickname)
    if not user_to_add:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Проверяем, что пользователь не в команде
    if user_to_add.team_id is not None:
        raise HTTPException(status_code=400, detail="User is already in a team")
    
    # Добавляем пользователя в команду
    result = crud.add_member_to_team(db, team_id, user_to_add.user_id)
    if not result:
        raise HTTPException(status_code=400, detail="Failed to add member")
    
    return {"message": f"Successfully added {add_request.nickname} to the team"}

@api_router.post("/teams/{team_id}/remove-member")
def remove_member(
    team_id: int,
    remove_request: schemas.RemoveMemberRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Проверяем, что пользователь - владелец команды
    if team.owner_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Only team owner can remove members")
    
    # Проверяем, что удаляемый пользователь не владелец
    if remove_request.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Team owner cannot remove themselves")
    
    # Удаляем пользователя из команды
    result = crud.remove_member_from_team(db, team_id, remove_request.user_id, current_user.user_id)
    if not result:
        raise HTTPException(status_code=400, detail="Failed to remove member or member not in team")
    
    return {"message": "Successfully removed member from the team"}

# --- Boss endpoints ---
@api_router.post("/bosses", response_model=schemas.Boss, status_code=status.HTTP_201_CREATED)
def create_new_boss(boss: schemas.BossCreate, db: Session = Depends(get_db)):
    return crud.create_boss(db=db, boss=boss)

@api_router.get("/bosses", response_model=List[schemas.Boss])
def list_available_bosses(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_bosses(db, skip=skip, limit=limit)

@api_router.get("/bosses/{boss_id}", response_model=schemas.Boss)
def get_boss_details(boss_id: int, db: Session = Depends(get_db)):
    db_boss = crud.get_boss(db, boss_id=boss_id)
    if db_boss is None:
        raise HTTPException(status_code=404, detail="Boss not found")
    return db_boss

@api_router.post("/teams/{team_id}/attack-boss", response_model=schemas.BossAttackResult)
def attack_team_boss(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Проверяем, что пользователь в этой команде
    if current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    team = crud.get_team(db, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if not team.boss_id:
        raise HTTPException(status_code=400, detail="Team has no boss to fight")
    
    if team.boss_lives <= 0:
        raise HTTPException(status_code=400, detail="Boss is already defeated")
    
    boss = team.boss
    if not boss:
        raise HTTPException(status_code=404, detail="Boss not found")
    
    # Вычисляем урон
    damage = current_user.attack
    
    # Наносим урон боссу
    new_lives = max(0, team.boss_lives - damage)
    team.boss_lives = new_lives
    
    boss_defeated = False
    rewards = None
    
    # Проверяем победу над боссом
    if new_lives == 0:
        boss_defeated = True
        defeat_result = crud.defeat_boss(db, team_id)
        if defeat_result:
            rewards = {
                "gold": defeat_result["gold_reward"],
                "members_rewarded": defeat_result["members_count"]
            }
    
    db.commit()
    
    return schemas.BossAttackResult(
        message=f"You dealt {damage} damage to {boss.name}!",
        player_damage_done=damage,
        boss_damage_taken=damage,
        boss_current_health=new_lives,
        boss_defeated=boss_defeated,
        rewards_granted=rewards
    )

# --- Chat endpoints ---
@api_router.get("/teams/{team_id}/chat", response_model=List[schemas.ChatMessage])
def get_team_chat(
    team_id: int,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Проверяем, что пользователь в этой команде
    if current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    messages = crud.get_team_chat_messages(db, team_id, skip, limit)
    return messages[::-1]  # Возвращаем в хронологическом порядке

@api_router.post("/teams/{team_id}/chat", response_model=schemas.ChatMessage)
def send_chat_message(
    team_id: int,
    message: schemas.ChatMessageCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Проверяем, что пользователь в этой команде
    if current_user.team_id != team_id:
        raise HTTPException(status_code=403, detail="You are not a member of this team")
    
    # Создаем сообщение
    db_message = crud.create_chat_message(db, team_id, current_user.user_id, message.message)
    return db_message

# --- Catalog endpoints ---
@api_router.post("/catalogs/", response_model=schemas.Catalog, status_code=status.HTTP_201_CREATED)
def create_catalog(catalog_data: schemas.CatalogCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Ensure user_id is set to current user
    catalog_data.user_id = current_user.user_id
    return crud.create_catalog(db=db, catalog=catalog_data)

@api_router.get("/catalogs/", response_model=List[schemas.Catalog])
def get_user_catalogs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    return crud.get_user_catalogs(db, user_id=current_user.user_id, skip=skip, limit=limit)

@api_router.get("/catalogs/{catalog_id}", response_model=schemas.Catalog)
def get_catalog_details(catalog_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    db_catalog = crud.get_catalog(db, catalog_id=catalog_id)
    if db_catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    if db_catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this catalog")
    return db_catalog

@api_router.delete("/catalogs/{catalog_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_catalog(catalog_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Verify catalog belongs to user
    catalog = crud.get_catalog(db, catalog_id=catalog_id)
    if not catalog:
        raise HTTPException(status_code=404, detail="Catalog not found")
    if catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this catalog")
    
    crud.delete_catalog(db, catalog_id=catalog_id)
    return {"detail": "Catalog and all its tasks deleted successfully"}

# --- Enhanced Task endpoints ---
@api_router.post("/tasks/", response_model=schemas.Task, status_code=status.HTTP_201_CREATED)
def create_task_enhanced(task: schemas.TaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Verify catalog belongs to user
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to add tasks to this catalog")
    
    # Create the main task
    db_task = crud.create_task(db=db, task=task)
    
    # If repeat_days are specified, create daily_task entries
    if task.repeat_days:
        for day in task.repeat_days:
            daily_task_data = schemas.DailyTaskCreate(
                task_id=db_task.task_id,
                day_week=day
            )
            crud.create_daily_task(db=db, daily_task=daily_task_data)
    
    # Refresh to get daily_tasks
    db.refresh(db_task)
    return db_task

@api_router.get("/tasks/{task_id}", response_model=schemas.Task)
def get_task_details(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Verify task belongs to user's catalog
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view this task")
    
    return task

@api_router.get("/catalogs/{catalog_id}/tasks", response_model=List[schemas.Task])
def get_catalog_tasks(catalog_id: int, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Verify catalog belongs to user
    catalog = crud.get_catalog(db, catalog_id=catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view tasks in this catalog")
    return crud.get_catalog_tasks(db, catalog_id=catalog_id, skip=skip, limit=limit)

@api_router.put("/tasks/{task_id}", response_model=schemas.Task)
def update_task_enhanced(
    task_id: int, 
    task_update: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_active_user)
):
    # Verify task belongs to user
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Запрещаем редактирование экземпляров ежедневных задач
    if hasattr(task, 'is_daily_instance') and task.is_daily_instance:
        raise HTTPException(status_code=400, detail="Daily task instances cannot be edited")
    
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
    
    updated_task = crud.update_task_enhanced(db, task_id=task_id, task_update=task_update)
    return updated_task

@api_router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task_enhanced(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Verify task belongs to user's catalog
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this task")
    
    crud.delete_task_enhanced(db, task_id=task_id)
    return {"detail": "Task deleted successfully"}

@api_router.patch("/tasks/{task_id}/completion", response_model=schemas.Task)
def update_task_completion_enhanced(
    task_id: int, 
    completed_status: schemas.TaskUpdate, 
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    # Verify task belongs to user's catalog
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this task")
    
    if completed_status.completed is None:
        raise HTTPException(status_code=400, detail="Completed status must be provided ('true' or 'false')")
    
    rewards = {
        "easy": [10, 20],
        "normal": [30, 40],
        "hard": [50, 80]
    }
    
    updated_task = crud.update_task_completion(db=db, task_id=task_id, completed=completed_status.completed, user_id=current_user.user_id)
    
    # Награды выдаем только при выполнении задачи
    if completed_status.completed == 'true':
        crud.update_user_gold_xp(
            db,
            user_id=current_user.user_id,
            gold_change=rewards[task.complexity][0],
            points_change=rewards[task.complexity][1]
        )
    
    return updated_task

# --- Daily Tasks Management endpoints ---
@api_router.post("/daily-tasks/create-instances", response_model=List[schemas.Task])
def create_daily_task_instances(
    target_date: Optional[date] = None,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Создание экземпляров ежедневных задач на указанную дату (по умолчанию - сегодня)"""
    if not target_date:
        target_date = date.today()
    
    instances = crud.create_daily_instances_for_date(db, current_user.user_id, target_date)
    return instances

@api_router.delete("/daily-tasks/cleanup")
def cleanup_old_daily_instances(
    cutoff_days: int = 7,  # По умолчанию удаляем выполненные задачи старше недели
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Очистка старых ВЫПОЛНЕННЫХ экземпляров ежедневных задач"""
    cutoff_date = date.today() - timedelta(days=cutoff_days)
    deleted_count = crud.cleanup_old_daily_instances(db, current_user.user_id, cutoff_date)
    return {"deleted_completed_instances": deleted_count, "cutoff_date": cutoff_date}

@api_router.post("/daily-tasks/maintain")
def maintain_daily_tasks(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Автоматическое обслуживание ежедневных задач"""
    result = crud.maintain_daily_tasks_for_user(db, current_user.user_id)
    return result

@api_router.get("/tasks/for-date/{target_date}", response_model=List[schemas.Task])
def get_tasks_for_date(
    target_date: date,
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Получение всех задач на конкретную дату"""
    tasks = crud.get_tasks_for_date(db, current_user.user_id, target_date)
    return tasks

@api_router.get("/tasks/daily", response_model=List[schemas.Task])
def get_user_daily_tasks(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Получение всех ежедневных задач пользователя"""
    daily_tasks = crud.get_daily_tasks_for_user(db, current_user.user_id)
    return daily_tasks

@api_router.get("/tasks/overdue", response_model=List[schemas.Task])
def get_overdue_tasks(
    db: Session = Depends(get_db), 
    current_user: models.User = Depends(get_current_active_user)
):
    """Получение просроченных задач"""
    current_date = date.today()
    overdue_tasks = crud.get_overdue_tasks(db, current_user.user_id, current_date)
    return overdue_tasks

# --- DailyTask endpoints ---
@api_router.post("/daily-tasks/", response_model=schemas.DailyTask, status_code=status.HTTP_201_CREATED)
def create_daily_task(daily_task: schemas.DailyTaskCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Verify task belongs to user's catalog
    task = crud.get_task(db, task_id=daily_task.task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to add daily tasks to this task")
    
    return crud.create_daily_task(db=db, daily_task=daily_task)

@api_router.get("/tasks/{task_id}/daily-tasks", response_model=List[schemas.DailyTask])
def get_task_daily_tasks(task_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_active_user)):
    # Verify task belongs to user's catalog
    task = crud.get_task(db, task_id=task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    catalog = crud.get_catalog(db, catalog_id=task.catalog_id)
    if not catalog or catalog.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to view daily tasks for this task")
    
    return crud.get_task_daily_tasks(db, task_id=task_id)

# --- WebSocket для чата ---
class TeamConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, team_id: int):
        await websocket.accept()
        if team_id not in self.active_connections:
            self.active_connections[team_id] = []
        self.active_connections[team_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, team_id: int):
        if team_id in self.active_connections:
            if websocket in self.active_connections[team_id]:
                self.active_connections[team_id].remove(websocket)
            if not self.active_connections[team_id]:
                del self.active_connections[team_id]
    
    async def send_to_team(self, message: str, team_id: int):
        if team_id in self.active_connections:
            for connection in self.active_connections[team_id]:
                try:
                    await connection.send_text(message)
                except:
                    # Удаляем неактивные соединения
                    if connection in self.active_connections[team_id]:
                        self.active_connections[team_id].remove(connection)

team_manager = TeamConnectionManager()

@api_router.websocket("/ws/team-chat/{team_id}/{token}")
async def team_chat_websocket(
    websocket: WebSocket, 
    team_id: int, 
    token: str, 
    db: Session = Depends(get_db)
):
    try:
        # Проверяем токен
        user = await get_current_user(token=token, db=db)
        
        # Проверяем, что пользователь в команде
        if user.team_id != team_id:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
            
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    await team_manager.connect(websocket, team_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            # Сохраняем сообщение в базе данных
            message = crud.create_chat_message(db, team_id, user.user_id, data)
            
            # Отправляем сообщение всем участникам команды
            formatted_message = f"{user.nickname}: {data}"
            await team_manager.send_to_team(formatted_message, team_id)
            
    except WebSocketDisconnect:
        team_manager.disconnect(websocket, team_id)
    except Exception as e:
        print(f"Error in team chat websocket: {e}")
        team_manager.disconnect(websocket, team_id)

# --- Старый чат WebSocket (сохраняем для совместимости) ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, room_name: str):
        await websocket.accept()
        if room_name not in self.active_connections:
            self.active_connections[room_name] = []
        self.active_connections[room_name].append(websocket)
    
    def disconnect(self, websocket: WebSocket, room_name: str):
        if room_name in self.active_connections:
            self.active_connections[room_name].remove(websocket)
            if not self.active_connections[room_name]:
                del self.active_connections[room_name]
    
    async def broadcast(self, message: str, room_name: str):
        if room_name in self.active_connections:
            for connection in self.active_connections[room_name]:
                await connection.send_text(message)

manager = ConnectionManager()

# Simplified chat message schema for WebSocket
class ChatMessageBase(schemas.BaseModel):
    message: str

class ChatMessage(ChatMessageBase):
    user_id: int
    nickname: str
    timestamp: str

@api_router.websocket("/ws/chat/{room_name}/{token}")
async def websocket_endpoint(websocket: WebSocket, room_name: str, token: str, db: Session = Depends(get_db)):
    try:
        user = await get_current_user(token=token, db=db)
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    await manager.connect(websocket, room_name)
    await manager.broadcast(f"User {user.nickname} joined room '{room_name}'.", room_name)
    
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"{user.nickname}: {data}", room_name)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_name)
        await manager.broadcast(f"User {user.nickname} left room '{room_name}'.", room_name)
    except Exception as e:
        print(f"Error in websocket: {e}")
        manager.disconnect(websocket, room_name)
        await manager.broadcast(f"User {user.nickname} disconnected due to an error.", room_name)

# Подключаем API роутер
app.include_router(api_router, prefix="/api")

# Добавляем middleware для автоматического обслуживания ежедневных задач
@app.middleware("http")
async def daily_tasks_maintenance_middleware(request: Request, call_next):
    """Middleware для автоматического обслуживания ежедневных задач"""
    response = await call_next(request)
    
    # Проверяем, нужно ли выполнить обслуживание ежедневных задач
    # Делаем это только для запросов к каталогам, чтобы не перегружать систему
    if (request.url.path.startswith("/api/catalogs/") and 
        request.method == "GET" and 
        response.status_code == 200):
        
        try:
            # Получаем токен из заголовка
            auth_header = request.headers.get("authorization")
            if auth_header and auth_header.startswith("Bearer "):
                # Здесь можно добавить фоновую задачу для обслуживания ежедневных задач
                # Пока оставляем пустым, так как обслуживание происходит на фронтенде
                pass
        except Exception as e:
            # Логируем ошибку, но не прерываем обработку запроса
            print(f"Daily tasks maintenance error: {e}")
    
    return response

# Обслуживание фронтенда
@app.get("/{path:path}", response_class=HTMLResponse)
async def serve_frontend_page(request: Request, path: str):
    file_path = os.path.join(FRONTEND_DIR, path)
    if os.path.isdir(file_path):
        index_path = os.path.join(file_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path, media_type="text/html")
        raise HTTPException(status_code=404, detail="Directory listing not supported or index.html not found")
    
    if os.path.exists(file_path):
        media_type = "text/html" 
        if path.endswith(".css"): media_type = "text/css"
        elif path.endswith(".js"): media_type = "application/javascript"
        elif path.endswith(".png"): media_type = "image/png"
        elif path.endswith(".jpg") or path.endswith(".jpeg"): media_type = "image/jpeg"
        elif path.endswith(".svg"): media_type = "image/svg+xml"
        elif path.endswith(".json"): media_type = "application/json"
        return FileResponse(file_path, media_type=media_type)
    
    # If specific file not found, try to serve index.html for SPA routing
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path, media_type="text/html")
    
    raise HTTPException(status_code=404, detail=f"File {path} not found")