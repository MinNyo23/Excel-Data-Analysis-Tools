do $$
begin
  if to_regclass('public.admin_user_action_history') is not null then
    -- The target Auth record is intentionally not referenced because delete
    -- history must survive deletion of the target user.
    alter table public.admin_user_action_history
      drop constraint if exists admin_user_action_history_target_user_id_fkey;

    -- Older drafts used a temporary status. Normalize it before tightening the
    -- check constraint used by the current application.
    update public.admin_user_action_history
    set status = 'completed'
    where status = 'pending';

    alter table public.admin_user_action_history
      drop constraint if exists admin_user_action_history_status_check;
    alter table public.admin_user_action_history
      add constraint admin_user_action_history_status_check
      check (status in ('completed', 'failed'));

    comment on column public.admin_user_action_history.target_user_id is
      'The Auth user ID targeted by the action; intentionally not a foreign key so delete history survives Auth deletion.';
    comment on column public.admin_user_action_history.target_email is
      'The target email captured before the action; retained for audit history after deletion.';
    comment on column public.admin_user_action_history.status is
      'The final status of the recorded action: completed or failed.';
  end if;
end
$$;
