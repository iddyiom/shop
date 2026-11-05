# Alembic runs this file for every command (upgrade, downgrade, revision...).
# It tells Alembic WHERE the database is and WHAT the tables should look like.
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401  (importing it registers every table on Base.metadata)
from app.config import DATABASE_URL
from app.database import Base

config = context.config

# Logging settings from alembic.ini.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# The tables as app/models.py describes them. --autogenerate compares the database to this.
target_metadata = Base.metadata


def database_url() -> str:
    """The address from app/config.py (rule 3). A test may pass its own with -x url=..."""
    return context.get_x_argument(as_dictionary=True).get("url", DATABASE_URL)


def run_migrations_offline() -> None:
    """--sql mode: print the SQL instead of running it (useful to read before a big change)."""
    context.configure(
        url=database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Normal mode: connect and run the migrations."""
    # A plain engine, NOT make_engine: SQLite foreign-key checks stay off while
    # migrating, because batch mode drops and re-creates tables that others point to.
    engine = create_engine(database_url(), poolclass=NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # Rule 5: SQLite cannot change a column in place; batch mode copies the table.
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
