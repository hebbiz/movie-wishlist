-- Operator health-query reference. Not a migration or an automatic monitor.
-- Actual activation/control-check status: docs/m4-media-advice.md.
-- No person/duty/time is assigned by this file. Requires activation authorization,
-- reconciled M4 migrations and an available pg_cron extension. No extension
-- installation, credentials, HTTP call, movie/Wishlist mutation or job here
-- is executed during tests. Review an existing same-name job before scheduling.
-- The sibling media-advice-cleanup.schedule.sql prepares an INACTIVE job for
-- daily 02:15 UTC. Neither file is part of automatic migration scheduling.

-- Read-only operations check, to be run independently of this cleanup job.
-- Independent operational monitoring remains to be arranged, not assigned here;
-- the scheduler cannot detect its own total outage.
-- Missing heartbeat on first run or >26h since success is actionable.
select
  coalesce((select last_success_at < clock_timestamp() - interval '26 hours'
    from media_advice_private.cleanup_health where singleton), true) as missed_or_failed_run,
  (select last_success_at from media_advice_private.cleanup_health where singleton) as last_success_at,
  (select count(*) from media_advice_private.sessions
    where created_at <= clock_timestamp() - interval '48 hours') as overdue_sessions;

-- Inspect cron.job (active/schedule) and cron.job_run_details for this job on
-- an alert; do not install another job or reset accounting to hide failure.
-- Authorized recovery: one manual media_advice_cleanup(), investigate, recheck
-- heartbeat and backlog. Never rerun source requests. No 48h guarantee during
-- scheduler failure; live activation still requires the runbook's operational gates.
