import sanitizeHtml from 'sanitize-html';

/**
 * README 渲染结果的 HTML 白名单。详情页用 dangerouslySetInnerHTML 直接渲染，
 * 所以这里只放行排版所需的标签与属性，链接与图片只允许 http(s)（链接另允许 mailto）。
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'a', 'img', 'picture', 'source', 'em', 'strong', 'b', 'i', 'u', 's', 'del', 'ins', 'kbd', 'sub', 'sup', 'mark',
  'abbr', 'small', 'span', 'div', 'details', 'summary', 'input',
];

const OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ['href', 'title', 'rel', 'target'],
    img: ['src', 'alt', 'title', 'width', 'height', 'align'],
    source: ['srcset', 'media', 'type'],
    code: ['class'],
    th: ['align', 'colspan', 'rowspan'],
    td: ['align', 'colspan', 'rowspan'],
    p: ['align'],
    div: ['align'],
    input: ['type', 'checked', 'disabled'],
    details: ['open'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'], source: ['http', 'https'] },
  allowProtocolRelative: false,
  // 任务列表的复选框只保留 disabled checkbox，其余 input 一律丢弃
  exclusiveFilter: (frame) => frame.tag === 'input' && frame.attribs.type !== 'checkbox',
  // 白名单外的标签整体丢弃（连同内容），而不是只去掉标签壳
  disallowedTagsMode: 'discard',
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'template'],
};

export function sanitizeReadmeHtml(html) {
  return sanitizeHtml(String(html ?? ''), OPTIONS);
}
