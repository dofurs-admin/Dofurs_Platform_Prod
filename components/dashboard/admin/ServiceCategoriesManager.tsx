'use client';

import { useState, useTransition } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import ImageUploadField from '@/components/ui/ImageUploadField';
import StorageBackedImage from '@/components/ui/StorageBackedImage';
import Modal from '@/components/ui/Modal';
import type { ServiceCategory } from '@/lib/service-catalog/types';
import { toSlug } from '@/lib/utils/slug';

type ServiceCategoriesManagerProps = {
  initialCategories: ServiceCategory[];
};

type CategoryDraft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon_url: string;
  banner_image_url: string;
  display_order: string;
  is_featured: boolean;
  is_active: boolean;
};

export default function ServiceCategoriesManager({ initialCategories }: ServiceCategoriesManagerProps) {
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { showToast } = useToast();
  const [categoryDraft, setCategoryDraft] = useState<CategoryDraft>({
    name: '',
    slug: '',
    description: '',
    icon_url: '',
    banner_image_url: '',
    display_order: '0',
    is_featured: false,
    is_active: true,
  });

  function setCategoryDraftField<K extends keyof CategoryDraft>(field: K, value: CategoryDraft[K]) {
    setCategoryDraft((current) => ({ ...current, [field]: value }));
  }

  function setCategoryNameWithSlug(name: string) {
    setCategoryDraft((current) => {
      const currentAutoSlug = toSlug(current.name);
      const nextAutoSlug = toSlug(name);
      const shouldAutoUpdateSlug = !current.slug.trim() || current.slug === currentAutoSlug;

      return {
        ...current,
        name,
        slug: shouldAutoUpdateSlug ? nextAutoSlug : current.slug,
      };
    });
  }

  function resetCategoryDraft() {
    setCategoryDraft({
      name: '',
      slug: '',
      description: '',
      icon_url: '',
      banner_image_url: '',
      display_order: '0',
      is_featured: false,
      is_active: true,
    });
  }

  function openCreateCategoryModal() {
    resetCategoryDraft();
    setIsEditorOpen(true);
  }

  function closeCategoryModal() {
    setIsEditorOpen(false);
  }

  function loadCategoryInDraft(category: ServiceCategory) {
    setCategoryDraft({
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      icon_url: category.icon_url || '',
      banner_image_url: category.banner_image_url || '',
      display_order: category.display_order.toString(),
      is_featured: category.is_featured,
      is_active: category.is_active,
    });
  }

  function saveCategory() {
    const name = categoryDraft.name.trim();
    const slug = toSlug(categoryDraft.slug) || toSlug(name);

    if (!name) {
      showToast('Category name is required.', 'error');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name,
          slug,
          description: categoryDraft.description.trim() || null,
          icon_url: categoryDraft.icon_url.trim() || null,
          banner_image_url: categoryDraft.banner_image_url.trim() || null,
          display_order: parseInt(categoryDraft.display_order) || 0,
          is_featured: categoryDraft.is_featured,
          is_active: categoryDraft.is_active,
        };

        const url = categoryDraft.id
          ? `/api/admin/services/categories/${categoryDraft.id}`
          : '/api/admin/services/categories';

        const method = categoryDraft.id ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to save category');
        }

        if (categoryDraft.id) {
          setCategories((current) =>
            current.map((cat) => (cat.id === categoryDraft.id ? result.data : cat))
          );
          showToast('Category updated successfully.', 'success');
        } else {
          setCategories((current) => [...current, result.data]);
          showToast('Category created successfully.', 'success');
        }

        resetCategoryDraft();
        closeCategoryModal();
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to save category', 'error');
      }
    });
  }

  function deleteCategory(categoryId: string) {
    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/services/categories/${categoryId}`, {
          method: 'DELETE',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to delete category');
        }

        setCategories((current) => current.filter((cat) => cat.id !== categoryId));
        showToast('Category deleted successfully.', 'success');
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Failed to delete category', 'error');
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#e8ccb3] bg-gradient-to-b from-[#fffdfb] to-white p-6 shadow-premium-md">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-ink">Service Types</h2>
            <p className="mt-1 text-xs text-[#6b6b6b]">
              Keep service categories clean and easy to scan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-2.5 py-1 text-[11px] font-semibold text-ink">
              {categories.length} total
            </span>
            <button
              type="button"
              onClick={openCreateCategoryModal}
              className="rounded-full bg-[#1f1f1f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#353535]"
            >
              + Add New Type
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-ink">Existing Categories</p>
          {categories.length === 0 ? (
            <p className="text-xs text-[#6b6b6b]">No categories created yet.</p>
          ) : (
            <ul className="grid gap-2">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="rounded-xl border border-[#e8ccb3] bg-white/80 p-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {category.icon_url ? (
                        <StorageBackedImage
                          value={category.icon_url}
                          bucket="service-images"
                          alt={category.name}
                          width={32}
                          height={32}
                          className="h-8 w-8 rounded-lg object-cover"
                        />
                      ) : null}
                      <div>
                        <p className="font-medium text-ink">
                          {category.name}{' '}
                          {category.is_featured ? (
                            <span className="ml-1 text-[10px] text-[#6b6b6b]">★ Featured</span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-[#6b6b6b]">
                          {category.slug} • Order: {category.display_order}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        category.is_active
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      {category.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {category.description ? (
                    <p className="mt-1.5 text-[11px] text-[#6b6b6b]">{category.description}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        loadCategoryInDraft(category);
                        setIsEditorOpen(true);
                      }}
                      disabled={isPending}
                      className="rounded-full border border-[#e8ccb3] bg-white px-2.5 py-1 text-[10px] font-semibold text-ink transition hover:bg-[#fff4e6]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteCategory(category.id)}
                      disabled={isPending}
                      className="rounded-full border border-[#e8ccb3] bg-white px-2.5 py-1 text-[10px] font-semibold text-ink transition hover:bg-[#fff4e6]"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        isOpen={isEditorOpen}
        onClose={closeCategoryModal}
        size="xl"
        title={categoryDraft.id ? 'Edit Service Type' : 'Add New Service Type'}
        description="Fill category details without leaving the list context."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink">Category Name *</label>
            <input
              value={categoryDraft.name}
              onChange={(event) => setCategoryNameWithSlug(event.target.value)}
              placeholder="e.g., Grooming, Veterinary, Training"
              className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />
            <p className="text-[10px] text-[#6b6b6b]">Display name for this category</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink">Slug</label>
            <input
              value={categoryDraft.slug}
              onChange={(event) => setCategoryDraftField('slug', toSlug(event.target.value))}
              placeholder="Auto-generated from name (editable)"
              className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />
            <p className="text-[10px] text-[#6b6b6b]">Auto-generated while typing the name, but you can edit it</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink">Description</label>
            <textarea
              value={categoryDraft.description}
              onChange={(event) => setCategoryDraftField('description', event.target.value)}
              placeholder="Brief description of this category for users"
              rows={2}
              className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />
            <p className="text-[10px] text-[#6b6b6b]">Optional: Helps users understand what&apos;s in this category</p>
          </div>

          <div className="space-y-2 rounded-xl border border-[#e8ccb3] bg-[#fff4e6] p-4">
            <label className="block text-xs font-semibold text-ink">Category Icon</label>
            <ImageUploadField
              label=""
              value={categoryDraft.icon_url}
              onChange={(url) => setCategoryDraftField('icon_url', url)}
              bucket="service-images"
              placeholder="Upload icon or enter URL"
            />
            <p className="text-[10px] text-[#6b6b6b]">Square image (recommended: 200x200px) for category display</p>
          </div>

          <div className="space-y-2 rounded-xl border border-[#e8ccb3] bg-[#fff4e6] p-4">
            <label className="block text-xs font-semibold text-ink">Banner Image</label>
            <ImageUploadField
              label=""
              value={categoryDraft.banner_image_url}
              onChange={(url) => setCategoryDraftField('banner_image_url', url)}
              bucket="service-images"
              placeholder="Upload banner or enter URL"
            />
            <p className="text-[10px] text-[#6b6b6b]">Wide image (recommended: 1200x400px) for category header</p>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-ink">Display Order</label>
            <input
              value={categoryDraft.display_order}
              onChange={(event) => setCategoryDraftField('display_order', event.target.value)}
              placeholder="0 = first"
              type="number"
              min="0"
              className="w-full rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs"
            />
            <p className="text-[10px] text-[#6b6b6b]">Position in category list (0 = first, lower numbers appear first)</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink">Status & Visibility</p>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center gap-2 rounded-xl border border-[#e8ccb3] px-3 py-2 text-xs hover:bg-[#fff4e6]">
                <input
                  type="checkbox"
                  checked={categoryDraft.is_featured}
                  onChange={(event) =>
                    setCategoryDraftField('is_featured', event.target.checked)
                  }
                />
                <span>Featured</span>
              </label>
              <label
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                  categoryDraft.is_active
                    ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                    : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                <input
                  type="checkbox"
                  checked={categoryDraft.is_active}
                  onChange={(event) =>
                    setCategoryDraftField('is_active', event.target.checked)
                  }
                />
                <span>{categoryDraft.is_active ? 'Active' : 'Inactive'}</span>
              </label>
            </div>
            <p className="text-[10px] text-[#6b6b6b]">Featured shows prominently. Active makes it visible to users.</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveCategory}
              disabled={isPending}
              className="rounded-full bg-[#1f1f1f] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#353535] disabled:opacity-60"
            >
              {categoryDraft.id ? 'Update Category' : 'Create Category'}
            </button>
            <button
              type="button"
              onClick={closeCategoryModal}
              disabled={isPending}
              className="rounded-full border border-[#e8ccb3] bg-[#fff4e6] px-4 py-2 text-xs font-semibold text-ink transition hover:bg-[#ffecd7]"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
