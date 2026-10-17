"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { deleteConversation } from "@/lib/chat";

export async function deleteConversationAction(id: number) {
  await requireSession();
  deleteConversation(id);
  redirect("/chat");
}
