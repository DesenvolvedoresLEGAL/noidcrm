import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks.
 * Uses DOMPurify to strip potentially malicious content while
 * preserving safe HTML formatting.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  
  return DOMPurify.sanitize(html, {
    // Allow common formatting tags
    ALLOWED_TAGS: [
      'p', 'br', 'b', 'i', 'u', 'strong', 'em', 'span', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li', 'a', 'blockquote', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'div', 'hr', 'sub', 'sup', 'mark'
    ],
    // Allow safe attributes
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'class', 'style',
      'colspan', 'rowspan', 'align', 'valign'
    ],
    // Force all links to open in new tab with noopener
    ADD_ATTR: ['target', 'rel'],
    // Hook to modify anchor tags
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
  });
}

let colorHookInstalled = false;


function installColorStripHook() {
  if (colorHookInstalled) return;
  colorHookInstalled = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node: any) => {
    if (!node.getAttribute) return;
    // Only active for calls that opt in via the marker attribute on the root call.
    if (!(DOMPurify as any).__stripColors) return;

    if (node.hasAttribute?.('color')) node.removeAttribute('color');
    if (node.hasAttribute?.('bgcolor')) node.removeAttribute('bgcolor');

    const style = node.getAttribute('style');
    if (style) {
      const cleaned = style
        .split(';')
        .filter((decl: string) => {
          const prop = decl.split(':')[0]?.trim().toLowerCase();
          return prop && !['color', 'background', 'background-color'].includes(prop);
        })
        .join(';')
        .trim();
      if (cleaned) node.setAttribute('style', cleaned);
      else node.removeAttribute('style');
    }
  });
}

/**
 * Sanitizes rich-text HTML for on-screen display in themed surfaces
 * (light/dark). Keeps all formatting but strips hardcoded text/background
 * colors coming from the rich text editor, so the content inherits the
 * theme's foreground color and stays readable in both modes.
 */
export function sanitizeRichTextForDisplay(html: string | null | undefined): string {
  if (!html) return '';
  installColorStripHook();
  (DOMPurify as any).__stripColors = true;
  try {
    return sanitizeHtml(html);
  } finally {
    (DOMPurify as any).__stripColors = false;
  }
}


/**
 * Sanitizes HTML and converts newlines to <br/> tags.
 * Useful for preserving line breaks in plain text content.
 */
export function sanitizeHtmlWithLineBreaks(html: string | null | undefined): string {
  if (!html) return '';
  
  // First sanitize, then convert remaining newlines to br tags
  const sanitized = sanitizeHtml(html);
  return sanitized.replace(/\n/g, '<br/>');
}
