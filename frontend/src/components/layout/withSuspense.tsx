import { Suspense } from "react";
import { PageLoader } from "@/components/ui/PageLoader";

export const withSuspense = (Component: React.ComponentType) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);
