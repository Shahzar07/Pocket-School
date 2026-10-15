'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { listCourseReviews, saveCourseReview, type CourseReview } from '@/lib/db';
import { averageRating } from '@/lib/learning';
import { Button } from '@/components/ui/button';

/** Ratings on a course landing page. Writing one requires an enrolment. */
export function CourseReviews({
  courseId,
  userId,
  userName,
  canReview,
}: {
  courseId: string;
  userId?: string | null;
  userName?: string | null;
  canReview: boolean;
}) {
  const [reviews, setReviews] = useState<CourseReview[]>([]);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listCourseReviews(courseId)
      .then(rows => { if (!cancelled) setReviews(rows); })
      .catch(() => { if (!cancelled) setReviews([]); });
    return () => { cancelled = true; };
  }, [courseId]);

  const mean = averageRating(reviews.map(review => review.rating));

  const submit = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const review = { userId, userName: userName || 'Learner', rating, text: text.trim() };
      await saveCourseReview(courseId, review);
      setReviews(prev => {
        const rest = prev.filter(item => item.userId !== userId);
        return [{ id: userId, ...review }, ...rest];
      });
      setText('');
      toast.success('Review saved.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'That review could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" />
        <h2 className="font-heading text-2xl">{mean === null ? 'No reviews yet' : `${mean} · ${reviews.length} review${reviews.length === 1 ? '' : 's'}`}</h2>
      </div>
      <ul className="space-y-3">
        {reviews.map(review => (
          <li key={review.id} className="rounded-2xl border border-border p-4">
            <p className="text-sm font-semibold">{review.userName} · {review.rating}/5</p>
            {review.text && <p className="text-sm text-muted-foreground mt-1">{review.text}</p>}
          </li>
        ))}
      </ul>
      {canReview && userId && (
        <form className="rounded-2xl border border-border p-4 space-y-3" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <label className="block text-sm font-semibold">
            Your rating
            <select className="mt-1 w-full h-10 rounded-xl border border-border bg-card px-2" value={rating} onChange={event => setRating(Number(event.target.value))}>
              {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} star{value === 1 ? '' : 's'}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            What should the next learner know?
            <textarea className="mt-1 w-full min-h-24 rounded-xl border border-border bg-card p-2 font-normal" value={text} onChange={event => setText(event.target.value)} />
          </label>
          <Button type="submit" disabled={saving} className="rounded-full">{saving ? 'Saving…' : 'Publish review'}</Button>
        </form>
      )}
    </section>
  );
}
