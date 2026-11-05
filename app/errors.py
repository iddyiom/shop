# One error type for the whole app, so every error looks the same on the screen:
# {"error": "item_over", "message": "Item over: only 1 in store", ...extra fields}
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status_code: int, error: str, message: str, **extra):
        super().__init__(message)
        self.status_code = status_code
        self.body = {"error": error, "message": message, **extra}


def add_error_handler(app: FastAPI) -> None:
    """When any endpoint raises AppError, turn it into a JSON response."""

    @app.exception_handler(AppError)
    async def handle_app_error(_request: Request, exc: AppError):
        return JSONResponse(status_code=exc.status_code, content=exc.body)
