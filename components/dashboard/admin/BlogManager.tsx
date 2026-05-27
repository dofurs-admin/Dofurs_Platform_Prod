'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Archive, ExternalLink, FileText, ImagePlus, Pencil, Plus, RefreshCw, Save, UploadCloud, X } from 'lucide-react';
import AdminSectionGuide from '@/components/dashboard/admin/AdminSectionGuide';
import Modal, { ModalFooter } from '@/components/ui/Modal';
import { Button, Input, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/ToastProvider';
import { cn } from '@/lib/design-system';
import { uploadCompressedImage } from '@/lib/storage/upload-client';
import type { BlogSection } from '@/lib/blog-posts';

type BlogPostStatus = 'draft' | 'published' | 'archived';

type AdminBlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: string | null;
  published_on: string | null;
  date_published: string | null;
  date_modified: string | null;
  author: string | null;
  tags: string[] | null;
  hero_image_src: string;
  hero_image_alt: string;
  sections: BlogSection[];
  status: BlogPostStatus;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

type BlogPostsResponse = {
  posts?: AdminBlogPost[];
  error?: string;
};

type SectionDraft = {
  id: string;
  heading: string;
  paragraphsText: string;
  bulletsText: string;
};

type BlogDraft = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  read_time: string;
  published_on: string;
  date_published: string;
  date_modified: string;
  author: string;
  tagsText: string;
  hero_image_src: string;
  hero_image_alt: string;
  sections: SectionDraft[];
  status: BlogPostStatus;
  display_order: string;
};

type OpenConfirm = (config: {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
}) => void;

type BlogManagerProps = {
  openConfirm?: OpenConfirm;
};

const fieldClass = 'rounded-xl border-neutral-200 text-xs focus:border-coral focus:ring-coral/20';
const statusOptions: BlogPostStatus[] = ['draft', 'published', 'archived'];

function createSectionDraft(section?: BlogSection): SectionDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    heading: section?.heading ?? '',
    paragraphsText: section?.paragraphs.join('\n') ?? '',
    bulletsText: section?.bullets?.join('\n') ?? '',
  };
}

function todayIsoDate() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDisplayDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(`${isoDate}T00:00:00+05:30`));
}

function createEmptyDraft(): BlogDraft {
  const today = todayIsoDate();

  return {
    slug: '',
    title: '',
    excerpt: '',
    category: 'Grooming',
    read_time: '5 min read',
    published_on: formatDisplayDate(today),
    date_published: today,
    date_modified: '',
    author: 'Dofurs Editorial',
    tagsText: 'pet grooming, Bengaluru',
    hero_image_src: '/Birthday/Blog_new.webp',
    hero_image_alt: 'Dofurs pet care blog hero image',
    sections: [createSectionDraft()],
    status: 'draft',
    display_order: '0',
  };
}

function draftFromPost(post: AdminBlogPost): BlogDraft {
  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    category: post.category,
    read_time: post.read_time ?? '5 min read',
    published_on: post.published_on ?? '',
    date_published: post.date_published ?? '',
    date_modified: post.date_modified ?? '',
    author: post.author ?? 'Dofurs Editorial',
    tagsText: (post.tags ?? []).join(', '),
    hero_image_src: post.hero_image_src,
    hero_image_alt: post.hero_image_alt,
    sections: post.sections.length > 0 ? post.sections.map(createSectionDraft) : [createSectionDraft()],
    status: post.status,
    display_order: String(post.display_order ?? 0),
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function splitLines(value: string) {
  return value.split('\n').map((line) => line.trim()).filter(Boolean);
}

function buildSections(sections: SectionDraft[]) {
  return sections.map((section) => ({
    heading: section.heading.trim(),
    paragraphs: splitLines(section.paragraphsText),
    bullets: splitLines(section.bulletsText),
  })).map((section) => ({
    ...section,
    bullets: section.bullets.length > 0 ? section.bullets : undefined,
  }));
}

function buildPayload(draft: BlogDraft) {
  const tags = draft.tagsText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    slug: draft.slug.trim(),
    title: draft.title.trim(),
    excerpt: draft.excerpt.trim(),
    category: draft.category.trim(),
    read_time: draft.read_time.trim() || null,
    published_on: draft.published_on.trim() || null,
    date_published: draft.date_published || null,
    date_modified: draft.date_modified || null,
    author: draft.author.trim() || null,
    tags,
    hero_image_src: draft.hero_image_src.trim(),
    hero_image_alt: draft.hero_image_alt.trim(),
    sections: buildSections(draft.sections),
    status: draft.status,
    display_order: Number(draft.display_order || 0),
  };
}

