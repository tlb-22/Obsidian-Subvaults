/** 跨 ESM、CommonJS 与 TypeScript 开发入口共享的目录类型。 */
declare const paths: {
  readonly project: string;
  readonly dist: string;
  readonly debugVault: string;
  readonly screenshotVault: string;
  readonly readmeImages: string;
  readonly artifacts: string;
  readonly scratch: string;
};
export = paths;
