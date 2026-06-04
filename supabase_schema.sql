-- ==============================================================================
-- Supabase Schema for Career Recommendation System
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. PROFILES TABLE
-- Linked to auth.users (Supabase's built-in authentication table)
-- ==============================================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON profiles FOR SELECT 
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON profiles FOR UPDATE 
USING (auth.uid() = id);

-- Trigger to automatically create a profile when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (new.id, new.raw_user_meta_data->>'full_name');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger to update 'updated_at' on profile changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_modtime
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();


-- ==============================================================================
-- 2. ASSESSMENTS TABLE
-- Stores answers to Q1-Q10 and time commitment
-- ==============================================================================
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    q1_coding INT CHECK (q1_coding BETWEEN 1 AND 5),
    q2_data_analysis INT CHECK (q2_data_analysis BETWEEN 1 AND 5),
    q3_ui_ux INT CHECK (q3_ui_ux BETWEEN 1 AND 5),
    q4_communication INT CHECK (q4_communication BETWEEN 1 AND 5),
    q5_cybersecurity INT CHECK (q5_cybersecurity BETWEEN 1 AND 5),
    q6_project_management INT CHECK (q6_project_management BETWEEN 1 AND 5),
    q7_content_creation INT CHECK (q7_content_creation BETWEEN 1 AND 5),
    q8_business_analysis INT CHECK (q8_business_analysis BETWEEN 1 AND 5),
    q9_cloud_infrastructure INT CHECK (q9_cloud_infrastructure BETWEEN 1 AND 5),
    q10_machine_learning INT CHECK (q10_machine_learning BETWEEN 1 AND 5),
    time_commitment_hours INT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for assessments
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assessments" 
ON assessments FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assessments" 
ON assessments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessments" 
ON assessments FOR UPDATE 
USING (auth.uid() = user_id);


-- ==============================================================================
-- 3. RECOMMENDATIONS TABLE
-- Stores a recommendation session linked to an assessment
-- ==============================================================================
CREATE TABLE recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for recommendations
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations" 
ON recommendations FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations" 
ON recommendations FOR INSERT 
WITH CHECK (auth.uid() = user_id);


-- ==============================================================================
-- 4. RECOMMENDED PROFESSIONS TABLE
-- Stores the top 3 professions for each recommendation
-- ==============================================================================
CREATE TABLE recommended_professions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recommendation_id UUID NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
    career_encoded INT CHECK (career_encoded BETWEEN 0 AND 9),
    career_name TEXT NOT NULL,
    rank INT CHECK (rank IN (1, 2, 3)),
    readiness_percentage NUMERIC(5,2),
    skill_gap JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_recommended_professions_recommendation_id ON recommended_professions(recommendation_id);

-- RLS for recommended_professions
ALTER TABLE recommended_professions ENABLE ROW LEVEL SECURITY;

-- Note: We join with recommendations table to verify ownership for RLS
CREATE POLICY "Users can view own recommended professions" 
ON recommended_professions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM recommendations 
        WHERE recommendations.id = recommended_professions.recommendation_id 
        AND recommendations.user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert own recommended professions" 
ON recommended_professions FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM recommendations 
        WHERE recommendations.id = recommended_professions.recommendation_id 
        AND recommendations.user_id = auth.uid()
    )
);
