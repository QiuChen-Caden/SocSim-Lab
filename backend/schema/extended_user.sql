-- Extended user profile schema with psychometrics
-- This extends the OASIS user table with additional fields

-- Big Five Personality Traits table
CREATE TABLE IF NOT EXISTS user_big_five (
    user_id INTEGER PRIMARY KEY,
    O REAL NOT NULL DEFAULT 0.5,  -- Openness (0-1)
    C REAL NOT NULL DEFAULT 0.5,  -- Conscientiousness (0-1)
    E REAL NOT NULL DEFAULT 0.5,  -- Extraversion (0-1)
    A REAL NOT NULL DEFAULT 0.5,  -- Agreeableness (0-1)
    N REAL NOT NULL DEFAULT 0.5,  -- Neuroticism (0-1)
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Moral Foundations table
CREATE TABLE IF NOT EXISTS user_moral_foundations (
    user_id INTEGER PRIMARY KEY,
    care REAL NOT NULL DEFAULT 0.5,       -- Care/Harm (0-1)
    fairness REAL NOT NULL DEFAULT 0.5,   -- Fairness/Cheating (0-1)
    loyalty REAL NOT NULL DEFAULT 0.5,    -- Loyalty/Betrayal (0-1)
    authority REAL NOT NULL DEFAULT 0.5,  -- Authority/Subversion (0-1)
    sanctity REAL NOT NULL DEFAULT 0.5,   -- Sanctity/Degradation (0-1)
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Social Status table
CREATE TABLE IF NOT EXISTS user_social_status (
    user_id INTEGER PRIMARY KEY,
    influence_tier TEXT NOT NULL DEFAULT 'ordinary_user',  -- ordinary_user, opinion_leader, elite
    economic_band TEXT NOT NULL DEFAULT 'medium',  -- low, medium, high, unknown
    network_size_proxy INTEGER NOT NULL DEFAULT 2,  -- 0-4+
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Behavior Profile table
CREATE TABLE IF NOT EXISTS user_behavior_profile (
    user_id INTEGER PRIMARY KEY,
    posts_per_day REAL NOT NULL DEFAULT 1.0,
    diurnal_pattern TEXT NOT NULL DEFAULT '["unknown"]',  -- JSON array
    civility REAL NOT NULL DEFAULT 0.5,  -- 0-1
    evidence_citation REAL NOT NULL DEFAULT 0.5,  -- 0-1
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Cognitive State table
CREATE TABLE IF NOT EXISTS user_cognitive_state (
    user_id INTEGER PRIMARY KEY,
    sentiment TEXT NOT NULL DEFAULT 'calm',  -- angry, calm, happy, sad, fearful, surprised
    arousal REAL NOT NULL DEFAULT 0.5,  -- 0-1
    mood REAL NOT NULL DEFAULT 0.0,  -- -1 to 1
    stance REAL NOT NULL DEFAULT 0.0,  -- -1 to 1
    resources REAL NOT NULL DEFAULT 0.5,  -- 0-1
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Issue Stances table (many-to-many)
CREATE TABLE IF NOT EXISTS user_issue_stance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    topic TEXT NOT NULL,
    support REAL NOT NULL,  -- -1 to 1
    certainty REAL NOT NULL,  -- 0 to 1
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Identity Extension table
CREATE TABLE IF NOT EXISTS user_identity (
    user_id INTEGER PRIMARY KEY,
    age_band TEXT NOT NULL DEFAULT 'unknown',  -- 18-24, 25-34, 35-44, 45-54, 55-64, 65+, unknown
    gender TEXT NOT NULL DEFAULT 'unknown',  -- male, female, unknown
    country TEXT NOT NULL DEFAULT '',
    region_city TEXT NOT NULL DEFAULT '',
    profession TEXT NOT NULL DEFAULT '',
    domain_of_expertise TEXT NOT NULL DEFAULT '[]',  -- JSON array
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Agent Group table for visualization
CREATE TABLE IF NOT EXISTS user_group (
    user_id INTEGER PRIMARY KEY,
    group_name TEXT NOT NULL DEFAULT 'unassigned',  -- Group A, B, C, D, E, etc.
    x REAL NOT NULL DEFAULT 0.0,  -- 2D visualization position
    y REAL NOT NULL DEFAULT 0.0,
    FOREIGN KEY(user_id) REFERENCES user(user_id) ON DELETE CASCADE
);

-- Post emotion table (extends post table)
CREATE TABLE IF NOT EXISTS post_emotion (
    post_id INTEGER PRIMARY KEY,
    emotion REAL NOT NULL DEFAULT 0.0,  -- -1 to 1
    FOREIGN KEY(post_id) REFERENCES post(post_id) ON DELETE CASCADE
);

-- Post tick table (maps posts to simulation ticks)
CREATE TABLE IF NOT EXISTS post_tick (
    post_id INTEGER PRIMARY KEY,
    tick INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(post_id) REFERENCES post(post_id) ON DELETE CASCADE
);

-- Snapshots table
CREATE TABLE IF NOT EXISTS simulation_snapshot (
    id TEXT PRIMARY KEY,  -- UUID
    name TEXT NOT NULL,
    experiment_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,  -- timestamp
    run_number INTEGER NOT NULL,
    final_tick INTEGER NOT NULL,
    data TEXT NOT NULL  -- JSON serialized simulation state
);

-- Bookmarks table
CREATE TABLE IF NOT EXISTS timeline_bookmark (
    id TEXT PRIMARY KEY,  -- UUID
    tick INTEGER NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL  -- timestamp
);

-- Timeline events table
CREATE TABLE IF NOT EXISTS timeline_event (
    id TEXT PRIMARY KEY,  -- UUID
    tick INTEGER NOT NULL,
    event_type TEXT NOT NULL,  -- agent_action, message, intervention, alert, bookmark
    agent_id INTEGER,
    title TEXT NOT NULL,
    payload TEXT,  -- JSON
    created_at INTEGER NOT NULL  -- timestamp
);

-- Simulation log table
CREATE TABLE IF NOT EXISTS simulation_log (
    id TEXT PRIMARY KEY,  -- UUID
    tick INTEGER NOT NULL,
    agent_id INTEGER,
    level TEXT NOT NULL,  -- info, ok, error
    message TEXT NOT NULL,
    created_at INTEGER NOT NULL  -- timestamp
);

-- Simulation state table
CREATE TABLE IF NOT EXISTS simulation_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),  -- Singleton table
    current_tick INTEGER NOT NULL DEFAULT 0,
    is_running INTEGER NOT NULL DEFAULT 0,  -- boolean
    speed REAL NOT NULL DEFAULT 1.0,
    selected_agent_id INTEGER,
    config TEXT,  -- JSON simulation config
    agents_json TEXT  -- JSON serialized agents state (for persistence)
);

-- Interventions table
CREATE TABLE IF NOT EXISTS intervention_record (
    id TEXT PRIMARY KEY,  -- UUID
    tick INTEGER NOT NULL,
    command TEXT NOT NULL,
    target_agent_id INTEGER,
    created_at INTEGER NOT NULL  -- timestamp
);
