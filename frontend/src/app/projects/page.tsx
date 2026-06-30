'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Navbar from '@/components/Navbar';
import LoadingSpinner from '@/components/LoadingSpinner';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  quota_cpu: number;
  quota_ram: number;
  quota_storage: number;
  quota_instances: number;
  usage: {
    cpu: number;
    ram: number;
    storage: number;
    instances: number;
  };
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
      loadProjects(savedToken);
    }
  }, []);

  const loadProjects = async (authToken: string) => {
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/projects`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      setProjects(response.data.projects);
    } catch (err) {
      console.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (used: number, quota: number) => {
    return quota > 0 ? Math.round((used / quota) * 100) : 0;
  };

  return (
    <div>
      <Navbar />
      <div className="container-custom py-8">
        <h1 className="text-3xl font-bold mb-8">Projects</h1>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid gap-6">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="card hover:shadow-lg transition cursor-pointer">
                  <h3 className="text-xl font-semibold mb-4">{project.name}</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-1">CPU Usage</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{width: `${getUsagePercentage(project.usage.cpu, project.quota_cpu)}%`}}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {project.usage.cpu}/{project.quota_cpu} vCPU
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">RAM Usage</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{width: `${getUsagePercentage(project.usage.ram, project.quota_ram)}%`}}
                        />
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {project.usage.ram}/{project.quota_ram} GB
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
