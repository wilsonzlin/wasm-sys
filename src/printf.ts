import { MemoryWalker } from "./MemoryWalker";

const SPECIFIER_PARSERS: {
  length: Set<string>;
  type: Set<string>;
  parse: (mem: MemoryWalker) => number | bigint | string;
}[] = [
  {
    length: new Set(["hh", "h", "l", "z", "t", ""]),
    type: new Set("dic"),
    parse: (mem) => mem.readInt32LE(),
  },
  {
    length: new Set(["hh", "h", "l", "z", "t", ""]),
    type: new Set("uxXop"),
    parse: (mem) => mem.readUInt32LE(),
  },
  {
    length: new Set(["ll", "j"]),
    type: new Set("di"),
    parse: (mem) => mem.readInt64LE(),
  },
  {
    length: new Set(["ll", "j"]),
    type: new Set("uxXop"),
    parse: (mem) => mem.readUInt64LE(),
  },
  {
    length: new Set(["L", ""]),
    type: new Set("fFeEgGaA"),
    parse: (mem) => mem.readDoubleLE(),
  },
  {
    length: new Set(),
    type: new Set("s"),
    parse: (mem) => mem.readAndDereferencePointer().readNullTerminatedString(),
  },
  { length: new Set(), type: new Set("%"), parse: () => "%" },
];

const SPECIFIER_FORMATTERS: any = {
  "%": () => "%",
  d: (val: number | bigint) => val.toString(),
  i: (val: number | bigint) => val.toString(),
  u: (val: number | bigint) => val.toString(),
  f: (val: number) =>
    val.toLocaleString("fullwide", {
      useGrouping: false,
      maximumFractionDigits: 20,
    }),
  F: (val: number) =>
    val
      .toLocaleString("fullwide", {
        useGrouping: false,
        maximumFractionDigits: 20,
      })
      .toUpperCase(),
  e: (val: number) => val.toExponential(2),
  E: (val: number) => val.toExponential(2).toUpperCase(),
  g: (val: number) => val.toString(),
  G: (val: number) => val.toString().toUpperCase(),
  x: (val: number | bigint) => val.toString(16),
  X: (val: number | bigint) => val.toString(16).toUpperCase(),
  o: (val: number | bigint) => val.toString(8),
  s: (val: string) => val,
  c: (val: number) => String.fromCharCode(val),
  p: (val: number | bigint) => val.toString(16),
  a: (val: number) => val.toString(16),
  A: (val: number) => val.toString(16).toUpperCase(),
};

export const formatFromVarargs = (mem: MemoryWalker): string =>
  mem
    .readAndDereferencePointer()
    .readNullTerminatedString()
    .replace(
      /%([-+ 0'#]*)([0-9]+|\*)?(\.[0-9]+|\.\*)?(hh|h|l|ll|L|z|j|t|I|I32|I64|q)?([%diufFeEgGxXoscpaA])/g,
      (spec, flags, width, precision, length = "", type) => {
        // These aren't used in our C code right now but we can implement later on if we do.
        if (flags || width || precision) {
          throw new Error(`Unsupported format specifier "${spec}"`);
        }

        const parser = SPECIFIER_PARSERS.find(
          (p) => p.length.has(length) && p.type.has(type)
        );
        if (!parser) {
          throw new SyntaxError(`Invalid format specifier "${spec}"`);
        }
        const rawValue = parser.parse(mem);

        return SPECIFIER_FORMATTERS[type](rawValue);
      }
    );
