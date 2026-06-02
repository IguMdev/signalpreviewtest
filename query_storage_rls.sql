SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.permissive,
  p.roles,
  p.cmd,
  p.qual,
  p.with_check
FROM
  pg_policies p
WHERE
  p.schemaname = 'storage' AND p.tablename = 'objects';
