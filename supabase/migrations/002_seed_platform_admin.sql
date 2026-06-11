-- ============================================================================
-- 002_seed_platform_admin.sql — désigne le super admin plateforme
-- ⚠️ À exécuter APRÈS avoir créé votre compte dans l'application
--    (l'utilisateur doit exister dans auth.users).
-- ============================================================================

insert into public.platform_admins (user_id)
select id from auth.users where email = 'arthur.arrazoladeonate@gmail.com'
on conflict (user_id) do nothing;

-- Vérification : doit retourner une ligne avec votre email.
select p.email, a.created_at as admin_depuis
from public.platform_admins a
join public.profiles p on p.user_id = a.user_id;
