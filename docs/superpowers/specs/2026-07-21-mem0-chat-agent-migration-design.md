# Migración mem0-chat a ToolLoopAgent con AI SDK

## Resumen

Migrar la función edge `functions/mem0-chat/` del actual tool-calling loop manual (MiniMax via fetch + dispatch en handler) al `ToolLoopAgent` de Vercel AI SDK 7.0, manteniendo MiniMax como provider de lenguaje, mem0 como memoria de perfil, y contrato sync (POST → JSON).

## Motivación

El handler actual implementa su propio loop de tool calling:
1. `classifyIntent()` via MiniMax (fetch directo)
2. if/else para cada intent
3. Ejecución de tools manual
4. Persistencia manual de mensajes

ToolLoopAgent reemplaza todo eso con una abstracción estándar: define tools, el modelo decide, el SDK maneja el loop.

## Arquitectura

### Antes (actual)

```
handler.ts:
  loadRecentChatHistory()
  classifyIntent(message) → MiniMax fetch
  if intent == 'chat' → responder
  if intent == 'approve' → loadPendingProposal + saveRoutineToDb
  if intent == 'routine' → pickProfileFields + generateRoutineProposal + savePendingProposal
  saveMessage() manual
```

### Después

```
handler.ts:
  agent.generate({ prompt: message })
  → ToolLoopAgent con MiniMax
    → tool extractProfile   (valida + mem0)
    → tool generateRoutine  (MiniMax + pending)
    → tool approveRoutine   (DB)
  → text response
```

## Provider: MiniMax via OpenAI Compatible

MiniMax expone API compatible con OpenAI en `https://api.minimax.io/v1`. Usamos `@ai-sdk/openai-compatible`:

```ts
import { createOpenAICompatible } from 'npm:@ai-sdk/openai-compatible';

const minimax = createOpenAICompatible({
  name: 'minimax',
  apiKey: Deno.env.get('MINIMAX_API_KEY')!,
  baseURL: 'https://api.minimax.io/v1',
});
```

Modelo: `MiniMax-M2.7` (mismo que usa hoy).

## ToolLoopAgent

```ts
import { ToolLoopAgent, tool } from 'npm:ai';

const agent = new ToolLoopAgent({
  model: minimax('MiniMax-M2.7'),
  instructions: `...`,
  tools: { extractProfile, generateRoutine, approveRoutine },
});

const { text } = await agent.generate({ prompt: message });
```

### Tools

#### extractProfile

- **Descripción:** Guarda o actualiza el perfil del usuario (edad, peso, objetivo, nivel, días por semana)
- **Input:** `{ age?: number, weightKg?: number, goal?: string, level?: string, daysPerWeek?: number }`
- **Execute:** Valida con `routineProfileSchema`, guarda en mem0 con `saveUserProfile()`. Retorna los datos guardados o error de validación.
- **Cuándo se llama:** Usuario da datos personales (completos o parciales)

#### generateRoutine

- **Descripción:** Genera una propuesta de rutina basada en el perfil del usuario
- **Input:** `{}`  (usa el perfil ya guardado en mem0)
- **Execute:** Carga perfil de mem0 con `loadUserProfile()`, llama a `generateRoutineProposal()` (MiniMax), guarda propuesta en `pending_routine_proposals`. Retorna la propuesta formateada o error si falta perfil.
- **Cuándo se llama:** Perfil completo y usuario pide rutina

#### approveRoutine

- **Descripción:** Aprueba y guarda la propuesta de rutina pendiente
- **Input:** `{ name?: string }` (nombre opcional personalizado)
- **Execute:** Carga propuesta pendiente de `pending_routine_proposals`, llama a `saveRoutineToDb()` para persistir, marca propuesta como `approved`. Retorna ID de la rutina guardada.
- **Cuándo se llama:** Usuario confirma propuesta pendiente

### Agent Instructions

```
Eres un entrenador personal. Tu ÚNICA función es crear rutinas de entrenamiento personalizadas.

REGLAS:
- Si el usuario NO está pidiendo crear una rutina ni dando datos para una, responde directamente:
  "Solo puedo ayudarte a crear rutinas de entrenamiento. Dime tu edad, peso, objetivo, nivel y días disponibles."
- Si el usuario proporciona datos personales (edad, peso, objetivo, nivel, días), usa extractProfile
- Si el usuario da datos parciales, usa extractProfile con los campos disponibles (se irán acumulando)
- Si tienes suficiente información del perfil y el usuario quiere una rutina, usa generateRoutine
- Si el usuario aprueba la propuesta mostrada, usa approveRoutine
- Cuando un tool se ejecuta exitosamente, genera un mensaje amigable en español informando al usuario del resultado
- Si un tool falla, explica el error al usuario y pídele que lo intente de nuevo
- NUNCA inventes datos del perfil del usuario
- Responde SIEMPRE en español
```

## Archivos

| Archivo | Cambio |
|---------|--------|
| `functions/mem0-chat/agent.ts` | **Nuevo.** Provider MiniMax + ToolLoopAgent + tool definitions |
| `functions/mem0-chat/handler.ts` | Simplificar: solo llama `agent.generate()`, mapea a response |
| `functions/mem0-chat/tools.ts` | **Eliminar.** Reemplazado por tools en agent.ts |
| `functions/mem0-chat/mem0.ts` | Sin cambios |
| `functions/mem0-chat/schemas.ts` | Sin cambios |
| `functions/mem0-chat/constants.ts` | Sin cambios |
| `functions/mem0-chat/embeddings.ts` | Sin cambios (ya no se usa, pero no se elimina) |
| `functions/mem0-chat/utils.ts` | Sin cambios |
| `functions/mem0-chat/index.ts` | Sin cambios |

Dependencias nuevas en runtime:
- `npm:ai`
- `npm:@ai-sdk/openai-compatible`
- `npm:@ai-sdk/provider` (peer dep)

## Manejo de errores

- Si MiniMax devuelve error → ToolLoopAgent lanza excepción, handler captura y responde 500
- Si tool falla por datos inválidos → tool retorna error string, el agente lo explica al usuario
- Si no hay propuesta pendiente al aprobar → tool retorna error, agente pide generar rutina nueva
- Rate limiting, auth, CORS → sin cambios (index.ts)

## Lo que no cambia

- Contrato HTTP (POST → 200 `{"response":"..."}`)
- Autenticación JWT + rate limiting
- mem0 OSS con pgvector y MiniMax embedder
- `generateRoutineProposal()` en `functions/minimax-chat/routine.ts`
- `saveRoutineToDb()` en `functions/minimax-chat/persistence.ts`
- Tabla `pending_routine_proposals` y `routines`
- Frontend (`ai-chat.service.ts`)
