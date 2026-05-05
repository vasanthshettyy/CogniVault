-- CogniVault Database Schema
-- Run these queries in Supabase SQL Editor in order.

-- =============================================
-- Table: users
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Table: admin
-- =============================================
CREATE TABLE IF NOT EXISTS admin (
    admin_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO admin (email, password_hash)
VALUES ('admin@cognivault.com', '$2b$12$PLACEHOLDER_HASH_REPLACE_THIS');

-- =============================================
-- Table: user_uploads
-- =============================================
CREATE TABLE IF NOT EXISTS user_uploads (
    upload_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) CHECK (file_type IN ('csv', 'pdf', 'xlsx')),
    file_size_bytes INTEGER NOT NULL,
    storage_path TEXT NOT NULL,
    upload_status VARCHAR(20) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Table: ai_analyses
-- =============================================
CREATE TABLE IF NOT EXISTS ai_analyses (
    analysis_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES user_uploads(upload_id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    confidence_score NUMERIC(5, 2),
    performance_metric NUMERIC(5, 2),
    reasoning_steps JSONB,
    consistency_flags JSONB,
    raw_llm_response TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- =============================================
-- Table: history
-- =============================================
CREATE TABLE IF NOT EXISTS history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES user_uploads(upload_id) ON DELETE CASCADE,
    analysis_id UUID NOT NULL REFERENCES ai_analyses(analysis_id) ON DELETE CASCADE,
    viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- Performance Indexes
-- =============================================
CREATE INDEX idx_user_uploads_user_id ON user_uploads(user_id);
CREATE INDEX idx_ai_analyses_user_id ON ai_analyses(user_id);
CREATE INDEX idx_ai_analyses_upload_id ON ai_analyses(upload_id);
CREATE INDEX idx_history_user_id ON history(user_id);
CREATE INDEX idx_history_viewed_at ON history(viewed_at DESC);

-- =============================================
-- Supabase Storage Bucket
-- =============================================
-- Required by backend uploads. Buckets are managed by Supabase Storage,
-- not by the app's user_uploads table.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('user-uploads', 'user-uploads', false, 10485760)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- Row Level Security (RLS)
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can view own uploads"
    ON user_uploads FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploads"
    ON user_uploads FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploads"
    ON user_uploads FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analyses"
    ON ai_analyses FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view own history"
    ON history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own history"
    ON history FOR INSERT
    WITH CHECK (auth.uid() = user_id);
