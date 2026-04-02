'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Artwork, Category, Tag } from '@/types/artwork';
import Button from '@/components/common/Button';

type SortField = 'title' | 'year' | 'medium';
type SortOrder = 'asc' | 'desc';

const MAX_FEATURED = 20;

interface ArtworkTableProps {
  artworks: Artwork[];
  categories: Category[];
  allTags: Tag[];
  onEdit: (artwork: Artwork) => void;
  onDelete: (artwork: Artwork) => void;
  onTagsChange: () => void;
  onFeaturedChange?: () => void;
}

// 태그 입력 컴포넌트
function TagInput({ 
  artwork, 
  allTags,
  usedTagIds,
  onTagsChange,
  onDeleteTag,
  onEditTag,
}: { 
  artwork: Artwork; 
  allTags: Tag[];
  usedTagIds: Set<string>;
  onTagsChange: () => void;
  onDeleteTag: (tagId: string, tagName: string) => void;
  onEditTag: (tagId: string, tagName: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 현재 작품의 태그들
  const currentTags = artwork.tags || [];
  const currentTagNames = currentTags.map(t => t.name);

  // 사용 중인 태그만 필터링 + 정렬 (영어 먼저, 한글 다음)
  const sortedSuggestions = useMemo(() => {
    return [...allTags]
      .filter(tag => usedTagIds.has(tag.id) && !currentTagNames.includes(tag.name))
      .sort((a, b) => {
        const aIsKorean = /[ㄱ-ㅎ가-힣]/.test(a.name[0]);
        const bIsKorean = /[ㄱ-ㅎ가-힣]/.test(b.name[0]);
        
        if (!aIsKorean && bIsKorean) return -1;
        if (aIsKorean && !bIsKorean) return 1;
        
        return a.name.localeCompare(b.name, 'ko');
      });
  }, [allTags, currentTagNames, usedTagIds]);

  // 바깥 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 태그 추가
  const addTags = async (tagNames: string[]) => {
    const validNames = tagNames
      .map(n => n.trim())
      .filter(n => n.length > 0 && !currentTagNames.includes(n));
    
    if (validNames.length === 0) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/portfolio/${artwork.id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_names: validNames }),
      });

      if (response.ok) {
        setInputValue('');
        onTagsChange();
      }
    } catch (error) {
      console.error('Error adding tags:', error);
    } finally {
      setSaving(false);
    }
  };

  // 작품에서 태그 제거
  const removeTagFromArtwork = async (tagId: string) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/portfolio/${artwork.id}/tags`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag_ids: [tagId] }),
      });

      if (response.ok) {
        onTagsChange();
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      if (inputValue.trim()) {
        const names = inputValue.split(',').map(n => n.trim()).filter(n => n);
        addTags(names);
      }
    }
  };

  const handleSuggestionClick = (tagName: string) => {
    addTags([tagName]);
    // Keep suggestions open after adding a tag
    setTimeout(() => setShowSuggestions(true), 100);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap gap-1 min-h-[32px] p-1 border border-gray-200 rounded bg-white focus-within:border-gray-400">
        {currentTags.map(tag => (
          <span 
            key={tag.id} 
            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTagFromArtwork(tag.id)}
              className="text-gray-400 hover:text-red-500"
              disabled={saving}
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={currentTags.length === 0 ? "태그 입력..." : ""}
          className="flex-1 min-w-[80px] px-1 py-0.5 text-sm outline-none bg-transparent"
          disabled={saving}
        />
      </div>

      {/* 태그 제안 리스트 (수정/삭제 버튼 포함) */}
      {showSuggestions && sortedSuggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded shadow-lg z-50">
          {sortedSuggestions.map(tag => (
            <div
              key={tag.id}
              className="flex items-center justify-between px-3 py-1.5 hover:bg-gray-100 border-b border-gray-50 last:border-b-0"
            >
              <button
                type="button"
                onClick={() => handleSuggestionClick(tag.name)}
                className="flex-1 text-left text-sm"
              >
                {tag.name}
              </button>
              <div className="flex items-center gap-1 ml-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditTag(tag.id, tag.name);
                  }}
                  className="text-gray-400 hover:text-blue-500 text-xs px-1"
                  title="태그 수정"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteTag(tag.id, tag.name);
                  }}
                  className="text-gray-400 hover:text-red-500 text-sm font-bold"
                  title="태그 삭제"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 대표작 순서 드롭다운
function FeaturedDropdown({
  artwork,
  featuredArtworks,
  onFeaturedChange,
}: {
  artwork: Artwork;
  featuredArtworks: Artwork[];
  onFeaturedChange: (artworkId: string, order: number | null) => void;
}) {
  // order는 0-based로 저장, UI는 1-based로 표시
  const currentOrder = artwork.is_featured ? (artwork.order ?? 0) + 1 : null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    
    if (value === '') {
      onFeaturedChange(artwork.id, null);
    } else {
      const newOrder = parseInt(value);
      
      // 최대 개수 체크
      if (featuredArtworks.length >= MAX_FEATURED && !artwork.is_featured) {
        alert(`대표작은 최대 ${MAX_FEATURED}개까지 선택할 수 있습니다.`);
        return;
      }
      
      onFeaturedChange(artwork.id, newOrder);
    }
  };

  return (
    <select
      value={currentOrder ?? ''}
      onChange={handleChange}
      className="w-14 h-8 px-1 text-sm border border-gray-200 rounded bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400"
    >
      <option value="">-</option>
      {Array.from({ length: MAX_FEATURED }, (_, i) => i + 1).map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

export default function ArtworkTable({ 
  artworks, 
  categories, 
  allTags, 
  onEdit, 
  onDelete, 
  onTagsChange,
  onFeaturedChange,
}: ArtworkTableProps) {
  const [sortField, setSortField] = useState<SortField>('year');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [deletingTag, setDeletingTag] = useState<{ id: string; name: string } | null>(null);
  const [editingTag, setEditingTag] = useState<{ id: string; name: string } | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // 스크롤 위치 감지
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 사용 중인 태그 ID 집합 (최소 1개 작품에 연결된 태그)
  const usedTagIds = useMemo(() => {
    const ids = new Set<string>();
    artworks.forEach(a => {
      a.tags?.forEach(t => ids.add(t.id));
    });
    return ids;
  }, [artworks]);

  // 대표작 목록
  const featuredArtworks = useMemo(() => {
    return artworks.filter(a => a.is_featured);
  }, [artworks]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'year' ? 'desc' : 'asc');
    }
  };

  // 정렬 (제목은 항상 오름차순 보조 정렬)
  const sortedArtworks = useMemo(() => {
    return [...artworks].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '', 'ko');
          break;
        case 'year':
          comparison = (a.year || 0) - (b.year || 0);
          break;
        case 'medium':
          comparison = (a.medium || '').localeCompare(b.medium || '', 'ko');
          break;
      }
      
      const primaryResult = sortOrder === 'asc' ? comparison : -comparison;
      
      // 동일한 경우 제목으로 오름차순 보조 정렬
      if (primaryResult === 0 && sortField !== 'title') {
        return (a.title || '').localeCompare(b.title || '', 'ko');
      }
      
      return primaryResult;
    });
  }, [artworks, sortField, sortOrder]);

  // 대표작 순서 변경
  const handleFeaturedChange = useCallback(async (artworkId: string, order: number | null) => {
    try {
      if (order === null) {
        // 대표작 해제
        await fetch(`/api/portfolio/${artworkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_featured: false, order: 0 }),
        });
      } else {
        // 같은 순서를 가진 기존 작품이 있으면 해제
        const conflicting = featuredArtworks.find(a => a.id !== artworkId && a.order === order - 1);
        if (conflicting) {
          await fetch(`/api/portfolio/${conflicting.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_featured: false, order: 0 }),
          });
        }

        // 선택한 작품을 대표작으로 설정
        await fetch(`/api/portfolio/${artworkId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_featured: true, order: order - 1 }),
        });
      }

      onFeaturedChange?.();
    } catch (error) {
      console.error('Error updating featured:', error);
    }
  }, [onFeaturedChange, featuredArtworks]);

  // 대표작 전체 리셋
  const handleResetFeatured = async () => {
    try {
      for (const artwork of featuredArtworks) {
        await fetch(`/api/portfolio/${artwork.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_featured: false, order: 0 }),
        });
      }
      onFeaturedChange?.();
      setShowResetConfirm(false);
    } catch (error) {
      console.error('Error resetting featured:', error);
    }
  };

  // 태그 완전 삭제
  const handleDeleteTag = async () => {
    if (!deletingTag) return;
    
    try {
      const response = await fetch(`/api/tags/${deletingTag.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onTagsChange();
        setDeletingTag(null);
      }
    } catch (error) {
      console.error('Error deleting tag:', error);
    }
  };

  // 태그 수정 시작
  const handleStartEditTag = (tagId: string, tagName: string) => {
    setEditingTag({ id: tagId, name: tagName });
    setEditTagName(tagName);
  };

  // 태그 수정 저장
  const handleSaveEditTag = async () => {
    if (!editingTag || !editTagName.trim()) return;
    
    try {
      const response = await fetch(`/api/tags/${editingTag.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editTagName.trim() }),
      });

      if (response.ok) {
        onTagsChange();
        setEditingTag(null);
        setEditTagName('');
      } else {
        const data = await response.json();
        alert(data.error || '태그 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Error updating tag:', error);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="ml-1 text-gray-400">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <th
      className={`text-left py-3 px-4 font-medium text-sm text-gray-600 cursor-pointer hover:text-gray-900 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center">
        {children}
        <SortIcon field={field} />
      </div>
    </th>
  );

  if (artworks.length === 0) {
    return (
      <div className="text-center py-12 bg-white border border-gray-200 rounded-lg shadow-sm">
        <p className="text-gray-500">
          등록된 작품이 없습니다. 첫 작품을 추가해보세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {/* Sort Controls */}
        <div className="p-3 border-b border-gray-200 flex items-center justify-between text-sm bg-gray-50">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">정렬:</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="year">연도</option>
              <option value="title">제목</option>
              <option value="medium">재료</option>
            </select>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="bg-white border border-gray-300 rounded px-2 py-1 text-gray-700 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            >
              <option value="desc">내림차순</option>
              <option value="asc">오름차순</option>
            </select>
          </div>
          <div className="text-gray-500">
            대표작: {featuredArtworks.length}/{MAX_FEATURED}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-sm text-gray-600 w-24">
                  <div className="flex items-center gap-2">
                    <span>대표</span>
                    {featuredArtworks.length > 0 && (
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="px-1.5 py-0.5 text-xs bg-gray-200 hover:bg-gray-300 text-gray-600 rounded"
                        title="대표작 전체 리셋"
                      >
                        리셋
                      </button>
                    )}
                  </div>
                </th>
                <th className="text-left py-3 px-4 font-medium text-sm text-gray-600 w-20">썸네일</th>
                <SortableHeader field="title" className="w-40">제목</SortableHeader>
                <th className="text-left py-3 px-4 font-medium text-sm text-gray-600">태그</th>
                <SortableHeader field="medium" className="w-32">재료</SortableHeader>
                <SortableHeader field="year" className="w-20">연도</SortableHeader>
                <th className="text-right py-3 px-4 font-medium text-sm text-gray-600 w-32">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedArtworks.map((artwork) => (
                <tr
                  key={artwork.id}
                  className="hover:bg-gray-50 align-top"
                >
                  <td className="py-3 px-4">
                    <FeaturedDropdown
                      artwork={artwork}
                      featuredArtworks={featuredArtworks}
                      onFeaturedChange={handleFeaturedChange}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="relative w-12 h-12 bg-gray-100 rounded overflow-hidden">
                      <Image
                        src={artwork.thumbnail_url}
                        alt={artwork.title}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-gray-900">{artwork.title}</span>
                  </td>
                  <td className="py-3 px-4">
                    <TagInput 
                      artwork={artwork} 
                      allTags={allTags}
                      usedTagIds={usedTagIds}
                      onTagsChange={onTagsChange}
                      onDeleteTag={(id, name) => setDeletingTag({ id, name })}
                      onEditTag={handleStartEditTag}
                    />
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-gray-600 text-sm">
                      {artwork.medium || '-'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {artwork.year}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end gap-2 flex-nowrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(artwork)}
                        className="whitespace-nowrap border-gray-300 text-gray-700 hover:bg-gray-100"
                      >
                        수정
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onDelete(artwork)}
                        className="text-red-600 border-red-300 hover:bg-red-50 whitespace-nowrap"
                      >
                        삭제
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 맨위로 버튼 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 w-12 h-12 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-colors flex items-center justify-center z-50"
          title="맨 위로"
        >
          ↑
        </button>
      )}

      {/* 태그 삭제 확인 모달 */}
      {deletingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium mb-2">태그 삭제</h3>
            <p className="text-gray-600 mb-4">
              &quot;{deletingTag.name}&quot; 태그를 삭제하시겠습니까?<br/>
              <span className="text-sm text-red-500">모든 작품에서 이 태그가 제거됩니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setDeletingTag(null)}>
                취소
              </Button>
              <Button onClick={handleDeleteTag} className="bg-red-500 hover:bg-red-600">
                삭제
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 대표작 리셋 확인 모달 */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium mb-2">대표작 리셋</h3>
            <p className="text-gray-600 mb-4">
              현재 선정된 대표작 {featuredArtworks.length}개를 모두 해제하시겠습니까?<br/>
              <span className="text-sm text-gray-500">해제 후 새로 선정할 수 있습니다.</span>
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowResetConfirm(false)}>
                취소
              </Button>
              <Button onClick={handleResetFeatured} className="bg-red-500 hover:bg-red-600">
                리셋
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 태그 수정 모달 */}
      {editingTag && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-medium mb-2">태그 수정</h3>
            <p className="text-gray-500 text-sm mb-3">
              &quot;{editingTag.name}&quot; 태그를 수정합니다.<br/>
              이 태그가 적용된 모든 작품에 반영됩니다.
            </p>
            <input
              type="text"
              value={editTagName}
              onChange={(e) => setEditTagName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 mb-4"
              placeholder="새 태그 이름"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEditTag();
                if (e.key === 'Escape') setEditingTag(null);
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditingTag(null)}>
                취소
              </Button>
              <Button onClick={handleSaveEditTag}>
                저장
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
