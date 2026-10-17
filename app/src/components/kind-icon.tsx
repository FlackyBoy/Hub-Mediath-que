import type { EntryKind } from "@/lib/files";
import {
  ArchiveIcon,
  BookIcon,
  DiscIcon,
  FileIcon,
  FilmIcon,
  FolderIcon,
  ImageIcon,
  MusicIcon,
} from "./icons";

const ICONS: Record<EntryKind, (p: { className?: string }) => React.ReactNode> = {
  dir: FolderIcon,
  video: FilmIcon,
  audio: MusicIcon,
  image: ImageIcon,
  book: BookIcon,
  archive: ArchiveIcon,
  software: DiscIcon,
  subtitle: FileIcon,
  text: FileIcon,
  other: FileIcon,
};

export function KindIcon({ kind, className }: { kind: EntryKind; className?: string }) {
  const Icon = ICONS[kind];
  return <Icon className={className} />;
}
