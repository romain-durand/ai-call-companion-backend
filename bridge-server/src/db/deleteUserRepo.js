const { supabaseAdmin } = require('./supabaseAdmin');
const log = require('../observability/logger');

async function deleteUser(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  // 1. Récupérer l'account_id par défaut de l'utilisateur
  const { data: membership, error: membershipErr } = await supabaseAdmin
    .from('account_members')
    .select('account_id')
    .eq('profile_id', userId)
    .eq('is_default_account', true)
    .single();

  if (membershipErr || !membership) {
    throw new Error(`No default account found for user ${userId}`);
  }

  const accountId = membership.account_id;

  // 2. Supprimer la membership de l'utilisateur
  await supabaseAdmin
    .from('account_members')
    .delete()
    .eq('profile_id', userId)
    .eq('account_id', accountId);

  // 3. Supprimer l'account et ses données si plus de membres (via RPC)
  const { error: accountErr } = await supabaseAdmin.rpc('delete_account_and_data', { account_id: accountId });
  if (accountErr) {
    log.error('delete_account_error', null, `Failed to delete account: ${accountErr.message}`);
  } else {
    log.info('account_deleted', null, `Account ${accountId} and related data deleted if no other members`);
  }

  // 4. Supprimer le profile explicitement via RPC (problème avec .delete().eq() sur Supabase)
  const { error: profileErr } = await supabaseAdmin.rpc('delete_profile_by_id', { profile_id: userId });
  if (profileErr) {
    log.error('delete_profile_error', null, `Failed to delete profile via RPC: ${profileErr.message}`);
  } else {
    log.info('profile_deleted', null, `Profile ${userId} deleted via RPC`);
  }

  // 5. Supprimer l'utilisateur auth
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authErr) {
    throw new Error(`Failed to delete auth user: ${authErr.message}`);
  }

  log.info('delete_user_success', null, `User ${userId} and all associated data deleted`);
  return { userId, accountId, success: true };
}

module.exports = { deleteUser };
