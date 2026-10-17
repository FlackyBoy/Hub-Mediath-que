import net from "node:net";
import { decodeResponse, encodeCall, type XValue } from "./xmlrpc";

// Client rTorrent : XML-RPC sur SCGI (127.0.0.1:41758, le même accès que ruTorrent).

export type TorrentState = "download" | "paused" | "seeding" | "stopped" | "checking" | "error";

export type Torrent = {
  hash: string;
  name: string;
  size: number;
  done: number;
  downRate: number;
  upRate: number;
  complete: boolean;
  state: TorrentState;
  basePath: string;
  directory: string;
  message: string;
  ratio: number;
  finishedAt: number;
  addedAt: number;
  peers: number;
};

function scgiRequest(body: string, timeoutMs = 15000): Promise<string> {
  const host = process.env.RTORRENT_SCGI_HOST || "127.0.0.1";
  const port = Number(process.env.RTORRENT_SCGI_PORT || 41758);
  const payload = Buffer.from(body, "utf8");
  const header = Buffer.from(`CONTENT_LENGTH\u0000${payload.length}\u0000SCGI\u00001\u0000`, "latin1");
  const message = Buffer.concat([Buffer.from(`${header.length}:`), header, Buffer.from(","), payload]);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const socket = net.connect({ host, port });
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error("rTorrent ne répond pas")));
    socket.on("connect", () => socket.end(message));
    socket.on("data", (c) => chunks.push(c));
    socket.on("error", (e) => reject(new Error(`rTorrent injoignable (${(e as NodeJS.ErrnoException).code ?? e.message})`)));
    socket.on("close", (hadError) => {
      if (hadError) return;
      const raw = Buffer.concat(chunks).toString("utf8");
      const sep = raw.indexOf("\r\n\r\n");
      resolve(sep >= 0 ? raw.slice(sep + 4) : raw);
    });
  });
}

export async function call(method: string, ...params: XValue[]): Promise<XValue> {
  return decodeResponse(await scgiRequest(encodeCall(method, params)));
}

const FIELDS = [
  "d.hash=", "d.name=", "d.size_bytes=", "d.completed_bytes=", "d.down.rate=", "d.up.rate=",
  "d.complete=", "d.state=", "d.is_active=", "d.base_path=", "d.directory=", "d.message=",
  "d.ratio=", "d.timestamp.finished=", "d.load_date=", "d.peers_connected=", "d.hashing=",
];

export async function listTorrents(): Promise<Torrent[]> {
  const rows = (await call("d.multicall2", "", "main", ...FIELDS)) as XValue[][];
  return rows.map((r) => {
    const [hash, name, size, done, downRate, upRate, complete, started, active, basePath, directory, message, ratio, finished, loaded, peers, hashing] = r;
    const isComplete = Number(complete) === 1;
    let state: TorrentState;
    if (Number(hashing) > 0) state = "checking";
    else if (message && Number(started) === 1 && !isComplete) state = "error";
    else if (Number(started) === 0) state = "stopped";
    else if (Number(active) === 0) state = "paused";
    else state = isComplete ? "seeding" : "download";
    return {
      hash: String(hash),
      name: String(name),
      size: Number(size),
      done: Number(done),
      downRate: Number(downRate),
      upRate: Number(upRate),
      complete: isComplete,
      state,
      basePath: String(basePath),
      directory: String(directory),
      message: String(message),
      ratio: Number(ratio) / 1000,
      finishedAt: Number(finished) * 1000,
      addedAt: Number(loaded) * 1000,
      peers: Number(peers),
    };
  });
}

// Argument de commande rTorrent entre guillemets (espaces, virgules dans les chemins)
function quoted(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export async function addTorrentFile(data: Buffer, directory: string) {
  await call("load.raw_start", "", data, `d.directory.set=${quoted(directory)}`, "d.custom1.set=Hub");
}

export async function addMagnet(uri: string, directory: string) {
  await call("load.start", "", uri, `d.directory.set=${quoted(directory)}`, "d.custom1.set=Hub");
}

export async function pauseTorrent(hash: string) {
  await call("d.stop", hash);
}

export async function resumeTorrent(hash: string) {
  await call("d.start", hash);
}

// Retire le torrent de rTorrent sans toucher aux fichiers
export async function eraseTorrent(hash: string) {
  await call("d.erase", hash);
}

export function isValidHash(hash: string): boolean {
  return /^[A-F0-9]{40}$/.test(hash);
}
