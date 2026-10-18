import assert from 'node:assert/strict';
import test from 'node:test';
import {
  audienceChoices,
  canSeePost,
  filterFeed,
  gridSpans,
  parseTokens,
  rochfordWall,
  screenWallDraft,
  sortFeed,
  toggleReaction,
  type WallViewer,
} from './model';

const teen: WallViewer = { handle: 'amina', ageTier: 'teen', schoolId: 'rochford' };
const outsider: WallViewer = { handle: 'guest', ageTier: 'teen', schoolId: 'other-school' };

test('under-18 audiences stay inside school, class, or group', () => {
  assert.deepEqual(audienceChoices('teen'), ['school', 'class', 'group']);
  assert.deepEqual(audienceChoices('adult'), ['public', 'school', 'class', 'group', 'only-me']);
  assert.equal(screenWallDraft({ body: 'Hello class', ageTier: 'under13', audience: 'public', authorSchoolId: 'rochford', hasImage: false }).decision, 'block');
  assert.equal(screenWallDraft({ body: 'Bench photo', ageTier: 'teen', audience: 'class', authorSchoolId: 'rochford', hasImage: true }).decision, 'hold');
});

test('minors cannot see another school or a public post', () => {
  const { posts } = rochfordWall();
  const publicPost = { ...posts[0], id: 'public', audience: 'public' as const, authorHandle: 'omar', pinned: false };
  assert.equal(canSeePost(publicPost, teen), false);
  assert.equal(canSeePost(posts[1], outsider), false);
  assert.equal(filterFeed(posts, 'class', teen).every((post) => post.feed === 'class'), true);
});

test('top sort keeps the pinned announcement first and ranks the rest', () => {
  const { posts } = rochfordWall();
  const top = sortFeed(posts, 'top');
  assert.equal(top[0]?.id, 'fair');
  assert.equal(top[0]?.pinned, true);
  assert.equal(sortFeed(posts, 'recent')[0]?.pinned, true);
});

test('mentions, hashtags, reactions, and the image grid', () => {
  const tokens = parseTokens('Thanks @Wei for the table #Field-Work');
  assert.deepEqual(tokens.mentions, ['wei']);
  assert.deepEqual(tokens.tags, ['field-work']);
  const { posts } = rochfordWall();
  const next = toggleReaction(posts[1], 'like');
  assert.equal(next.mine, 'like');
  assert.equal(next.reactions.love, posts[1].reactions.love - 1);
  assert.deepEqual(gridSpans(1), [2]);
  assert.deepEqual(gridSpans(5), [1, 1, 1, 1, 1]);
  assert.equal(posts[1].locationOn, false);
  assert.ok(posts[1].images.length >= 5);
});
