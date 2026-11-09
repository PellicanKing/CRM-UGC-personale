import { aiConfigured } from "@/lib/ai";
import { getReviewQueue, getSettings } from "@/lib/queries";
import ReviewDeck from "./ReviewDeck";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const queue = getReviewQueue();
  const settings = getSettings();
  return (
    <ReviewDeck
      items={queue}
      signature={settings.signature}
      unsubscribeText={settings.unsubscribeText}
      aiEnabled={aiConfigured()}
    />
  );
}
