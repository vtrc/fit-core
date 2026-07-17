// functions/minimax-chat/constants.ts
var RATE_LIMIT = 10;
var RATE_WINDOW = 60 * 1e3;
var AGE_MIN = 14;
var AGE_MAX = 99;
var WEIGHT_MIN = 40;
var WEIGHT_MAX = 120;
var DAYS_MIN = 1;
var DAYS_MAX = 7;
var SYSTEM_PROMPT = `Eres un asistente de fitness especializado en crear rutinas de entrenamiento personalizadas.
Tu objetivo es guiar al usuario para crear una rutina personalizada basada en sus objetivos, nivel de fitness y preferencias.

El proceso para crear una rutina:
1. Pregunta sobre los objetivos del usuario (perder peso, ganar m\xFAsculo, resistencia, etc.)
2. Pregunta sobre su nivel de fitness (principiante, intermedio, avanzado)
3. Pregunta sobre cu\xE1ntos d\xEDas por semana puede entrenar
4. Crea una rutina personalizada con ejercicios espec\xEDficos
5. Explica cada ejercicio y c\xF3mo hacerlo correctamente

Responde siempre en espa\xF1ol y s\xE9 motivador y profesional.`;
var rateLimitStore = /* @__PURE__ */ new Map();

// functions/minimax-chat/utils.ts
function extractUserIdFromToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  try {
    const token = authHeader.replace("Bearer ", "");
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.user_id || null;
  } catch {
    return null;
  }
}
function checkRateLimit(userId) {
  const now = Date.now();
  const record = rateLimitStore.get(userId);
  if (!record || now > record.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT) {
    return false;
  }
  record.count++;
  return true;
}
function buildCorsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
    "Access-Control-Allow-Credentials": "true"
  };
}
function stripThinkTags(delta, initialInThink) {
  let remaining = true;
  let inThink = initialInThink;
  let result = "";
  let cursor = delta;
  while (remaining && cursor.length > 0) {
    if (inThink) {
      const end = cursor.indexOf("</think>");
      if (end === -1) {
        remaining = false;
      } else {
        cursor = cursor.slice(end + 8);
        inThink = false;
      }
    } else {
      const start = cursor.indexOf("<think>");
      if (start === -1) {
        result += cursor;
        remaining = false;
      } else {
        result += cursor.slice(0, start);
        cursor = cursor.slice(start + 7);
        inThink = true;
      }
    }
  }
  return { cleaned: result, inThink };
}
function parseMiniMaxJson(text) {
  return JSON.parse(
    text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/gi, "").trim()
  );
}

// functions/minimax-chat/schemas.ts
import { z } from "npm:zod";
var routineProfileSchema = z.object({
  age: z.number().int().min(AGE_MIN).max(AGE_MAX),
  weightKg: z.number().min(WEIGHT_MIN).max(WEIGHT_MAX),
  goal: z.enum(["strength", "cardio", "fat_loss", "general"]),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  daysPerWeek: z.number().int().min(DAYS_MIN).max(DAYS_MAX)
});
var partialProfileSchema = routineProfileSchema.partial();
var routineProposalSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  exercises: z.array(z.object({
    exercise_id: z.string().uuid(),
    exercise_name: z.string().optional(),
    position: z.number().int().nonnegative(),
    planned_sets: z.number().int().positive().nullable(),
    planned_repetitions: z.number().int().positive().nullable(),
    planned_weight: z.number().nonnegative().nullable(),
    planned_duration_seconds: z.number().int().positive().nullable(),
    planned_distance: z.number().positive().nullable(),
    rest_seconds: z.number().int().nonnegative().nullable(),
    notes: z.string().nullable()
  })).min(1)
});

// functions/minimax-chat/routine.ts
import { createClient as createClient3 } from "npm:@insforge/sdk";

