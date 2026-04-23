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

  // 2. Vérifier si d'autres membres partagent cet account
  const { data: otherMembers } = await supabaseAdmin
    .from('account_members')
    .select('profile_id')
    .eq('account_id', accountId)
    .neq('profile_id', userId);

  const hasOtherMembers = otherMembers && otherMembers.length > 0;

  if (!hasOtherMembers) {
    // 3a. Seul membre → supprimer les données de l'account puis l'account
    await supabaseAdmin.from('outbound_missions').delete().eq('account_id', accountId);
    await supabaseAdmin.from('contacts').delete().eq('account_id', accountId);
    await supabaseAdmin.from('call_handling_rules').delete().eq('account_id', accountId);
    await supabaseAdmin.from('booking_rules').delete().eq('account_id', accountId);
    await supabaseAdmin.from('contact_group_memberships').delete().eq('account_id', accountId);

    // Note: caller_groups stay orphaned but isolated by account_id (protected by trigger)
    const { error: accountErr } = await supabaseAdmin
      .from('accounts')
      .delete()
      .eq('id', accountId)
      .not('id', 'is', null);

    if (accountErr && !accountErr.message.includes('default group')) {
      throw new Error(`Failed to delete account: ${accountErr.message}`);
    }
  } else {
    // 3b. Autres membres → retirer seulement la membership
    await supabaseAdmin
      .from('account_members')
      .delete()
      .eq('profile_id', userId)
      .eq('account_id', accountId);
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
