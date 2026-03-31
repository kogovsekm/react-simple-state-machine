const resolve = require("@rollup/plugin-node-resolve").default;
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const { terser } = require("rollup-plugin-terser");

module.exports = {
  input: "src/index.ts",
  external: ["react"],
  output: [
    { file: "dist/bundle.cjs.js", format: "cjs", exports: "named" },
    { file: "dist/bundle.esm.js", format: "es" },
    {
      file: "dist/bundle.umd.js",
      format: "umd",
      name: "ReactSimpleStateMachine",
      globals: {
        react: "React",
      },
      exports: "named",
    },
  ],
  plugins: [
    resolve(),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.rollup.json" }),
    terser(),
  ],
};
