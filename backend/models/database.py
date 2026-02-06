"""
Database models and connection management for extended OASIS schema.
"""
from __future__ import annotations

import os
import os.path as osp
import sqlite3
import json
import uuid
import shutil
from typing import Any, Optional
from contextlib import contextmanager

from .types import (
    AgentProfile,
    AgentState,
    FeedPost,
    TimelineEvent,
    LogLine,
    GroupProfile,
    SimulationConfig,
    InterventionRecord,
    SimulationSnapshot,
    SimulationState,
    BigFive,
    MoralFoundations,
    Identity,
    Psychometrics,
    SocialStatus,
    BehaviorProfile,
    CognitiveState,
    CoreAffect,
    IssueStance,
    AgeBand,
    Gender,
    InfluenceTier,
    EconomicBand,
    DiurnalPattern,
    Sentiment,
    EventType,
    LogLevel,
)


BASE_DIR = osp.dirname(osp.dirname(__file__))  # backend/
PROJECT_ROOT = osp.dirname(BASE_DIR)
DB_DIR = osp.join(PROJECT_ROOT, "data")
LEGACY_DB_DIR = osp.join(BASE_DIR, "backend", "data")
ALT_LEGACY_DB_DIR = osp.join(BASE_DIR, "data")
DB_NAME = "oasis_frontend.db"
SCHEMA_DIR = osp.join(BASE_DIR, "schema")


def get_db_path() -> str:
    """Get the database file path."""
    env_db_path = os.environ.get("OASIS_DB_PATH")
    if env_db_path:
        return env_db_path

    os.makedirs(DB_DIR, exist_ok=True)
    db_path = osp.join(DB_DIR, DB_NAME)
    legacy_db_path = osp.join(LEGACY_DB_DIR, DB_NAME)
    alt_legacy_db_path = osp.join(ALT_LEGACY_DB_DIR, DB_NAME)

    # One-time best-effort migration from legacy backend/backend/data location.
    if not osp.exists(db_path):
        for candidate in (legacy_db_path, alt_legacy_db_path):
            if not osp.exists(candidate):
                continue
            try:
                shutil.copy2(candidate, db_path)
                break
            except Exception:
                # Keep running with a fresh DB if copy fails.
                continue

    return db_path


@contextmanager
def get_db_connection():
    """Context manager for database connections."""
    db_path = get_db_path()
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def get_db_cursor():
    """Context manager for database cursors."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            yield cursor
            conn.commit()
        except Exception:
            conn.rollback()
            raise


def init_db():
    """Initialize the database with all schemas."""
    # Try standalone initialization first (doesn't require OASIS)
    try:
        # Import the standalone init module
        standalone_init_path = osp.join(osp.dirname(osp.dirname(__file__)), "init_db_standalone.py")
        if osp.exists(standalone_init_path):
            import importlib.util
            spec = importlib.util.spec_from_file_location("init_db_standalone", standalone_init_path)
            standalone_module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(standalone_module)
            standalone_module.init_db_standalone()
            return
    except Exception as e:
        print(f"Standalone DB init failed, trying OASIS: {e}")

    # Fall back to OASIS database creation
    import sys
    sys.path.insert(0, osp.join(osp.dirname(osp.dirname(__file__)), "../oasis-main"))
    from oasis.social_platform.database import create_db as create_oasis_db

    # Create OASIS base tables
    create_oasis_db(get_db_path())

    # Create extended tables
    schema_path = osp.join(SCHEMA_DIR, "extended_user.sql")
    if osp.exists(schema_path):
        with open(schema_path, "r") as f:
            schema_sql = f.read()

        with get_db_cursor() as cursor:
            cursor.executescript(schema_sql)

    # Initialize simulation state singleton
    with get_db_cursor() as cursor:
        cursor.execute("""
            INSERT OR IGNORE INTO simulation_state (id, current_tick, is_running, speed, config)
            VALUES (1, 0, 0, 1.0, ?)
        """, (json.dumps(SimulationConfig().to_dict()),))

        # Create OASIS post sync tracking table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS oasis_post_sync (
                oasis_post_id INTEGER PRIMARY KEY,
                feed_post_id INTEGER NOT NULL,
                synced_at TEXT DEFAULT (datetime('now')),
                FOREIGN KEY(feed_post_id) REFERENCES post(post_id) ON DELETE CASCADE
            )
        """)


