import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderReadmeHtml } from '../src/build-index.mjs';

test('保留常规排版', () => {
  const html = renderReadmeHtml('# 标题\n\n**粗体** 与 `code`\n\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done');
  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<strong>粗体<\/strong>/);
  assert.match(html, /<table>/);
  assert.match(html, /<input[^>]*type="checkbox"/);
});

test('移除脚本、事件属性与危险标签', () => {
  const html = renderReadmeHtml(
    [
      '<script>alert(1)</script>',
      '<img src="https://a.test/x.png" onerror="alert(1)">',
      '<svg onload="alert(1)"><circle/></svg>',
      '<iframe src="https://evil.test"></iframe>',
      '<form action="https://evil.test"><input name="pw"></form>',
      '<meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<base href="https://evil.test/">',
      '<style>body{display:none}</style>',
      '<SCRIPT/x>alert(1)</SCRIPT>',
    ].join('\n\n'),
  );
  for (const pattern of [/<script/i, /onerror/i, /onload/i, /<svg/i, /<iframe/i, /<form/i, /<meta/i, /<base/i, /<style/i]) {
    assert.doesNotMatch(html, pattern);
  }
  assert.match(html, /<img src="https:\/\/a\.test\/x\.png"/);
});

test('只放行 http(s) 与 mailto 链接', () => {
  const html = renderReadmeHtml(
    [
      '[a](javascript:alert(1))',
      '[b](JaVaScRiPt:alert(1))',
      '[c](data:text/html;base64,PHNjcmlwdD4=)',
      '[d](vbscript:msgbox(1))',
      '<a href="&#106;avascript:alert(1)">e</a>',
      '[f](https://ok.test)',
      '[g](mailto:a@b.test)',
      '<img src="data:image/svg+xml;base64,AAAA">',
    ].join('\n\n'),
  );
  assert.doesNotMatch(html, /javascript:|vbscript:|data:/i);
  assert.match(html, /href="https:\/\/ok\.test"/);
  assert.match(html, /href="mailto:a@b\.test"/);
});

test('外链新窗口打开并带 noopener，站内锚点保持原样', () => {
  const html = renderReadmeHtml('[ext](https://ok.test) [top](#top)');
  assert.match(html, /<a href="https:\/\/ok\.test" target="_blank" rel="noopener noreferrer">ext<\/a>/);
  assert.match(html, /<a href="#top">top<\/a>/);
});

test('相对链接与图片解析到源仓库', () => {
  const source = { owner: 'o', repo: 'r', branch: 'main' };
  const html = renderReadmeHtml('[doc](docs/a.md) [root](/LICENSE)\n\n![shot](./img/a.png)', source);
  assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/docs\/a\.md"/);
  assert.match(html, /href="https:\/\/github\.com\/o\/r\/blob\/main\/LICENSE"/);
  assert.match(html, /src="https:\/\/raw\.githubusercontent\.com\/o\/r\/main\/img\/a\.png"/);
  assert.match(html, /loading="lazy"/);
});

test('没有默认分支信息时回退到 HEAD', () => {
  const html = renderReadmeHtml('![x](a.png)', { owner: 'o', repo: 'r' });
  assert.match(html, /raw\.githubusercontent\.com\/o\/r\/HEAD\/a\.png/);
});
