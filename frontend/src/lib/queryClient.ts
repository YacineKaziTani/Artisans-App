import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 404) return false
        return failureCount < 2
      },
    },
  },
})