def _row_get(row: sqlite3.Row, key: str, default=None):
    """Helper to get value from sqlite3.Row with default."""
    try:
        val = row[key]
        if val is None and default is not None:
            return default
        return val
    except (KeyError, IndexError):
        return default


def row_to_agent_profile(row: sqlite3.Row) -> AgentProfile:
    """Convert a database row to AgentProfile."""
    # Get identity fields from the query
    age_band = _row_get(row, "age_band", "unknown")
    gender = _row_get(row, "gender", "unknown")
    country = _row_get(row, "country", "")
    region_city = _row_get(row, "region_city", "")
    profession = _row_get(row, "profession", "")
    domain_str = _row_get(row, "domain_of_expertise", "[]")

    return AgentProfile(
        id=row["user_id"],
        name=row["name"] or row["user_name"] or f"Agent_{row['user_id']}",
        group=_row_get(row, "group_name", "unassigned"),
        identity=Identity(
            username=row["user_name"] or "",
            age_band=AgeBand(age_band),
            gender=Gender(gender),
            country=country,
            region_city=region_city,
            profession=profession,
            domain_of_expertise=json.loads(domain_str) if isinstance(domain_str, str) else domain_str,
        ),
        psychometrics=Psychometrics(
            big_five=BigFive(
                O=_row_get(row, "big_five_O", 0.5),
                C=_row_get(row, "big_five_C", 0.5),
                E=_row_get(row, "big_five_E", 0.5),
                A=_row_get(row, "big_five_A", 0.5),
                N=_row_get(row, "big_five_N", 0.5),
            ),
            moral_foundations=MoralFoundations(
                care=_row_get(row, "moral_care", 0.5),
                fairness=_row_get(row, "moral_fairness", 0.5),
                loyalty=_row_get(row, "moral_loyalty", 0.5),
                authority=_row_get(row, "moral_authority", 0.5),
                sanctity=_row_get(row, "moral_sanctity", 0.5),
            ),
        ),
        social_status=SocialStatus(
            influence_tier=InfluenceTier(_row_get(row, "influence_tier", "ordinary_user")),
            economic_band=EconomicBand(_row_get(row, "economic_band", "medium")),
            network_size_proxy=_row_get(row, "network_size_proxy", 2),
        ),
        behavior_profile=BehaviorProfile(
            posts_per_day=_row_get(row, "posts_per_day", 1.0),
            diurnal_pattern=[
                DiurnalPattern(p) for p in json.loads(_row_get(row, "diurnal_pattern", '["unknown"]'))
            ],
            civility=_row_get(row, "civility", 0.5),
            evidence_citation=_row_get(row, "evidence_citation", 0.5),
        ),
        cognitive_state=CognitiveState(
            core_affect=CoreAffect(
                sentiment=Sentiment(_row_get(row, "sentiment", "calm")),
                arousal=_row_get(row, "arousal", 0.5),
            ),
            issue_stances=[
                IssueStance(topic=s["topic"], support=s["support"], certainty=s["certainty"])
                for s in json.loads(_row_get(row, "issue_stances_json", "[]"))
            ],
        ),
    )


