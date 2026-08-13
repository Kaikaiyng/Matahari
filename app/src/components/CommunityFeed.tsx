import { useEffect, useState } from 'react'
import { Heart, MessageCircle } from 'lucide-react'
import { portalApi, type CommunityPost } from '../api/portalApi'

type FeedRole = 'parent' | 'student' | 'teacher' | 'staff'

type CommunityFeedProps = {
  role: FeedRole
  userName: string
  onOpenFinance?: () => void
  onCreatePost?: () => void
}

export function CommunityFeed({ role, userName, onOpenFinance, onCreatePost }: CommunityFeedProps) {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [commenting, setCommenting] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const firstName = userName.split(' ')[0]

  const load = () => portalApi.getCommunityPosts().then(({ data }) => setPosts(data)).catch(() => setError('Unable to load community posts.')).finally(() => setLoading(false))
  useEffect(() => { void load() }, [])

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

  return <div className="community-page">
    <section className="community-welcome"><div><p>School community</p><h1>{role === 'student' ? `Hello, ${firstName}` : `Welcome, ${firstName}`}</h1></div><span className="role-chip">{role === 'staff' ? 'Staff' : role[0].toUpperCase() + role.slice(1)}</span></section>
    {role === 'parent' && <button type="button" className="attention-strip context-card" onClick={onOpenFinance}><span className="attention-icon">RM</span><span><strong>View school account</strong><small>Open read-only finance records for your linked children</small></span><b>View</b></button>}
    {(role === 'teacher' || role === 'staff') && <button type="button" className="create-strip context-card" onClick={onCreatePost}><span>Share a school moment</span><b>Create post</b></button>}
    {loading ? <div className="app-skeleton large" /> : error && posts.length === 0 ? <div className="app-empty"><h2>Community unavailable</h2><p>{error}</p></div> : posts.length === 0 ? <div className="app-empty"><h2>No posts yet</h2><p>Authorized school updates will appear here.</p></div> : <section className="feed-list" aria-label="School community posts">
      {error && <p className="form-error">{error}</p>}
      {posts.map((post) => <article className="feed-post" key={post.id}>
        <header className="feed-post-header"><span className="feed-avatar">{post.author.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span className="feed-author"><strong>{post.author.name}</strong><span className="feed-post-meta"><small>{post.published_at ? new Date(post.published_at).toLocaleString() : 'Published'}</small></span></span></header>
        <div className="feed-copy"><p>{post.body}</p></div>
        <div className="feed-counts">{post.reaction_count} appreciations · {post.comments_enabled ? `${post.comments.length} comments` : 'Comments closed'}</div>
        <footer className="feed-actions"><button type="button" className={post.reacted_by_me ? 'liked' : ''} onClick={() => void toggleLike(post.id)}><Heart size={19} fill={post.reacted_by_me ? 'currentColor' : 'none'} />{post.reacted_by_me ? 'Appreciated' : 'Appreciate'}</button><button type="button" disabled={!post.comments_enabled} onClick={() => setCommenting(commenting === post.id ? null : post.id)}><MessageCircle size={19} />{post.comments_enabled ? 'Comment' : 'Comments off'}</button></footer>
        {post.comments.map((item) => <div className="community-comment" key={item.id}><strong>{item.author}</strong><span>{item.body}</span></div>)}
        {commenting === post.id && <div className="community-comment-form"><input value={comment} maxLength={2000} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment" /><button type="button" onClick={() => void submitComment(post.id)}>Send</button></div>}
      </article>)}
    </section>}
  </div>
}
