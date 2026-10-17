// Encodeur / décodeur XML-RPC minimal (types utilisés par rTorrent).

export type XValue = string | number | boolean | Buffer | XValue[] | { [key: string]: XValue };

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function encodeValue(v: XValue): string {
  if (typeof v === "string") return `<string>${escape(v)}</string>`;
  if (typeof v === "boolean") return `<boolean>${v ? 1 : 0}</boolean>`;
  if (typeof v === "number") {
    if (!Number.isInteger(v)) return `<double>${v}</double>`;
    return Math.abs(v) < 2 ** 31 ? `<i4>${v}</i4>` : `<i8>${v}</i8>`;
  }
  if (Buffer.isBuffer(v)) return `<base64>${v.toString("base64")}</base64>`;
  if (Array.isArray(v)) return `<array><data>${v.map((x) => `<value>${encodeValue(x)}</value>`).join("")}</data></array>`;
  const members = Object.entries(v)
    .map(([k, x]) => `<member><name>${escape(k)}</name><value>${encodeValue(x)}</value></member>`)
    .join("");
  return `<struct>${members}</struct>`;
}

export function encodeCall(method: string, params: XValue[]): string {
  const p = params.map((x) => `<param><value>${encodeValue(x)}</value></param>`).join("");
  return `<?xml version="1.0"?><methodCall><methodName>${escape(method)}</methodName><params>${p}</params></methodCall>`;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

type Token = { tag?: string; close?: boolean; selfClose?: boolean; text?: string };

function tokenize(xml: string): Token[] {
  const tokens: Token[] = [];
  const re = /<\?[^>]*\?>|<(\/?)([a-zA-Z0-9._-]+)[^>]*?(\/?)>|([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    if (m[2]) tokens.push({ tag: m[2], close: m[1] === "/", selfClose: m[3] === "/" });
    else if (m[4] !== undefined) tokens.push({ text: m[4] });
  }
  return tokens;
}

export class XmlRpcFault extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

export function decodeResponse(xml: string): XValue {
  const tokens = tokenize(xml);
  let i = 0;

  const skipText = () => {
    while (tokens[i]?.text !== undefined && !tokens[i].text!.trim()) i++;
  };
  const expectOpen = (tag: string) => {
    skipText();
    const t = tokens[i++];
    if (t?.tag !== tag || t.close) throw new Error(`XML-RPC : <${tag}> attendu`);
    return t;
  };
  const expectClose = (tag: string) => {
    skipText();
    const t = tokens[i++];
    if (t?.tag !== tag || !t.close) throw new Error(`XML-RPC : </${tag}> attendu`);
  };
  const readText = (tag: string): string => {
    let text = "";
    while (tokens[i] && !(tokens[i].tag === tag && tokens[i].close)) text += tokens[i++].text ?? "";
    i++;
    return decodeEntities(text);
  };

  function parseValue(): XValue {
    const open = expectOpen("value");
    if (open.selfClose) return "";
    // <value>texte</value> sans type = chaîne
    if (tokens[i]?.text !== undefined && tokens[i + 1]?.tag === "value" && tokens[i + 1].close) {
      const s = decodeEntities(tokens[i].text!);
      i += 2;
      return s;
    }
    skipText();
    if (tokens[i]?.tag === "value" && tokens[i].close) {
      i++;
      return "";
    }
    const t = tokens[i++];
    let result: XValue;
    if (t.selfClose) result = t.tag === "array" ? [] : "";
    else
      switch (t.tag) {
        case "string":
          result = readText("string");
          break;
        case "i4":
        case "i8":
        case "int":
          result = Number(readText(t.tag));
          break;
        case "double":
          result = Number(readText("double"));
          break;
        case "boolean":
          result = readText("boolean").trim() === "1";
          break;
        case "base64":
          result = Buffer.from(readText("base64"), "base64");
          break;
        case "nil":
          result = "";
          break;
        case "array": {
          const arr: XValue[] = [];
          expectOpen("data");
          for (;;) {
            skipText();
            if (tokens[i]?.tag === "data" && tokens[i].close) break;
            arr.push(parseValue());
          }
          expectClose("data");
          expectClose("array");
          result = arr;
          break;
        }
        case "struct": {
          const obj: { [key: string]: XValue } = {};
          for (;;) {
            skipText();
            if (tokens[i]?.tag === "struct" && tokens[i].close) break;
            expectOpen("member");
            expectOpen("name");
            const name = readText("name");
            obj[name] = parseValue();
            expectClose("member");
          }
          expectClose("struct");
          result = obj;
          break;
        }
        default:
          throw new Error(`XML-RPC : type inconnu ${t.tag}`);
      }
    expectClose("value");
    return result;
  }

  expectOpen("methodResponse");
  skipText();
  if (tokens[i]?.tag === "fault") {
    i++;
    const fault = parseValue() as { faultCode?: number; faultString?: string };
    throw new XmlRpcFault(Number(fault.faultCode ?? 0), String(fault.faultString ?? "Erreur XML-RPC"));
  }
  expectOpen("params");
  expectOpen("param");
  return parseValue();
}
