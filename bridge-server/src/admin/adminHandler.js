const { deleteUser } = require('../db/deleteUserRepo');
const log = require('../observability/logger');

async function handleDeleteUser(req, res, userId) {
  try {
    const result = await deleteUser(userId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    log.error('delete_user_error', null, err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

module.exports = { handleDeleteUser };
