from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# Load .env file from project root to make DATABASE_URL available
import os
from dotenv import load_dotenv
# Go up 3 levels: env.py -> alembic -> backend_api -> project root
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
DOTENV_PATH = os.path.join(PROJECT_ROOT, ".env")
if os.path.exists(DOTENV_PATH):
    load_dotenv(dotenv_path=DOTENV_PATH)
else:
    print(f"Warning: alembic/env.py could not find .env file at {DOTENV_PATH}")

# Add the 'src' directory to the Python path so Alembic can find the models
import sys
# Go up two levels from alembic/env.py to backend_api, then into src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

# Import Base from the new package structure
# Note: The sys.path modification above is technically no longer needed
# if backend_api is installed via pip install -e ., but doesn't hurt.
from api.database import Base 
from api.models import Job # Also import models absolutely

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata # Use Base from your database setup

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    # url = config.get_main_option("sqlalchemy.url") # Don't get from config
    context.configure(
        url=SQLALCHEMY_DATABASE_URL, # Use the URL loaded from .env via database.py
        target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"}
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    # Instead of engine_from_config, use the engine we already created in database.py
    # Requires importing the engine
    # Change to absolute import
    from backend_api.database import engine as db_engine
    # connectable = engine_from_config(...)
    connectable = db_engine

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
