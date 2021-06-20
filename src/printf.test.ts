import { compile } from "./_common.test";
import { formatFromVarargs } from "./printf";
import { MemoryWalker } from "./MemoryWalker";

test("it correctly formats", async () => {
  const expectedOutputs = [
    "Hello?\n",
    "Oh my 2863311530\n",
    "Hello 14th customer\n",
    "Hello world.\n",
  ][Symbol.iterator]();
  const { exports, memory } = await compile<{
    main(): void;
  }>(
    `
    void printf(char const* ptrToFmt, ...);
    __attribute__((visibility("default"))) int main(void) {
      printf("Hello%c\\n", '?');
      printf("Oh my %lu\\n", 0xAAAAAAAAlu);
      printf("Hello %dth customer\\n", (short) 14);
      printf("Hello %s%c\\n", "world", '.');
    }
  `,
    {
      printf(ptrToFmt: number, ptrToVarargBuf: number) {
        console.log("char* fmt", ptrToFmt, "*varargBuf", ptrToVarargBuf);
        expect(
          formatFromVarargs(
            new MemoryWalker(memory.buffer, ptrToFmt),
            new MemoryWalker(memory.buffer, ptrToVarargBuf)
          )
        ).toStrictEqual(expectedOutputs.next().value);
      },
    },
    2
  );
  exports.main();
});