def get_all_agents() -> list[AgentProfile]:
    """Get all agents from the database."""
    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT
                u.*,
                ug.group_name, ug.x, ug.y,
                bf.O as big_five_O, bf.C as big_five_C, bf.E as big_five_E, bf.A as big_five_A, bf.N as big_five_N,
                mf.care as moral_care, mf.fairness as moral_fairness, mf.loyalty as moral_loyalty,
                    mf.authority as moral_authority, mf.sanctity as moral_sanctity,
                ss.influence_tier, ss.economic_band, ss.network_size_proxy,
                bp.posts_per_day, bp.diurnal_pattern, bp.civility, bp.evidence_citation,
                cs.sentiment, cs.arousal, cs.mood, cs.stance, cs.resources,
                ui.age_band, ui.gender, ui.country, ui.region_city, ui.profession, ui.domain_of_expertise,
                COALESCE('[' || group_concat('{"topic":"' || uis.topic || '","support":' || uis.support || ',"certainty":' || uis.certainty || '}') || ']', '[]') as issue_stances_json
            FROM user u
            LEFT JOIN user_group ug ON u.user_id = ug.user_id
            LEFT JOIN user_big_five bf ON u.user_id = bf.user_id
            LEFT JOIN user_moral_foundations mf ON u.user_id = mf.user_id
            LEFT JOIN user_social_status ss ON u.user_id = ss.user_id
            LEFT JOIN user_behavior_profile bp ON u.user_id = bp.user_id
            LEFT JOIN user_cognitive_state cs ON u.user_id = cs.user_id
            LEFT JOIN user_identity ui ON u.user_id = ui.user_id
            LEFT JOIN user_issue_stance uis ON u.user_id = uis.user_id
            GROUP BY u.user_id
        """)
        rows = cursor.fetchall()
        return [row_to_agent_profile(row) for row in rows]


def get_agent_by_id(agent_id: int) -> Optional[AgentProfile]:
    """Get a single agent by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT
                u.*,
                ug.group_name, ug.x, ug.y,
                bf.O as big_five_O, bf.C as big_five_C, bf.E as big_five_E, bf.A as big_five_A, bf.N as big_five_N,
                mf.care as moral_care, mf.fairness as moral_fairness, mf.loyalty as moral_loyalty,
                    mf.authority as moral_authority, mf.sanctity as moral_sanctity,
                ss.influence_tier, ss.economic_band, ss.network_size_proxy,
                bp.posts_per_day, bp.diurnal_pattern, bp.civility, bp.evidence_citation,
                cs.sentiment, cs.arousal, cs.mood, cs.stance, cs.resources,
                ui.age_band, ui.gender, ui.country, ui.region_city, ui.profession, ui.domain_of_expertise,
                COALESCE('[' || group_concat('{"topic":"' || uis.topic || '","support":' || uis.support || ',"certainty":' || uis.certainty || '}') || ']', '[]') as issue_stances_json
            FROM user u
            LEFT JOIN user_group ug ON u.user_id = ug.user_id
            LEFT JOIN user_big_five bf ON u.user_id = bf.user_id
            LEFT JOIN user_moral_foundations mf ON u.user_id = mf.user_id
            LEFT JOIN user_social_status ss ON u.user_id = ss.user_id
            LEFT JOIN user_behavior_profile bp ON u.user_id = bp.user_id
            LEFT JOIN user_cognitive_state cs ON u.user_id = cs.user_id
            LEFT JOIN user_identity ui ON u.user_id = ui.user_id
            LEFT JOIN user_issue_stance uis ON u.user_id = uis.user_id
            WHERE u.user_id = ?
            GROUP BY u.user_id
        """, (agent_id,))
        row = cursor.fetchone()
        if row:
            return row_to_agent_profile(row)
        return None


def get_agents_by_ids(agent_ids: list[int]) -> list[AgentProfile]:
    """Get multiple agents by IDs."""
    if not agent_ids:
        return []

    placeholders = ",".join("?" * len(agent_ids))
    with get_db_cursor() as cursor:
        cursor.execute(f"""
            SELECT
                u.*,
                ug.group_name, ug.x, ug.y,
                bf.O as big_five_O, bf.C as big_five_C, bf.E as big_five_E, bf.A as big_five_A, bf.N as big_five_N,
                mf.care as moral_care, mf.fairness as moral_fairness, mf.loyalty as moral_loyalty,
                    mf.authority as moral_authority, mf.sanctity as moral_sanctity,
                ss.influence_tier, ss.economic_band, ss.network_size_proxy,
                bp.posts_per_day, bp.diurnal_pattern, bp.civility, bp.evidence_citation,
                cs.sentiment, cs.arousal, cs.mood, cs.stance, cs.resources,
                ui.age_band, ui.gender, ui.country, ui.region_city, ui.profession, ui.domain_of_expertise,
                COALESCE('[' || group_concat('{"topic":"' || uis.topic || '","support":' || uis.support || ',"certainty":' || uis.certainty || '}') || ']', '[]') as issue_stances_json
            FROM user u
            LEFT JOIN user_group ug ON u.user_id = ug.user_id
            LEFT JOIN user_big_five bf ON u.user_id = bf.user_id
            LEFT JOIN user_moral_foundations mf ON u.user_id = mf.user_id
            LEFT JOIN user_social_status ss ON u.user_id = ss.user_id
            LEFT JOIN user_behavior_profile bp ON u.user_id = bp.user_id
            LEFT JOIN user_cognitive_state cs ON u.user_id = cs.user_id
            LEFT JOIN user_identity ui ON u.user_id = ui.user_id
            LEFT JOIN user_issue_stance uis ON u.user_id = uis.user_id
            WHERE u.user_id IN ({placeholders})
            GROUP BY u.user_id
        """, agent_ids)
        rows = cursor.fetchall()
        return [row_to_agent_profile(row) for row in rows]


def save_agent_profile(profile: AgentProfile) -> None:
    """Save or update an agent profile in the database."""
    with get_db_cursor() as cursor:
        # Update base user table
        cursor.execute("""
            INSERT OR REPLACE INTO user (user_id, user_name, name, bio)
            VALUES (?, ?, ?, ?)
        """, (profile.id, profile.identity.username, profile.name, ""))

        # Update extended tables
        cursor.execute("""
            INSERT OR REPLACE INTO user_big_five (user_id, O, C, E, A, N)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (profile.id, profile.psychometrics.big_five.O,
              profile.psychometrics.big_five.C, profile.psychometrics.big_five.E,
              profile.psychometrics.big_five.A, profile.psychometrics.big_five.N))

        cursor.execute("""
            INSERT OR REPLACE INTO user_moral_foundations (user_id, care, fairness, loyalty, authority, sanctity)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (profile.id, profile.psychometrics.moral_foundations.care,
              profile.psychometrics.moral_foundations.fairness, profile.psychometrics.moral_foundations.loyalty,
              profile.psychometrics.moral_foundations.authority, profile.psychometrics.moral_foundations.sanctity))

        cursor.execute("""
            INSERT OR REPLACE INTO user_social_status (user_id, influence_tier, economic_band, network_size_proxy)
            VALUES (?, ?, ?, ?)
        """, (profile.id, profile.social_status.influence_tier.value,
              profile.social_status.economic_band.value, profile.social_status.network_size_proxy))

        cursor.execute("""
            INSERT OR REPLACE INTO user_behavior_profile (user_id, posts_per_day, diurnal_pattern, civility, evidence_citation)
            VALUES (?, ?, ?, ?, ?)
        """, (profile.id, profile.behavior_profile.posts_per_day,
              json.dumps([p.value for p in profile.behavior_profile.diurnal_pattern]),
              profile.behavior_profile.civility, profile.behavior_profile.evidence_citation))

        cursor.execute("""
            INSERT OR REPLACE INTO user_cognitive_state (user_id, sentiment, arousal, mood, stance, resources)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (profile.id, profile.cognitive_state.core_affect.sentiment.value,
              profile.cognitive_state.core_affect.arousal, 0.0, 0.0, 0.5))

        cursor.execute("""
            INSERT OR REPLACE INTO user_identity (user_id, age_band, gender, country, region_city, profession, domain_of_expertise)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (profile.id, profile.identity.age_band.value, profile.identity.gender.value,
              profile.identity.country, profile.identity.region_city,
              profile.identity.profession, json.dumps(profile.identity.domain_of_expertise)))

        cursor.execute("""
            INSERT OR REPLACE INTO user_group (user_id, group_name, x, y)
            VALUES (?, ?, ?, ?)
        """, (profile.id, profile.group, 0.0, 0.0))


def get_feed_posts(limit: int = 100, offset: int = 0) -> list[FeedPost]:
    """Get feed posts from the database."""
    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT
                p.post_id, p.content, p.created_at, p.num_likes,
                u.user_id, u.user_name, u.name,
                pe.emotion,
                COALESCE(pt.tick, 0) as tick
            FROM post p
            JOIN user u ON p.user_id = u.user_id
            LEFT JOIN post_emotion pe ON p.post_id = pe.post_id
            LEFT JOIN post_tick pt ON p.post_id = pt.post_id
            ORDER BY COALESCE(pt.tick, p.rowid) DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cursor.fetchall()
        posts = []
        for row in rows:
            tick = row["tick"]
            # If tick is 0 (not set), use timestamp as approximation
            if tick == 0:
                import time
                try:
                    tick = int(time.mktime(time.strptime(row["created_at"], "%Y-%m-%d %H:%M:%S")))
                except:
                    tick = 0  # Fallback if timestamp parsing fails

            posts.append(FeedPost(
                id=str(row["post_id"]),
                tick=tick,
                author_id=row["user_id"],
                author_name=row["name"] or row["user_name"] or f"Agent_{row['user_id']}",
                emotion=_row_get(row, "emotion", 0.0),
                content=row["content"] or "",
                likes=row["num_likes"] or 0,
            ))
        return posts


def save_feed_post(post: FeedPost) -> str:
    """Save a feed post to the database and return persisted post id."""
    with get_db_cursor() as cursor:
        import datetime
        created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        cursor.execute("""
            INSERT INTO post (user_id, content, created_at, num_likes)
            VALUES (?, ?, ?, ?)
        """, (post.author_id, post.content, created_at, post.likes))

        post_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO post_emotion (post_id, emotion)
            VALUES (?, ?)
        """, (post_id, post.emotion))

        # Save tick information
        cursor.execute("""
            INSERT OR REPLACE INTO post_tick (post_id, tick)
            VALUES (?, ?)
        """, (post_id, post.tick))

        return str(post_id)


