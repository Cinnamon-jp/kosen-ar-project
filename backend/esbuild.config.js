import * as esbuild from "esbuild";
import pkg from "./package.json" with { type: "json" };


await esbuild.build({
    entryPoints: [
        "src/index.js",
    ],
    outfile: "main.js",
    // outDir: "",
    external: Object.keys(pkg.dependencies || {}), // 依存関係のバンドルの除外 (必要に応じてコメントアウト)
    // outExtension: { ".js": ".mjs" }, // 出力ファイルの拡張子の変更
    format: "esm",
    splitting: false, // ファイルの分割出力 (trueにした場合、outDirを指定する必要あり)
    platform: "node",
    bundle: true,
    minify: true,
    keepNames: false,
    sourcemap: false,
    tsconfig: "./tsconfig.json",
    target: "esNext",
    charset: "utf8",
    logLevel: "info",
});