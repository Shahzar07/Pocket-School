import type { AutomationRuleId } from './site-automation';

/** Client check for a self-serve door. A failed lookup leaves the door open. */
export async function automationEnabled(id: AutomationRuleId): Promise<boolean> {
  try {
    const response = await fetch('/api/automation/status');
    if (!response.ok) return true;
    const data = await response.json() as { rules?: Partial<Record<AutomationRuleId, boolean>> };
    return data.rules?.[id] !== false;
  } catch {
    return true;
  }
}
