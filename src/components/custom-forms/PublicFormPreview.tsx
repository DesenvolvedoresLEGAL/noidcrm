import { CustomFormField } from '@/hooks/useCustomForms';
import { cn } from '@/lib/utils';

export interface PublicFormSettings {
  page_title: string;
  logo_url: string;
  page_bg_color: string;
  page_text_color: string;
  form_bg_color: string;
  form_text_color: string;
  button_color: string;
  button_text_color: string;
  button_text: string;
  use_rounded_borders: boolean;
  show_field_icons: boolean;
}

export const DEFAULT_PUBLIC_SETTINGS: PublicFormSettings = {
  page_title: 'Ficha Cadastral',
  logo_url: '',
  page_bg_color: '#F8FAFC',
  page_text_color: '#0F172A',
  form_bg_color: '#FFFFFF',
  form_text_color: '#0F172A',
  button_color: '#6366F1',
  button_text_color: '#FFFFFF',
  button_text: 'Enviar',
  use_rounded_borders: true,
  show_field_icons: true,
};

interface PublicFormPreviewProps {
  settings: PublicFormSettings;
  fields: CustomFormField[];
  formName: string;
}

export function PublicFormPreview({ settings, fields, formName }: PublicFormPreviewProps) {
  const borderRadius = settings.use_rounded_borders ? '0.75rem' : '0';
  const inputRadius = settings.use_rounded_borders ? '0.375rem' : '0';

  return (
    <div 
      className="h-full w-full overflow-auto p-4"
      style={{ 
        backgroundColor: settings.page_bg_color,
        color: settings.page_text_color,
      }}
    >
      <div className="max-w-md mx-auto">
        {/* Logo */}
        {settings.logo_url && (
          <div className="flex justify-center mb-4">
            <img 
              src={settings.logo_url} 
              alt="Logo" 
              className="h-12 object-contain"
            />
          </div>
        )}

        {/* Title */}
        <h2 
          className="text-lg font-semibold text-center mb-4"
          style={{ color: settings.page_text_color }}
        >
          {settings.page_title || formName}
        </h2>

        {/* Form Card */}
        <div 
          className="p-4 shadow-lg"
          style={{ 
            backgroundColor: settings.form_bg_color,
            color: settings.form_text_color,
            borderRadius,
          }}
        >
          <div className="space-y-3">
            {fields.length === 0 ? (
              <p className="text-center text-sm opacity-70">
                Adicione campos ao formulário
              </p>
            ) : (
              fields.slice(0, 5).map((field, index) => (
                <div key={field.id || index} className="space-y-1">
                  <label 
                    className="block text-xs font-medium"
                    style={{ color: settings.form_text_color }}
                  >
                    {field.label}
                    {field.is_required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input 
                    type="text"
                    disabled
                    placeholder={`Digite ${field.label?.toLowerCase()}...`}
                    className="w-full px-2 py-1.5 text-xs border bg-white/10"
                    style={{ 
                      borderRadius: inputRadius,
                      borderColor: `${settings.form_text_color}20`,
                      color: settings.form_text_color,
                    }}
                  />
                </div>
              ))
            )}
            
            {fields.length > 5 && (
              <p className="text-xs text-center opacity-70">
                +{fields.length - 5} campos adicionais...
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            disabled
            className="w-full mt-4 py-2 text-sm font-medium transition-colors"
            style={{ 
              backgroundColor: settings.button_color,
              color: settings.button_text_color,
              borderRadius: inputRadius,
            }}
          >
            {settings.button_text || 'Enviar'}
          </button>
        </div>

        <p className="text-xs text-center mt-4 opacity-50">
          Powered by NoiD CRM
        </p>
      </div>
    </div>
  );
}
