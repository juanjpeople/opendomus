import { FeedbackPage } from "@/features/feedback/FeedbackPage";
import { LocalOnlyPage } from "@/features/cloud/components/LocalOnlyPage";
import { CLOUD_ENABLED } from "@/lib/cloud/api";

export default function FeedbackRoute() {
  return CLOUD_ENABLED ? <FeedbackPage /> : <LocalOnlyPage />;
}
