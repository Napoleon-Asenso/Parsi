#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULTS = {
  input: join(__dirname, "matisse-tokens-all.json"),
  output: null,
  prefix: "--",
  defaultTheme: "light",
  themeFormat: '[data-theme="%s"]',
  pretty: true,
};

const HELP = `Usage: node tokens-to-css.mjs [options]

Options:
  -i, --input <file>       Path to the tokens JSON file.
                           Default: <script-dir>/matisse-tokens-all.json
  -o, --output <file>      Where to write the generated CSS.
                           Default: "<input basename>.css" next to the input.
  -p, --prefix <prefix>    Prefix for every custom property name. Default: "--"
  -d, --default-theme <t>  Theme treated as the default (:root). Default: "light"
  -s, --selector <t>       CSS selector used for the default theme's variables.
                           Default: "root" (means :root). Pass the literal other
                           themes use via --theme-format.
  --theme-format <fmt>     printf-style template for non-default theme selectors.
                           Use %s for the theme name. Default: '[data-theme="%s"]'
  --pretty / --no-pretty   Toggle indentation/newlines. Default: pretty
  -h, --help               Show this help.
`;

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        console.log(HELP);
        process.exit(0);
      case "-i":
      case "--input":
        opts.input = argv[++i];
        break;
      case "-o":
      case "--output":
        opts.output = argv[++i];
        break;
      case "-p":
      case "--prefix":
        opts.prefix = argv[++i];
        break;
      case "-d":
      case "--default-theme":
        opts.defaultTheme = argv[++i];
        break;
      case "-s":
      case "--selector":
        opts.rootSelector = argv[++i];
        break;
      case "--theme-format":
        opts.themeFormat = argv[++i];
        break;
      case "--pretty":
        opts.pretty = true;
        break;
      case "--no-pretty":
        opts.pretty = false;
        break;
      default:
        if (a.startsWith("--") || a.startsWith("-")) {
          console.error(`Unknown option: ${a}\n${HELP}`);
          process.exit(1);
        }
        opts.input = a;
    }
  }
  if (opts.rootSelector === undefined) opts.rootSelector = ":root";
  if (!opts.output) {
    const dir = dirname(opts.input);
    const base = basename(opts.input).replace(/\.json$/i, "");
    opts.output = join(dir, `${base}.css`);
  }
  return opts;
}

function isLeaf(value) {
  return typeof value !== "object" || value === null;
}

function kebabize(part) {
  return String(part)
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();
}

function properties(obj, prefix, propPrefix) {
  const props = [];
  for (const [key, value] of Object.entries(obj)) {
    const name = `${propPrefix}-${kebabize(key)}`;
    if (isLeaf(value)) {
      props.push(`${prefix}${name}: ${value};`);
    } else {
      props.push(...properties(value, prefix, name));
    }
  }
  return props;
}

function block(selector, props, pretty) {
  if (props.length === 0) return "";
  if (!pretty) return `${selector}{${props.join("")}}`;
  const body = props.map((p) => `  ${p}`).join("\n");
  return `${selector} {\n${body}\n}`;
}

function isThemeGroup(category) {
  const values = Object.values(category);
  return values.some((v) => !isLeaf(v));
}

function build(tokens, opts) {
  const pretty = opts.pretty;
  const nl = pretty ? "\n" : "";
  const out = [];
  const defaultThemeProps = [];
  const otherThemeProps = new Map();

  for (const [category, value] of Object.entries(tokens)) {
    const categoryName = kebabize(category);

    if (isThemeGroup(value)) {
      const groupPrefix = opts.prefix + categoryName;
      for (const [theme, themeValue] of Object.entries(value)) {
        if (!isLeaf(themeValue)) {
          const props = properties(themeValue, groupPrefix, "");
          if (theme === opts.defaultTheme) {
            defaultThemeProps.push(...props);
          } else {
            if (!otherThemeProps.has(theme)) otherThemeProps.set(theme, []);
            otherThemeProps.get(theme).push(...props);
          }
        }
      }
    } else {
      defaultThemeProps.push(...properties(value, opts.prefix, categoryName));
    }
  }

  out.push(block(opts.rootSelector, defaultThemeProps, pretty));
  for (const [theme, props] of otherThemeProps) {
    const selector = opts.themeFormat.replace("%s", theme);
    out.push(block(selector, props, pretty));
  }

  return out.filter(Boolean).join(nl + nl) + nl;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const tokens = JSON.parse(readFileSync(opts.input, "utf8"));
  const css = build(tokens, opts);
  writeFileSync(opts.output, css, "utf8");
  console.error(`Wrote ${opts.output} (${css.length} bytes)`);
}

main();