-- Organization settings are tenant data, not public data. The public project
-- showcase predicate must not depend on reading another tenant's settings row,
-- so it is removed here and enforced by the API using the organizations contract.

DROP POLICY IF EXISTS organization_settings_read ON organization_settings;
DROP POLICY IF EXISTS organization_settings_write ON organization_settings;

CREATE POLICY organization_settings_isolation ON organization_settings
    FOR ALL
    USING (organization_id = current_organization_id())
    WITH CHECK (organization_id = current_organization_id());

DROP POLICY IF EXISTS projects_isolation ON projects;

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
        )
    )
    WITH CHECK (organization_id = current_organization_id());
