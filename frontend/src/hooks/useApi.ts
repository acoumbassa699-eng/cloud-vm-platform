import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/api';

// Instances queries
export function useInstances() {
  return useQuery({
    queryKey: ['instances'],
    queryFn: () => apiClient.listInstances(),
    refetchInterval: 30000 // Refetch every 30 seconds
  });
}

export function useInstance(instanceId: string) {
  return useQuery({
    queryKey: ['instance', instanceId],
    queryFn: () => apiClient.getInstance(instanceId),
    enabled: !!instanceId,
    refetchInterval: 20000
  });
}

export function useCreateInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      imageId,
      flavorId,
      networkId,
      projectId,
      securityGroups
    }: {
      name: string;
      imageId: string;
      flavorId: string;
      networkId: string;
      projectId: string;
      securityGroups?: string[];
    }) => apiClient.createInstance(name, imageId, flavorId, networkId, projectId, securityGroups),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    }
  });
}

export function useRebootInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, type }: { instanceId: string; type?: 'SOFT' | 'HARD' }) =>
      apiClient.rebootInstance(instanceId, type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    }
  });
}

export function useStartInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => apiClient.startInstance(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    }
  });
}

export function useStopInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => apiClient.stopInstance(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    }
  });
}

export function useDeleteInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (instanceId: string) => apiClient.deleteInstance(instanceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    }
  });
}

export function useFlavors() {
  return useQuery({
    queryKey: ['flavors'],
    queryFn: () => apiClient.listFlavors(),
    staleTime: 3600000 // 1 hour
  });
}

// Storage queries
export function useVolumes() {
  return useQuery({
    queryKey: ['volumes'],
    queryFn: () => apiClient.listVolumes(),
    refetchInterval: 30000
  });
}

export function useCreateVolume() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      size,
      projectId,
      volumeType
    }: {
      name: string;
      size: number;
      projectId: string;
      volumeType?: string;
    }) => apiClient.createVolume(name, size, projectId, volumeType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volumes'] });
    }
  });
}

export function useSnapshots() {
  return useQuery({
    queryKey: ['snapshots'],
    queryFn: () => apiClient.listSnapshots(),
    refetchInterval: 30000
  });
}

export function useCreateSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      volumeId,
      projectId
    }: {
      name: string;
      volumeId: string;
      projectId: string;
    }) => apiClient.createSnapshot(name, volumeId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snapshots'] });
    }
  });
}

// Networking queries
export function useNetworks() {
  return useQuery({
    queryKey: ['networks'],
    queryFn: () => apiClient.listNetworks(),
    refetchInterval: 30000
  });
}

export function useSecurityGroups() {
  return useQuery({
    queryKey: ['security_groups'],
    queryFn: () => apiClient.listSecurityGroups(),
    staleTime: 3600000
  });
}

// Images queries
export function useImages(name?: string, status?: string) {
  return useQuery({
    queryKey: ['images', name, status],
    queryFn: () => apiClient.listImages(name, status),
    staleTime: 1800000 // 30 minutes
  });
}

// Monitoring queries
export function useMetrics(
  instanceId?: string,
  metric?: string,
  start?: string,
  end?: string
) {
  return useQuery({
    queryKey: ['metrics', instanceId, metric, start, end],
    queryFn: () => apiClient.getMetrics(instanceId, metric, start, end),
    enabled: !!instanceId,
    refetchInterval: 60000 // 1 minute
  });
}

export function useAlerts(projectId?: string) {
  return useQuery({
    queryKey: ['alerts', projectId],
    queryFn: () => apiClient.listAlerts(projectId),
    refetchInterval: 30000
  });
}

export function useInstanceHealth(instanceId: string) {
  return useQuery({
    queryKey: ['instance_health', instanceId],
    queryFn: () => apiClient.getInstanceHealth(instanceId),
    enabled: !!instanceId,
    refetchInterval: 30000
  });
}

// Billing queries
export function useBillingUsage(projectId?: string) {
  return useQuery({
    queryKey: ['billing_usage', projectId],
    queryFn: () => apiClient.getBillingUsage(projectId),
    refetchInterval: 60000
  });
}

export function useInvoices(month?: number, year?: number) {
  return useQuery({
    queryKey: ['invoices', month, year],
    queryFn: () => apiClient.listInvoices(month, year),
    staleTime: 300000 // 5 minutes
  });
}

export function useCostAnalysis(projectId?: string) {
  return useQuery({
    queryKey: ['cost_analysis', projectId],
    queryFn: () => apiClient.getCostAnalysis(projectId),
    refetchInterval: 3600000 // 1 hour
  });
}

// Projects queries
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiClient.listProjects(),
    refetchInterval: 30000
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: () => apiClient.getProject(projectId),
    enabled: !!projectId,
    refetchInterval: 30000
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name, description }: { name: string; description?: string }) =>
      apiClient.createProject(name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      name,
      description
    }: {
      projectId: string;
      name?: string;
      description?: string;
    }) => apiClient.updateProject(projectId, name, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => apiClient.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });
}
