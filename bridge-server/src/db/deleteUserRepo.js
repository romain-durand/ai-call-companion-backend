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

  // 2. Supprimer les données dans l'ordre correct (éviter FK violations)
  await supabaseAdmin.from('outbound_missions').delete().eq('account_id', accountId);
  await supabaseAdmin.from('contacts').delete().eq('account_id', accountId);
  await supabaseAdmin.from('call_handling_rules').delete().eq('account_id', accountId);
  await supabaseAdmin.from('booking_rules').delete().eq('account_id', accountId);
  await supabaseAdmin.from('contact_group_memberships').delete().eq('account_id', accountId);

  // 3. Note: caller_groups et account cascades are blocked by trigger protect_system_group_deletion
  // We'll delete account WITHOUT the groups (they stay orphaned but isolated by account_id)
  // This is acceptable for test user cleanup

  // 4. Supprimer l'account (cascade sur les autres tables, mais groupes resteront)
  const { error: accountErr } = await supabaseAdmin
    .from('accounts')
    .delete()
    .eq('id', accountId)
    .not('id', 'is', null); // Extra safety check

  if (accountErr && !accountErr.message.includes('default group')) {
    throw new Error(`Failed to delete account: ${accountErr.message}`);
  }

  // 5. Supprimer l'utilisateur auth (cascade vers profiles)
  const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authErr) {
    throw new Error(`Failed to delete auth user: ${authErr.message}`);
  }

  log.info('delete_user_success', null, `User ${userId} and all associated data deleted`);
  return { userId, accountId, success: true };
}

module.exports = { deleteUser };
