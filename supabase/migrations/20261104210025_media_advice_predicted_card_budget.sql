-- NEW compatible Beta sessions only: retain the complete Tavily cap12 route,
-- one predicted title GET, and at most one additional Kinobaza person GET.
-- Existing cap8/10/12 sessions, pilot default8, flags and permissions unchanged.
-- Prepared SQL only: no remote application/activation is implied.
begin;

alter table media_advice_private.sessions drop constraint media_advice_sessions_source_cap_check;
alter table media_advice_private.sessions add constraint media_advice_sessions_source_cap_check
  check (source_cap in (8, 10, 12, 14));

create or replace function public.media_advice_beta_action(
  p_user uuid, p_group uuid, p_imdb text, p_list uuid, p_form uuid,
  p_op text, p_session uuid default null, p_stage text default null
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_session media_advice_private.sessions%rowtype;
  v_diagnostics boolean;
begin
  if p_user is null or p_group is null or p_form is null or p_imdb is null
     or p_imdb !~ '^tt[0-9]{7,10}$' then
    raise exception 'invalid-context' using errcode = '22023';
  end if;
  v_diagnostics := media_advice_private.assert_beta_access(p_user, p_group, p_imdb, p_list);
  if p_op = 'capability' then
    return jsonb_build_object('mykola_media_advice', true, 'mykola_media_advice_diagnostics', v_diagnostics);
  end if;
  -- Service-only capability marker; never accepted from browser JSON.
  if p_op = 'start' and p_stage is not null
     and p_stage <> all(array['reserve-exact-v1','predicted-card-v1']) then
    raise exception 'unsupported-start-contract' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 4104));
  v_diagnostics := media_advice_private.assert_beta_access(p_user, p_group, p_imdb, p_list);
  delete from media_advice_private.sessions where user_id = p_user
    and created_at <= clock_timestamp() - interval '24 hours' and expires_at <= clock_timestamp();
  if p_op = 'start' then
    if exists (select 1 from media_advice_private.sessions where user_id = p_user and form_session = p_form) then
      raise exception 'form-attempt-already-used' using errcode = '23505';
    end if;
    insert into media_advice_private.sessions(user_id, group_id, imdb_id, list_id, form_session, source_cap)
      values(p_user, p_group, p_imdb, p_list, p_form,
        case p_stage when 'predicted-card-v1' then 14 when 'reserve-exact-v1' then 12 else 10 end)
      returning * into v_session;
  else
    select * into v_session from media_advice_private.sessions
      where id = p_session and user_id = p_user and group_id = p_group
        and imdb_id = p_imdb and list_id is not distinct from p_list and form_session = p_form
      for update;
    if not found or v_session.expires_at <= clock_timestamp() or v_session.finished then
      raise exception 'session-unavailable' using errcode = '42501';
    end if;
    if p_op = 'reserve' then
      -- Unique attempts, including legitimate gaps. This adds no second TMDb
      -- person fetch: reuse is scoped by the handler to the same verified person.
      if p_stage is null or p_stage <> all(array['tmdb-find','tmdb-details','tmdb-providers','motn-title','search-1','search-2','kinobaza-1','kinobaza-2','tmdb-person','kinobaza-person','search-3','kinobaza-3','kinobaza-predicted','kinobaza-person-predicted'])
         or (v_session.source_cap < 14 and p_stage = any(array['kinobaza-predicted','kinobaza-person-predicted']))
         or (v_session.source_cap < 12 and p_stage = any(array['search-3','kinobaza-3']))
         or (v_session.source_cap = 8 and p_stage = any(array['tmdb-person','kinobaza-person'])) then
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
    'expiresAt', v_session.expires_at, 'mykola_media_advice', true,
    'mykola_media_advice_diagnostics', v_diagnostics);
end;
$$;
revoke all on function public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.media_advice_beta_action(uuid,uuid,text,uuid,uuid,text,uuid,text) to service_role;
comment on column media_advice_private.sessions.source_cap is 'Server-created per-search cap: existing8/10/12 unchanged, compatible new Beta14, reserve Beta12, older Beta10, pilot default8; one TMDb profile, at most two distinct Kinobaza profiles; no source content';
commit;
