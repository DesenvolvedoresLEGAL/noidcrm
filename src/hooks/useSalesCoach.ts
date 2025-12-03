import { useQuery } from '@tanstack/react-query';
import { getSalesCoachData, getSellerIdForCurrentUser, SalesCoachData } from '@/services/sales-coach/coach';

export function useSalesCoach() {
  const { data: sellerId, isLoading: loadingSellerId } = useQuery({
    queryKey: ['current-seller-id'],
    queryFn: getSellerIdForCurrentUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const { 
    data: coachData, 
    isLoading: loadingCoachData,
    error,
    refetch 
  } = useQuery({
    queryKey: ['sales-coach-data', sellerId],
    queryFn: () => getSalesCoachData(sellerId!),
    enabled: !!sellerId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    sellerId,
    coachData,
    isLoading: loadingSellerId || loadingCoachData,
    error,
    refetch,
    hasSeller: !!sellerId,
  };
}
