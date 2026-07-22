import { createClient } from 'npm:@insforge/sdk';
import type { Profile } from './schemas.ts';

type InsForgeClient = ReturnType<typeof createClient>;

export async function loadUserProfile(
  userId: string,
  client: InsForgeClient,
): Promise<Profile | null> {
  const { data, error } = await client.database
    .from('user_profiles')
    .select('age, weight_kg, goal, level, days_per_week')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(formatSdkError(error));
  if (!data) return null;
  return {
    age: data.age as number,
    weightKg: Number(data.weight_kg),
    goal: data.goal as Profile['goal'],
    level: data.level as Profile['level'],
    daysPerWeek: data.days_per_week as number,
  };
}

export async function saveUserProfile(
  userId: string,
  profile: Profile,
  client: InsForgeClient,
): Promise<void> {
  const { error } = await client.database
    .from('user_profiles')
    .upsert({
      user_id: userId,
      age: profile.age,
      weight_kg: profile.weightKg,
      goal: profile.goal,
      level: profile.level,
      days_per_week: profile.daysPerWeek,
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(formatSdkError(error));
}

export async function savePendingProposal(
  userId: string,
  proposal: Record<string, unknown>,
  profile: Profile,
  client: InsForgeClient,
): Promise<void> {
  const payload = {
    proposal: JSON.stringify(proposal),
    profile: JSON.stringify(profile),
    updated_at: new Date().toISOString(),
  };
  const { data: updated, error: updateError } = await client.database
    .from('pending_proposals')
    .update(payload)
    .eq('user_id', userId)
    .select('user_id');
  if (updateError) throw new Error(formatSdkError(updateError));
  if (updated && updated.length > 0) return;

  const { error: insertError } = await client.database
    .from('pending_proposals')
    .insert([{ user_id: userId, ...payload }]);
  if (insertError) throw new Error(formatSdkError(insertError));
}

export async function loadPendingProposal(
  userId: string,
  client: InsForgeClient,
): Promise<{ proposal: Record<string, unknown>; profile: Profile; approvalStatus: 'pending' | 'approving' } | null> {
  const { data, error } = await client.database
    .from('pending_proposals')
    .select('proposal, profile, approval_status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(formatSdkError(error));
  if (!data) return null;
  return {
    proposal: typeof data.proposal === 'string' ? JSON.parse(data.proposal) : data.proposal,
    profile: typeof data.profile === 'string' ? JSON.parse(data.profile) : data.profile,
    approvalStatus: data.approval_status as 'pending' | 'approving',
  };
}

export async function claimPendingProposal(userId: string, client: InsForgeClient): Promise<boolean> {
  const { data, error } = await client.database
    .from('pending_proposals')
    .update({ approval_status: 'approving' })
    .eq('user_id', userId)
    .eq('approval_status', 'pending')
    .select('user_id');
  if (error) throw new Error(formatSdkError(error));
  return Boolean(data?.length);
}

export async function resetPendingProposalClaim(userId: string, client: InsForgeClient): Promise<void> {
  const { error } = await client.database
    .from('pending_proposals')
    .update({ approval_status: 'pending' })
    .eq('user_id', userId)
    .eq('approval_status', 'approving');
  if (error) throw new Error(formatSdkError(error));
}

export async function deletePendingProposal(
  userId: string,
  client: InsForgeClient,
): Promise<void> {
  const { error } = await client.database.from('pending_proposals').delete().eq('user_id', userId);
  if (error) throw new Error(formatSdkError(error));
}

export async function saveProfileDraft(
  userId: string,
  profile: Record<string, unknown>,
  client: InsForgeClient,
): Promise<void> {
  const { error } = await client.database
    .from('profile_drafts')
    .upsert({
      user_id: userId,
      profile: JSON.stringify(profile),
      updated_at: new Date().toISOString(),
    });
  if (error) throw new Error(formatSdkError(error));
}

export async function loadProfileDraft(
  userId: string,
  client: InsForgeClient,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await client.database
    .from('profile_drafts')
    .select('profile')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(formatSdkError(error));
  if (!data) return null;
  return typeof data.profile === 'string' ? JSON.parse(data.profile) : data.profile;
}

export async function deleteProfileDraft(
  userId: string,
  client: InsForgeClient,
): Promise<void> {
  const { error } = await client.database.from('profile_drafts').delete().eq('user_id', userId);
  if (error) throw new Error(formatSdkError(error));
}

function formatSdkError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
