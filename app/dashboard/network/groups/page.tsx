import { WallScreen } from '@/components/wall/wall-screen';

export const dynamic = 'force-dynamic';

export default function GroupsPage() {
  return (
    <div className="bg-[#F4F6F6]">
      <WallScreen surface="group" />
    </div>
  );
}
