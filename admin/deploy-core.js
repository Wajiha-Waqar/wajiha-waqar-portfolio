(function (root) {
  'use strict';
  function readToken(storage) {
    try {
      const user = JSON.parse(storage.getItem('decap-cms-user') || 'null');
      return user && typeof user.token === 'string' ? user.token : '';
    } catch (error) {
      return '';
    }
  }
  function parseBackend(text) {
    const repo = String(text).match(/^\s*repo:\s*['"]?([\w.-]+\/[\w.-]+)['"]?\s*$/m);
    const branch = String(text).match(/^\s*branch:\s*['"]?([\w./-]+)['"]?\s*$/m);
    return repo && branch ? { repo: repo[1], branch: branch[1] } : null;
  }
  function computeDeployState({ headSha, liveCommit, statuses = [], headAgeMs = Infinity }) {
    if (headSha && liveCommit === headSha) return { state: 'live', label: 'Live site is up to date', url: '' };
    const deploy = statuses.find((item) => /netlify/i.test(item.context || item.name || ''));
    if (deploy && ['failure', 'error'].includes(deploy.state)) return { state: 'failed', label: 'Deploy failed', url: deploy.target_url || '' };
    if (deploy && deploy.state === 'success') return { state: 'deploying', label: 'Deploying your changes', url: deploy.target_url || '' };
    if (headAgeMs < 15 * 60 * 1000) return { state: 'deploying', label: 'Deploying your changes', url: deploy && deploy.target_url || '' };
    return { state: 'unknown', label: 'Deploy status unavailable', url: '' };
  }
  root.DeployCore = { readToken, parseBackend, computeDeployState };
})(window);
