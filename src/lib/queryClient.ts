import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevent excessive read costs
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
})
