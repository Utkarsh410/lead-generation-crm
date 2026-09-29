import { redirect } from "next/navigation";

// The pipeline now tracks opportunities (deals), not prospects.
export default function PipelinePage() {
  redirect("/opportunities");
}