def get_feed_post_by_id(post_id: str) -> Optional[FeedPost]:
    """Get a feed post by its ID."""
    with get_db_cursor() as cursor:
        # Check if it's an OASIS-prefixed ID (check the tracking table)
        if post_id.startswith("oasis_"):
            # Extract the original OASIS post ID
            try:
                oasis_id = int(post_id.replace("oasis_", ""))
                # Check if this OASIS post has been synced
                cursor.execute("""
                    SELECT feed_post_id FROM oasis_post_sync WHERE oasis_post_id = ?
                """, (oasis_id,))
                row = cursor.fetchone()
                if not row:
                    return None  # Not synced yet
                # Get the actual feed post
                feed_id = row[0]
                cursor.execute("""
                    SELECT
                        p.post_id, p.user_id, p.content, p.created_at, p.num_likes,
                        pe.emotion, pt.tick
                    FROM post p
                    LEFT JOIN post_emotion pe ON p.post_id = pe.post_id
                    LEFT JOIN post_tick pt ON p.post_id = pt.post_id
                    WHERE p.post_id = ?
                """, (feed_id,))
                post_row = cursor.fetchone()
                if not post_row:
                    return None
                # Get author info
                cursor.execute("""
                    SELECT user_name, name
                    FROM user
                    WHERE user_id = ?
                """, (post_row[1],))
                user_row = cursor.fetchone()
                author_name = user_row[1] if user_row and user_row[1] else (user_row[0] if user_row else f"Agent_{post_row[1]}")
                return FeedPost(
                    id=post_id,
                    tick=post_row[6] if post_row[6] is not None else 0,
                    author_id=post_row[1],
                    author_name=author_name,
                    emotion=post_row[5] if post_row[5] is not None else 0.0,
                    content=post_row[2],
                    likes=post_row[4],
                )
            except ValueError:
                return None

        # Convert string ID to integer for regular posts
        try:
            id_int = int(post_id)
        except ValueError:
            return None

        cursor.execute("""
            SELECT
                p.post_id, p.user_id, p.content, p.created_at, p.num_likes,
                pe.emotion, pt.tick
            FROM post p
            LEFT JOIN post_emotion pe ON p.post_id = pe.post_id
            LEFT JOIN post_tick pt ON p.post_id = pt.post_id
            WHERE p.post_id = ?
        """, (id_int,))

        row = cursor.fetchone()
        if not row:
            return None

        # Get author info
        cursor.execute("""
            SELECT user_name, name
            FROM user
            WHERE user_id = ?
        """, (row[1],))
        user_row = cursor.fetchone()
        author_name = user_row[1] if user_row and user_row[1] else (user_row[0] if user_row else f"Agent_{row[1]}")

        return FeedPost(
            id=post_id,
            tick=row[6] if row[6] is not None else 0,
            author_id=row[1],
            author_name=author_name,
            emotion=row[5] if row[5] is not None else 0.0,
            content=row[2],
            likes=row[4],
        )


