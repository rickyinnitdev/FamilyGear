function repository(value) {
  const text = (value || '').trim().replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '');
  if (!text) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(text) || text.split('/')[1] === '..') throw new Error('Use a GitHub repository address: owner/repository');
  return text;
}
module.exports = { repository };
