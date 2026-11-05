# The entry point of our Depot Management System API.
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import Base, engine
from app.errors import add_error_handler
from app.routers import auth, users


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Runs once when the server starts: create any tables that do not exist yet.
    # (Before PostgreSQL we will replace this with proper migrations: Alembic.)
    Base.metadata.create_all(engine)
    yield


# Create the application. Every endpoint is attached to this object.
app = FastAPI(title="Depot Management System", lifespan=lifespan)
add_error_handler(app)

app.include_router(auth.router)
app.include_router(users.router)


# When someone sends GET /, FastAPI runs this function
# and turns the returned dict into JSON.
@app.get("/")
def read_root():
    return {"message": "Depot Management System is running"}


@app.get("/health")
def read_health():
    return {"status": "ok"}
