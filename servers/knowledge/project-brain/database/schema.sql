-- Project-Brain SQLite Schema
-- Hybrid architecture: SQL for metrics, PageIndex for learnings

-- QoR snapshots table
CREATE TABLE IF NOT EXISTS qor_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    stage TEXT NOT NULL,
    checkpoint_name TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    wns REAL,
    tns REAL,
    area REAL,
    power REAL,
    cell_count INTEGER,
    utilization REAL,
    drc_count INTEGER,
    CONSTRAINT unique_snapshot UNIQUE (project_name, stage, checkpoint_name)
);

-- Error log table
CREATE TABLE IF NOT EXISTS error_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    stage TEXT,
    error_message TEXT,
    error_type TEXT,
    resolution TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Checkpoint registry
CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    stage TEXT NOT NULL,
    checkpoint_path TEXT NOT NULL,
    parent_checkpoint TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT -- JSON
);

-- Stage transitions tracking
CREATE TABLE IF NOT EXISTS stage_transitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_name TEXT NOT NULL,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    transition_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success BOOLEAN,
    metadata TEXT -- JSON
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_qor_project ON qor_snapshots(project_name);
CREATE INDEX IF NOT EXISTS idx_qor_stage ON qor_snapshots(stage);
CREATE INDEX IF NOT EXISTS idx_qor_timestamp ON qor_snapshots(timestamp);
CREATE INDEX IF NOT EXISTS idx_errors_project ON error_log(project_name);
CREATE INDEX IF NOT EXISTS idx_errors_type ON error_log(error_type);
CREATE INDEX IF NOT EXISTS idx_checkpoints_project ON checkpoints(project_name);
CREATE INDEX IF NOT EXISTS idx_transitions_project ON stage_transitions(project_name);