// functions/minimax-chat/catalog.ts
import { createClient } from "npm:@insforge/sdk";
async function loadCatalog(token, anonKey) {
  const client = createClient({ baseUrl: Deno.env.get("INSFORGE_URL") ?? "https://4af6r2tm.eu-central.insforge.app", anonKey });
  client.setAccessToken(token);
  const { data: catalog, error: catalogError } = await client.database.from("exercises").select("id, name, type, equipment, muscle_groups").order("name", { ascending: true });
  if (catalogError) throw new Error(catalogError.message);
  const entries = catalog ?? [];
  return {
    entries,
    nameToEntry: new Map(entries.map((e) => [e.name.toLowerCase().trim(), e])),
    idToEntry: new Map(entries.map((e) => [e.id, e]))
  };
}
function fillExerciseDetails(exercise, profile, position) {
  const base = { exercise_id: exercise.id, position, notes: null };
  if (exercise.type === "cardio") {
    return {
      ...base,
      planned_sets: null,
      planned_repetitions: null,
      planned_weight: null,
      planned_duration_seconds: profile.level === "beginner" ? 600 : profile.level === "intermediate" ? 900 : 1200,
      planned_distance: null,
      rest_seconds: null
    };
  }
  const isCompound = (exercise.muscle_groups?.length ?? 0) >= 2;
  const levelMultiplier = profile.level === "beginner" ? 0.5 : profile.level === "intermediate" ? 0.7 : 0.9;
  const bodyweightRatio = isCompound ? levelMultiplier : levelMultiplier * 0.35;
  const rawWeight = profile.weightKg * bodyweightRatio;
  const suggestedWeight = exercise.equipment ? Math.round(rawWeight) : null;
  const setsReps = getGoalSetsAndReps(profile);
  return {
    ...base,
    planned_sets: setsReps.sets,
    planned_repetitions: setsReps.reps,
    planned_weight: suggestedWeight,
    planned_duration_seconds: null,
    planned_distance: null,
    rest_seconds: setsReps.rest
  };
}
function getGoalSetsAndReps(profile) {
  if (profile.goal === "strength") {
    return {
      sets: 4,
      reps: profile.level === "beginner" ? 8 : profile.level === "intermediate" ? 6 : 5,
      rest: 90
    };
  }
  if (profile.goal === "fat_loss") {
    return {
      sets: 3,
      reps: profile.level === "beginner" ? 12 : 15,
      rest: 45
    };
  }
  return {
    sets: 3,
    reps: profile.level === "beginner" ? 10 : 12,
    rest: 60
  };
}

// functions/minimax-chat/persistence.ts
import { createClient as createClient2 } from "npm:@insforge/sdk";
var URL_BASE = Deno.env.get("INSFORGE_URL") ?? "https://4af6r2tm.eu-central.insforge.app";
async function saveRoutineToDb(client, userId, routine) {
  const name = routine.name?.trim();
  if (!name || !routine.exercises?.length) throw new Error("A name and at least one exercise are required");
  const exerciseIds = routine.exercises.map((e) => e.exercise_id);
  const { data: exercises, error: exerciseError } = await client.database.from("exercises").select("id").in("id", exerciseIds);
  if (exerciseError) throw new Error(exerciseError.message);
  if ((exercises ?? []).length !== new Set(exerciseIds).size) throw new Error("The routine contains an exercise that is not in the catalog");
  const { data: created, error: routineError } = await client.database.from("routines").insert([{ user_id: userId, name, description: routine.description?.trim() || null }]).select("id").single();
  if (routineError) throw new Error(routineError.message);
  const rows = routine.exercises.map((exercise, index) => ({
    user_id: userId,
    routine_id: created.id,
    exercise_id: exercise.exercise_id,
    position: exercise.position ?? index,
    planned_sets: exercise.planned_sets ?? null,
    planned_repetitions: exercise.planned_repetitions ?? null,
    planned_weight: exercise.planned_weight ?? null,
    planned_duration_seconds: exercise.planned_duration_seconds ?? null,
    planned_distance: exercise.planned_distance ?? null,
    rest_seconds: exercise.rest_seconds ?? null,
    notes: exercise.notes ?? null
  }));
  const { error: insertError } = await client.database.from("routine_exercises").insert(rows);
  if (insertError) {
    await client.database.from("routines").delete().eq("id", created.id).eq("user_id", userId);
    throw new Error(insertError.message);
  }
  return created.id;
}
async function persistRoutine(req, userId, routine, corsHeaders) {
  try {
    const anonKey = req.headers.get("apikey");
    if (!anonKey) return new Response(JSON.stringify({ error: "Missing apikey" }), { status: 401, headers: corsHeaders });
    const client = createClient2({ baseUrl: URL_BASE, anonKey });
    client.setAccessToken(req.headers.get("Authorization").slice(7));
    const id = await saveRoutineToDb(client, userId, routine);
    return new Response(JSON.stringify({ id }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: corsHeaders });
  }
}

