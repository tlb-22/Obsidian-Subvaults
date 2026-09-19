/** 开发目录的唯一定位入口；路径随本模块所在的项目移动，供 Node 脚本和宿主验收共用。 */
const { resolve, join } = require('node:path');
const project = resolve(__dirname, '..');
module.exports = {
  project,
  dist: join(project, 'dist'),
  debugVault: join(project, 'TestVaults', 'Debug-Vault'),
  screenshotVault: join(project, 'TestVaults', 'Debug-Screenshot-Vault'),
  readmeImages: join(project, '.docs', 'images'),
  artifacts: join(project, '.artifacts'),
  scratch: join(project, '.artifacts', 'scratch'),
};