def save_oasis_feed_post(oasis_post_id: int, post: FeedPost) -> bool:
    """Save an OASIS post to the feed database with tracking."""
    with get_db_cursor() as cursor:
        try:
            # Check if this OASIS post was already synced
            cursor.execute("""
                SELECT feed_post_id FROM oasis_post_sync WHERE oasis_post_id = ?
            """, (oasis_post_id,))
            existing = cursor.fetchone()
            if existing:
                return False  # Already synced

            # Save the post to the feed database
            import datetime
            created_at = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            cursor.execute("""
                INSERT INTO post (user_id, content, created_at, num_likes)
                VALUES (?, ?, ?, ?)
            """, (post.author_id, post.content, created_at, post.likes))

            feed_post_id = cursor.lastrowid

            cursor.execute("""
                INSERT INTO post_emotion (post_id, emotion)
                VALUES (?, ?)
            """, (feed_post_id, post.emotion))

            cursor.execute("""
                INSERT OR REPLACE INTO post_tick (post_id, tick)
                VALUES (?, ?)
            """, (feed_post_id, post.tick))

            # Record the mapping
            cursor.execute("""
                INSERT INTO oasis_post_sync (oasis_post_id, feed_post_id)
                VALUES (?, ?)
            """, (oasis_post_id, feed_post_id))

            return True
        except Exception as e:
            print(f"Error saving OASIS post: {e}")
            return False


