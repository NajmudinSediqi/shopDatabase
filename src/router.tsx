import { createAppQueryClient } from "./lib/query-client";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { AppLoading } from "./components/ui/app-loading";

export const getRouter = () => {
  const queryClient = createAppQueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPendingComponent: AppLoading,
    defaultPendingMs: 250,
    defaultPendingMinMs: 300,
  });

  return router;
};
