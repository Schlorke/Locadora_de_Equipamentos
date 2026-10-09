import { describe, expect, it } from "vitest";
import {
  HIGHLIGHTED_SENDERS_STORAGE_KEY,
  getFolderLabelPt,
  getSenderKey,
  htmlToPlainTextForForward,
  isInboxFolder,
  normalizeEmailFolders,
  normalizeEmailMessages,
} from "./caixa";

describe("caixa de e-mail", () => {
  it("prefere o e-mail do remetente e reconhece a entrada", () => {
    expect(getSenderKey(null)).toBe("");
    expect(getSenderKey({ fromAddress: { emailAddress: " a@gb.com ", displayName: "Ana" } })).toBe("a@gb.com");
    expect(getSenderKey({ fromAddress: { displayName: " Ana " } })).toBe("Ana");
    expect(isInboxFolder("Inbox")).toBe(true);
    expect(isInboxFolder("Caixa de Entrada")).toBe(true);
    expect(getFolderLabelPt("inbox")).toBe("Caixa de entrada");
    expect(getFolderLabelPt("Personalizada")).toBe("Personalizada");
    expect(HIGHLIGHTED_SENDERS_STORAGE_KEY).toBe("admin-email-highlighted-senders");
  });

  it("esconde outbox, traduz inbox e lê unReadCount", () => {
    const folders = normalizeEmailFolders([
      { folderId: "2", folderName: "Trash" },
      { folderId: "1", folderName: "Inbox", unReadCount: 3, totalCount: 10 },
      { folderId: "3", folderName: "Outbox" },
    ]);
    expect(folders.map((folder) => folder.folderName)).toEqual(["Caixa de entrada", "Lixeira"]);
    expect(folders[0]?.unreadCount).toBe(3);
    expect(folders[0]?.totalCount).toBe(10);
  });

  it("tira o estilo do encaminhamento e marca status 1 como lido", () => {
    expect(htmlToPlainTextForForward('<style>p{}</style><p>Olá<br>GB</p>')).toBe("Olá\nGB");
    const [message] = normalizeEmailMessages([
      { messageId: "m1", status: "1", subject: "Orçamento", threadId: 9 },
    ]);
    expect(message?.isRead).toBe(true);
    expect(message?.threadId).toBe("9");
    expect(message?.subject).toBe("Orçamento");
  });
});