// functions/minimax-chat/routine.ts
var mmKey = Deno.env.get("MINIMAX_API_KEY") ?? "";
var URL_BASE2 = Deno.env.get("INSFORGE_URL") ?? "https://4af6r2tm.eu-central.insforge.app";
function generateName(profile) {
  const goalLabels = { strength: "Fuerza", cardio: "Cardio", fat_loss: "P\xE9rdida de Grasa", general: "General" };
  return `Rutina de ${goalLabels[profile.goal] ?? "Entrenamiento"} - Nivel ${profile.level}`;
}
function generateDescription(profile) {
  const goalText = profile.goal === "strength" ? "ganar fuerza" : profile.goal === "cardio" ? "mejorar resistencia cardiovascular" : profile.goal === "fat_loss" ? "perder grasa" : "mantenerse en forma";
  const days = profile.daysPerWeek;
  return `Rutina personalizada para ${goalText} entrenando ${days} d\xEDa${days > 1 ? "s" : ""} por semana.`;
}
async function generateRoutineProposal(profile, token, anonKey) {
  const validatedProfile = routineProfileSchema.parse(profile);
  const client = createClient3({ baseUrl: URL_BASE2, anonKey });
  client.setAccessToken(token);
  const { data: catalog, error: catalogError } = await client.database.from("exercises").select("id, name, type, equipment, muscle_groups").order("name", { ascending: true });
  if (catalogError) throw new Error(catalogError.message);
  const entries = catalog ?? [];
  const nameToEntry = new Map(entries.map((e) => [e.name.toLowerCase().trim(), e]));
  const idToEntry = new Map(entries.map((e) => [e.id, e]));
  const availableNames = entries.map((e) => e.name).join(", ");
  const mmRes = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${mmKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: [
        { role: "system", content: "Eres un entrenador personal. Devuelve SOLO JSON sin explicaciones." },
        { role: "user", content: `De estos ejercicios: ${availableNames}. Perfil: ${JSON.stringify(validatedProfile)}. Elige 5-8 ejercicios. Devuelve SOLO un array JSON con los nombres exactos.` }
      ]
    })
  });
  const mmText = await mmRes.text();
  if (!mmRes.ok) throw new Error(`MiniMax API raw error: ${mmRes.status} ${mmText}`);
  const mmData = JSON.parse(mmText);
  const text = mmData?.choices?.[0]?.message?.content ?? "";
  const rawList = JSON.parse(text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```json|```/gi, "").trim());
  const selected = [];
  for (const raw of rawList) {
    const entry = nameToEntry.get(String(raw).toLowerCase().trim());
    if (entry) selected.push(entry);
  }
  if (selected.length === 0) throw new Error("No se pudieron seleccionar ejercicios");
  const exercises = selected.map((e, i) => fillExerciseDetails(e, validatedProfile, i));
  return {
    name: generateName(validatedProfile),
    description: generateDescription(validatedProfile),
    exercises: exercises.map((e) => ({ ...e, exercise_name: idToEntry.get(e.exercise_id)?.name ?? "Ejercicio" }))
  };
}
async function handleProposalFeedback(message, userId, proposal, profile, token, anonKey) {
  const prop = proposal;
  const currentNames = prop.exercises.map((e) => e.exercise_name).join(", ");
  const mmRes = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${mmKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: [
        { role: "system", content: "Eres un entrenador personal. Responde SOLO JSON sin explicaciones." },
        {
          role: "user",
          content: `Rutina actual: ${currentNames} (${prop.exercises.length} ejercicios, nombre: "${prop.name}").
Usuario: "${message}"

Determina qu\xE9 quiere hacer:
1. "approve" \u2014 si est\xE1 conforme, quiere guardar, dice s\xED/correcto/est\xE1 bien/me gusta/ok/guardar
2. "rename" \u2014 si quiere cambiar el nombre (ej: "ll\xE1mala X", "nombre: X", "ponle X")
3. "modify" \u2014 si quiere cambiar los ejercicios (a\xF1adir/quitar/reemplazar)

Devuelve JSON:
- Si approve: {"intent":"approve"}
- Si rename: {"intent":"rename","name":"nuevo nombre"}
- Si modify: {"intent":"modify","exercises":["nombre1","nombre2",...]}`
        }
      ]
    })
  });
  const mmText = await mmRes.text();
  if (!mmRes.ok) throw new Error(`MiniMax API error: ${mmRes.status} ${mmText}`);
  const mmData = JSON.parse(mmText);
  const text = mmData?.choices?.[0]?.message?.content ?? "";
  const parsed = parseMiniMaxJson(text);
  if (parsed.intent === "approve") {
    const client = createClient3({ baseUrl: URL_BASE2, anonKey });
    client.setAccessToken(token);
    const id = await saveRoutineToDb(client, userId, prop);
    return { action: "approve", id };
  }
  if (parsed.intent === "rename" && parsed.name) {
    return { action: "rename", proposal: { ...prop, name: parsed.name.trim() } };
  }
  if (parsed.intent === "modify" && Array.isArray(parsed.exercises)) {
    const { nameToEntry, idToEntry } = await loadCatalog(token, anonKey);
    const selected = [];
    for (const raw of parsed.exercises) {
      const entry = nameToEntry.get(String(raw).toLowerCase().trim());
      if (entry) selected.push(entry);
    }
    if (selected.length === 0) {
      return {
        state: "collecting_requirements",
        missing: ["exercises"],
        message: "\xA1Ups! No encontr\xE9 ejercicios del cat\xE1logo que encajen con lo que pides. Intenta decirme los nombres de otro modo y los ajusto."
      };
    }
    const validatedProfile = profile ? routineProfileSchema.parse(profile) : null;
    if (!validatedProfile) {
      return {
        state: "collecting_requirements",
        missing: ["profile"],
        message: "Necesito tus datos para ajustar la rutina. Cu\xE9ntame tu edad, peso, objetivo, nivel y d\xEDas de entrenamiento."
      };
    }
    const exercises = selected.map((e, i) => fillExerciseDetails(e, validatedProfile, i));
    return {
      action: "modify",
      proposal: {
        name: prop.name,
        description: prop.description,
        exercises: exercises.map((e) => ({ ...e, exercise_name: idToEntry.get(e.exercise_id)?.name ?? "Ejercicio" }))
      },
      profile: validatedProfile
    };
  }
  return { action: "modify", proposal };
}

