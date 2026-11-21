import { useHousehold } from '@/features/household';

interface VisitorPickerProps {
  value: readonly string[];
  onChange: (memberIds: string[]) => void;
  /** Private places can only record their creator. */
  onlySelf: boolean;
}

/** "Who went?" — explicit, so a shared trip is never assumed to include both people. */
export function VisitorPicker({ value, onChange, onlySelf }: VisitorPickerProps) {
  const household = useHousehold();
  const members = [household.me, ...(household.partner && !onlySelf ? [household.partner] : [])];
  const toggle = (userId: string, checked: boolean) => {
    onChange(checked ? [...new Set([...value, userId])] : value.filter((id) => id !== userId));
  };
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="mb-1 text-sm font-medium">Who went?</legend>
      {members.map((member) => (
        <label key={member.userId} className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={value.includes(member.userId)}
            onChange={(event) => {
              toggle(member.userId, event.target.checked);
            }}
          />
          {member.tone === 'me' ? `${member.displayName} (you)` : member.displayName}
        </label>
      ))}
    </fieldset>
  );
}
