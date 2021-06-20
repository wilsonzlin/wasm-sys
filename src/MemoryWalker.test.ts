import { byteHex, compile } from "./_common.test";

test("WASM grows stack upwards, starting from __heap_base; within each frame, the layout is [last var, first arg] as [smallest addr, biggest addr]", async () => {
  let lastPtr = Infinity;
  const { exports } = await compile<{
    main(): number;
  }>(
    `
    extern unsigned char __heap_base;
    void on_fn(void* arg1, void* arg2, void* var1, void* var2);
    void on_init(void* heap_base);
    void fn(int i, int j) {
      int k = 30;
      int l = 40;
      if (i > 0) {
        on_fn(&i, &j, &k, &l);
        fn(i - 1, j);
      }
    }
    __attribute__((visibility("default"))) int main(void) {
      on_init((void*) &__heap_base);
      fn(2, 20);
    }
  `,
    {
      on_fn(
        ptrArg1: number,
        ptrArg2: number,
        ptrVar1: number,
        ptrVar2: number
      ) {
        console.log("Received from fn", ptrArg1, ptrArg2, ptrVar1, ptrVar2);
        expect(ptrArg1).toBeLessThan(lastPtr);
        expect(ptrArg1).toBeGreaterThan(ptrArg2);
        expect(ptrArg2).toBeGreaterThan(ptrVar1);
        expect(ptrVar1).toBeGreaterThan(ptrVar2);
        lastPtr = ptrVar2;
      },
      on_init(ptrHeapBase: number) {
        console.log("heap_base", ptrHeapBase);
        lastPtr = ptrHeapBase;
      },
    }
  );
  exports.main();
});

test("WASM stores static data starting from addr 1024", async () => {
  const { exports } = await compile<{
    main(): number;
  }>(
    `
    char const* A_STRING = "chars: 10"; // If including NUL terminator.
    char const* B_STRING = "01 :srahc"; // If identical, compiler will optimise away.
    void on_init(char const* a, char const* b);
    __attribute__((visibility("default"))) int main(void) {
      on_init(A_STRING, B_STRING);
    }
  `,
    {
      on_init(ptrA: number, ptrB: number) {
        console.log("*A_STRING", ptrA, "*B_STRING", ptrB);
        expect(ptrA).toStrictEqual(1024);
        expect(ptrB).toStrictEqual(1034);
      },
    }
  );
  exports.main();
});

test("WASM args and varargs layout", async () => {
  /*
     SUMMARY:
     - Lowest address: first stack variable.
     - Next:           non-variadic arguments, aligned with padding, pushed upwards from last to first.
     - Next:           variadic arguments, promoted to long, aligned with padding, pushed downwards from first to last.
     Definition of push: set value to next address **in push direction** where address is multiple of value size.
       - Order of values pushed and the push direction are significant, as they determine which bytes are skipped as padding.
   */
  const { exports, memory } = await compile<{
    main(): number;
  }>(
    `
    void on_vararg(void* ptr);
    void on_frame(void* ptr);
    void varfn(char a1, short a2, char a3, char a4, long a5, long long a6, ...) {
      int stackVar1 = 0xCAFEB0BA;
      (void) a2;
      (void) a3;
      (void) a4;
      (void) a5;
      (void) a6;
      (void) stackVar1;
      on_vararg((void*) (&a1 + sizeof(a1)));
      on_frame((void*) &stackVar1);
    }
    __attribute__((visibility("default"))) int main(void) {
      int m1 = 0x8BADF00D;
      (void) m1;
      varfn(
        (char) 0x11, (short) 0xf1f0, (char) 0x13, (char) 0x17, 0x19990119l, 0x1234567890ABCDEFll, 
        (char) 0x19, (short) 0xf3f3, (char) 0x23, (char) 0x29, "va1",       0xDEADBEEFDEADBEEFll
      );
    }
  `,
    {
      on_vararg(ptrVarargStart: number) {
        console.log("*...", ptrVarargStart);
        // prettier-ignore
        const expectedMemory = [
          // va1 (signed char promoted to int).
          0x19, 0x00, 0x00, 0x00,
          // va2 (signed short promoted to int).
          0xF3, 0xF3, 0xFF, 0xFF,
          // va3 (signed char promoted to int).
          0x23, 0x00, 0x00, 0x00,
          // va4 (signed char promoted to int).
          0x29, 0x00, 0x00, 0x00,
          // va5 (char const* to static).
          0x00, 0x04, 0x00, 0x00,
          // Alignment padding.
          0x00, 0x00, 0x00, 0x00,
          // va6.
          0xEF, 0xBE, 0xAD, 0xDE, 0xEF, 0xBE, 0xAD, 0xDE
        ];
        const actualMemory = [
          ...new Uint8Array(
            memory.buffer,
            ptrVarargStart,
            expectedMemory.length
          ),
        ].map(byteHex);
        expect(actualMemory).toEqual(expectedMemory.map(byteHex));
      },
      on_frame(ptrStackVar1: number) {
        console.log("*ptrStackVar1", ptrStackVar1);
        // prettier-ignore
        const expectedMemory = [
          // stackVar1.
          0xBA, 0xB0, 0xFE, 0xCA,
          // a6.
          0xEF, 0xCD, 0xAB, 0x90, 0x78, 0x56, 0x34, 0x12,
          // Alignment padding.
          0x00, 0x00, 0x00, 0x00,
          // a5.
          0x19, 0x01, 0x99, 0x19,
          // Alignment padding.
          0x00, 0x00,
          // a4.
          0x17,
          // a3.
          0x13,
          // a2,
          0xf0, 0xf1,
          // Alignment padding.
          0x00,
          // a1.
          0x11
        ];
        const actualMemory = [
          ...new Uint8Array(memory.buffer, ptrStackVar1, expectedMemory.length),
        ].map(byteHex);
        expect(actualMemory).toEqual(expectedMemory.map(byteHex));
      },
    },
    2
  );
  exports.main();
});
