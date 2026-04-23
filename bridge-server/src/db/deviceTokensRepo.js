const { supabaseAdmin } = require('./supabaseAdmin');

async function upsertDeviceToken(profileId, token, platform) {
  const { error } = await supabaseAdmin
    .from('device_tokens')
    .upsert({ profile_id: profileId, token, platform }, { onConflict: 'profile_id,token' });
  if (error) throw new Error(error.message);
}

async function getTokensForProfile(profileId) {
  const { data, error } = await supabaseAdmin
    .from('device_tokens')
    .select('token, platform')
    .eq('profile_id', profileId);
  if (error) throw new Error(error.message);
  return data || [];
}

module.exports = { upsertDeviceToken, getTokensForProfile };
