import { BRAND } from '@/lib/brand';

export const metadata = { title: 'Community guidelines · Poket School' };

export default function CommunityGuidelines() {
  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '48px 20px', color: '#203337', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <p style={{ letterSpacing: '0.14em', color: BRAND.primary }}>POKET SCHOOL</p>
      <h1>Community guidelines</h1>
      <p>ET AI reads every post, comment, reply, message, profile, and image before it is published. A person still reviews the queue.</p>
      <h2>What is removed</h2>
      <ul>
        <li>Hate or discrimination, including race, religion, gender, and disability.</li>
        <li>Harassment, bullying, and pile-ons.</li>
        <li>Sexual content, threats, and violent content.</li>
        <li>Self-harm signals. You will see a supportive note, and a school contact is told when the member is under 18.</li>
        <li>Scams, spam, and personal data such as a phone number or email.</li>
        <li>Unsolicited investment pitches. Poket School does not vet investments.</li>
      </ul>
      <h2>If something is held or removed</h2>
      <p>You get a short note that says why, without shaming you. You can appeal. An admin restores it or keeps it down. Removed items stay in an admin audit log for 90 days.</p>
      <h2>Repeat harm</h2>
      <p>A warning, then a 24 hour posting pause, then a 7 day pause, then a suspension while an admin reviews the account.</p>
      <h2>Young members</h2>
      <p>Under-18 profiles stay inside the school. They are not public and they are not searchable. Direct messages to adults outside the school are not available.</p>
      <h2>Your report still matters</h2>
      <p>If ET AI misses something, report it. Schools and the super admin see the moderation queue.</p>
    </main>
  );
}
