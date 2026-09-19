/** 为同次开发任务分配带 UTC 时间、用途和进程号的分类目录；现有运行目录不覆盖。 */
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { scratch } = require('./project-paths.cjs');

module.exports = (purpose, categories) => {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace('.', '-').replace('Z', '');
  const name = `${timestamp}-${purpose}-${process.pid}`;
  const directories = {};
  for (const category of categories) {
    const parent = join(scratch, category);
    mkdirSync(parent, { recursive: true });
    const directory = join(parent, name);
    mkdirSync(directory);
    directories[category] = directory;
  }
  return { name, directories };
};
