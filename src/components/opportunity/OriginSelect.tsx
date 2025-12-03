import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizationOrigins } from '@/hooks/useOrganizationOrigins';

interface OriginSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function OriginSelect({ 
  value, 
  onChange, 
  disabled, 
  placeholder = "Selecione a origem" 
}: OriginSelectProps) {
  const { origins, groups, loading } = useOrganizationOrigins();

  // Group origins by their group
  const groupedOrigins = groups.map(group => ({
    ...group,
    origins: origins.filter(o => o.group_id === group.id),
  }));

  // Origins without a group
  const ungroupedOrigins = origins.filter(o => !o.group_id);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? "Carregando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {/* Ungrouped origins first */}
        {ungroupedOrigins.length > 0 && (
          <SelectGroup>
            <SelectLabel>Outras</SelectLabel>
            {ungroupedOrigins.map((origin) => (
              <SelectItem key={origin.id} value={origin.name}>
                {origin.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}

        {/* Grouped origins */}
        {groupedOrigins.map((group) => (
          group.origins.length > 0 && (
            <SelectGroup key={group.id}>
              <SelectLabel>{group.name}</SelectLabel>
              {group.origins.map((origin) => (
                <SelectItem key={origin.id} value={origin.name}>
                  {origin.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )
        ))}

        {origins.length === 0 && !loading && (
          <SelectItem value="_empty" disabled>
            Nenhuma origem cadastrada
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  );
}
