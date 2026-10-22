-- Operator configuration template, outside migrations; do not replay an existing job.
-- Actual activation/control-check status: docs/m4-media-advice.md.
-- Requires separate operator authorization and pg_cron availability. Installs
-- INACTIVE, without replacing an existing job; enabling it is a separate action.
begin;
do $$
declare job_id bigint;
begin
  if current_setting('cron.timezone', true) is null
     or current_setting('cron.timezone', true) not in ('UTC', 'GMT') then
    raise exception 'verify-cron-timezone-UTC-before-configuring';
  end if;
  if exists(select 1 from cron.job where jobname = 'mykola-media-advice-cleanup') then
    raise exception 'review-existing-cleanup-job-no-overwrite';
  end if;
  job_id := cron.schedule('mykola-media-advice-cleanup', '15 2 * * *',
    'select public.media_advice_cleanup();');
  perform cron.alter_job(job_id, active := false);
end;
$$;
commit;
