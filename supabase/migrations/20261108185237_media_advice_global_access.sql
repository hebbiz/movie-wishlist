-- Global authenticated UA feature eligibility; no movie/group/role gate for
-- discovery. Existing pilot/group RPCs and historical cap8/10/12/14 remain.
-- Prepared only: no flags, permissions, region assignments or source data change.
begin;

-- NULL is an honest global scope, not a fabricated group. Legacy RPCs require
-- non-NULL p_group and use equality, so cannot adopt these new global sessions.
alter table media_advice_private.sessions alter column group_id drop not null;

create function media_advice_private.assert_beta_feature_access(p_user uuid)
returns boolean language plpgsql security invoker set search_path = ''
as $$
begin
  if p_user is null then raise exception 'invalid-context' using errcode = '22023'; end if;
  if not exists (select 1 from media_advice_private.beta_config where singleton and enabled)
     or not exists (select 1 from media_advice_private.user_regions where user_id = p_user and region_code = 'UA')
  then raise exception 'access-denied' using errcode = '42501'; end if;
  return exists (
    select 1 from media_advice_private.permissions p
    where p.user_id = p_user and p.feature_key = 'mykola_media_advice_diagnostics'
      and p.enabled and (p.expires_at is null or p.expires_at > clock_timestamp())
  );
end;
$$;
revoke all on function media_advice_private.assert_beta_feature_access(uuid) from public, anon, authenticated, service_role;

create function public.media_advice_beta_global_action(
  p_user uuid, p_imdb text, p_form uuid, p_op text,
  p_session uuid default null, p_stage text default null
) returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_session media_advice_private.sessions%rowtype;
  v_diagnostics boolean;
begin
  v_diagnostics := media_advice_private.assert_beta_feature_access(p_user);
  if p_op = 'capability' then
    return jsonb_build_object('mykola_media_advice', true, 'mykola_media_advice_diagnostics', v_diagnostics);
  end if;
  if p_form is null or p_imdb is null or p_imdb !~ '^tt[0-9]{7,10}$' then
    raise exception 'invalid-context' using errcode = '22023';
  end if;
  if p_op = 'start' and p_stage is distinct from 'global-predicted-card-v1' then
    raise exception 'unsupported-start-contract' using errcode = '22023';
  end if;
  -- Fresh authorization after waiting, before cleanup or ledger mutation.
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 4104));
  v_diagnostics := media_advice_private.assert_beta_feature_access(p_user);
  delete from media_advice_private.sessions where user_id = p_user
    and created_at <= clock_timestamp() - interval '24 hours' and expires_at <= clock_timestamp();
  if p_op = 'start' then
    if exists (select 1 from media_advice_private.sessions where user_id = p_user and form_session = p_form) then
      raise exception 'form-attempt-already-used' using errcode = '23505';
    end if;
    insert into media_advice_private.sessions(user_id, group_id, imdb_id, list_id, form_session, source_cap)
      values(p_user, null, p_imdb, null, p_form, 14) returning * into v_session;
  else
    select * into v_session from media_advice_private.sessions
      where id = p_session and user_id = p_user and group_id is null and list_id is null
        and imdb_id = p_imdb and form_session = p_form for update;
    if not found or v_session.expires_at <= clock_timestamp() or v_session.finished then
      raise exception 'session-unavailable' using errcode = '42501';
    end if;
    if p_op = 'reserve' then
      if p_stage is null or p_stage <> all(array['tmdb-find','tmdb-details','tmdb-providers','motn-title','search-1','search-2','kinobaza-1','kinobaza-2','tmdb-person','kinobaza-person','search-3','kinobaza-3','kinobaza-predicted','kinobaza-person-predicted']) then
        raise exception 'unsupported-stage' using errcode = '22023';
      end if;
      if p_stage = any(v_session.attempts) or cardinality(v_session.attempts) >= v_session.source_cap then
        raise exception 'attempt-already-spent-or-budget' using errcode = '54000';
      end if;
      update media_advice_private.sessions set attempts = attempts || p_stage where id = v_session.id returning * into v_session;
    elsif p_op = 'finish' then
      update media_advice_private.sessions set finished = true where id = v_session.id returning * into v_session;
    else raise exception 'unsupported-action' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object('id', v_session.id, 'attempts', to_jsonb(v_session.attempts), 'cap', v_session.source_cap,
    'expiresAt', v_session.expires_at, 'mykola_media_advice', true, 'mykola_media_advice_diagnostics', v_diagnostics);
end;
$$;
revoke all on function public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text) to service_role;
comment on function public.media_advice_beta_global_action(uuid,text,uuid,text,uuid,text) is 'Verified server Auth user only; global backend UA and Beta flag, no editing grant; cap14 global sessions isolated from unchanged legacy group sessions';
commit;