async function readApiError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null;
  return payload?.error ?? fallback;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function statusClass(status: BlogPostStatus) {
  if (status === 'published') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'archived') return 'border-neutral-200 bg-neutral-100 text-neutral-600';
  return 'border-amber-200 bg-amber-50 text-amber-700';
}

export default function BlogManager({ openConfirm }: BlogManagerProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<AdminBlogPost | null>(null);
  const [draft, setDraft] = useState<BlogDraft>(() => createEmptyDraft());

  const counts = useMemo(() => ({
    all: posts.length,
    published: posts.filter((post) => post.status === 'published').length,
    draft: posts.filter((post) => post.status === 'draft').length,
    archived: posts.filter((post) => post.status === 'archived').length,
  }), [posts]);

  const previewSections = useMemo(() => buildSections(draft.sections), [draft.sections]);

  const loadPosts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/blog?status=all&limit=100', { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as BlogPostsResponse;

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load blog posts.');
      }

      setPosts(payload.posts ?? []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to load blog posts.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  function updateDraft<K extends keyof BlogDraft>(key: K, value: BlogDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function openCreateEditor() {
    setEditingPost(null);
    setDraft(createEmptyDraft());
    setEditorOpen(true);
  }

  function openEditEditor(post: AdminBlogPost) {
    setEditingPost(post);
    setDraft(draftFromPost(post));
    setEditorOpen(true);
  }

  function updateSection(sectionId: string, patch: Partial<SectionDraft>) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.map((section) => (
        section.id === sectionId ? { ...section, ...patch } : section
      )),
    }));
  }

  function removeSection(sectionId: string) {
    setDraft((current) => ({
      ...current,
      sections: current.sections.length > 1
        ? current.sections.filter((section) => section.id !== sectionId)
        : current.sections,
    }));
  }

  async function handleHeroUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await uploadCompressedImage(file, 'blog-images');
      const publicUrl = uploaded.publicUrl ?? uploaded.signedUrl;
      updateDraft('hero_image_src', publicUrl);
      if (!draft.hero_image_alt.trim() || draft.hero_image_alt === 'Dofurs pet care blog hero image') {
        updateDraft('hero_image_alt', draft.title ? `${draft.title} hero image` : 'Dofurs blog hero image');
      }
      showToast('Hero image uploaded.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Image upload failed.', 'error');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  }

  async function handleSave() {
    const payload = buildPayload(draft);

    if (!payload.slug) {
      showToast('Add a slug before saving.', 'error');
      return;
    }

    if (payload.sections.some((section) => !section.heading || section.paragraphs.length === 0)) {
      showToast('Every section needs a heading and at least one paragraph.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(editingPost ? `/api/admin/blog/${editingPost.id}` : '/api/admin/blog', {
        method: editingPost ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to save blog post.'));
      }

      const result = await response.json() as { post: AdminBlogPost };
      setPosts((current) => {
        if (editingPost) {
          return current.map((post) => (post.id === result.post.id ? result.post : post));
        }

        return [result.post, ...current];
      });
      setEditorOpen(false);
      showToast(editingPost ? 'Blog post updated.' : 'Blog post created.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to save blog post.', 'error');
    } finally {
      setIsSaving(false);
    }
  }

  async function archivePost(post: AdminBlogPost) {
    setArchivingId(post.id);
    try {
      const response = await fetch(`/api/admin/blog/${post.id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error(await readApiError(response, 'Unable to archive blog post.'));
      }

      const result = await response.json() as { post: AdminBlogPost };
      setPosts((current) => current.map((item) => (item.id === post.id ? result.post : item)));
      showToast('Blog post archived.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to archive blog post.', 'error');
    } finally {
      setArchivingId(null);
    }
  }

  function handleArchive(post: AdminBlogPost) {
    const confirm = () => startTransition(() => {
      void archivePost(post);
    });

    if (openConfirm) {
      openConfirm({
        title: 'Archive blog post',
        description: `Archive "${post.title}"? It will be removed from public blog pages but kept in admin history.`,
        confirmLabel: 'Archive post',
        confirmVariant: 'warning',
        onConfirm: confirm,
      });
      return;
    }

    confirm();
  }

  return (
    <section className="space-y-4">
      <AdminSectionGuide
        title="How to Use Blog Publishing"
        subtitle="Write, upload a hero image, save drafts, and publish public blog posts"
        steps={[
          { title: 'Draft', description: 'Add a title, slug, excerpt, hero image, metadata, and structured article sections.' },
          { title: 'Preview', description: 'Use the live preview to match the current public blog card and article style.' },
          { title: 'Publish', description: 'Set status to Published and save. Published posts join the public blog, sitemap, and search.' },
        ]}
      />

      <div className="rounded-2xl border border-neutral-200/70 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-neutral-950">Blog Operations</p>
            <p className="text-xs text-neutral-600">Manage editorial posts using the same metadata shape as the public blog.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadPosts()}
              disabled={isLoading}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', isLoading ? 'animate-spin' : '')} aria-hidden="true" />
              Refresh
            </button>
            <button
              type="button"
              onClick={openCreateEditor}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-coral px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#cf8448]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              New post
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ['All', counts.all],
            ['Published', counts.published],
            ['Drafts', counts.draft],
            ['Archived', counts.archived],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-neutral-200 bg-neutral-50/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
              <p className="mt-1 text-lg font-semibold leading-5 text-neutral-950">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm">
        <div className="border-b border-neutral-100 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-950">Editorial Queue</p>
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-xl bg-neutral-100" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-neutral-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-neutral-900">No admin blog posts yet</p>
            <p className="mt-1 text-xs text-neutral-500">Create the first draft from the Blog Operations panel.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-100 text-left text-xs">
              <thead className="bg-neutral-50 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Post</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Published</th>
                  <th className="px-4 py-2">Updated</th>
                  <th className="px-4 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {posts.map((post) => (
                  <tr key={post.id} className="align-top hover:bg-brand-50/30">
                    <td className="max-w-[28rem] px-4 py-3">
                      <p className="font-semibold text-neutral-950">{post.title}</p>
                      <p className="mt-1 line-clamp-2 text-neutral-500">{post.excerpt}</p>
                      <p className="mt-1 font-mono text-[11px] text-neutral-400">/blog/{post.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize', statusClass(post.status))}>
                        {post.status}
                      </span>
                      <p className="mt-1 text-[11px] text-neutral-500">{post.category}</p>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{post.published_on ?? post.date_published ?? 'Not set'}</td>
                    <td className="px-4 py-3 text-neutral-600">{formatDateTime(post.updated_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {post.status === 'published' ? (
                          <Link
                            href={`/blog/${post.slug}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                            aria-label={`Open ${post.title}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => openEditEditor(post)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-200 text-neutral-600 transition hover:bg-neutral-50"
                          aria-label={`Edit ${post.title}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        {post.status !== 'archived' ? (
                          <button
                            type="button"
                            onClick={() => handleArchive(post)}
                            disabled={archivingId === post.id || isPending}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-red-200 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                            aria-label={`Archive ${post.title}`}
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingPost ? 'Edit Blog Post' : 'Create Blog Post'}
        description="Build the article from structured sections so it renders in the current public blog style."
        size="xl"
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Title"
                value={draft.title}
                onChange={(event) => updateDraft('title', event.target.value)}
                className={fieldClass}
                required
              />
              <div className="space-y-2">
                <label htmlFor="blog-status" className="text-sm font-medium text-neutral-700">Status</label>
                <select
                  id="blog-status"
                  value={draft.status}
                  onChange={(event) => updateDraft('status', event.target.value as BlogPostStatus)}
                  className="h-[46px] w-full rounded-xl border border-neutral-200 bg-white px-3 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-coral/20"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <Input
                label="Slug"
                value={draft.slug}
                onChange={(event) => updateDraft('slug', slugify(event.target.value))}
                hint="Lowercase letters, numbers, and hyphens."
                className={fieldClass}
                required
              />
              <button
                type="button"
                onClick={() => updateDraft('slug', slugify(draft.title))}
                className="inline-flex min-h-[46px] items-center justify-center rounded-xl border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Generate slug
              </button>
            </div>

            <Textarea
              label="Excerpt"
              value={draft.excerpt}
              onChange={(event) => updateDraft('excerpt', event.target.value)}
              rows={3}
              className={fieldClass}
              required
            />

            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Category" value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} className={fieldClass} />
              <Input label="Read time" value={draft.read_time} onChange={(event) => updateDraft('read_time', event.target.value)} className={fieldClass} />
              <Input label="Display order" value={draft.display_order} onChange={(event) => updateDraft('display_order', event.target.value)} className={fieldClass} inputMode="numeric" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Input label="Published label" value={draft.published_on} onChange={(event) => updateDraft('published_on', event.target.value)} className={fieldClass} />
              <Input label="Date published" type="date" value={draft.date_published} onChange={(event) => updateDraft('date_published', event.target.value)} className={fieldClass} />
              <Input label="Date modified" type="date" value={draft.date_modified} onChange={(event) => updateDraft('date_modified', event.target.value)} className={fieldClass} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="Author" value={draft.author} onChange={(event) => updateDraft('author', event.target.value)} className={fieldClass} />
              <Input label="Tags" value={draft.tagsText} onChange={(event) => updateDraft('tagsText', event.target.value)} hint="Comma-separated." className={fieldClass} />
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Hero image URL"
                    value={draft.hero_image_src}
                    onChange={(event) => updateDraft('hero_image_src', event.target.value)}
                    className={fieldClass}
                    required
                  />
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleHeroUpload} className="hidden" />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl border border-[#f2dfcf] bg-white px-3 text-xs font-semibold text-ink transition hover:bg-[#fff7f0] disabled:opacity-50"
                >
                  {isUploading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />}
                  {isUploading ? 'Uploading' : 'Upload'}
                </button>
              </div>
              <Input
                label="Hero image alt text"
                value={draft.hero_image_alt}
                onChange={(event) => updateDraft('hero_image_alt', event.target.value)}
                className={cn(fieldClass, 'mt-3')}
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-neutral-950">Article Sections</p>
                  <p className="text-xs text-neutral-500">Use one paragraph or bullet per line.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, sections: [...current.sections, createSectionDraft()] }))}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-neutral-200 px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Section
                </button>
              </div>

              {draft.sections.map((section, index) => (
                <div key={section.id} className="rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Section {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeSection(section.id)}
                      disabled={draft.sections.length === 1}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
                      aria-label="Remove section"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    <Input
                      id={`blog-section-${section.id}-heading`}
                      label="Heading"
                      value={section.heading}
                      onChange={(event) => updateSection(section.id, { heading: event.target.value })}
                      className={fieldClass}
                    />
                    <Textarea
                      id={`blog-section-${section.id}-paragraphs`}
                      label="Paragraphs"
                      value={section.paragraphsText}
                      onChange={(event) => updateSection(section.id, { paragraphsText: event.target.value })}
                      rows={4}
                      className={fieldClass}
                    />
                    <Textarea
                      id={`blog-section-${section.id}-bullets`}
                      label="Bullets"
                      value={section.bulletsText}
                      onChange={(event) => updateSection(section.id, { bulletsText: event.target.value })}
                      rows={3}
                      className={fieldClass}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
            <div className="rounded-2xl border border-[#f1e6da] bg-[linear-gradient(135deg,#fffdfb,#fff8f0)] p-4 shadow-soft-sm">
              <div className="flex items-center gap-2 text-xs text-ink/70">
                <span className="rounded-full border border-[#f1e6da] bg-[#fffaf6] px-2.5 py-1 font-medium text-ink/80">{draft.category || 'Category'}</span>
                <span>{draft.read_time || 'Read time'}</span>
              </div>
              <h3 className="mt-3 text-xl font-semibold leading-tight text-ink">{draft.title || 'Blog post title'}</h3>
              <p className="mt-2 text-sm leading-6 text-ink/75">{draft.excerpt || 'The article excerpt will appear here.'}</p>
              <div className="mt-4 overflow-hidden rounded-xl border border-[#f1e6da] bg-white">
                {draft.hero_image_src ? (
                  <div className="relative h-36 w-full">
                    <Image
                      src={draft.hero_image_src}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 100vw, 320px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 items-center justify-center text-neutral-300">
                    <ImagePlus className="h-8 w-8" aria-hidden="true" />
                  </div>
                )}
              </div>
            </div>

            <div className="max-h-[36rem] overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Article Preview</p>
              <div className="mt-3 space-y-4 text-sm text-neutral-700">
                {previewSections.map((section, index) => (
                  <section key={`${section.heading}-${index}`} className="space-y-2">
                    <h4 className="text-base font-semibold text-neutral-950">{section.heading || `Section ${index + 1}`}</h4>
                    {section.paragraphs.length > 0 ? section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="leading-6">{paragraph}</p>
                    )) : <p className="text-neutral-400">Paragraph text appears here.</p>}
                    {section.bullets && section.bullets.length > 0 ? (
                      <ul className="list-disc space-y-1 pl-5">
                        {section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
                      </ul>
                    ) : null}
                  </section>
                ))}
              </div>
            </div>
          </aside>
        </div>

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => setEditorOpen(false)}>Cancel</Button>
          <Button type="button" onClick={handleSave} isLoading={isSaving} leftIcon={<Save className="h-4 w-4" aria-hidden="true" />}>
            {editingPost ? 'Save changes' : 'Create post'}
          </Button>
        </ModalFooter>
      </Modal>
    </section>
  );
}