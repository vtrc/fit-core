# mem0-chat: Función agéntica con memoria persistente

## Resumen

Nueva función edge (`functions/mem0-chat/`) que reemplaza el enfoque de máquina de estados del `functions/minimax-chat/` por un flujo agéntico donde MiniMax orquesta la conversación vía tool calls (JSON en su respuesta), y mem0 provee memoria persistente de perfil y facts entre sesiones.

## Arquitectura

### Flujo principal

```
Request → load_user_profile (mem0) → MiniMax con contexto + tools
  → MiniMax responde (texto directo) o decide llamar tool (JSON tool call)
  → Si tool call: ejecutar → loop: devolver resultado a MiniMax → nueva respuesta
  → Si hubo cambios: save_user_profile / save_routine
  → Response al usuario
```

### Tools que MiniMax puede invocar

Cada tool se define como instrucción en el system prompt. MiniMax responde con un JSON `{"tool":"<name>","args":{...}}` cuando quiere invocar una. El handler ejecuta la tool y hace otro round con MiniMax para generar la respuesta final al usuario.

| Tool | Args | Qué hace |
|------|------|----------|
| `save_user_profile` | `{age, weightKg, goal, level, daysPerWeek}` | Guarda/actualiza perfil en mem0 |
| `generate_routine` | `{profile}` | Llama a `generateRoutineProposal` (reuse) y presenta la propuesta |
| `save_routine` | `{routine}` | Persiste rutina aprobada en InsForge DB (reuse `saveRoutineToDb`) |

No hay tool para `load_user_profile` — eso ocurre automáticamente al inicio del request, antes de llamar a MiniMax.

### Memoria en mem0

**Qué se guarda:** Facts atómicos por usuario:
- Perfil (`edad, peso, objetivo, nivel, días`)
- Resumen de última rutina
- Cambios de objetivo o preferencias

`searchMemories(query=userMessage, filters={user_id})` al inicio de cada request.
`addMemories(content, {user_id})` después de cambios relevantes.

### Integración con MiniMax

MiniMax no tiene tool calling nativo. El mecanismo:
1. System prompt describe las tools disponibles con formato JSON
2. MiniMax responde con texto normal o con `{"tool":"...","args":{...}}`
3. Si es tool call → handler ejecuta → loop con MiniMax para generar respuesta user-facing
4. Si es texto → se envía directamente al usuario

## Archivos del proyecto

```
functions/mem0-chat/
├── index.ts        — Entry point (CORS, auth, rate limit)
├── handler.ts      — Orquestación: mem0 → MiniMax → tools loop
├── tools.ts        — Definición de tools + ejecutores
├── mem0.ts         — Wrapper para searchMemories / addMemories
├── routines.ts     — Reuse de generateRoutineProposal + saveRoutineToDb
├── schemas.ts      — Schemas Zod (reuse)
├── utils.ts        — CORS, auth, rate limit (reuse)
└── constants.ts    — Constantes (reuse)
```

## Lo que NO cambia

- Auth (JWT extraction), CORS, rate limiting
- `catalog.ts` (loadCatalog, fillExerciseDetails)
- `saveRoutineToDb` (persistencia en InsForge)
- Schemas de datos (`routineProfileSchema`, `ApprovedRoutine`, etc.)

## Lo que SÍ cambia

- No hay clasificación de intentos hardcodeada
- No hay templates de respuesta en el código
- El flujo lo gobierna MiniMax vía tool calls
- Mem0 guarda perfil y facts entre sesiones

## Chat History con pgvector

Cada mensaje se guarda en `chat_messages` con embedding vector(1024) de MiniMax embo-01.

**Tabla:**
```sql
CREATE TABLE chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content text NOT NULL,
  embedding vector(1024),              -- solo para mensajes de usuario
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
```

**Flujo de carga:**
1. Cada request carga últimos 50 mensajes del usuario (ORDER BY created_at DESC)
2. Se inyectan como contexto cronológico para MiniMax
3. Embeddings solo para mensajes user (no assistant/tool) para futura búsqueda semántica

## Constraints

- Sin tests unitarios
- Se ejecuta en Deno (InsForge edge functions)
- Usa `npm:@mem0/vercel-ai-provider` v3 standalone features (`searchMemories`, `addMemories`)
- Usa MiniMax API vía fetch (sin Vercel AI SDK) para chat y embeddings (`embo-01`)
- MEM0_API_KEY como environment variable
