import { spawn } from "child_process";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";

export const byteHex = (b: number) => b.toString(16).padStart(2, "0");

export const compile = async <Exports extends WebAssembly.Exports>(
  code: string,
  imports: {
    [name: string]: Function;
  } = {},
  memoryPages: number = 1024
): Promise<{
  instance: WebAssembly.Instance;
  exports: Exports;
  module: WebAssembly.Module;
  memory: WebAssembly.Memory;
}> => {
  const tmpOut = `/tmp/wasmsystestmw${crypto.randomBytes(16).toString("hex")}`;
  const tmpSrc = `${tmpOut}.c`;
  await writeFile(tmpSrc, code);
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(
      "clang",
      [
        "-std=c17",
        "-O0",
        "-Wall",
        "-Wextra",
        "-Werror",
        "--target=wasm32-unknown-unknown-wasm",
        "-nostdlib",
        "-nostdinc",
        "-isystemstubs",
        // Prevent optimising from/to functions that don't exist e.g. printf => puts/putchar.
        "-fno-builtin",
        // Needed for import function declarations.
        "-Wl,--allow-undefined",
        "-Wl,--import-memory",
        "-Wl,--export-dynamic",
        "-Wl,--no-entry",
        "-Wl,--strip-all",
        tmpSrc,
        "-o",
        tmpOut,
      ],
      {
        stdio: "inherit",
      }
    );
    proc.on("error", reject);
    proc.on("exit", (status, signal) => {
      if (status || signal) {
        reject(
          new Error(
            `Failed to compile with ${JSON.stringify({ status, signal })}`
          )
        );
      } else {
        resolve();
      }
    });
  });
  const bin = await readFile(tmpOut);
  const memory = new WebAssembly.Memory({ initial: memoryPages });
  const { instance, module } = await WebAssembly.instantiate(bin, {
    env: {
      ...imports,
      memory,
    },
  });
  return { instance, module, exports: instance.exports as Exports, memory };
};