def get_simulation_state() -> SimulationState:
    """Get the current simulation state from the database."""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM simulation_state WHERE id = 1")
        row = cursor.fetchone()

        if row:
            config = SimulationConfig.from_dict(json.loads(row["config"] or "{}"))
            # Deserialize agents from JSON if available
            agents = {}
            agents_json = _row_get(row, "agents_json")
            if agents_json:
                try:
                    agents = json.loads(agents_json)
                except:
                    agents = {}

            return SimulationState(
                config=config,
                tick=row["current_tick"],
                is_running=bool(row["is_running"]),
                speed=row["speed"],
                selected_agent_id=row["selected_agent_id"],
                agents=agents,
            )
        return SimulationState()


def save_simulation_state(state: SimulationState) -> None:
    """Save the simulation state to the database."""
    with get_db_cursor() as cursor:
        # First, try to add the agents_json column if it doesn't exist
        try:
            cursor.execute("ALTER TABLE simulation_state ADD COLUMN agents_json TEXT")
        except:
            pass  # Column already exists

        cursor.execute("""
            UPDATE simulation_state
            SET current_tick = ?, is_running = ?, speed = ?, selected_agent_id = ?, config = ?, agents_json = ?
            WHERE id = 1
        """, (state.tick, 1 if state.is_running else 0, state.speed,
              state.selected_agent_id, json.dumps(state.config.to_dict()),
              json.dumps(state.agents)))


