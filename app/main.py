# The entry point of our Depot Management System API.
from fastapi import FastAPI

# Create the application. Every endpoint is attached to this object.
app = FastAPI(title="Depot Management System")


# When someone sends GET /, FastAPI runs this function
# and turns the returned dict into JSON.
@app.get("/")
def read_root():
    return {"message": "Depot Management System is running"}


@app.get("/health")
def read_health():
    return {"status": "ok"}
