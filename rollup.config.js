import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import { terser } from "rollup-plugin-terser";

export default {
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
