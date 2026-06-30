import { create } from 'zustand';
import { apiClient } from '../services/api';

interface Instance {
  id: string;
  name: string;
  status: string;
  vcpus: number;
  ram: number;
  disk: number;
  created_at: string;
  project_id: string;
  ipAddress?: string;
}

interface InstanceStore {
  instances: Instance[];
  selectedInstance: Instance | null;
  isLoading: boolean;
  error: string | null;
  fetchInstances: () => Promise<void>;
  getInstance: (id: string) => Promise<void>;
  createInstance: (
    name: string,
    imageId: string,
    flavorId: string,
    networkId: string,
    projectId: string
  ) => Promise<void>;
  rebootInstance: (id: string, type?: 'SOFT' | 'HARD') => Promise<void>;
  startInstance: (id: string) => Promise<void>;
  stopInstance: (id: string) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useInstanceStore = create<InstanceStore>((set, get) => ({
  instances: [],
  selectedInstance: null,
  isLoading: false,
  error: null,

  fetchInstances: async () => {
    set({ isLoading: true, error: null });
    try {
      const instances = await apiClient.listInstances();
      set({ instances, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch instances',
        isLoading: false
      });
    }
  },

  getInstance: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const instance = await apiClient.getInstance(id);
      set({ selectedInstance: instance, isLoading: false });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to fetch instance',
        isLoading: false
      });
    }
  },

  createInstance: async (name, imageId, flavorId, networkId, projectId) => {
    set({ isLoading: true, error: null });
    try {
      const newInstance = await apiClient.createInstance(
        name,
        imageId,
        flavorId,
        networkId,
        projectId
      );
      set({
        instances: [...get().instances, newInstance],
        isLoading: false
      });
    } catch (error: any) {
      set({
        error: error.response?.data?.error || 'Failed to create instance',
        isLoading: false
      });
    }
  },

  rebootInstance: async (id, type) => {
    try {
      await apiClient.rebootInstance(id, type);
      // Update instance status
      const instances = get().instances.map((inst) =>
        inst.id === id ? { ...inst, status: 'REBOOTING' } : inst
      );
      set({ instances });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to reboot instance' });
    }
  },

  startInstance: async (id) => {
    try {
      await apiClient.startInstance(id);
      const instances = get().instances.map((inst) =>
        inst.id === id ? { ...inst, status: 'STARTING' } : inst
      );
      set({ instances });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to start instance' });
    }
  },

  stopInstance: async (id) => {
    try {
      await apiClient.stopInstance(id);
      const instances = get().instances.map((inst) =>
        inst.id === id ? { ...inst, status: 'STOPPING' } : inst
      );
      set({ instances });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to stop instance' });
    }
  },

  deleteInstance: async (id) => {
    try {
      await apiClient.deleteInstance(id);
      set({
        instances: get().instances.filter((inst) => inst.id !== id)
      });
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Failed to delete instance' });
    }
  },

  clearError: () => set({ error: null })
}));
