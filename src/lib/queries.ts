import { useQuery, useQueryClient } from "@tanstack/react-query";

type SbResult<T> = { data: T | null; error: { message: string } | null };

export function useSb<T>(key: unknown[], fn: () => PromiseLike<SbResult<T>>) {
  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await fn();
      if (error) throw new Error(error.message);
      return data as T;
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
