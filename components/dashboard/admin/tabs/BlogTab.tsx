'use client';

import BlogManager from '@/components/dashboard/admin/BlogManager';
import type { ConfirmConfig } from '@/components/dashboard/admin/AdminDashboardShell';

type BlogTabProps = {
  openConfirm: (config: Omit<ConfirmConfig, 'isOpen'>) => void;
};

export default function BlogTab({ openConfirm }: BlogTabProps) {
  return <BlogManager openConfirm={openConfirm} />;
}