import { useState, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Eye,
  EyeOff
} from 'lucide-react';
import { VariableSelectorPopup } from './VariableSelectorPopup';
import { sanitizeHtml } from '@/lib/sanitizeHtml';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  defaultShowPreview?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite o texto...',
  minHeight = '200px',
  defaultShowPreview = false,
}: RichTextEditorProps) {
  const [showPreview, setShowPreview] = useState(defaultShowPreview);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = document.activeElement as HTMLTextAreaElement;
    if (textarea && textarea.tagName === 'TEXTAREA') {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = value.substring(start, end);
      const newText = value.substring(0, start) + before + selectedText + after + value.substring(end);
      onChange(newText);
      
      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
      }, 0);
    }
  };

  const formatBold = () => insertFormatting('**', '**');
  const formatItalic = () => insertFormatting('*', '*');
  const formatList = () => {
    const lines = value.split('\n');
    const textarea = document.activeElement as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = lines.findIndex((_, i) => {
        const linePos = lines.slice(0, i).join('\n').length + i;
        return linePos >= lineStart;
      });
      if (currentLine !== -1) {
        lines[currentLine] = `• ${lines[currentLine].replace(/^[•\-]\s*/, '')}`;
        onChange(lines.join('\n'));
      }
    }
  };

  const formatOrderedList = () => {
    const lines = value.split('\n');
    const textarea = document.activeElement as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = lines.findIndex((_, i) => {
        const linePos = lines.slice(0, i).join('\n').length + i;
        return linePos >= lineStart;
      });
      if (currentLine !== -1) {
        lines[currentLine] = `1. ${lines[currentLine].replace(/^\d+\.\s*/, '')}`;
        onChange(lines.join('\n'));
      }
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = value || '';
    const before = text.substring(0, start);
    const after = text.substring(end);
    
    const newValue = before + variable + after;
    onChange(newValue);

    // Set cursor position after variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variable.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const renderPreview = (text: string) => {
    // Simple markdown-like rendering
    let html = text;
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Italic
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Line breaks
    html = html.replace(/\n/g, '<br />');
    
    // Lists
    html = html.replace(/^[•\-]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/^(\d+)\.\s+(.*)$/gm, '<li>$2</li>');
    
    // Wrap lists in ul/ol
    html = html.replace(/(<li>.*?<\/li>)/g, '<ul>$1</ul>');
    
    return html;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={formatBold}
          title="Negrito (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={formatItalic}
          title="Itálico (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={formatList}
          title="Lista"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={formatOrderedList}
          title="Lista Numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <VariableSelectorPopup onSelectVariable={insertVariable} />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowPreview(!showPreview)}
          title={showPreview ? 'Mostrar Editor' : 'Mostrar Preview'}
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>

      {showPreview ? (
        <div
          className="prose prose-sm max-w-none p-4 border rounded-md bg-muted/50"
          style={{ minHeight }}
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(renderPreview(value)) }}
        />
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ minHeight }}
          className="resize-none font-mono text-sm"
        />
      )}
    </div>
  );
}
