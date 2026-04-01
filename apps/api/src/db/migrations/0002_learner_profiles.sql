-- Learner Profiles and Adaptive Learning Migration
-- Version: 2.0.0
-- Adds user profiling, progress tracking, and simulation support

-- Create new enums for learning styles and module types
DO $$ BEGIN
    CREATE TYPE learning_style AS ENUM (
        'visual',
        'text',
        'interactive',
        'audio',
        'mixed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE module_type AS ENUM (
        'standard',
        'simulation',
        'assessment',
        'interactive',
        'video'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to modules table
ALTER TABLE modules
    ADD COLUMN IF NOT EXISTS module_type module_type NOT NULL DEFAULT 'standard',
    ADD COLUMN IF NOT EXISTS pillar VARCHAR(100),
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS estimated_minutes INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS prerequisites JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS learning_objectives JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS simulation_config JSONB;

-- Add indexes for new module columns
CREATE INDEX IF NOT EXISTS modules_type_idx ON modules(module_type);
CREATE INDEX IF NOT EXISTS modules_pillar_idx ON modules(pillar);
CREATE INDEX IF NOT EXISTS modules_order_idx ON modules(vertical, order_index);

-- Users table (platform users - learners, admins, content creators)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    vertical VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'learner',
    password_hash VARCHAR(255),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::jsonb,
    last_login_at TIMESTAMP,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS users_user_id_idx ON users(user_id);
CREATE INDEX IF NOT EXISTS users_vertical_idx ON users(vertical);

-- Learner Profiles table (extended profile for adaptive learning)
CREATE TABLE IF NOT EXISTS learner_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    current_role VARCHAR(255) NOT NULL,
    learning_style learning_style NOT NULL DEFAULT 'mixed',
    primary_goal TEXT NOT NULL,
    secondary_goals JSONB DEFAULT '[]'::jsonb,
    risk_tolerance INTEGER NOT NULL DEFAULT 5,
    experience_level VARCHAR(50) NOT NULL DEFAULT 'intermediate',
    time_availability VARCHAR(50) NOT NULL DEFAULT 'moderate',
    preferred_session_length INTEGER NOT NULL DEFAULT 30,
    industry_background VARCHAR(255),
    certifications JSONB DEFAULT '[]'::jsonb,
    strength_areas JSONB DEFAULT '[]'::jsonb,
    improvement_areas JSONB DEFAULT '[]'::jsonb,
    quiz_responses JSONB DEFAULT '{}'::jsonb,
    adaptive_settings JSONB DEFAULT '{
        "contentDensity": "moderate",
        "exampleFrequency": "moderate",
        "quizDifficulty": "adaptive",
        "feedbackStyle": "detailed"
    }'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS learner_profiles_user_idx ON learner_profiles(user_id);
CREATE INDEX IF NOT EXISTS learner_profiles_role_idx ON learner_profiles(current_role);
CREATE INDEX IF NOT EXISTS learner_profiles_style_idx ON learner_profiles(learning_style);

-- Module Progress table (tracks learner progress through modules)
CREATE TABLE IF NOT EXISTS module_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'not_started',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    current_section VARCHAR(255),
    completed_sections JSONB DEFAULT '[]'::jsonb,
    time_spent_minutes INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    score INTEGER,
    attempts INTEGER NOT NULL DEFAULT 0,
    bookmarks JSONB DEFAULT '[]'::jsonb,
    notes JSONB DEFAULT '[]'::jsonb,
    adaptive_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, module_id)
);

CREATE INDEX IF NOT EXISTS module_progress_user_idx ON module_progress(user_id);
CREATE INDEX IF NOT EXISTS module_progress_module_idx ON module_progress(module_id);
CREATE INDEX IF NOT EXISTS module_progress_status_idx ON module_progress(status);

-- Simulation Sessions table (tracks Case 7 style simulation interactions)
CREATE TABLE IF NOT EXISTS simulation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    scenario_id VARCHAR(255) NOT NULL,
    scenario_title VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    decisions JSONB DEFAULT '[]'::jsonb,
    current_step VARCHAR(255),
    total_steps INTEGER NOT NULL DEFAULT 0,
    completed_steps INTEGER NOT NULL DEFAULT 0,
    score INTEGER,
    max_score INTEGER,
    time_spent_minutes INTEGER NOT NULL DEFAULT 0,
    outcomes JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS simulation_sessions_session_id_idx ON simulation_sessions(session_id);
CREATE INDEX IF NOT EXISTS simulation_sessions_user_idx ON simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS simulation_sessions_module_idx ON simulation_sessions(module_id);
CREATE INDEX IF NOT EXISTS simulation_sessions_scenario_idx ON simulation_sessions(scenario_id);

-- Apply updated_at triggers to new tables
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_learner_profiles_updated_at ON learner_profiles;
CREATE TRIGGER update_learner_profiles_updated_at
    BEFORE UPDATE ON learner_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_module_progress_updated_at ON module_progress;
CREATE TRIGGER update_module_progress_updated_at
    BEFORE UPDATE ON module_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE users IS 'Platform users including learners, admins, and content creators';
COMMENT ON TABLE learner_profiles IS 'Extended learner profiles for adaptive learning personalization';
COMMENT ON TABLE module_progress IS 'Tracks learner progress through training modules';
COMMENT ON TABLE simulation_sessions IS 'Tracks interactive simulation (Case 7 style) sessions';

COMMENT ON COLUMN modules.module_type IS 'Type of module: standard, simulation, assessment, interactive, video';
COMMENT ON COLUMN modules.pillar IS 'Learning pillar or category grouping';
COMMENT ON COLUMN modules.simulation_config IS 'Configuration for simulation modules (Case 7 style)';

COMMENT ON COLUMN learner_profiles.adaptive_settings IS 'Personalization settings: contentDensity, exampleFrequency, quizDifficulty, feedbackStyle';
COMMENT ON COLUMN learner_profiles.quiz_responses IS 'Responses from onboarding quiz (Gateway)';

COMMENT ON COLUMN simulation_sessions.decisions IS 'Array of decisions made during simulation with outcomes and scores';
COMMENT ON COLUMN simulation_sessions.outcomes IS 'Final outcomes: success, summary, learningPoints, areasToImprove';
