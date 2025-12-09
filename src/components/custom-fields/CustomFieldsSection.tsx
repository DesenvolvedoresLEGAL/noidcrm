import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { CustomFieldRenderer } from './CustomFieldRenderer';
import { EditableCustomField } from './EditableCustomField';
import { useCustomFieldsByLocation, useCustomFieldValues, useCustomFieldGroups, useCustomFieldValueMutations } from '@/hooks/useCustomFields';
import type { EntityType, CustomField, CustomFieldGroup } from '@/services/crm/custom-fields';
import { validateFieldValue } from '@/services/crm/custom-fields';
import { cn } from '@/lib/utils';

interface CustomFieldsSectionProps {
  entityId?: string;
  entityType: EntityType;
  location: string;
  mode?: 'edit' | 'view';
  variant?: 'default' | 'sidebar';
  values?: Record<string, any>;
  onChange?: (fieldId: string, value: any) => void;
  className?: string;
  showGroupHeaders?: boolean;
}

export function CustomFieldsSection({
  entityId,
  entityType,
  location,
  mode = 'edit',
  variant = 'default',
  values: externalValues,
  onChange,
  className,
  showGroupHeaders = true,
}: CustomFieldsSectionProps) {
  const { data: fields = [], isLoading: fieldsLoading } = useCustomFieldsByLocation(entityType, location);
  const { data: groups = [] } = useCustomFieldGroups(entityType);
  const { data: savedValues = [] } = useCustomFieldValues(entityId, entityType);
  const { saveValue } = useCustomFieldValueMutations();

  const [localValues, setLocalValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Initialize collapsed state from group defaults
  useEffect(() => {
    const initialCollapsed: Record<string, boolean> = {};
    groups.forEach((group) => {
      if (group.is_collapsed_default) {
        initialCollapsed[group.id] = true;
      }
    });
    setCollapsedGroups(initialCollapsed);
  }, [groups]);

  // Initialize local values from saved values
  useEffect(() => {
    if (savedValues.length > 0) {
      const valuesMap: Record<string, any> = {};
      savedValues.forEach((sv) => {
        valuesMap[sv.custom_field_id] = sv.value;
      });
      setLocalValues(valuesMap);
    }
  }, [savedValues]);

  const handleChange = async (field: CustomField, value: any) => {
    // Update local state
    setLocalValues((prev) => ({ ...prev, [field.id]: value }));

    // Validate
    const error = validateFieldValue(value, field);
    setErrors((prev) => {
      if (error) {
        return { ...prev, [field.id]: error };
      }
      const { [field.id]: _, ...rest } = prev;
      return rest;
    });

    // Call external onChange if provided
    if (onChange) {
      onChange(field.id, value);
    }

    // Auto-save if we have an entityId and no validation errors
    if (entityId && !error && mode === 'edit') {
      try {
        await saveValue({
          customFieldId: field.id,
          entityId,
          entityType,
          value,
        });
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }
  };

  const getValue = (fieldId: string) => {
    if (externalValues && fieldId in externalValues) {
      return externalValues[fieldId];
    }
    return localValues[fieldId];
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  if (fieldsLoading) {
    return (
      <div className={cn('animate-pulse space-y-4', className)}>
        <div className="h-10 bg-muted rounded" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  if (fields.length === 0) {
    return null;
  }

  // Group fields by their group_id
  const groupedFields = fields.reduce((acc, field) => {
    const groupId = field.group_id || 'ungrouped';
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(field);
    return acc;
  }, {} as Record<string, CustomField[]>);

  // Sort groups by display_order
  const sortedGroupIds = Object.keys(groupedFields).sort((a, b) => {
    if (a === 'ungrouped') return 1;
    if (b === 'ungrouped') return -1;
    const groupA = groups.find((g) => g.id === a);
    const groupB = groups.find((g) => g.id === b);
    return (groupA?.display_order || 0) - (groupB?.display_order || 0);
  });

  // Sidebar variant: render with EditableCustomField pattern
  if (variant === 'sidebar') {
    return (
      <div className={cn('space-y-2', className)}>
        {fields
          .sort((a, b) => a.display_order - b.display_order)
          .map((field) => (
            <EditableCustomField
              key={field.id}
              field={field}
              value={getValue(field.id)}
              onSave={async (value) => {
                await handleChange(field, value);
              }}
            />
          ))}
      </div>
    );
  }

  if (!showGroupHeaders) {
    // Render all fields in a flat grid
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-2 gap-4', className)}>
        {fields
          .sort((a, b) => a.display_order - b.display_order)
          .map((field) => (
            <CustomFieldRenderer
              key={field.id}
              field={field}
              value={getValue(field.id)}
              onChange={(value) => handleChange(field, value)}
              error={errors[field.id]}
              mode={mode}
            />
          ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {sortedGroupIds.map((groupId) => {
        const group = groups.find((g) => g.id === groupId);
        const groupFields = groupedFields[groupId].sort(
          (a, b) => a.display_order - b.display_order
        );

        if (groupId === 'ungrouped') {
          // Render ungrouped fields directly
          return (
            <div key="ungrouped" className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupFields.map((field) => (
                <CustomFieldRenderer
                  key={field.id}
                  field={field}
                  value={getValue(field.id)}
                  onChange={(value) => handleChange(field, value)}
                  error={errors[field.id]}
                  mode={mode}
                />
              ))}
            </div>
          );
        }

        const isCollapsed = collapsedGroups[groupId];

        return (
          <Card key={groupId}>
            <Collapsible open={!isCollapsed} onOpenChange={() => toggleGroup(groupId)}>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {group?.name || 'Campos Personalizados'}
                    </CardTitle>
                    {isCollapsed ? (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {groupFields.map((field) => (
                      <CustomFieldRenderer
                        key={field.id}
                        field={field}
                        value={getValue(field.id)}
                        onChange={(value) => handleChange(field, value)}
                        error={errors[field.id]}
                        mode={mode}
                      />
                    ))}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
}
