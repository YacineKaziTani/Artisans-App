import { QueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: (failureCount, error) => {
        if (isAxiosError(error) && error.response?.status === 404) return false
        return failureCount < 2
      },
    },
  },
})
