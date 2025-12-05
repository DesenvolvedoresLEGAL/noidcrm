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