// functions/minimax-chat/handler.ts
var mmKey2 = Deno.env.get("MINIMAX_API_KEY") ?? "";
async function handleRoutineMessage(message, userId, proposal, profile, token, anonKey, messages) {
  if (proposal) {
    return handleProposalFeedback(message, userId, proposal, profile, token ?? "", anonKey ?? "");
  }
  const conversationContext = (messages ?? []).filter((m) => m.role === "user" || m.role === "assistant").map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`).join("\n");
  const classifyPrompt = `Eres un entrenador personal. Responde SOLO JSON sin explicaciones.

Conversaci\xF3n:
${conversationContext}

Mensaje actual: "${message}"

Determina si el usuario quiere CREAR O MODIFICAR una rutina, o es conversaci\xF3n GENERAL.

RUTINA \u2014 si habla de crear/generar/modificar una rutina o da datos de perfil (edad/peso/objetivo/nivel/d\xEDas):
  Extrae SOLO los campos que aparezcan (no inventes): age, weightKg, goal (strength|cardio|fat_loss|general), level (beginner|intermediate|advanced), daysPerWeek.
  \u2192 {"intent":"routine","age":...,"weightKg":...,"goal":"...","level":"...","daysPerWeek":...}

CHAT \u2014 si es saludo, consejo, motivaci\xF3n, pregunta general, etc:
  \u2192 {"intent":"chat","response":"tu respuesta como entrenador en markdown"}`;
  const mmRes = await fetch("https://api.minimax.io/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${mmKey2}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "MiniMax-M2.7",
      messages: [
        { role: "system", content: "Eres un entrenador personal. Responde SOLO JSON sin explicaciones." },
        { role: "user", content: classifyPrompt }
      ]
    })
  });
  const mmText = await mmRes.text();
  if (!mmRes.ok) throw new Error(`MiniMax API error: ${mmRes.status} ${mmText}`);
  const mmData = JSON.parse(mmText);
  const text = mmData?.choices?.[0]?.message?.content ?? "";
  const parsed = parseMiniMaxJson(text);
  if (parsed.intent === "chat") {
    return { action: "chat", content: "Soy un asistente especializado en crear rutinas de entrenamiento personalizadas \u{1F4AA} Cu\xE9ntame tu objetivo, nivel y d\xEDas disponibles y te preparo una rutina a medida. \xBFEmpezamos?" };
  }
  const raw = parsed.intent === "routine" ? parsed : {};
  const clean = coerceNumericFields(raw);
  const missing = Object.entries(routineProfileSchema.shape).filter(([key]) => clean[key] === void 0).map(([key]) => key);
  if (missing.length > 0) {
    return buildMissingProfileResponse(missing);
  }
  const parsedIntent = routineProfileSchema.safeParse(clean);
  if (!parsedIntent.success) {
    return buildInvalidProfileResponse(parsedIntent.error);
  }
  return { state: "profile_ready", profile: parsedIntent.data };
}
function coerceNumericFields(raw) {
  const numericKeys = /* @__PURE__ */ new Set(["age", "weightKg", "daysPerWeek"]);
  const clean = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null) continue;
    if (numericKeys.has(key) && typeof value === "string") {
      const n = Number(value);
      clean[key] = Number.isNaN(n) ? value : n;
    } else {
      clean[key] = value;
    }
  }
  return clean;
}
function buildMissingProfileResponse(missing) {
  const labels = {
    age: `tu **edad** (${AGE_MIN}-${AGE_MAX} a\xF1os)`,
    weightKg: `tu **peso** (${WEIGHT_MIN}-${WEIGHT_MAX} kg)`,
    goal: "tu **objetivo** (fuerza/cardio/perder grasa/general)",
    level: "tu **nivel** (principiante/intermedio/avanzado)",
    daysPerWeek: `los **d\xEDas** que entrenas (${DAYS_MIN}-${DAYS_MAX})`
  };
  const list = missing.map((key) => labels[key] ?? key).join(", ");
  return {
    state: "collecting_requirements",
    missing,
    message: `\xA1Genial, voy bien! Solo dime ${list} y terminamos.

Ejemplo: *"25 a\xF1os, 70kg, fuerza, intermedio, 3 d\xEDas"*`
  };
}
function buildInvalidProfileResponse(error) {
  const fieldLabels = {
    age: `la edad (tiene que ser entre ${AGE_MIN} y ${AGE_MAX})`,
    weightKg: `el peso (entre ${WEIGHT_MIN} y ${WEIGHT_MAX} kg)`,
    goal: "el objetivo (fuerza/cardio/perder grasa/general)",
    level: "el nivel (principiante/intermedio/avanzado)",
    daysPerWeek: `los d\xEDas (de ${DAYS_MIN} a ${DAYS_MAX})`
  };
  const issues = error.issues.map((issue) => fieldLabels[issue.path[0]] ?? issue.path[0]).join(", ");
  return {
    state: "collecting_requirements",
    missing: error.issues.map((issue) => String(issue.path[0])),
    message: `Casi casi \u{1F64C} Revisa ${issues}. Por ejemplo: *"25 a\xF1os, 70kg, fuerza, intermedio, 3 d\xEDas"*`
  };
}

// functions/minimax-chat/index.ts
async function index_default(req) {
  const origin = req.headers.get("Origin") || "https://4af6r2tm.insforge.site";
  const corsHeaders = buildCorsHeaders(origin);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  const authHeader = req.headers.get("Authorization");
  const userId = extractUserIdFromToken(authHeader);
  const token = authHeader?.slice(7);
  const anonKey = req.headers.get("apikey") ?? "";
  if (!userId) {
    return new Response(
      JSON.stringify({ error: "Authentication required" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!checkRateLimit(userId)) {
    return new Response(
      JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  try {
    const { messages, stream, action, routine, profile, message, proposal } = await req.json();
    if (action === "routine_message") {
      const result = await handleRoutineMessage(
        message,
        userId,
        proposal,
        profile,
        token,
        anonKey,
        messages
      );
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (action === "generate_routine") {
      const result = await generateRoutineProposal(profile, token ?? "", anonKey);
      return new Response(JSON.stringify({ state: "awaiting_approval", proposal: result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    if (action === "approve_routine") {
      return persistRoutine(req, userId, routine, corsHeaders);
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const apiKey = Deno.env.get("MINIMAX_API_KEY");
    const minimaxResponse = await fetch("https://api.minimax.io/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "MiniMax-M2.7",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages
        ],
        stream: stream ?? false
      })
    });
    if (!minimaxResponse.ok) {
      const errorText = await minimaxResponse.text();
      return new Response(
        JSON.stringify({ error: `MiniMax API error: ${minimaxResponse.status} ${errorText}` }),
        { status: minimaxResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (stream) {
      return handleStreamingResponse(minimaxResponse, corsHeaders);
    }
    const apiResponse = await minimaxResponse.json();
    if (apiResponse?.choices?.[0]?.message?.content) {
      apiResponse.choices[0].message.content = apiResponse.choices[0].message.content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    }
    return new Response(JSON.stringify(apiResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    console.error("minimax-chat runtime error", e);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
function handleStreamingResponse(minimaxResponse, corsHeaders) {
  let inThink = false;
  const stripStream = new TransformStream({
    transform(chunk, controller) {
      const { cleaned, inThink: newInThink } = stripThinkTags(chunk, inThink);
      inThink = newInThink;
      if (cleaned) controller.enqueue(cleaned);
    },
    flush(controller) {
      if (!inThink) controller.enqueue("");
    }
  });
  const streamingBody = minimaxResponse.body.pipeThrough(new TextDecoderStream()).pipeThrough(stripStream).pipeThrough(new TextEncoderStream());
  return new Response(streamingBody, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  });
}
export {
  index_default as default
};