def create_snapshot(name: str, state: SimulationState) -> SimulationSnapshot:
    """Create a simulation snapshot."""
    snapshot_id = str(uuid.uuid4())
    import time
    created_at = int(time.time())

    snapshot = SimulationSnapshot(
        id=snapshot_id,
        experiment_name=state.config.experiment_name,
        created_at=created_at,
        run_number=1,
        final_tick=state.tick,
        data=state.to_dict(),
    )

    with get_db_cursor() as cursor:
        cursor.execute("""
            INSERT INTO simulation_snapshot (id, name, experiment_name, created_at, run_number, final_tick, data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (snapshot_id, name, snapshot.experiment_name, created_at,
              snapshot.run_number, snapshot.final_tick, json.dumps(snapshot.data)))

    return snapshot


def get_all_snapshots() -> list[SimulationSnapshot]:
    """Get all simulation snapshots."""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM simulation_snapshot ORDER BY created_at DESC")
        rows = cursor.fetchall()

        return [
            SimulationSnapshot(
                id=row["id"],
                name=row["name"],
                experiment_name=row["experiment_name"],
                created_at=row["created_at"],
                run_number=row["run_number"],
                final_tick=row["final_tick"],
                data=json.loads(row["data"]),
            )
            for row in rows
        ]


def get_snapshot_by_id(snapshot_id: str) -> Optional[SimulationSnapshot]:
    """Get a snapshot by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM simulation_snapshot WHERE id = ?", (snapshot_id,))
        row = cursor.fetchone()

        if row:
            return SimulationSnapshot(
                id=row["id"],
                name=row["name"],
                experiment_name=row["experiment_name"],
                created_at=row["created_at"],
                run_number=row["run_number"],
                final_tick=row["final_tick"],
                data=json.loads(row["data"]),
            )
        return None


def save_timeline_event(event: TimelineEvent) -> None:
    """Save a timeline event to the database."""
    import time
    created_at = int(time.time())

    with get_db_cursor() as cursor:
        cursor.execute("""
            INSERT INTO timeline_event (id, tick, event_type, agent_id, title, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (event.id, event.tick, event.type.value, event.agent_id,
              event.title, json.dumps(event.payload) if event.payload else None, created_at))


def get_timeline_events(limit: int = 100, offset: int = 0) -> list[TimelineEvent]:
    """Get timeline events from the database."""
    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT * FROM timeline_event
            ORDER BY tick DESC, created_at DESC
            LIMIT ? OFFSET ?
        """, (limit, offset))
        rows = cursor.fetchall()

        return [
            TimelineEvent(
                id=row["id"],
                tick=row["tick"],
                type=EventType(row["event_type"]),
                agent_id=row["agent_id"],
                title=row["title"],
                payload=json.loads(row["payload"]) if row["payload"] else None,
            )
            for row in rows
        ]


def save_log_line(log: LogLine) -> None:
    """Save a log line to the database."""
    import time
    created_at = int(time.time())

    with get_db_cursor() as cursor:
        cursor.execute("""
            INSERT INTO simulation_log (id, tick, agent_id, level, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (log.id, log.tick, log.agent_id, log.level.value, log.text, created_at))


def get_log_lines(limit: int = 100) -> list[LogLine]:
    """Get log lines from the database."""
    with get_db_cursor() as cursor:
        cursor.execute("""
            SELECT * FROM simulation_log
            ORDER BY tick DESC, created_at DESC
            LIMIT ?
        """, (limit,))
        rows = cursor.fetchall()

        return [
            LogLine(
                id=row["id"],
                tick=row["tick"],
                agent_id=row["agent_id"],
                level=LogLevel(row["level"]),
                text=row["message"],
            )
            for row in rows
        ]


def save_intervention(record: InterventionRecord) -> None:
    """Save an intervention record to the database."""
    import time
    created_at = int(time.time())

    with get_db_cursor() as cursor:
        cursor.execute("""
            INSERT INTO intervention_record (id, tick, command, target_agent_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        """, (record.id, record.tick, record.command, record.target_agent_id, created_at))


def get_all_interventions() -> list[InterventionRecord]:
    """Get all intervention records."""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM intervention_record ORDER BY tick DESC")
        rows = cursor.fetchall()

        return [
            InterventionRecord(
                id=row["id"],
                tick=row["tick"],
                command=row["command"],
                target_agent_id=row["target_agent_id"],
            )
            for row in rows
        ]


def save_bookmark(tick: int, note: str) -> str:
    """Save a timeline bookmark."""
    bookmark_id = str(uuid.uuid4())
    import time
    created_at = int(time.time())

    with get_db_cursor() as cursor:
        cursor.execute("""
            INSERT INTO timeline_bookmark (id, tick, note, created_at)
            VALUES (?, ?, ?, ?)
        """, (bookmark_id, tick, note, created_at))

    return bookmark_id


def get_all_bookmarks() -> list[dict[str, Any]]:
    """Get all bookmarks."""
    with get_db_cursor() as cursor:
        cursor.execute("SELECT * FROM timeline_bookmark ORDER BY tick ASC")
        rows = cursor.fetchall()

        return [
            {
                "id": row["id"],
                "tick": row["tick"],
                "note": row["note"],
                "createdAt": row["created_at"],
            }
            for row in rows
        ]


def delete_bookmark(bookmark_id: str) -> None:
    """Delete a bookmark by ID."""
    with get_db_cursor() as cursor:
        cursor.execute("DELETE FROM timeline_bookmark WHERE id = ?", (bookmark_id,))


def get_all_group_profiles() -> list[GroupProfile]:
    """Get all group profiles from the database or generate defaults."""
    # Try to get from database first
    groups = []

    with get_db_cursor() as cursor:
        # Check if we have group profiles stored
        cursor.execute("""
            SELECT DISTINCT group_name FROM user_group WHERE group_name IS NOT NULL
        """)
        rows = cursor.fetchall()

        existing_groups = [row["group_name"] for row in rows]

        # If no groups in database, return default groups
        if not existing_groups:
            return _generate_default_group_profiles()

        # Generate profiles for existing groups
        for group_name in existing_groups:
            # Get agents in this group to calculate stats
            cursor.execute("""
                SELECT
                    COUNT(DISTINCT ug.user_id) as agent_count,
                    AVG(ss.influence_tier) as avg_influence,
                    AVG(ss.economic_band) as avg_economic
                FROM user_group ug
                LEFT JOIN user_social_status ss ON ug.user_id = ss.user_id
                WHERE ug.group_name = ?
            """, (group_name,))
            stats = cursor.fetchone()

            # Generate group profile with some variation based on group name
            group_hash = hash(group_name) % 100
            cohesion = 0.4 + (group_hash % 50) / 100.0  # 0.4-0.9
            polarization = 0.2 + ((group_hash // 5) % 60) / 100.0  # 0.2-0.8
            trust_climate = 0.3 + ((group_hash // 3) % 50) / 100.0  # 0.3-0.8

            # Determine dominant stratum based on group characteristics
            influence_val = stats["avg_influence"] or 1.0
            if influence_val >= 2.0:
                dominant_stratum = SocialStratum.ELITE
            elif influence_val >= 1.5:
                dominant_stratum = SocialStratum.UPPER_MIDDLE
            elif influence_val >= 1.0:
                dominant_stratum = SocialStratum.MIDDLE
            else:
                dominant_stratum = SocialStratum.WORKING

            groups.append(GroupProfile(
                key=group_name,
                label=f"{group_name} ({stats['agent_count']} agents)" if stats else group_name,
                dominant_stratum=dominant_stratum,
                cohesion=cohesion,
                polarization=polarization,
                trust_climate=trust_climate,
                norm_summary=f"Group {group_name} - cohesion: {cohesion:.2f}, polarization: {polarization:.2f}",
            ))

    return groups if groups else _generate_default_group_profiles()


def _generate_default_group_profiles() -> list[GroupProfile]:
    """Generate default group profiles matching frontend expectations."""
    return [
        GroupProfile(
            key="Group A",
            label="Civic Elite 公共精英",
            dominant_stratum=SocialStratum.ELITE,
            cohesion=0.75,
            polarization=0.35,
            trust_climate=0.68,
            norm_summary="重视秩序与效率；群体凝聚=0.75，极化=0.35",
        ),
        GroupProfile(
            key="Group B",
            label="Urban Middle 城市中产",
            dominant_stratum=SocialStratum.UPPER_MIDDLE,
            cohesion=0.62,
            polarization=0.45,
            trust_climate=0.55,
            norm_summary="重视协作与稳定；群体凝聚=0.62，极化=0.45",
        ),
        GroupProfile(
            key="Group C",
            label="Local Communities 本地社群",
            dominant_stratum=SocialStratum.MIDDLE,
            cohesion=0.70,
            polarization=0.30,
            trust_climate=0.72,
            norm_summary="重视社区互助；群体凝聚=0.70，极化=0.30",
        ),
        GroupProfile(
            key="Group D",
            label="Industrial Workers 产业工薪",
            dominant_stratum=SocialStratum.WORKING,
            cohesion=0.55,
            polarization=0.55,
            trust_climate=0.45,
            norm_summary="重视就业与保障；群体凝聚=0.55，极化=0.55",
        ),
        GroupProfile(
            key="Group E",
            label="Precarious Fringe 边缘群体",
            dominant_stratum=SocialStratum.PRECARIOUS,
            cohesion=0.40,
            polarization=0.70,
            trust_climate=0.30,
            norm_summary="重视生存与互助；群体凝聚=0.40，极化=0.70",
        ),
    ]


# Import type references for the function signatures
from .types import (
    AgeBand, Gender, InfluenceTier, EconomicBand, DiurnalPattern,
    Sentiment, EventType, LogLevel, GroupProfile, SocialStratum
)
