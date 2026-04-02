'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Artwork, ArtworkFormData, Category, CategoryFormData, AboutInfo, AboutFormData, Exhibition, ExhibitionFormData, News, NewsFormData, Tag } from '@/types/artwork';
import Button from '@/components/common/Button';
import Modal from '@/components/common/Modal';
import ArtworkTable from '@/components/admin/ArtworkTable';
import ArtworkForm from '@/components/admin/ArtworkForm';
import CategoryTable from '@/components/admin/CategoryTable';
import CategoryForm from '@/components/admin/CategoryForm';
import AboutForm from '@/components/admin/AboutForm';
import SettingsForm from '@/components/admin/SettingsForm';
import ExhibitionTable from '@/components/admin/ExhibitionTable';
import ExhibitionForm from '@/components/admin/ExhibitionForm';
import NewsTable from '@/components/admin/NewsTable';
import NewsForm from '@/components/admin/NewsForm';

type Tab = 'artworks' | 'categories' | 'exhibitions' | 'news' | 'about' | 'settings';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('artworks');

  // Artworks state
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [artworksLoading, setArtworksLoading] = useState(true);
  const [isArtworkFormOpen, setIsArtworkFormOpen] = useState(false);
  const [editingArtwork, setEditingArtwork] = useState<Artwork | null>(null);
  const [deletingArtwork, setDeletingArtwork] = useState<Artwork | null>(null);

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [isCategoryFormOpen, setIsCategoryFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // Exhibitions state
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [exhibitionsLoading, setExhibitionsLoading] = useState(true);
  const [isExhibitionFormOpen, setIsExhibitionFormOpen] = useState(false);
  const [editingExhibition, setEditingExhibition] = useState<Exhibition | null>(null);
  const [deletingExhibition, setDeletingExhibition] = useState<Exhibition | null>(null);

  // News state
  const [news, setNews] = useState<News[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [isNewsFormOpen, setIsNewsFormOpen] = useState(false);
  const [editingNews, setEditingNews] = useState<News | null>(null);

  // About state
  const [aboutInfo, setAboutInfo] = useState<AboutInfo | null>(null);
  const [aboutLoading, setAboutLoading] = useState(true);

  // Tags state
  const [allTags, setAllTags] = useState<Tag[]>([]);

  // Settings state
  const [currentHint, setCurrentHint] = useState<string>('');

  // Common state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchArtworks();
    fetchCategories();
    fetchExhibitions();
    fetchNews();
    fetchAbout();
    fetchSettings();
    fetchTags();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth');
      if (!response.ok) {
        router.push('/admin/login');
      }
    } catch {
      router.push('/admin/login');
    }
  };

  const fetchArtworks = async () => {
    try {
      const response = await fetch('/api/portfolio?t=' + Date.now(), { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        setArtworks(data);
      }
    } catch {
      setError('작품 목록을 불러올 수 없습니다');
    } finally {
      setArtworksLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data);
      }
    } catch {
      setError('카테고리 목록을 불러올 수 없습니다');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchExhibitions = async () => {
    try {
      const response = await fetch('/api/exhibitions');
      if (response.ok) {
        const data = await response.json();
        setExhibitions(data);
      }
    } catch {
      setError('전시 목록을 불러올 수 없습니다');
    } finally {
      setExhibitionsLoading(false);
    }
  };

  const fetchNews = async () => {
    try {
      const response = await fetch('/api/news');
      if (response.ok) {
        const data = await response.json();
        setNews(data);
      }
    } catch {
      setError('뉴스 목록을 불러올 수 없습니다');
    } finally {
      setNewsLoading(false);
    }
  };

  const fetchAbout = async () => {
    try {
      const response = await fetch('/api/about');
      if (response.ok) {
        const data = await response.json();
        setAboutInfo(data);
      }
    } catch {
      setError('작가소개 정보를 불러올 수 없습니다');
    } finally {
      setAboutLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/admin-settings');
      if (response.ok) {
        const data = await response.json();
        setCurrentHint(data.password_hint || '');
      }
    } catch {
      // 설정 조회 실패는 무시
    }
  };

  const fetchTags = async () => {
    try {
      const response = await fetch('/api/tags');
      if (response.ok) {
        const data = await response.json();
        setAllTags(data);
      }
    } catch {
      // 태그 조회 실패는 무시
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/admin/login');
  };

  // Artwork handlers
  const handleArtworkFormSubmit = async (
    data: ArtworkFormData & { image_url: string; thumbnail_url: string }
  ) => {
    const url = editingArtwork
      ? `/api/portfolio/${editingArtwork.id}`
      : '/api/portfolio';
    const method = editingArtwork ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      setIsArtworkFormOpen(false);
      setEditingArtwork(null);
      fetchArtworks();
      setToast(editingArtwork ? '수정되었습니다' : '저장되었습니다');
    } else {
      let errorMsg = '저장 실패';
      try {
        const body = await response.json();
        errorMsg = body.error || errorMsg;
      } catch { /* empty response */ }
      throw new Error(errorMsg);
    }
  };

  const handleArtworkDelete = async () => {
    if (!deletingArtwork) return;
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/portfolio/${deletingArtwork.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeletingArtwork(null);
        fetchArtworks();
        setToast('삭제되었습니다');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Category handlers
  const handleCategoryFormSubmit = async (data: CategoryFormData & { cover_image_url?: string }) => {
    const url = editingCategory
      ? `/api/categories/${editingCategory.id}`
      : '/api/categories';
    const method = editingCategory ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      setIsCategoryFormOpen(false);
      setEditingCategory(null);
      fetchCategories();
      setToast(editingCategory ? '수정되었습니다' : '저장되었습니다');
    } else {
      const { error } = await response.json();
      throw new Error(error || '저장 실패');
    }
  };

  const handleCategoryDelete = async () => {
    if (!deletingCategory) return;
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/categories/${deletingCategory.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeletingCategory(null);
        fetchCategories();
        setToast('삭제되었습니다');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Exhibition handlers
  const handleExhibitionFormSubmit = async (data: ExhibitionFormData) => {
    const url = editingExhibition
      ? `/api/exhibitions/${editingExhibition.id}`
      : '/api/exhibitions';
    const method = editingExhibition ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      setIsExhibitionFormOpen(false);
      setEditingExhibition(null);
      fetchExhibitions();
      setToast(editingExhibition ? '수정되었습니다' : '저장되었습니다');
    } else {
      const { error } = await response.json();
      throw new Error(error || '저장 실패');
    }
  };

  const handleExhibitionDelete = async () => {
    if (!deletingExhibition) return;
    setDeleteLoading(true);

    try {
      const response = await fetch(`/api/exhibitions/${deletingExhibition.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setDeletingExhibition(null);
        fetchExhibitions();
        setToast('삭제되었습니다');
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleteLoading(false);
    }
  };

  // News handlers
  const handleNewsFormSubmit = async (data: NewsFormData) => {
    const url = editingNews
      ? `/api/news/${editingNews.id}`
      : '/api/news';
    const method = editingNews ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      setIsNewsFormOpen(false);
      setEditingNews(null);
      fetchNews();
      setToast(editingNews ? '수정되었습니다' : '저장되었습니다');
    } else {
      const { error } = await response.json();
      throw new Error(error || '저장 실패');
    }
  };

  const handleNewsDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchNews();
        setToast('삭제되었습니다');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleAboutSubmit = async (data: AboutFormData) => {
    const response = await fetch('/api/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      fetchAbout();
      setToast('저장되었습니다');
    } else {
      const { error } = await response.json();
      throw new Error(error || '저장 실패');
    }
  };

  const handleSettingsSubmit = async (data: {
    current_password: string;
    new_password?: string;
    password_hint?: string;
  }) => {
    const response = await fetch('/api/admin-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      fetchSettings();
      setToast('설정이 저장되었습니다');
    } else {
      const { error } = await response.json();
      throw new Error(error || '저장 실패');
    }
  };

  return (
    <>
      <main className="min-h-screen bg-gray-100">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-light tracking-wide text-gray-900">관리자</h1>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-900 text-sm"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6 bg-white">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('artworks')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'artworks'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              작품 관리
            </button>
            {/* 카테고리 관리 탭 숨김 (DB 스키마 유지, UI만 숨김)
            <button
              onClick={() => setActiveTab('categories')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'categories'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              카테고리 관리
            </button>
            */}
            <button
              onClick={() => setActiveTab('exhibitions')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'exhibitions'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              전시 관리
            </button>
            <button
              onClick={() => setActiveTab('news')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'news'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              뉴스 관리
            </button>
            <button
              onClick={() => setActiveTab('about')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'about'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              작가소개
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              설정
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto px-6 py-8">
          {activeTab === 'artworks' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">
                  작품 목록 <span className="text-gray-500 font-normal">({artworks.length}개)</span>
                </h2>
                <Button onClick={() => { setEditingArtwork(null); setIsArtworkFormOpen(true); }}>
                  + 새 작품
                </Button>
              </div>
              {artworksLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-gray-600 mb-4">{error}</p>
                  <Button onClick={fetchArtworks}>다시 시도</Button>
                </div>
              ) : (
                <ArtworkTable
                  artworks={artworks}
                  categories={categories}
                  allTags={allTags}
                  onEdit={(artwork) => { setEditingArtwork(artwork); setIsArtworkFormOpen(true); }}
                  onDelete={setDeletingArtwork}
                  onTagsChange={() => { fetchArtworks(); fetchTags(); }}
                  onFeaturedChange={fetchArtworks}
                />
              )}
            </>
          )}

          {activeTab === 'categories' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">카테고리 목록</h2>
                <Button onClick={() => { setEditingCategory(null); setIsCategoryFormOpen(true); }}>
                  + 새 카테고리
                </Button>
              </div>
              {categoriesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <CategoryTable
                  categories={categories}
                  onEdit={(category) => { setEditingCategory(category); setIsCategoryFormOpen(true); }}
                  onDelete={setDeletingCategory}
                />
              )}
            </>
          )}

          {activeTab === 'exhibitions' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">전시 목록</h2>
                <Button onClick={() => { setEditingExhibition(null); setIsExhibitionFormOpen(true); }}>
                  + 새 전시
                </Button>
              </div>
              {exhibitionsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <ExhibitionTable
                  exhibitions={exhibitions}
                  onEdit={(exhibition) => { setEditingExhibition(exhibition); setIsExhibitionFormOpen(true); }}
                  onDelete={setDeletingExhibition}
                />
              )}
            </>
          )}

          {activeTab === 'news' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-medium text-gray-900">뉴스 목록</h2>
                <Button onClick={() => { setEditingNews(null); setIsNewsFormOpen(true); }}>
                  + 새 뉴스
                </Button>
              </div>
              {newsLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <NewsTable
                  news={news}
                  onEdit={(newsItem) => { setEditingNews(newsItem); setIsNewsFormOpen(true); }}
                  onDelete={handleNewsDelete}
                />
              )}
            </>
          )}

          {activeTab === 'about' && (
            <>
              <h2 className="text-lg font-medium mb-6 text-gray-900">작가소개 관리</h2>
              {aboutLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 animate-pulse rounded" />
                  ))}
                </div>
              ) : (
                <AboutForm
                  aboutInfo={aboutInfo || undefined}
                  onSubmit={handleAboutSubmit}
                />
              )}
            </>
          )}

          {activeTab === 'settings' && (
            <>
              <h2 className="text-lg font-medium mb-6 text-gray-900">관리자 설정</h2>
              <SettingsForm
                currentHint={currentHint}
                onSubmit={handleSettingsSubmit}
              />
            </>
          )}
        </div>
      </main>

      {/* Artwork Form Modal */}
      <Modal
        isOpen={isArtworkFormOpen}
        onClose={() => { setIsArtworkFormOpen(false); setEditingArtwork(null); }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-xl font-medium mb-6 text-gray-900">
            {editingArtwork ? '작품 수정' : '새 작품 추가'}
          </h2>
          <ArtworkForm
            artwork={editingArtwork || undefined}
            categories={categories}
            onSubmit={handleArtworkFormSubmit}
            onCancel={() => { setIsArtworkFormOpen(false); setEditingArtwork(null); }}
          />
        </div>
      </Modal>

      {/* Category Form Modal */}
      <Modal
        isOpen={isCategoryFormOpen}
        onClose={() => { setIsCategoryFormOpen(false); setEditingCategory(null); }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-xl font-medium mb-6 text-gray-900">
            {editingCategory ? '카테고리 수정' : '새 카테고리 추가'}
          </h2>
          <CategoryForm
            category={editingCategory || undefined}
            onSubmit={handleCategoryFormSubmit}
            onCancel={() => { setIsCategoryFormOpen(false); setEditingCategory(null); }}
          />
        </div>
      </Modal>

      {/* Exhibition Form Modal */}
      <Modal
        isOpen={isExhibitionFormOpen}
        onClose={() => { setIsExhibitionFormOpen(false); setEditingExhibition(null); }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-xl font-medium mb-6 text-gray-900">
            {editingExhibition ? '전시 수정' : '새 전시 추가'}
          </h2>
          <ExhibitionForm
            exhibition={editingExhibition || undefined}
            onSubmit={handleExhibitionFormSubmit}
            onCancel={() => { setIsExhibitionFormOpen(false); setEditingExhibition(null); }}
          />
        </div>
      </Modal>

      {/* News Form Modal */}
      <Modal
        isOpen={isNewsFormOpen}
        onClose={() => { setIsNewsFormOpen(false); setEditingNews(null); }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <h2 className="text-xl font-medium mb-6 text-gray-900">
            {editingNews ? '뉴스 수정' : '새 뉴스 추가'}
          </h2>
          <NewsForm
            news={editingNews || undefined}
            onSubmit={handleNewsFormSubmit}
            onCancel={() => { setIsNewsFormOpen(false); setEditingNews(null); }}
          />
        </div>
      </Modal>

      {/* Delete Artwork Confirm Modal */}
      <Modal
        isOpen={!!deletingArtwork}
        onClose={() => setDeletingArtwork(null)}
        className="w-full max-w-sm"
      >
        <div className="p-6 text-center">
          <h2 className="text-lg font-medium mb-2 text-gray-900">정말 삭제하시겠습니까?</h2>
          <p className="text-gray-600 mb-1">
            &quot;{deletingArtwork?.title}&quot;을(를) 삭제합니다.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setDeletingArtwork(null)}>
              취소
            </Button>
            <Button
              onClick={handleArtworkDelete}
              loading={deleteLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Category Confirm Modal */}
      <Modal
        isOpen={!!deletingCategory}
        onClose={() => setDeletingCategory(null)}
        className="w-full max-w-sm"
      >
        <div className="p-6 text-center">
          <h2 className="text-lg font-medium mb-2 text-gray-900">정말 삭제하시겠습니까?</h2>
          <p className="text-gray-600 mb-1">
            &quot;{deletingCategory?.name}&quot; 카테고리를 삭제합니다.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            이 카테고리에 속한 작품들은 카테고리 없음으로 변경됩니다.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setDeletingCategory(null)}>
              취소
            </Button>
            <Button
              onClick={handleCategoryDelete}
              loading={deleteLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Exhibition Confirm Modal */}
      <Modal
        isOpen={!!deletingExhibition}
        onClose={() => setDeletingExhibition(null)}
        className="w-full max-w-sm"
      >
        <div className="p-6 text-center">
          <h2 className="text-lg font-medium mb-2 text-gray-900">정말 삭제하시겠습니까?</h2>
          <p className="text-gray-600 mb-1">
            &quot;{deletingExhibition?.title}&quot; 전시를 삭제합니다.
          </p>
          <p className="text-gray-500 text-sm mb-6">
            이 작업은 되돌릴 수 없습니다.
          </p>
          <div className="flex justify-center gap-3">
            <Button variant="secondary" onClick={() => setDeletingExhibition(null)}>
              취소
            </Button>
            <Button
              onClick={handleExhibitionDelete}
              loading={deleteLoading}
              className="bg-red-500 hover:bg-red-600"
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}
