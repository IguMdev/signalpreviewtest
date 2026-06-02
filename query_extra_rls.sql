SELECT
  p.policyname,
  p.cmd
FROM
  pg_policies p
WHERE
  p.tablename = 'welcome_extra_messages';
