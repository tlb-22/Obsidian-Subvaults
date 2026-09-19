/** 验收入口只接受同一项目中的 Debug-Vault。 */
const { realpathSync } = require('node:fs');
const paths = require('../../scripts/project-paths.cjs');
module.exports = app => {
  if (realpathSync(app.vault.adapter.getBasePath()) !== realpathSync(paths.debugVault)) throw new Error('Expected the project Debug-Vault');
  return paths.project;
};
