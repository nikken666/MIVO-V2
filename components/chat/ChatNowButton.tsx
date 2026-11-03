"use client";

import { useT } from "../LanguageProvider";
import { openChat } from "./ChatWidget";

/** "Chat now" button that opens the chat window with a shop (and product/order). */
export default function ChatNowButton({
  sellerId,
  productId,
  orderNumber,
  className = "chatNowButton",
}: {
  sellerId: string;
  productId?: string;
  orderNumber?: string;
  className?: string;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className={className}
      onClick={() => openChat({ sellerId, productId, orderNumber })}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z" />
      </svg>
      {t("chat.chatNow")}
    </button>
  );
}
