-- Remplacez l'adresse ci-dessous, puis exécutez ce fichier dans le SQL Editor.
-- Cette opération doit rester manuelle et côté serveur.
update public.comptes
set approuve = true, role = 'administrateur', acces = 'complet', updated_at = now()
where email = 'VOTRE_EMAIL_ADMIN';

-- Vérification : doit renvoyer exactement le compte choisi.
select id, email, approuve, role, acces from public.comptes
where email = 'VOTRE_EMAIL_ADMIN';
