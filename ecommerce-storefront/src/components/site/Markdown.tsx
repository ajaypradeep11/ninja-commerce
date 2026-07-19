import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Renders admin-authored Markdown (bold, italic, lists, headings, links, line
// breaks) as styled React elements. react-markdown does NOT render raw HTML by
// default, so this is XSS-safe even though descriptions are user/admin input.
// The same component is used in the admin preview so the two views match.
const COMPONENTS = {
  p: (props: React.HTMLProps<HTMLParagraphElement>) => (
    <p className="mb-3 last:mb-0" {...props} />
  ),
  strong: (props: React.HTMLProps<HTMLElement>) => (
    <strong className="font-semibold text-ink" {...props} />
  ),
  em: (props: React.HTMLProps<HTMLElement>) => <em className="italic" {...props} />,
  ul: (props: React.HTMLProps<HTMLUListElement>) => (
    <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: React.HTMLProps<HTMLOListElement>) => (
    <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />
  ),
  li: (props: React.HTMLProps<HTMLLIElement>) => <li {...props} />,
  h2: (props: React.HTMLProps<HTMLHeadingElement>) => (
    <h2 className="mt-4 mb-2 text-lg font-semibold text-ink" {...props} />
  ),
  h3: (props: React.HTMLProps<HTMLHeadingElement>) => (
    <h3 className="mt-3 mb-1 font-semibold text-ink" {...props} />
  ),
  a: (props: React.HTMLProps<HTMLAnchorElement>) => (
    <a
      className="text-brand underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: (props: React.HTMLProps<HTMLQuoteElement>) => (
    <blockquote className="border-l-2 border-ink/20 pl-3 italic" {...props} />
  ),
};

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
