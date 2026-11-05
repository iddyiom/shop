# The entry point of our Depot Management System API.
# Tables are NOT made here: run "alembic upgrade head" first (docs/specs/09-migrations.md).
from fastapi import FastAPI

from app.errors import add_error_handler
from app.routers import auth, deliveries, groups, products, sales, stock, summary, users


# Create the application. Every endpoint is attached to this object.
app = FastAPI(title="Depot Management System")
add_error_handler(app)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(products.router)
app.include_router(sales.router)
app.include_router(deliveries.router)
app.include_router(stock.router)
app.include_router(summary.router)


# When someone sends GET /, FastAPI runs this function
# and turns the returned dict into JSON.
@app.get("/")
def read_root():
    return {"message": "Depot Management System is running"}


@app.get("/health")
def read_health():
    return {"status": "ok"}
