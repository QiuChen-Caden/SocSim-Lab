"""
Standalone database initialization for the frontend demo.
This creates the necessary tables without requiring the full OASIS package.
"""
import sqlite3
import os
import os.path as osp
import json
from typing import Any

# Database paths
BASE_DIR = osp.dirname(__file__)  # backend/
PROJECT_ROOT = osp.dirname(BASE_DIR)
DB_DIR = osp.join(PROJECT_ROOT, "data")
DB_NAME = "oasis_frontend.db"
SCHEMA_DIR = osp.join(BASE_DIR, "schema")


def get_db_path() -> str:
    """Get the database file path."""
    os.makedirs(DB_DIR, exist_ok=True)
    return osp.join(DB_DIR, DB_NAME)


def create_base_tables(cursor: sqlite3.Cursor) -> None:
    """Create the base OASIS user and post tables."""

    # User table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user (
            user_id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id INTEGER,
            user_name TEXT,
            name TEXT,
            bio TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            num_followings INTEGER DEFAULT 0,
            num_followers INTEGER DEFAULT 0
        )
    """)

    # Post table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post (
            post_id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            original_post_id INTEGER,
            content TEXT DEFAULT '',
            quote_content TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            num_likes INTEGER DEFAULT 0,
            num_dislikes INTEGER DEFAULT 0,
            num_shares INTEGER DEFAULT 0,
            num_reports INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES user(user_id),
            FOREIGN KEY(original_post_id) REFERENCES post(post_id)
        )
    """)


def create_extended_tables(cursor: sqlite3.Cursor) -> None:
    """Create the extended tables for psychometrics and visualization."""

    # Big Five Personality Traits
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_big_five (
            user_id INTEGER PRIMARY KEY,
            O REAL NOT NULL DEFAULT 0.5,
            C REAL NOT NULL DEFAULT 0.5,
            E REAL NOT NULL DEFAULT 0.5,
            A REAL NOT NULL DEFAULT 0.5,
            N REAL NOT NULL DEFAULT 0.5,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Moral Foundations
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_moral_foundations (
            user_id INTEGER PRIMARY KEY,
            care REAL NOT NULL DEFAULT 0.5,
            fairness REAL NOT NULL DEFAULT 0.5,
            loyalty REAL NOT NULL DEFAULT 0.5,
            authority REAL NOT NULL DEFAULT 0.5,
            sanctity REAL NOT NULL DEFAULT 0.5,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Social Status
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_social_status (
            user_id INTEGER PRIMARY KEY,
            influence_tier TEXT NOT NULL DEFAULT 'ordinary_user',
            economic_band TEXT NOT NULL DEFAULT 'medium',
            network_size_proxy INTEGER NOT NULL DEFAULT 2,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Behavior Profile
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_behavior_profile (
            user_id INTEGER PRIMARY KEY,
            posts_per_day REAL NOT NULL DEFAULT 1.0,
            diurnal_pattern TEXT NOT NULL DEFAULT '["unknown"]',
            civility REAL NOT NULL DEFAULT 0.5,
            evidence_citation REAL NOT NULL DEFAULT 0.5,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Cognitive State
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_cognitive_state (
            user_id INTEGER PRIMARY KEY,
            sentiment TEXT NOT NULL DEFAULT 'calm',
            arousal REAL NOT NULL DEFAULT 0.5,
            mood REAL NOT NULL DEFAULT 0.0,
            stance REAL NOT NULL DEFAULT 0.0,
            resources REAL NOT NULL DEFAULT 0.5,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Issue Stances
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_issue_stance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            topic TEXT NOT NULL,
            support REAL NOT NULL,
            certainty REAL NOT NULL,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Identity Extension
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_identity (
            user_id INTEGER PRIMARY KEY,
            age_band TEXT NOT NULL DEFAULT 'unknown',
            gender TEXT NOT NULL DEFAULT 'unknown',
            country TEXT NOT NULL DEFAULT '',
            region_city TEXT NOT NULL DEFAULT '',
            profession TEXT NOT NULL DEFAULT '',
            domain_of_expertise TEXT NOT NULL DEFAULT '[]',
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Agent Group for visualization
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_group (
            user_id INTEGER PRIMARY KEY,
            group_name TEXT NOT NULL DEFAULT 'unassigned',
            x REAL NOT NULL DEFAULT 0.0,
            y REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
        )
    """)

    # Post emotion
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_emotion (
            post_id INTEGER PRIMARY KEY,
            emotion REAL NOT NULL DEFAULT 0.0,
            FOREIGN KEY(post_id) REFERENCES post(post_id) ON DELETE CASCADE
        )
    """)

    # Post tick (maps posts to simulation ticks)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS post_tick (
            post_id INTEGER PRIMARY KEY,
            tick INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY(post_id) REFERENCES post(post_id) ON DELETE CASCADE
        )
    """)

    # Snapshots
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS simulation_snapshot (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            experiment_name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            run_number INTEGER NOT NULL,
            final_tick INTEGER NOT NULL,
            data TEXT NOT NULL
        )
    """)

    # Bookmarks
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS timeline_bookmark (
            id TEXT PRIMARY KEY,
            tick INTEGER NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            created_at INTEGER NOT NULL
        )
    """)

    # Timeline events
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS timeline_event (
            id TEXT PRIMARY KEY,
            tick INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            agent_id INTEGER,
            title TEXT NOT NULL,
            payload TEXT,
            created_at INTEGER NOT NULL
        )
    """)

    # Simulation log
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS simulation_log (
            id TEXT PRIMARY KEY,
            tick INTEGER NOT NULL,
            agent_id INTEGER,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )
    """)

    # Simulation state
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS simulation_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            current_tick INTEGER NOT NULL DEFAULT 0,
            is_running INTEGER NOT NULL DEFAULT 0,
            speed REAL NOT NULL DEFAULT 1.0,
            selected_agent_id INTEGER,
            config TEXT
        )
    """)

    # Interventions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS intervention_record (
            id TEXT PRIMARY KEY,
            tick INTEGER NOT NULL,
            command TEXT NOT NULL,
            target_agent_id INTEGER,
            created_at INTEGER NOT NULL
        )
    """)

    # OASIS post sync tracking
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS oasis_post_sync (
            oasis_post_id INTEGER PRIMARY KEY,
            feed_post_id INTEGER NOT NULL,
            synced_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY(feed_post_id) REFERENCES post(post_id) ON DELETE CASCADE
        )
    """)


def init_db_standalone() -> None:
    """Initialize the database without requiring OASIS."""
    db_path = get_db_path()

    # Connect and create tables
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        # Create base tables
        create_base_tables(cursor)

        # Create extended tables
        create_extended_tables(cursor)

        # Initialize simulation state
        from models.types import SimulationConfig

        cursor.execute("""
            INSERT OR IGNORE INTO simulation_state (id, current_tick, is_running, speed, config)
            VALUES (1, 0, 0, 1.0, ?)
        """, (json.dumps(SimulationConfig().to_dict()),))

        conn.commit()
        print(f"Database initialized: {db_path}")

    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


if __name__ == "__main__":
    init_db_standalone()
