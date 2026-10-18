'use client';

import { adminTools, missingKeys, roleNote, toolsForRole } from '@/lib/admin/help-guide';
import { resolveStaffRole } from '@/lib/admin-console';
import { useAuthSTORE } from '@/hooks/use-auth';

export function AdminHelpGuide() {
  const { profile } = useAuthSTORE();
  const staff = resolveStaffRole(profile);
  const role = profile?.role ?? '';
  const tools = toolsForRole(staff ?? role, adminTools());
  const note = roleNote(staff, role);
  const keys = missingKeys(adminTools());
  return (
    <div className="space-y-6">
      <section className="rounded-[24px] border border-[#D5E6EA] bg-white p-5">
        <h2 className="font-heading text-2xl text-[#203337]">Your login</h2>
        {note ? (
          <>
            <p className="mt-2 text-sm text-[#203337]">{note.label}. {note.can}</p>
            <p className="mt-2 text-sm text-[#1E6A83]">{note.hidden}</p>
          </>
        ) : <p className="mt-2 text-sm text-[#203337]">Sign in with an admin role to see the full desk.</p>}
      </section>
      <section className="rounded-[24px] border border-[#D5E6EA] bg-white p-5">
        <h2 className="font-heading text-2xl text-[#203337]">Where each tool lives</h2>
        <ul className="mt-3 space-y-3">
          {tools.map((tool) => (
            <li key={tool.path}>
              <a className="font-semibold text-[#1E6A83]" href={tool.path}>{tool.title}</a>
              <p className="text-sm text-[#203337]">{tool.purpose}</p>
              <p className="text-xs text-[#1E6A83]">{tool.path}</p>
            </li>
          ))}
        </ul>
      </section>
      {staff === 'super_admin' || staff === 'admin' ? (
        <section className="rounded-[24px] border border-[#D5E6EA] bg-white p-5">
          <h2 className="font-heading text-2xl text-[#203337]">Keys that still say coming soon</h2>
          <ul className="mt-3 space-y-3">
            {keys.map((item) => (
              <li key={item.key}>
                <p className="text-sm font-semibold text-[#203337]">{item.key}</p>
                <p className="text-sm text-[#1E6A83]">{item.effect}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
