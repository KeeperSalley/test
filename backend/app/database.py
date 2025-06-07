from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# DATABASE_URL = "postgresql://user:password@host:port/database"
# For now, we'll use a placeholder or an environment variable for the actual database URL
# In a real scenario, this should be configured securely, e.g., via environment variables
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:btAQE6EpDOvCb4BiYw7GAOk5U1I@localhost:5432/gamify_planner1")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

