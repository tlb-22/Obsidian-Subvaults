/** 无需 Obsidian 的 README 图片检查入口，可在本地和 GitHub Actions 中运行。 */
import paths from './project-paths.cjs';
import { checkReadmeImages } from './screenshots/ImageFiles';

checkReadmeImages(paths.project, paths.readmeImages)
  .then(version => console.log(`README screenshots exist for version ${version} and match both language references.`))
  .catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
