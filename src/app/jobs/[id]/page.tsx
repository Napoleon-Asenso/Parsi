"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import ProcessingView from "@/components/ProcessingView";
import ResultView from "@/components/ResultView";
import type { JobRecord } from "@/lib/utils";

export default function JobPage() {
  const params = useParams<{ id: string }>();
  const jobId = typeof params?.id === "string" ? params.id : "";
  const [completedJob, setCompletedJob] = useState<JobRecord | null>(null);

  if (completedJob) {
    return <ResultView job={completedJob} />;
  }

  return <ProcessingView jobId={jobId} onComplete={setCompletedJob} />;
}
