import { useEditor, EditorContent, Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Link } from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { Input } from './input';
import { Label } from './label';
import { Separator } from './separator';
import { Textarea } from './textarea';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Link as LinkIcon,
  Unlink,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Code,
  Highlighter,
  Palette,
  Type,
  Undo,
  Redo,
  Eye,
  EyeOff,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

const COLORS = [
  '#000000', '#424242', '#636363', '#9C9C94', '#CEC6CE', '#FFFFFF',
  '#FF0000', '#FF9C00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF',
  '#9C00FF', '#FF00FF', '#F7C6CE', '#FFE7CE', '#FFEFC6', '#D6EFD6',
  '#CEDEE7', '#CEE7F7', '#D6D6E7', '#E7D6DE', '#E79C9C', '#FFC69C',
  '#FFE79C', '#B5D6A5', '#A5C6CE', '#9CC6EF', '#B5A5D6', '#D6A5BD',
  '#E76363', '#F7AD6B', '#FFD663', '#94BD7B', '#73A5AD', '#6BADDE',
  '#8C7BC6', '#C67BA5', '#CE0000', '#E79439', '#EFC631', '#6BA54A',
  '#4A7B8C', '#3984C6', '#634AA5', '#A54A7B', '#9C0000', '#B56308',
  '#BD9400', '#397B21', '#104A5A', '#085294', '#311873', '#731842',
];

const HIGHLIGHT_COLORS = [
  '#FFFF00', '#00FF00', '#00FFFF', '#FF00FF', '#FF0000', '#0000FF',
  '#FFC0CB', '#FFD700', '#98FB98', '#87CEEB', '#DDA0DD', '#F0E68C',
];

function ToolbarButton({
  onClick,
  isActive,
  disabled,
  children,
  title,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-primary/20 text-primary'
      )}
    >
      {children}
    </Button>
  );
}

function ColorPicker({
  colors,
  selectedColor,
  onSelect,
  icon: Icon,
  title,
}: {
  colors: string[];
  selectedColor?: string;
  onSelect: (color: string) => void;
  icon: React.ElementType;
  title: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={title}
          className="h-8 w-8 p-0"
        >
          <Icon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-8 gap-1">
          {colors.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onSelect(color)}
              className={cn(
                'h-6 w-6 rounded border border-border transition-transform hover:scale-110',
                selectedColor === color && 'ring-2 ring-primary ring-offset-1'
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LinkDialog({ editor }: { editor: Editor }) {
  const [url, setUrl] = useState('');
  const [open, setOpen] = useState(false);

  const setLink = useCallback(() => {
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
    setOpen(false);
    setUrl('');
  }, [editor, url]);

  const openDialog = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setUrl(previousUrl);
    setOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={openDialog}
          title="Inserir Link"
          className={cn(
            'h-8 w-8 p-0',
            editor.isActive('link') && 'bg-primary/20 text-primary'
          )}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">URL do Link</Label>
            <Input
              id="url"
              placeholder="https://exemplo.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setLink()}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={setLink} className="flex-1">
              Aplicar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditorToolbar({ editor, showSource, onToggleSource }: { 
  editor: Editor; 
  showSource: boolean;
  onToggleSource: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/30 p-1 rounded-t-md">
      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Desfazer (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Refazer (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Text formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        isActive={editor.isActive('underline')}
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Tachado"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Colors */}
      <ColorPicker
        colors={COLORS}
        selectedColor={editor.getAttributes('textStyle').color}
        onSelect={(color) => editor.chain().focus().setColor(color).run()}
        icon={Palette}
        title="Cor do Texto"
      />
      <ColorPicker
        colors={HIGHLIGHT_COLORS}
        selectedColor={editor.getAttributes('highlight').color}
        onSelect={(color) => editor.chain().focus().toggleHighlight({ color }).run()}
        icon={Highlighter}
        title="Destacar Texto"
      />

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Lista com Marcadores"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Lista Numerada"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Alignment */}
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        isActive={editor.isActive({ textAlign: 'left' })}
        title="Alinhar à Esquerda"
      >
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        isActive={editor.isActive({ textAlign: 'center' })}
        title="Centralizar"
      >
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        isActive={editor.isActive({ textAlign: 'right' })}
        title="Alinhar à Direita"
      >
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        isActive={editor.isActive({ textAlign: 'justify' })}
        title="Justificar"
      >
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Link */}
      <LinkDialog editor={editor} />
      <ToolbarButton
        onClick={() => editor.chain().focus().unsetLink().run()}
        disabled={!editor.isActive('link')}
        title="Remover Link"
      >
        <Unlink className="h-4 w-4" />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-6" />

      {/* Code view toggle */}
      <ToolbarButton
        onClick={onToggleSource}
        isActive={showSource}
        title="Ver código HTML"
      >
        {showSource ? <EyeOff className="h-4 w-4" /> : <Code className="h-4 w-4" />}
      </ToolbarButton>
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Digite aqui...',
  minHeight = '150px',
  className,
}: RichTextEditorProps) {
  const [showSource, setShowSource] = useState(false);
  const [sourceCode, setSourceCode] = useState(value);

  const editor = useEditor({
    extensions: [
      // StarterKit v3 already ships Link and Underline; disable them here
      // and re-register with custom config to avoid duplicate extension warnings
      // (duplicates silently drop commands like setColor/setLink in the chain).
      StarterKit.configure({
        heading: false,
        link: false,
        underline: false,
      } as any),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm max-w-none focus:outline-none p-3',
          'prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
          '[&_ul]:list-disc [&_ul]:pl-6',
          '[&_ol]:list-decimal [&_ol]:pl-6',
          // CRITICAL: Tailwind Typography forces explicit `color` on p/strong/a/li/h*/blockquote/code,
          // which overrides the inline `color` that TipTap's Color extension injects on <span>.
          // Force them to inherit so the user-picked color actually shows in the editor.
          'prose-p:text-inherit prose-headings:text-inherit prose-strong:text-inherit',
          'prose-em:text-inherit prose-a:text-inherit prose-li:text-inherit',
          'prose-blockquote:text-inherit prose-code:text-inherit',
        ),
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
      setSourceCode(html);
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
      setSourceCode(value);
    }
  }, [value, editor]);

  const handleSourceChange = (newSource: string) => {
    setSourceCode(newSource);
    if (editor) {
      editor.commands.setContent(newSource);
      onChange(newSource);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div className={cn('rounded-md border border-input bg-background', className)}>
      <EditorToolbar 
        editor={editor} 
        showSource={showSource} 
        onToggleSource={() => setShowSource(!showSource)} 
      />
      
      {showSource ? (
        <Textarea
          value={sourceCode}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="border-0 rounded-t-none focus-visible:ring-0 font-mono text-sm"
          style={{ minHeight }}
          placeholder="<p>Digite seu HTML aqui...</p>"
        />
      ) : (
        <EditorContent 
          editor={editor} 
          className="[&_.ProseMirror]:min-h-[150px] [&_.ProseMirror-focused]:outline-none"
        />
      )}
    </div>
  );
}
