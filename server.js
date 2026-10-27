const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
const { google } = require("googleapis");

require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

// ---------------------
// SUPABASE
// ---------------------

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY

);
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
// ---------------------
// HOME
// ---------------------

app.get("/", (req, res) => {
  res.send("DECROTEL API OK");
});

// ---------------------
// HEALTH CHECK
// ---------------------

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    backend: "Decrotel"
  });
});

// ---------------------
// USERS
// ---------------------

app.get("/users", async (req, res) => {
  const { data, error } = await supabase
    .from("Users")
    .select("*");

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

// ---------------------
// INSCRIPTION
// ---------------------

app.post("/register", async (req, res) => {
  try {
    const {
      email,
      password,
      business_name,
      plan
    } = req.body;

const {
    data: authData,
    error: authError
} = await supabase.auth.signUp({
    email,
    password,
    options: {
        emailRedirectTo:
        "https://decrotel.netlify.app/dashboard.html"
    }
});

    console.log("AUTH DATA :", authData);
console.log("AUTH ERROR :", authError);

if (authError) {
    return res.status(400).json(authError);
}
 if(!authData.user){
    return res.status(400).json({
        error:"Utilisateur non créé"
   });
}
const { data, error } = await supabase
    .from("Users")
    .insert([
        {
            id: authData.user.id,
            email,
            business_name,
            plan: plan || "essential"
        }
    ])
    .select();

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true,
      user: data
    });

  } catch (err) {
    res.status(500).json(err);
  }
});

// ---------------------
// USER TEST
// ---------------------

app.get("/create-test-user", async (req, res) => {

  const { data, error } = await supabase
    .from("Users")
    .insert([
      {
        email: "test@decrotel.fr",
        business_name: "Entreprise Test",
        plan: "essential"
      }
    ])
    .select();

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

// ---------------------
// CALLS
// ---------------------

app.get("/calls", async (req, res) => {

  const { data, error } = await supabase
    .from("calls")
    .select("*");

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

// ---------------------
// APPOINTMENTS
// ---------------------

app.get("/appointments", async (req, res) => {

  const { data, error } = await supabase
    .from("appointments")
    .select("*");

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
});

// ---------------------
// STATS DASHBOARD
// ---------------------

app.get("/stats", async (req, res) => {

  const { count: usersCount } =
    await supabase
      .from("Users")
      .select("*", {
        count: "exact",
        head: true
      });

  const { count: callsCount } =
    await supabase
      .from("calls")
      .select("*", {
        count: "exact",
        head: true
      });

  const { count: appointmentsCount } =
    await supabase
      .from("appointments")
      .select("*", {
        count: "exact",
        head: true
      });

  res.json({
    users: usersCount || 0,
    calls: callsCount || 0,
    appointments: appointmentsCount || 0
  });

});
// ---------------------
// REGISTER
// ---------------------

app.post("/register", async (req, res) => {

  try {

    const {
      email,
      business_name
    } = req.body;

    if (!email || !business_name) {

      return res.status(400).json({
        error: "Email et nom de société obligatoires"
      });

    }

    const { data, error } = await supabase
      .from("Users")
      .insert([
        {
          email,
          business_name,
          plan: "essential"
        }
      ])
      .select();

    if (error) {
      return res.status(500).json(error);
    }

    res.json({
      success: true,
      user: data[0]
    });

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

});

// ---------------------
// GOOGLE OAUTH + CALENDAR
// ---------------------
const crypto = require("crypto");
const path = require("path");

const dashboardPath = path.join(__dirname, "dashboard.html");
const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:3000/dashboard.html";
const stateSecret = process.env.OAUTH_STATE_SECRET;

const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

function signState(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
function verifyState(state) {
  if (!state || !state.includes(".")) throw new Error("État OAuth invalide");
  const [body, sig] = state.split(".");
  const expected = crypto.createHmac("sha256", stateSecret).update(body).digest();
  const actual = Buffer.from(sig, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error("Signature OAuth invalide");
  }
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.userId || !payload.nonce || !payload.createdAt ||
      Date.now() - payload.createdAt > 10 * 60 * 1000) {
    throw new Error("État OAuth expiré ou incomplet");
  }
  return payload;
}
function requireGoogleConfig(res) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET ||
      !process.env.GOOGLE_REDIRECT_URI || !stateSecret) {
    res.status(500).json({ error: "Configuration OAuth incomplète. Vérifiez le fichier .env." });
    return false;
  }
  if (!supabaseAdmin) {
    res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY manque dans le .env du serveur." });
    return false;
  }
  return true;
}
async function getAuthenticatedUser(req, res) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) {
    res.status(401).json({ error: "Session Decrotel absente. Reconnectez-vous." });
    return null;
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Session Decrotel invalide ou expirée." });
    return null;
  }
  return data.user;
}

// Dashboard served by Node: open this URL rather than file:// for OAuth return.
app.get("/dashboard.html", (req, res) => res.sendFile(dashboardPath));

// One OAuth entry point used by the existing dashboard.
app.post("/calendar/connect", async (req, res) => {
  try {
    if (!requireGoogleConfig(res)) return;
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    const { provider } = req.body || {};
    if (provider !== "google") {
      return res.status(400).json({ error: "Pour le moment, seul Google Agenda est activé en mode réel." });
    }
    const state = signState({
      userId: user.id,
      nonce: crypto.randomBytes(18).toString("hex"),
      createdAt: Date.now()
    });
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      state,
      scope: ["https://www.googleapis.com/auth/calendar"]
    });
    return res.json({ authUrl });
  } catch (err) {
    console.error("Erreur /calendar/connect:", err.message);
    return res.status(500).json({ error: "Impossible de démarrer la connexion Google." });
  }
});

