import { WallScreen } from '@/components/wall/wall-screen';

export const dynamic = 'force-dynamic';

export default function GroupsPage() {
  return (
    <div className="bg-[#f8fafc]">
      <WallScreen surface="group" />
    </div>
  );
}
