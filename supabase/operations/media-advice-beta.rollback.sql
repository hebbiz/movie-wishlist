-- PREPARED ONLY; requires release authorization. Non-destructive rollback:
-- immediately close the Beta RPC through its own global switch. Keep region
-- data, assignments, technical ledger, cleanup, and all Wishlist/Auth data.
-- Deploy/revert the application separately if returning to the legacy pilot;
-- the unchanged media_advice_action RPC remains backend-pilot-only.
begin;
update media_advice_private.beta_config set enabled = false where singleton;
commit;

select enabled as beta_enabled from media_advice_private.beta_config where singleton;