app.get("/auth/google/callback", async (req, res) => {
  try {
    if (!requireGoogleConfig(res)) return;
    if (req.query.error) {
      return res.redirect(`${dashboardUrl}?calendar=error&reason=cancelled`);
    }
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(`${dashboardUrl}?calendar=error&reason=missing_parameters`);
    }
    const payload = verifyState(String(state));
    const { tokens } = await oauth2Client.getToken(String(code));

    // Google peut ne pas renvoyer un nouveau refresh_token à chaque consentement.
    const { data: oldRows, error: readError } = await supabaseAdmin
      .from("googletokens").select("refresh_token").eq("user_id", payload.userId).limit(1);
    if (readError) throw readError;
    const oldRefreshToken = oldRows?.[0]?.refresh_token;
    const row = {
      user_id: payload.userId,
      access_token: tokens.access_token || null,
      ...(tokens.refresh_token || oldRefreshToken
        ? { refresh_token: tokens.refresh_token || oldRefreshToken }
        : {}),
      token_type: tokens.token_type || "Bearer",
      scope: tokens.scope || null,
      expiry_date: tokens.expiry_date || null,
      updated_at: new Date().toISOString()
    };
    const { error: saveError } = await supabaseAdmin
      .from("googletokens").upsert(row, { onConflict: "user_id" });
    if (saveError) throw saveError;

    return res.redirect(`${dashboardUrl}?calendar=connected&provider=google`);
  } catch (err) {
    // Never log OAuth codes or tokens.
    console.error("Échec callback Google:", err.message);
    return res.redirect(`${dashboardUrl}?calendar=error&reason=oauth_failed`);
  }
});

// Read Google Calendar events for the currently authenticated Decrotel user.
// Used to import appointments created directly in Google Agenda into the Decrotel planning.
app.get("/calendar/events", async (req, res) => {
  try {
    if (!requireGoogleConfig(res)) return;
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;

    const { data: rows, error } = await supabaseAdmin
      .from("googletokens")
      .select("refresh_token, access_token, expiry_date")
      .eq("user_id", user.id).limit(1);
    if (error) throw error;
    const saved = rows?.[0];
    if (!saved?.refresh_token && !saved?.access_token) {
      return res.status(409).json({ error: "Google Agenda n'est pas connecté pour ce compte." });
    }

    const userOAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    userOAuth.setCredentials({
      refresh_token: saved.refresh_token || undefined,
      access_token: saved.access_token || undefined,
      expiry_date: saved.expiry_date || undefined
    });
    const calendar = google.calendar({ version: "v3", auth: userOAuth });
    const now = Date.now();
    const result = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(now + 365 * 24 * 60 * 60 * 1000).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 2500
    });
    return res.json({
      success: true,
      events: (result.data.items || []).filter(e => e.status !== "cancelled").map(e => ({
        id: e.id,
        summary: e.summary || "Rendez-vous Google",
        description: e.description || "",
        start: e.start || {},
        end: e.end || {},
        htmlLink: e.htmlLink || ""
      }))
    });
  } catch (err) {
    console.error("Erreur lecture événements Google:", err.message);
    return res.status(500).json({ error: "La lecture des rendez-vous Google Agenda a échoué." });
  }
});

// Create a real event for the currently authenticated Decrotel user.
app.post("/calendar/events", async (req, res) => {
  try {
    if (!requireGoogleConfig(res)) return;
    const user = await getAuthenticatedUser(req, res);
    if (!user) return;
    const { title, start, end, description } = req.body || {};
    if (!title || !start || !end || Number.isNaN(Date.parse(start)) ||
        Number.isNaN(Date.parse(end)) || Date.parse(end) <= Date.parse(start)) {
      return res.status(400).json({ error: "Titre, début et fin du rendez-vous sont obligatoires." });
    }
    const { data: rows, error } = await supabaseAdmin
      .from("googletokens")
      .select("refresh_token, access_token, expiry_date")
      .eq("user_id", user.id).limit(1);
    if (error) throw error;
    const saved = rows?.[0];
    if (!saved?.refresh_token && !saved?.access_token) {
      return res.status(409).json({ error: "Google Agenda n'est pas connecté pour ce compte." });
    }
    const userOAuth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    userOAuth.setCredentials({
      refresh_token: saved.refresh_token || undefined,
      access_token: saved.access_token || undefined,
      expiry_date: saved.expiry_date || undefined
    });
    const calendar = google.calendar({ version: "v3", auth: userOAuth });
    const result = await calendar.events.insert({
      calendarId: "primary",
      resource: {
        summary: String(title).slice(0, 250),
        description: description ? String(description).slice(0, 4000) : "",
        start: { dateTime: new Date(start).toISOString(), timeZone: "Europe/Paris" },
        end: { dateTime: new Date(end).toISOString(), timeZone: "Europe/Paris" }
      }
    });
    return res.status(201).json({ success: true, eventId: result.data.id, htmlLink: result.data.htmlLink });
  } catch (err) {
    console.error("Erreur création événement Google:", err.message);
    return res.status(500).json({ error: "La création du rendez-vous Google Agenda a échoué." });
  }
});

// Keep exactly one listener.
app.listen(PORT, () => {
  console.log(`DECROTEL API STARTED ON PORT ${PORT}`);
  console.log(`Dashboard local : http://localhost:${PORT}/dashboard.html`);
});
