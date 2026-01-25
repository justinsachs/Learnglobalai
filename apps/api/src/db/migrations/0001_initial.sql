-- Initial database schema for LearnGlobal.ai
-- Version: 1.0.0

-- Create custom types
DO $$ BEGIN
    CREATE TYPE pipeline_state AS ENUM (
        'DRAFT_MODULE_SPEC',
        'OUTLINE_GENERATED',
        'SOURCEPACK_GENERATED',
        'QA_PASSED',
        'NOTEBOOK_CREATED',
        'NOTEBOOK_SOURCES_UPLOADED',
        'MEDIA_PROMPT_PACK_GENERATED',
        'HEYGEN_SCRIPT_GENERATED',
        'HEYGEN_VIDEO_REQUESTED',
        'HEYGEN_VIDEO_READY',
        'LMS_PUBLISHED',
        'CHAT_CONFIGURED',
        'AUDIT_FINALIZED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE artifact_type AS ENUM (
        'module_spec',
        'outline',
        'sourcepack_json',
        'sourcepack_markdown',
        'qa_report',
        'media_prompt_pack_json',
        'media_prompt_pack_markdown',
        'heygen_package',
        'asset_manifest',
        'chat_config',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_event_type AS ENUM (
        'run_created',
        'state_transition',
        'artifact_created',
        'artifact_updated',
        'qa_passed',
        'qa_failed',
        'approval_requested',
        'approval_granted',
        'approval_denied',
        'error_occurred',
        'retry_attempted',
        'run_completed',
        'run_failed',
        'connector_called',
        'llm_called'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_message_role AS ENUM (
        'user',
        'assistant',
        'system'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector for RAG (if available)
CREATE EXTENSION IF NOT EXISTS "vector";

-- Modules table
CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    vertical VARCHAR(100) NOT NULL,
    current_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    author VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    tags JSONB DEFAULT '[]'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS modules_vertical_idx ON modules(vertical);
CREATE INDEX IF NOT EXISTS modules_status_idx ON modules(status);

-- Module Specs table (versioned)
CREATE TABLE IF NOT EXISTS module_specs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    spec_data JSONB NOT NULL,
    spec_hash VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(module_id, version)
);

CREATE INDEX IF NOT EXISTS module_specs_active_idx ON module_specs(module_id, is_active);

-- Runs table
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id VARCHAR(255) NOT NULL UNIQUE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    module_spec_id UUID NOT NULL REFERENCES module_specs(id),
    version VARCHAR(50) NOT NULL,
    current_state pipeline_state NOT NULL DEFAULT 'DRAFT_MODULE_SPEC',
    previous_state pipeline_state,
    checkpoint JSONB,
    error JSONB,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    triggered_by VARCHAR(255) NOT NULL,
    config JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS runs_module_idx ON runs(module_id);
CREATE INDEX IF NOT EXISTS runs_state_idx ON runs(current_state);

-- Run States table (state transition history)
CREATE TABLE IF NOT EXISTS run_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    from_state pipeline_state,
    to_state pipeline_state NOT NULL,
    transitioned_at TIMESTAMP NOT NULL DEFAULT NOW(),
    actor VARCHAR(255) NOT NULL,
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS run_states_run_idx ON run_states(run_id);
CREATE INDEX IF NOT EXISTS run_states_transitioned_at_idx ON run_states(transitioned_at);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    artifact_type artifact_type NOT NULL,
    version VARCHAR(50) NOT NULL,
    storage_uri TEXT NOT NULL,
    content_type VARCHAR(100) NOT NULL,
    size_bytes INTEGER NOT NULL,
    hash VARCHAR(64) NOT NULL,
    hash_algorithm VARCHAR(20) NOT NULL DEFAULT 'sha256',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artifacts_run_idx ON artifacts(run_id);
CREATE INDEX IF NOT EXISTS artifacts_type_idx ON artifacts(artifact_type);
CREATE INDEX IF NOT EXISTS artifacts_hash_idx ON artifacts(hash);

-- Audit Events table (immutable)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    event_type audit_event_type NOT NULL,
    actor VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    from_state pipeline_state,
    to_state pipeline_state,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    prompt_hash VARCHAR(64),
    response_hash VARCHAR(64),
    ip_address VARCHAR(45),
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS audit_events_run_idx ON audit_events(run_id);
CREATE INDEX IF NOT EXISTS audit_events_module_idx ON audit_events(module_id);
CREATE INDEX IF NOT EXISTS audit_events_type_idx ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS audit_events_timestamp_idx ON audit_events(timestamp);

-- Chat Configs table
CREATE TABLE IF NOT EXISTS chat_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_id VARCHAR(255) NOT NULL UNIQUE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    policy_id VARCHAR(255) NOT NULL,
    retrieval_index_id VARCHAR(255),
    sources JSONB DEFAULT '[]'::jsonb,
    system_prompt_template TEXT NOT NULL,
    model_config JSONB NOT NULL,
    features JSONB DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_configs_module_idx ON chat_configs(module_id);
CREATE INDEX IF NOT EXISTS chat_configs_active_idx ON chat_configs(module_id, active);

-- Chat Messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id VARCHAR(255) NOT NULL UNIQUE,
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    conversation_id VARCHAR(255) NOT NULL,
    role chat_message_role NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    retrieved_context JSONB,
    citations JSONB,
    policy_violations JSONB,
    token_usage JSONB,
    feedback JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    session_id VARCHAR(255),
    user_id VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS chat_messages_module_idx ON chat_messages(module_id);
CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS chat_messages_timestamp_idx ON chat_messages(timestamp);

-- Connectors table (configuration metadata)
CREATE TABLE IF NOT EXISTS connectors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    connector_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    endpoint TEXT,
    scopes JSONB DEFAULT '[]'::jsonb,
    capabilities JSONB DEFAULT '[]'::jsonb,
    redaction_rules JSONB DEFAULT '[]'::jsonb,
    retry_config JSONB DEFAULT '{"maxRetries": 3, "initialDelayMs": 1000, "maxDelayMs": 30000, "backoffMultiplier": 2}'::jsonb,
    timeout_ms INTEGER NOT NULL DEFAULT 30000,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS connectors_type_idx ON connectors(type);

-- Vertical Configs table
CREATE TABLE IF NOT EXISTS vertical_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vertical VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vertical_configs_active_idx ON vertical_configs(active);

-- Job Queue table (for tracking BullMQ jobs)
CREATE TABLE IF NOT EXISTS job_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id VARCHAR(255) NOT NULL UNIQUE,
    queue_name VARCHAR(100) NOT NULL,
    run_id UUID REFERENCES runs(id) ON DELETE CASCADE,
    job_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    payload JSONB,
    result JSONB,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    scheduled_for TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_queue_queue_name_idx ON job_queue(queue_name);
CREATE INDEX IF NOT EXISTS job_queue_status_idx ON job_queue(status);
CREATE INDEX IF NOT EXISTS job_queue_run_idx ON job_queue(run_id);

-- Approvals table
CREATE TABLE IF NOT EXISTS approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    approval_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    requested_by VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP,
    comments TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS approvals_run_idx ON approvals(run_id);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON approvals(status);

-- Document embeddings for RAG (pgvector)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    run_id UUID REFERENCES runs(id) ON DELETE SET NULL,
    source_type VARCHAR(50) NOT NULL,
    source_id VARCHAR(255) NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_embeddings_module_idx ON document_embeddings(module_id);
CREATE INDEX IF NOT EXISTS document_embeddings_source_idx ON document_embeddings(source_type, source_id);

-- Create vector similarity search index (if pgvector is available)
-- Note: Uncomment if using pgvector
-- CREATE INDEX IF NOT EXISTS document_embeddings_vector_idx ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Functions for updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_modules_updated_at ON modules;
CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_configs_updated_at ON chat_configs;
CREATE TRIGGER update_chat_configs_updated_at
    BEFORE UPDATE ON chat_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_connectors_updated_at ON connectors;
CREATE TRIGGER update_connectors_updated_at
    BEFORE UPDATE ON connectors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vertical_configs_updated_at ON vertical_configs;
CREATE TRIGGER update_vertical_configs_updated_at
    BEFORE UPDATE ON vertical_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
