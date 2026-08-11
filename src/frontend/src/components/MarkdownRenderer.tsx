import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import { isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

// Pull the plain source text out of a highlighted code block so the copy
// button copies code, not the span markup the highlighter inserted.
function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return extractText(props.children);
  }
  return "";
}

// A code fence rendered the way Obsidian/Claude do it: dark rounded block with
// a small header showing the language and a copy button.
function CodeBlock({ language, children }: { language?: string; children: ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(children));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  };

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-white/10 bg-[#0d1117]">
      <div className="flex h-8 items-center justify-between border-b border-white/10 bg-white/[0.04] px-3">
        <span className="text-[11px] font-medium text-neutral-400">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="text-neutral-500 transition-colors hover:text-neutral-200"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3">
        <code className="font-mono text-[13px] leading-relaxed text-neutral-200">{children}</code>
      </pre>
    </div>
  );
}

const totoMarkdownComponents: Components = {
  // no big bold headers for a short Q&A answer — treat them as quiet eyebrows
  h1: ({ children }) => (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">{children}</p>
  ),
  h2: ({ children }) => (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-1">{children}</p>
  ),
  h3: ({ children }) => (
    <p className="text-sm font-medium text-foreground mt-3 mb-1">{children}</p>
  ),

  p: ({ children }) => (
    <p className="text-[15px] leading-relaxed text-foreground/90 mb-2">{children}</p>
  ),

  // accent color instead of just heavier weight — makes emphasis feel intentional
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),

  ul: ({ children }) => <ul className="space-y-1.5 my-2">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-2 text-[15px] text-foreground/90">
      <span className="text-accent mt-1.5 h-1 w-1 rounded-full bg-accent shrink-0" />
      <span>{children}</span>
    </li>
  ),

  // inline code stays a small pill. Fenced blocks are detected in the `pre`
  // component below — in react-markdown v10 hast nodes carry no `parent` link,
  // so a `code` element can't tell here whether it sits inside a <pre>.
  code: ({ children }) => (
    <code className="px-1.5 py-0.5 rounded-md bg-muted text-xs font-mono text-foreground/80">{children}</code>
  ),

  // A fenced block arrives as <pre><code …>…</code></pre>; the `pre` component
  // is handed the already-rendered <code> element, so swap it for a CodeBlock
  // (which owns its own <pre>). The element's `node` prop carries the hast node
  // — its tagName is what tells a fenced block apart from a raw <pre>. Anything
  // else (raw HTML from the model) falls through to default rendering.
  pre: ({ children }) => {
    if (!isValidElement(children)) return <>{children}</>;
    const child = children as ReactElement<{
      node?: { tagName?: string };
      className?: string;
      children?: ReactNode;
    }>;
    if (child.props.node?.tagName !== "code") return <>{children}</>;
    const language = /language-([\w-]+)/.exec(child.props.className ?? "")?.[1];
    return <CodeBlock language={language}>{child.props.children}</CodeBlock>;
  },

  // blockquote becomes a soft callout, not a browser-default left-border
  blockquote: ({ children }) => (
    <div className="rounded-lg bg-accent/5 border border-accent/10 px-3 py-2 my-2 text-sm text-foreground/80">
      {children}
    </div>
  ),

  // GFM tables (via remark-gfm)
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-[15px]">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
  th: ({ align, children }) => (
    <th align={align} className="px-3 py-2 text-left font-semibold text-foreground border border-border/60">{children}</th>
  ),
  td: ({ align, children }) => (
    <td align={align} className="px-3 py-2 border border-border/60 text-foreground/90">{children}</td>
  ),
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeHighlight, rehypeRaw]}
      remarkRehypeOptions={{ allowDangerousHtml: true }}
      components={totoMarkdownComponents}
    >
      {content}
    </ReactMarkdown>
  );
}
