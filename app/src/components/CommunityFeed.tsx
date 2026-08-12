import { useState } from 'react'
import { CalendarDays, Heart, MessageCircle, MoreHorizontal, Play, ShieldCheck } from 'lucide-react'

type FeedRole = 'parent' | 'student' | 'teacher' | 'staff'

type CommunityFeedProps = {
  role: FeedRole
  userName: string
  onOpenFinance?: () => void
  onCreatePost?: () => void
}

const samplePosts = [
  {
    id: 1,
    initials: 'LT',
    author: 'Ms Lim',
    meta: 'Mathematics · 42 minutes ago',
    scope: 'Class MB1',
    title: 'Math came alive in the courtyard today',
    body: 'Students measured shadows and used the results to estimate the height of our rain trees. Ask them which tree surprised them most.',
    media: 'photos' as const,
    likes: 24,
    comments: 3,
    commentsEnabled: true,
  },
  {
    id: 2,
    initials: 'MIS',
    author: 'MIS School Office',
    meta: 'Yesterday at 4:15 PM',
    scope: 'Whole school',
    title: 'Family Sports Evening',
    body: 'Join us this Friday for friendly games, student performances, and a shared picnic on the main field.',
    media: 'event' as const,
    likes: 38,
    comments: 0,
    commentsEnabled: false,
  },
  {
    id: 3,
    initials: 'AR',
    author: 'Mr Arif',
    meta: 'Science · Monday',
    scope: 'Classes MB1 & MB2',
    title: 'A closer look at the water cycle',
    body: 'Our young scientists built working mini water cycles and explained evaporation, condensation, and precipitation in their own words.',
    media: 'video' as const,
    likes: 19,
    comments: 4,
    commentsEnabled: true,
  },
]

export function CommunityFeed({ role, userName, onOpenFinance, onCreatePost }: CommunityFeedProps) {
  const [filter, setFilter] = useState('For you')
  const [liked, setLiked] = useState<number[]>([1])
  const firstName = userName.split(' ')[0]

  const toggleLike = (postId: number) => setLiked((items) => items.includes(postId) ? items.filter((id) => id !== postId) : [...items, postId])

  return (
    <div className="community-page">
      <section className="community-welcome">
        <div><p>Tuesday, 12 August</p><h1>{role === 'student' ? `Hello, ${firstName}` : `Good evening, ${firstName}`}</h1></div>
        <span className="role-chip">{role === 'staff' ? 'Staff' : role[0].toUpperCase() + role.slice(1)}</span>
      </section>

      {role === 'parent' && (
        <button type="button" className="attention-strip context-card" onClick={onOpenFinance}>
          <span className="attention-icon">RM</span><span><strong>RM 1,240 outstanding</strong><small>Alyssa Tan · account updated today</small></span><b>View</b>
        </button>
      )}
      {(role === 'teacher' || role === 'staff') && (
        <button type="button" className="create-strip context-card" onClick={onCreatePost}><span>Share a school moment</span><b>Create post</b></button>
      )}

      <div className="feed-filter" aria-label="Feed filters">
        {['For you', 'School', 'My classes', 'Events'].map((item) => <button key={item} type="button" className={filter === item ? 'active' : ''} onClick={() => setFilter(item)}>{item}</button>)}
      </div>

      <div className="preview-label preview-note"><ShieldCheck size={14} /> Preview · community publishing is not connected</div>

      <section className="feed-list" aria-label="School community posts">
        {samplePosts.map((post) => {
          const isLiked = liked.includes(post.id)
          return (
            <article className="feed-post" key={post.id}>
              <header className="feed-post-header"><span className="feed-avatar">{post.initials}</span><span className="feed-author"><strong>{post.author}</strong><span className="feed-post-meta"><small>{post.meta}</small><span className="feed-scope">{post.scope}</span></span></span><button type="button" className="plain-icon" aria-label={`More options for ${post.title}`}><MoreHorizontal size={20} /></button></header>
              <div className="feed-copy"><h2>{post.title}</h2><p>{post.body}</p></div>
              {post.media === 'photos' && <div className="feed-media school-garden"><span>4 classroom photos</span></div>}
              {post.media === 'video' && <div className="feed-media science-lab"><button type="button" aria-label="Play classroom video"><Play size={21} fill="currentColor" /></button><span>1:18 classroom video</span></div>}
              {post.media === 'event' && <div className="event-card"><span className="event-date"><b>15</b>AUG</span><span><strong>Family Sports Evening</strong><small><CalendarDays size={13} /> 5:00 PM · Main field</small></span></div>}
              <div className="feed-counts">{post.likes + (isLiked && post.id !== 1 ? 1 : 0)} appreciations · {post.commentsEnabled ? `${post.comments} comments` : 'Comments closed'}</div>
              <footer className="feed-actions"><button type="button" className={isLiked ? 'liked' : ''} onClick={() => toggleLike(post.id)}><Heart size={19} fill={isLiked ? 'currentColor' : 'none'} />{isLiked ? 'Appreciated' : 'Appreciate'}</button><button type="button" disabled={!post.commentsEnabled}><MessageCircle size={19} />{post.commentsEnabled ? 'Comment' : 'Comments off'}</button></footer>
            </article>
          )
        })}
      </section>
    </div>
  )
}
