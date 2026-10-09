export const FOLDERS_TO_HIDE = ["outbox", "newsletter", "notification", "snoozed"];

export const FOLDER_ORDER: string[] = [
  "inbox",
  "sent",
  "drafts",
  "spam",
  "archive",
  "templates",
  "trash",
  "receipts",
  "recibos",
];

export const FOLDER_LABELS_PT: Record<string, string> = {
  inbox: "Caixa de entrada",
  sent: "Enviados",
  drafts: "Rascunhos",
  templates: "Modelos",
  archive: "Arquivado",
  archived: "Arquivado",
  trash: "Lixeira",
  spam: "Spam",
  receipts: "Recibos",
  recibos: "Recibos",
};

export const HIGHLIGHTED_SENDERS_STORAGE_KEY = "admin-email-highlighted-senders";

export interface EmailFolderRecord {
  folderId: string;
  folderName: string;
  unreadCount?: number;
  totalCount?: number;
}

export function getSenderKey(
  msg: { fromAddress?: { emailAddress?: string; displayName?: string } } | null,
): string {
  if (!msg?.fromAddress) return "";
  const email = msg.fromAddress.emailAddress?.trim();
  const name = msg.fromAddress.displayName?.trim();
  return (email ?? name ?? "").trim();
}

export function normalizeFolderKey(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

export function isInboxFolder(name: string): boolean {
  const key = normalizeFolderKey(name);
  return key === "inbox" || key.includes("entrada");
}

export function getFolderLabelPt(name: string): string {
  const key = normalizeFolderKey(name);
  return FOLDER_LABELS_PT[key] ?? name;
}

export function isEmailFolderLike(item: unknown): item is EmailFolderRecord {
  return (
    item != null &&
    typeof item === "object" &&
    typeof (item as EmailFolderRecord).folderId === "string" &&
    typeof (item as EmailFolderRecord).folderName === "string"
  );
}

export function normalizeEmailFolders(raw: unknown[]): EmailFolderRecord[] {
  const parsed = raw.filter(isEmailFolderLike);
  const filtered = parsed.filter((folder) => {
    const key = normalizeFolderKey(folder.folderName);
    return !FOLDERS_TO_HIDE.includes(key);
  });
  const orderIndex = (key: string) => {
    const index = FOLDER_ORDER.indexOf(key);
    return index === -1 ? FOLDER_ORDER.length : index;
  };
  const sorted = [...filtered].sort(
    (a, b) => orderIndex(normalizeFolderKey(a.folderName)) - orderIndex(normalizeFolderKey(b.folderName)),
  );
  return sorted.map((folder) => {
    const rawFolder = folder as unknown as Record<string, unknown>;
    const unreadCount =
      typeof rawFolder.unReadCount === "number"
        ? rawFolder.unReadCount
        : typeof rawFolder.unreadCount === "number"
          ? rawFolder.unreadCount
          : undefined;
    const totalCount = typeof rawFolder.totalCount === "number" ? rawFolder.totalCount : undefined;
    return {
      folderId: folder.folderId,
      folderName: getFolderLabelPt(folder.folderName),
      unreadCount,
      totalCount,
    };
  });
}

export function parseMessageTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const ms = Date.parse(value.trim());
    if (Number.isFinite(ms)) return ms;
  }
  return undefined;
}

export function htmlToPlainTextForForward(html: string): string {
  if (!html || typeof html !== "string") return "";
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export interface EmailMessageRecord {
  messageId: string;
  threadId?: string;
  subject?: string;
  summary?: string;
  fromAddress?: { emailAddress?: string; displayName?: string };
  receivedTime?: number;
  sentTime?: number;
  isRead?: boolean;
  isStarred?: boolean;
  hasAttachments?: boolean;
}

export function normalizeEmailMessages(raw: unknown[]): EmailMessageRecord[] {
  return raw
    .filter(
      (message): message is Record<string, unknown> =>
        message != null && typeof message === "object" && typeof (message as Record<string, unknown>).messageId === "string",
    )
    .map((message) => ({
      messageId: String(message.messageId),
      threadId:
        typeof message.threadId === "string"
          ? message.threadId
          : typeof message.threadId === "number"
            ? String(message.threadId)
            : undefined,
      subject: typeof message.subject === "string" ? message.subject : undefined,
      summary: typeof message.summary === "string" ? message.summary : undefined,
      fromAddress:
        message.fromAddress != null && typeof message.fromAddress === "object"
          ? {
              emailAddress:
                typeof (message.fromAddress as Record<string, unknown>).emailAddress === "string"
                  ? ((message.fromAddress as Record<string, unknown>).emailAddress as string)
                  : undefined,
              displayName:
                typeof (message.fromAddress as Record<string, unknown>).displayName === "string"
                  ? ((message.fromAddress as Record<string, unknown>).displayName as string)
                  : undefined,
            }
          : undefined,
      receivedTime: parseMessageTimestamp(message.receivedTime),
      sentTime: parseMessageTimestamp(message.sentTime),
      isRead:
        typeof message.isRead === "boolean"
          ? message.isRead
          : message.status === "1" || message.status === 1
            ? true
            : message.status === "0" || message.status === 0
              ? false
              : undefined,
      isStarred: typeof message.isStarred === "boolean" ? message.isStarred : undefined,
      hasAttachments: typeof message.hasAttachments === "boolean" ? message.hasAttachments : undefined,
    }));
}
