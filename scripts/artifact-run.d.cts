/** 分类由调用方按需选择，同次任务共享运行名称。 */
type ArtifactCategory = 'logs' | 'tests' | 'probes' | 'previews';
declare function createArtifactRun<Category extends ArtifactCategory>(purpose: string, categories: readonly Category[]): {
  readonly name: string;
  readonly directories: Readonly<Record<Category, string>>;
};
export = createArtifactRun;
