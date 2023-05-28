// original: https://github.com/denoland/deno-gfm/blob/main/mod.ts

import {
  emojify,
  gfmHeadingId,
  katex,
  Marked,
} from "https://deno.land/x/gfm/deps.ts";
import { CSS, KATEX_CSS } from "https://deno.land/x/gfm/style.js";
export { CSS, KATEX_CSS, Marked };

Marked.marked.use(gfmHeadingId());

/** Convert inline and block math to katex */
function mathify(markdown: string) {
  // Deal with block math
  markdown = markdown.replace(/\$\$\s(.+?)\s\$\$/gs, (match, p1) => {
    try {
      return katex.renderToString(p1.trim(), { displayMode: true });
    } catch (e) {
      console.warn(e);
      // Don't replace the math if there's an error
      return match;
    }
  });

  // Deal with inline math
  markdown = markdown.replace(/\s\$((?=\S).*?(?=\S))\$/g, (match, p1) => {
    try {
      return " " + katex.renderToString(p1, { displayMode: false });
    } catch (e) {
      console.warn(e);
      // Don't replace the math if there's an error
      return match;
    }
  });

  return markdown;
}

export interface RenderOptions {
  baseUrl?: string;
  mediaBaseUrl?: string;
  inline?: boolean;
  allowIframes?: boolean;
  allowMath?: boolean;
  disableHtmlSanitization?: boolean;
  marked_options?: unknown;
}

export function render(markdown: string, opts: RenderOptions = {}): string {
  opts.mediaBaseUrl ??= opts.baseUrl;
  markdown = emojify(markdown);
  markdown = mathify(markdown);

  const marked_opts = {
    baseUrl: opts.baseUrl,
    gfm: true,
    renderer: new Marked.Renderer(),
  };
  if ("marked_options" in opts) Object.assign(marked_opts, opts.marked_options);

  const html = opts.inline
    ? Marked.marked.parseInline(markdown, marked_opts)
    : Marked.marked.parse(markdown, marked_opts);

  return html;
}
