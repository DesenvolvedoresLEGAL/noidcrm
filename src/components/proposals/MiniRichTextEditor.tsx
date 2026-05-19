import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Bold, Italic, Underline as UnderlineIcon, List } from 'lucide-react';
import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface MiniRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const COLORS = ['#000000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'];

export function MiniRichTextEditor({ value, onChange, placeholder, className }: MiniRichTextEditorProps) {
  const isInternalChange = useRef(false);
  const hasUserInteracted = useRef(false);
  const initialValueRef = useRef(value);

  const handleUpdate = useCallback(({ editor }: { editor: any }) => {
    // Only trigger onChange if user has actually interacted with the editor
    if (hasUserInteracted.current) {
      isInternalChange.current = true;
      onChange(editor.getHTML());
    }
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already includes Underline — disable to avoid duplicate
      // extension registration (silently breaks chain commands like setColor).
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        underline: false,
      } as any),
      Underline,
      TextStyle,
      Color,
    ],
    content: value || '',
    editorProps: {
      attributes: {
        // Force prose color rules to inherit so inline color from <span style="color:..."> wins.
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[40px] px-2 py-1 text-sm prose-p:text-inherit prose-strong:text-inherit prose-em:text-inherit prose-li:text-inherit prose-a:text-inherit [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_u]:underline',
      },
    },
    onUpdate: handleUpdate,
    // Mark that user has interacted when they start typing or using keyboard
    onFocus: () => {
      hasUserInteracted.current = true;
    },
  });

  // Handle toolbar button clicks - mark as user interaction
  const handleToolbarAction = useCallback((action: () => void) => {
    hasUserInteracted.current = true;
    action();
  }, []);

  useEffect(() => {
    if (editor && !isInternalChange.current) {
      const currentHTML = editor.getHTML();
      // Only update if the value actually changed from external source
      // and is different from what we're showing
      if (value !== currentHTML && value !== initialValueRef.current) {
        // Reset interaction flag when content is loaded externally
        hasUserInteracted.current = false;
        editor.commands.setContent(value || '');
        initialValueRef.current = value;
      }
    }
    isInternalChange.current = false;
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={cn("border border-border rounded-md bg-background", className)}>
      {/* Mini Toolbar */}
      <div className="flex items-center gap-0.5 px-1 py-0.5 border-b border-border bg-muted/30">
        <button
          type="button"
          onClick={() => handleToolbarAction(() => editor.chain().focus().toggleBold().run())}
          className={cn(
            "p-1 rounded hover:bg-muted transition-colors",
            editor.isActive('bold') && "bg-muted text-primary"
          )}
          title="Negrito"
        >
          <Bold className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => handleToolbarAction(() => editor.chain().focus().toggleItalic().run())}
          className={cn(
            "p-1 rounded hover:bg-muted transition-colors",
            editor.isActive('italic') && "bg-muted text-primary"
          )}
          title="Itálico"
        >
          <Italic className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => handleToolbarAction(() => editor.chain().focus().toggleUnderline().run())}
          className={cn(
            "p-1 rounded hover:bg-muted transition-colors",
            editor.isActive('underline') && "bg-muted text-primary"
          )}
          title="Sublinhado"
        >
          <UnderlineIcon className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => handleToolbarAction(() => editor.chain().focus().toggleBulletList().run())}
          className={cn(
            "p-1 rounded hover:bg-muted transition-colors",
            editor.isActive('bulletList') && "bg-muted text-primary"
          )}
          title="Lista"
        >
          <List className="h-3 w-3" />
        </button>
        <div className="h-3 w-px bg-border mx-1" />
        <div className="flex items-center gap-0.5">
          {COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => handleToolbarAction(() => editor.chain().focus().setColor(color).run())}
              className="w-3 h-3 rounded-full border border-border hover:scale-110 transition-transform"
              style={{ backgroundColor: color }}
              title={`Cor ${color}`}
            />
          ))}
        </div>
      </div>
      
      {/* Editor Content */}
      <div className="relative">
        <EditorContent editor={editor} />
        {!value && placeholder && (
          <div className="absolute top-1 left-2 text-muted-foreground text-sm pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}
