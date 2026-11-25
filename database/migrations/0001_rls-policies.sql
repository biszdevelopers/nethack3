-- Organization isolation is enforced in the database in addition to the API.
-- The runtime connects as a non-owner role, sets nethack.organization_id
-- transaction-locally, and never has BYPASSRLS. Public read predicates expose
-- only records that the public product intentionally publishes.

CREATE OR REPLACE FUNCTION current_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT nullif(current_setting('nethack.organization_id', true), '')::uuid
$$;

ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_settings_read ON organization_settings
    FOR SELECT
    USING (true);
CREATE POLICY organization_settings_write ON organization_settings
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE competition_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_series FORCE ROW LEVEL SECURITY;
CREATE POLICY competition_series_isolation ON competition_series
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR EXISTS (
            SELECT 1 FROM competition_editions edition
            WHERE edition.series_id = competition_series.id
              AND edition.status IN (
                  'published', 'registration_open', 'registration_closed', 'active',
                  'judging', 'voting', 'completed', 'archived'
              )
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE competition_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_editions FORCE ROW LEVEL SECURITY;
CREATE POLICY competition_editions_isolation ON competition_editions
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR status IN (
            'published', 'registration_open', 'registration_closed', 'active',
            'judging', 'voting', 'completed', 'archived'
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions FORCE ROW LEVEL SECURITY;
CREATE POLICY divisions_isolation ON divisions
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR EXISTS (
            SELECT 1 FROM competition_editions edition
            WHERE edition.id = divisions.edition_id
              AND edition.status IN (
                  'published', 'registration_open', 'registration_closed', 'active',
                  'judging', 'voting', 'completed', 'archived'
              )
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones FORCE ROW LEVEL SECURITY;
CREATE POLICY milestones_isolation ON milestones
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR EXISTS (
            SELECT 1 FROM competition_editions edition
            WHERE edition.id = milestones.edition_id
              AND edition.status IN (
                  'published', 'registration_open', 'registration_closed', 'active',
                  'judging', 'voting', 'completed', 'archived'
              )
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;
CREATE POLICY teams_isolation ON teams
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR EXISTS (
            SELECT 1 FROM projects project
            WHERE project.team_id = teams.id
              AND project.status = 'published'
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members FORCE ROW LEVEL SECURITY;
CREATE POLICY team_members_isolation ON team_members
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY team_invitations_isolation ON team_invitations
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations FORCE ROW LEVEL SECURITY;
CREATE POLICY registrations_isolation ON registrations
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants FORCE ROW LEVEL SECURITY;
CREATE POLICY participants_isolation ON participants
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;
CREATE POLICY projects_isolation ON projects
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR (
            status = 'published'
            AND published_at IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM competition_editions edition
                WHERE edition.id = projects.edition_id
                  AND edition.status IN (
                      'published', 'registration_open', 'registration_closed', 'active',
                      'judging', 'voting', 'completed', 'archived'
                  )
            )
            AND EXISTS (
                SELECT 1 FROM organization_settings settings
                WHERE settings.organization_id = projects.organization_id
                  AND settings.public_showcase_enabled
            )
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members FORCE ROW LEVEL SECURITY;
CREATE POLICY project_members_isolation ON project_members
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR EXISTS (
            SELECT 1 FROM projects project
            WHERE project.id = project_members.project_id
              AND project.status = 'published'
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions FORCE ROW LEVEL SECURITY;
CREATE POLICY submissions_isolation ON submissions
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE submission_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY submission_versions_isolation ON submission_versions
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files FORCE ROW LEVEL SECURITY;
CREATE POLICY submission_files_isolation ON submission_files
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR (
            status = 'approved'
            AND EXISTS (
                SELECT 1 FROM projects project
                WHERE project.id = submission_files.project_id
                  AND project.status = 'published'
            )
        )
    )
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE judging_rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE judging_rubrics FORCE ROW LEVEL SECURITY;
CREATE POLICY judging_rubrics_isolation ON judging_rubrics
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE judging_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE judging_criteria FORCE ROW LEVEL SECURITY;
CREATE POLICY judging_criteria_isolation ON judging_criteria
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE judge_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE judge_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY judge_assignments_isolation ON judge_assignments
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations FORCE ROW LEVEL SECURITY;
CREATE POLICY evaluations_isolation ON evaluations
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_scores FORCE ROW LEVEL SECURITY;
CREATE POLICY evaluation_scores_isolation ON evaluation_scores
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE voting_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_rounds FORCE ROW LEVEL SECURITY;
CREATE POLICY voting_rounds_isolation ON voting_rounds
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE ballots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ballots FORCE ROW LEVEL SECURITY;
CREATE POLICY ballots_isolation ON ballots
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes FORCE ROW LEVEL SECURITY;
CREATE POLICY votes_isolation ON votes
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements FORCE ROW LEVEL SECURITY;
CREATE POLICY announcements_isolation ON announcements
    FOR ALL
    USING (
        organization_id = current_organization_id()
        OR (visibility = 'public' AND published_at IS NOT NULL)
    )
    WITH CHECK (organization_id = current_organization_id());

GRANT USAGE ON SCHEMA public TO nethack_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nethack_app;
