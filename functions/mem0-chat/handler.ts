import { classifyIntent, extractProfile, MissingProfileError, InvalidProfileError, buildMissingMessage, buildInvalidProfileMessage } from './agent.ts';
import { loadUserProfile, savePendingProposal, loadPendingProposal, deletePendingProposal, loadProfileDraft, saveProfileDraft, deleteProfileDraft, claimPendingProposal, resetPendingProposalClaim } from './mem0.ts';
import { generateRoutineProposal, handleProposalFeedback } from '../minimax-chat/routine.ts';
import { saveRoutineToDb } from '../minimax-chat/persistence.ts';
import { createClient } from 'npm:@insforge/sdk';
import type { Profile } from './schemas.ts';
import type { ApprovedRoutine } from '../minimax-chat/schemas.ts';
import { extractProfileHints } from './profile-hints.ts';

const URL_BASE = Deno.env.get('INSFORGE_URL') ?? 'https://4af6r2tm.eu-central.insforge.app';

export async function handleChatRequest(
  userId: string,
  token: string,
  anonKey: string,
  message: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  try {
    const client = createClient({ baseUrl: URL_BASE, anonKey });
    client.setAccessToken(token);

    const pending = await loadPendingProposal(userId, client);
    if (pending) {
      return handlePendingProposal(userId, token, anonKey, message, pending, corsHeaders);
    }

    const existingProfile = await loadUserProfile(userId, client);
    const profileDraft = await loadProfileDraft(userId, client);
    const hints = extractProfileHints(message);
    const intent = await classifyIntent(message, existingProfile, profileDraft as Partial<Profile> | null);

    if (intent.intent === 'chat' && Object.keys(hints).length === 0) {
      return ok(intent.response ?? 'Solo puedo ayudarte a crear rutinas de entrenamiento.', corsHeaders);
    }

    const candidate: Partial<Profile> = {
      ...(profileDraft as Partial<Profile> | null),
      ...(intent.profile ?? {}),
      ...hints,
    };

    if (Object.keys(candidate).length === 0) {
      return ok('Solo puedo ayudarte a crear rutinas de entrenamiento. Dime tu edad, peso, objetivo, nivel y días disponibles.', corsHeaders);
    }

    let profile: Profile;
    try {
      profile = await extractProfile(userId, token, anonKey, candidate);
    } catch (e) {
      if (e instanceof MissingProfileError) {
        await saveProfileDraft(userId, candidate as Record<string, unknown>, client);
        return ok(buildMissingMessage(e.missing), corsHeaders);
      }
      if (e instanceof InvalidProfileError) return ok(buildInvalidProfileMessage(e.issues), corsHeaders);
      throw e;
    }

    await deleteProfileDraft(userId, client);
    const proposal = await generateRoutineProposal(profile, token, anonKey, message) as Record<string, unknown>;
    await savePendingProposal(userId, proposal, profile, client);
    return ok(formatProposalInline(proposal, profile), corsHeaders);
  } catch (e) {
    console.error('handler error', e);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
}

export async function clearChatContext(
  userId: string,
  token: string,
  anonKey: string,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const client = createClient({ baseUrl: URL_BASE, anonKey });
  client.setAccessToken(token);
  await deletePendingProposal(userId, client);
  await deleteProfileDraft(userId, client);
  return ok('Contexto del chat limpiado.', corsHeaders);
}

async function handlePendingProposal(
  userId: string,
  token: string,
  anonKey: string,
  message: string,
  pending: { proposal: Record<string, unknown>; profile: Profile; approvalStatus: 'pending' | 'approving' },
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const client = createClient({ baseUrl: URL_BASE, anonKey });
  client.setAccessToken(token);

  if (pending.approvalStatus === 'approving') {
    return ok('La rutina ya se está guardando. Espera un momento antes de volver a aprobarla.', corsHeaders);
  }

  const feedback = await handleProposalFeedback(message, userId, pending.proposal, pending.profile, token, anonKey, false) as Record<string, unknown>;

  if (feedback.action === 'approve') {
    const claimed = await claimPendingProposal(userId, client);
    if (!claimed) return ok('La rutina ya se está guardando. Espera un momento.', corsHeaders);
    let id: string;
    try {
      id = await saveRoutineToDb(client, userId, pending.proposal as ApprovedRoutine);
      await deletePendingProposal(userId, client);
    } catch (error) {
      await resetPendingProposalClaim(userId, client);
      throw error;
    }
    return ok([
      '✅ **Rutina guardada correctamente**',
      '',
      `Puedes ver los detalles aquí: [Ver rutina](/routines/${id})`,
      '',
      '¿Necesitas algo más?',
    ].join('\n'), corsHeaders);
  }

  if (feedback.action === 'rename' && feedback.proposal) {
    const updatedProposal = feedback.proposal as Record<string, unknown>;
    const updatedProfile = (feedback.profile as Profile) ?? pending.profile;
    await savePendingProposal(userId, updatedProposal, updatedProfile, client);
    return ok(formatProposalInline(updatedProposal, updatedProfile), corsHeaders);
  }

  if (feedback.action === 'modify' && feedback.proposal) {
    const updatedProposal = feedback.proposal as Record<string, unknown>;
    const updatedProfile = (feedback.profile as Profile) ?? pending.profile;
    await savePendingProposal(userId, updatedProposal, updatedProfile, client);
    return ok(formatProposalInline(updatedProposal, updatedProfile), corsHeaders);
  }

  if (feedback.state === 'profile_ready') {
    const newProfile = feedback.profile as Profile;
    const newProposal = await generateRoutineProposal(newProfile, token, anonKey, message) as Record<string, unknown>;
    await savePendingProposal(userId, newProposal, newProfile, client);
    return ok(formatProposalInline(newProposal, newProfile), corsHeaders);
  }

  if (feedback.action === 'chat') {
    return ok(String(feedback.content ?? 'No entendí. ¿Quieres cambiar algo de la rutina o la guardo?'), corsHeaders);
  }

  return ok(formatProposalInline(pending.proposal, pending.profile), corsHeaders);
}

function formatProposalInline(proposal: Record<string, unknown>, profile: Profile): string {
  const goalLabels: Record<string, string> = {
    strength: 'fuerza', cardio: 'cardio', fat_loss: 'pérdida de grasa', general: 'mantenimiento',
  };

  const lines = [
    `📋 **${(proposal.name as string) ?? 'Rutina'}**`,
    '',
    `Objetivo: ${goalLabels[profile.goal] ?? profile.goal}`,
    `Nivel: ${profile.level}`,
    `Frecuencia: ${profile.daysPerWeek} día(s) por semana`,
    '',
    '**Ejercicios:**',
  ];

  const exercises = (proposal.exercises as Array<Record<string, unknown>>) ?? [];
  for (const [i, ex] of exercises.entries()) {
    const details: string[] = [];
    if (ex.planned_sets != null && ex.planned_repetitions != null) details.push(`${ex.planned_sets}×${ex.planned_repetitions}`);
    if (ex.planned_weight != null) details.push(`${ex.planned_weight}kg`);
    if (ex.planned_duration_seconds != null) details.push(`${Math.round(Number(ex.planned_duration_seconds) / 60)}min`);
    if (ex.planned_distance != null) details.push(`${ex.planned_distance}m`);
    if (ex.rest_seconds != null) details.push(`${ex.rest_seconds}s descanso`);
    const detail = details.length > 0 ? ` — ${details.join(', ')}` : '';
    lines.push(`${i + 1}. **${(ex.exercise_name as string) ?? 'Ejercicio'}**${detail}`);
  }

  lines.push('', '_¿Te parece bien? Puedes cambiar el nombre, los ejercicios o decir "guárdala" cuando estés listo._');
  return lines.join('\n');
}

function ok(body: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ response: body }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
