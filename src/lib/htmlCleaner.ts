/**
 * Client and server compatible chapter HTML sanitizer and relative asset rewriter.
 */
export function extractAndCleanChapterHtml(rawHtml: string, bookFolder: string, basePath = ''): string {
  let content = '';

  const sboIdx = rawHtml.indexOf('<div id="sbo-rt-content">');
  if (sboIdx !== -1) {
    let depth = 1;
    let idx = sboIdx + '<div id="sbo-rt-content">'.length;
    while (depth > 0 && idx < rawHtml.length) {
      const nextOpen = rawHtml.indexOf('<div', idx);
      const nextClose = rawHtml.indexOf('</div>', idx);
      if (nextClose === -1) break;
      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        idx = nextOpen + 4;
      } else {
        depth--;
        idx = nextClose + 6;
      }
    }
    content = rawHtml.substring(sboIdx, idx);
  } else {
    const chMatch = rawHtml.match(/<div class="chapter"[^>]*>[\s\S]*?<\/div>\s*<\/div>/i);
    if (chMatch) {
      content = chMatch[0];
    } else {
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      content = bodyMatch ? bodyMatch[1] : rawHtml;
    }
  }

  // Strip all scripts completely
  content = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Strip banners, headers, navigation widgets
  content = content.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');
  content = content.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
  content = content.replace(/<div[^>]+id=["']top-nav["'][^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<div[^>]+id=["']site-header["'][^>]*>[\s\S]*?<\/div>/gi, '');
  content = content.replace(/<app-ls-content\b[^<]*(?:(?!<\/app-ls-content>)<[^<]*)*<\/app-ls-content>/gi, '');

  // Normalize image asset paths
  const baseAssetUrl = `${basePath}/books/${encodeURIComponent(bookFolder)}/`;
  content = content.replace(/<img([^>]+)src=["'](\.[^"']+)["']/gi, (match, before, src) => {
    const cleanSrc = src.replace(/^\.\//, '');
    return `<img${before}src="${baseAssetUrl}${cleanSrc}"`;
  });
  content = content.replace(/<img([^>]+)src=["'](?!\/|https?:\/\/)([^"']+)["']/gi, (match, before, src) => {
    return `<img${before}src="${baseAssetUrl}${src}"`;
  });

  // Strip font-family overrides
  content = content.replace(/font-family\s*:\s*["']?(Title|Mono|Number|Fallback|Open Sans)["']?;?/gi, '');

  return content;
}
