import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, Heart, MessageCircle, MoreVertical, Pencil, Trash2, EyeOff } from 'lucide-react'
import { portalApi, type CommunityPost } from '../api/portalApi'
import { CommunityPolicyGate } from '../features/community-safety/CommunityPolicyGate'
import { CommunitySafetyMenu } from '../features/community-safety/CommunitySafetyMenu'

type FeedRole = 'parent' | 'student' | 'teacher' | 'staff'

type CommunityFeedProps = {
  role: FeedRole
  userName: string
  onOpenFinance?: () => void
  onCreatePost?: () => void
  moderation?: boolean
  activeTab?: string
}

/** Three-dot dropdown menu for a single post */
function PostMenu({ post, onEdit, onDelete, onHide }: { post: CommunityPost; onEdit: () => void; onDelete: () => void; onHide: () => void }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const hasActions = post.can_edit || post.can_delete || (post.can_moderate)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!hasActions) return null

  return (
    <div ref={menuRef} style={{ position: 'relative', marginLeft: 'auto', flexShrink: 0 }}>
      <button
        type="button"
        aria-label="Post options"
        onClick={() => setOpen((v) => !v)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: '#888', display: 'flex', alignItems: 'center', borderRadius: '8px', transition: 'background 0.15s' }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'none')}
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 9999,
          background: '#fff', borderRadius: '14px', boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          border: '1px solid rgba(0,0,0,0.07)', minWidth: '160px', overflow: 'hidden',
          animation: 'fadeIn 0.12s ease',
        }}>
          {post.can_edit && (
            <button type="button" onClick={() => { setOpen(false); onEdit() }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#1a1a2e', textAlign: 'left' }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
              <Pencil size={15} color="#555" /> Edit post
            </button>
          )}
          {post.can_delete && (
            <button type="button" onClick={() => { setOpen(false); onDelete() }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#c0392b', textAlign: 'left' }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#fff5f5')} onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
              <Trash2 size={15} /> Delete post
            </button>
          )}
          {post.can_moderate && (
            <button type="button" onClick={() => { setOpen(false); onHide() }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 500, color: '#777', textAlign: 'left' }}
              onMouseOver={(e) => (e.currentTarget.style.background = '#f5f5f5')} onMouseOut={(e) => (e.currentTarget.style.background = 'none')}>
              <EyeOff size={15} color="#999" /> Hide post
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function CommunityFeed({ role, userName, onOpenFinance, onCreatePost, moderation: _moderation = false, activeTab }: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commenting, setCommenting] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [canContribute, setCanContribute] = useState(false)
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null)
  const [deleteConfirmPostId, setDeleteConfirmPostId] = useState<number | null>(null)
  const [hidePromptPostId, setHidePromptPostId] = useState<number | null>(null)
  const [hideReasonText, setHideReasonText] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const firstName = userName.split(' ')[0]

  const load = () => portalApi.getCommunityPosts().then(({ data }) => setPosts(Array.isArray(data) ? data : [])).catch(() => setError('Unable to load community posts.')).finally(() => setLoading(false))

  useEffect(() => {
    if (!activeTab || activeTab === 'home') {
      void load()
    }
  }, [activeTab])

  useEffect(() => {
    const handleAppRefresh = () => { void load() }
    window.addEventListener('app-refresh', handleAppRefresh)
    return () => window.removeEventListener('app-refresh', handleAppRefresh)
  }, [])

  const toggleLike = async (postId: number) => {
    try {
      const { data } = await portalApi.toggleCommunityReaction(postId)
      setPosts((items) => items.map((post) => post.id === postId ? { ...post, reacted_by_me: data.reacted, reaction_count: data.reaction_count } : post))
    } catch { setError('Unable to update your appreciation.') }
  }

  const submitComment = async (postId: number) => {
    if (!comment.trim()) return
    try {
      const { data } = await portalApi.addCommunityComment(postId, comment)
      setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: [...post.comments, data] } : post))
      setComment(''); setCommenting(null)
    } catch { setError('Unable to add your comment.') }
  }

  const removeComment = async (postId: number, commentId: number) => {
    try { await portalApi.removeCommunityComment(commentId); setPosts((items) => items.map((post) => post.id === postId ? { ...post, comments: post.comments.filter((item) => item.id !== commentId) } : post)) } catch { setError('Unable to remove this comment.') }
  }

  const deletePost = (postId: number) => {
    setDeleteConfirmPostId(postId)
  }

  const hidePost = (postId: number) => {
    setHidePromptPostId(postId)
    setHideReasonText('')
  }

  const handlePostUpdated = (updatedPost: CommunityPost) => {
    setPosts((items) => items.map((post) => (post.id === updatedPost.id ? updatedPost : post)))
  }

  return (
    <div className="community-page">
      <section className="community-welcome">
        <div><p>School community</p><h1>{role === 'student' ? `Hello, ${firstName}` : `Welcome, ${firstName}`}</h1></div>
        <span className="role-chip">{role === 'staff' ? 'Staff' : role[0].toUpperCase() + role.slice(1)}</span>
      </section>

      {role === 'parent' && (
        <button type="button" className="attention-strip context-card" onClick={onOpenFinance}>
          <span className="attention-icon">RM</span>
          <span><strong>View school account</strong><small>Open read-only finance records for your linked children</small></span>
          <b>View</b>
        </button>
      )}

      <CommunityPolicyGate role={role} onReadyChange={setCanContribute} />

      {(role === 'teacher' || role === 'staff') && (
        <button type="button" className="create-strip context-card" disabled={!canContribute} onClick={onCreatePost}>
          <span>Share a school moment</span>
          <b>{canContribute ? 'Create post' : 'Accept policies first'}</b>
        </button>
      )}

      {loading ? (
        <div className="app-skeleton large" />
      ) : error && posts.length === 0 ? (
        <div className="app-empty"><h2>Community unavailable</h2><p>{error}</p></div>
      ) : posts.length === 0 ? (
        <div className="app-empty"><h2>No posts yet</h2><p>Authorized school updates will appear here.</p></div>
      ) : (
        <section className="feed-list" aria-label="School community posts">
          {error && <p className="form-error">{error}</p>}
          {posts.map((post) => (
            <article className="feed-post" key={post.id}>
              <header className="feed-post-header">
                <span className="feed-avatar">{post.author.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span>
                <span className="feed-author">
                  <strong>{post.author.name}</strong>
                  <span className="feed-post-meta"><small>{post.status === 'pending_review' ? 'Pending review' : post.published_at ? new Date(post.published_at).toLocaleString() : 'Published'}</small></span>
                </span>
                <PostMenu
                  post={post}
                  onEdit={() => setEditingPost(post)}
                  onDelete={() => void deletePost(post.id)}
                  onHide={() => void hidePost(post.id)}
                />
                <CommunitySafetyMenu targetType="post" targetId={post.id} authorUserId={post.author.id} canReportContent={post.can_report_content} canReportUser={post.can_report_user} onBlocked={() => void load()} />
              </header>
              <div className="feed-copy"><p>{post.body}</p></div>
              {post.media.map((media) => media.type === 'image' ? <img className="feed-uploaded-image" key={media.id} src={media.url} alt={media.name ?? 'Community photo'} /> : media.type === 'video' ? <video className="feed-uploaded-video" key={media.id} src={media.url} controls /> : <a key={media.id} href={media.url}>{media.name ?? 'Download attachment'}</a>)}
              <div className="feed-counts">{post.reaction_count} appreciations · {post.comments_enabled ? `${post.comments.length} comments` : 'Comments closed'}</div>
              <footer className="feed-actions">
                <button type="button" disabled={!canContribute} className={post.reacted_by_me ? 'liked' : ''} onClick={() => void toggleLike(post.id)}>
                  <Heart size={19} fill={post.reacted_by_me ? 'currentColor' : 'none'} />{post.reacted_by_me ? 'Appreciated' : 'Appreciate'}
                </button>
                <button type="button" disabled={!post.comments_enabled || !canContribute} onClick={() => setCommenting(commenting === post.id ? null : post.id)}>
                  <MessageCircle size={19} />{post.comments_enabled ? 'Comment' : 'Comments off'}
                </button>
              </footer>
              {post.comments.map((item) => (
                <div className="community-comment" key={item.id}>
                  <strong>{item.author}</strong><span>{item.body}</span>{item.can_remove && <button type="button" onClick={() => void removeComment(post.id, item.id)}>Remove</button>}
                  <CommunitySafetyMenu targetType="comment" targetId={item.id} authorUserId={item.author_user_id} canReportContent={item.can_report_content} canReportUser={item.can_report_user} onBlocked={() => void load()} />
                </div>
              ))}
              {commenting === post.id && (
                <div className="community-comment-form">
                  <input value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" />
                  <button type="button" onClick={() => void submitComment(post.id)}>Send</button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {editingPost && <EditPostSubpage post={editingPost} onSaved={handlePostUpdated} onClose={() => setEditingPost(null)} />}

      {deleteConfirmPostId !== null && createPortal(
        <div className="community-policy-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm post deletion">
          <div className="community-policy-gate-modal" style={{ maxWidth: '380px' }}>
            <h2>Delete Post?</h2>
            <p className="policy-gate-desc">This action cannot be undone. The post and all its comments will be permanently removed.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                className="secondary-action"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto' }}
                onClick={() => setDeleteConfirmPostId(null)}
                disabled={actionBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto', background: 'var(--app-red, #b42318)' }}
                disabled={actionBusy}
                onClick={async () => {
                  setActionBusy(true)
                  try {
                    await portalApi.deleteCommunityPost(deleteConfirmPostId)
                    setPosts((items) => items.filter((p) => p.id !== deleteConfirmPostId))
                    setDeleteConfirmPostId(null)
                  } catch {
                    setError('Unable to delete this post.')
                  } finally {
                    setActionBusy(false)
                  }
                }}
              >
                {actionBusy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {hidePromptPostId !== null && createPortal(
        <div className="community-policy-modal-overlay" role="dialog" aria-modal="true" aria-label="Hide post dialog">
          <div className="community-policy-gate-modal" style={{ maxWidth: '420px' }}>
            <h2>Hide Post</h2>
            <p className="policy-gate-desc">Provide a reason for hiding this post from the community feed.</p>
            <textarea
              className="custom-textarea"
              rows={3}
              value={hideReasonText}
              onChange={(e) => setHideReasonText(e.target.value)}
              placeholder="Enter moderation reason…"
              style={{ width: '100%', boxSizing: 'border-box', marginTop: '6px' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <button
                type="button"
                className="secondary-action"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto' }}
                onClick={() => {
                  setHidePromptPostId(null)
                  setHideReasonText('')
                }}
                disabled={actionBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                style={{ minHeight: '42px', padding: '0 16px', width: 'auto' }}
                disabled={actionBusy || !hideReasonText.trim()}
                onClick={async () => {
                  setActionBusy(true)
                  try {
                    await portalApi.hideCommunityPost(hidePromptPostId, hideReasonText.trim())
                    setPosts((items) => items.filter((post) => post.id !== hidePromptPostId))
                    setHidePromptPostId(null)
                    setHideReasonText('')
                  } catch {
                    setError('Unable to hide this post.')
                  } finally {
                    setActionBusy(false)
                  }
                }}
              >
                {actionBusy ? 'Hiding…' : 'Confirm & Hide'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function EditPostSubpage({ post, onSaved, onClose }: { post: CommunityPost; onSaved: (updatedPost: CommunityPost) => void; onClose: () => void }) {
  const [body, setBody] = useState(post.body)
  const [commentsEnabled, setCommentsEnabled] = useState(post.comments_enabled)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [isExiting, setIsExiting] = useState(false)
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [dragOffset, setDragOffset] = useState<number>(0)
  const [isDragging, setIsDragging] = useState<boolean>(false)

  const handleClose = () => {
    if (isExiting) return
    setIsExiting(true)
    setTimeout(() => onClose(), 220)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return
    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY
    const deltaX = currentX - touchStart.x
    const deltaY = currentY - touchStart.y

    if (deltaX > 15 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
      setIsDragging(true)
      setDragOffset(Math.max(0, deltaX))
      e.stopPropagation()
    }
  }

  const handleTouchEnd = () => {
    if (dragOffset > 100) {
      handleClose()
    } else {
      setDragOffset(0)
    }
    setIsDragging(false)
    setTouchStart(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSaving(true)
    setNotice('')
    try {
      const response = await portalApi.updateCommunityPost(post.id, body, commentsEnabled)
      onSaved(response.data)
      handleClose()
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className={`subpage-slide-overlay ${isExiting ? 'subpage-slide-out' : ''}`}
      role="dialog"
      aria-label={`Edit post ${post.id}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        background: '#f6f3ee',
        overflowY: 'auto',
        transform: dragOffset > 0 ? `translateX(${dragOffset}px)` : undefined,
        opacity: dragOffset > 0 ? Math.max(0.2, 1 - dragOffset / 400) : undefined,
        transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease',
        willChange: 'transform, opacity',
      }}
    >
      <form className="subpage-container" onSubmit={handleSave}>
        <header className="subpage-header">
          <button type="button" className="subpage-back-btn" onClick={handleClose} aria-label="Cancel editing">
            <ChevronLeft size={20} />
          </button>
          <h1 className="subpage-nav-title">Edit Post</h1>
          <button type="submit" className="primary-action-btn" disabled={saving || !body.trim()} style={{ background: 'var(--app-primary, #bd284a)', color: '#fff', border: 'none', borderRadius: '18px', padding: '6px 16px', fontWeight: 600, fontSize: '13px' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </header>

        <section style={{ margin: '16px 0 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {notice && <p className="form-error" role="alert">{notice}</p>}

          <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid rgba(23,32,51,0.08)' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '8px' }}>Post message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={5000}
              style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', font: 'inherit', fontSize: '14px', background: 'transparent' }}
              placeholder="What would you like to update?"
              required
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: '#999' }}>{body.length} / 5000</div>
          </div>

          <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', border: '1px solid rgba(23,32,51,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>
              <strong style={{ display: 'block', fontSize: '14px' }}>Allow comments</strong>
              <small style={{ color: '#666', fontSize: '12px' }}>School members can reply to this post</small>
            </span>
            <input
              type="checkbox"
              checked={commentsEnabled}
              onChange={(e) => setCommentsEnabled(e.target.checked)}
              style={{ width: '20px', height: '20px', accentColor: 'var(--app-primary, #bd284a)', cursor: 'pointer' }}
            />
          </div>
        </section>
      </form>
    </div>,
    document.body
  )
}
