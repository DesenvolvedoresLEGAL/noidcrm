import { ActiveUserSelect } from './ActiveUserSelect';

interface ActiveUserFilterProps {
  value?: string | null;
  onChange: (userId: string) => void;
  placeholder?: string;
  allOptionLabel?: string;
  salesOnly?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Wrapper de ActiveUserSelect com opção "Todos" sempre presente para filtros. */
export function ActiveUserFilter(props: ActiveUserFilterProps) {
  return <ActiveUserSelect {...props} includeAllOption allOptionLabel={props.allOptionLabel || 'Todos'} />;
}
