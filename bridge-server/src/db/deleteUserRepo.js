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

  // 2. Supprimer outbound_missions (FK sans ON DELETE CASCADE)
  const { error: missionsErr } = await supabaseAdmin
    .from('outbound_missions')
    .delete()
    .eq('account_id', accountId);

  if (missionsErr) {
    throw new Error(`Failed to delete outbound_missions: ${missionsErr.message}`);
  }

  // 3. Supprimer les contacts (pour que les groupes puissent être supprimés)
  await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('account_id', accountId);

  // 4. Supprimer les call_handling_rules (référencent les groupes)
  await supabaseAdmin
    .from('call_handling_rules')
    .delete()
    .eq('account_id', accountId);

  // 5. Supprimer les booking_rules (référencent les groupes)
  await supabaseAdmin
    .from('booking_rules')
    .delete()
    .eq('account_id', accountId);

  // 6. Supprimer les contact_group_memberships (référencent les groupes)
  await supabaseAdmin
    .from('contact_group_memberships')
    .delete()
    .eq('account_id', accountId);

  // 7. Supprimer les caller_groups explicitement (bypass le trigger en les vidant d'abord)
  await supabaseAdmin
    .from('caller_groups')
    .delete()
    .eq('account_id', accountId);

  // 8. Supprimer l'account (cascade automatique sur ~25 tables)
  const { error: accountErr } = await supabaseAdmin
    .from('accounts')
    .delete()
    .eq('id', accountId);

  if (accountErr) {
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
