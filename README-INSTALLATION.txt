DECROTEL — correction OAuth Google Agenda
==========================================

1) Décompressez ce dossier, puis ouvrez un terminal dans le dossier backend.
2) Copiez .env.example en .env et complétez les valeurs (ne partagez jamais le .env).
3) Dans Google Cloud Console, l'URI de redirection autorisée doit correspondre EXACTEMENT à :
   http://localhost:3000/auth/google/callback
   L'identifiant client et le secret doivent appartenir au même client OAuth.
4) Dans Supabase, ajoutez SUPABASE_SERVICE_ROLE_KEY dans le .env serveur uniquement.
   Ne mettez JAMAIS cette clé dans dashboard.html.
5) La table public.googletokens doit avoir au minimum :
   user_id (uuid, UNIQUE ou PRIMARY KEY), refresh_token (text nullable),
   access_token (text nullable), token_type (text nullable), scope (text nullable),
   expiry_date (bigint nullable), updated_at (timestamptz nullable).
   Si la table existe déjà, vérifiez qu'une contrainte UNIQUE existe sur user_id.
6) Installez les dépendances si nécessaire : npm install
7) Démarrez : node server.js
8) Ouvrez le dashboard via http://localhost:3000/dashboard.html
   N'ouvrez plus le fichier en file:// pour ce test OAuth.
9) Connectez-vous à Decrotel, choisissez Google Agenda, entrez une adresse email,
   puis cliquez sur le bouton de connexion Google. Acceptez les autorisations.
10) Testez en créant un rendez-vous depuis le dashboard et vérifiez Google Agenda.

Variables .env nécessaires :
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (serveur seulement)
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
- OAUTH_STATE_SECRET (chaîne aléatoire longue, au moins 32 caractères)
- DASHBOARD_URL=http://localhost:3000/dashboard.html

Remarques :
- Le backend n'enregistre jamais les jetons dans les logs.
- L'endpoint de création d'événement exige une session Decrotel valide.
- Cette correction active le flux Google Agenda uniquement. Les autres fournisseurs
  (Outlook / calendrier iPhone) restent non connectés en mode réel.
- Si la table googletokens n'a pas le schéma décrit, adaptez-la avant le test.


DIAGNOSTIC SESSION SUPABASE (version de dépannage)
-------------------------------------------------
Si le serveur renvoie « Session Decrotel invalide ou expirée », cette version
affiche un diagnostic technique limité (code/statut/message Supabase), sans
jamais afficher le jeton de session. En mode local, le diagnostic apparaît dans
la réponse réseau et dans le terminal Node.js.

Vérifiez en priorité que SUPABASE_URL et SUPABASE_ANON_KEY dans le .env du
serveur appartiennent au même projet Supabase que celui utilisé par le dashboard.
La clé de service doit rester côté serveur et ne doit jamais être copiée dans
le dashboard. Ne partagez pas le fichier .env ni les jetons de session.
