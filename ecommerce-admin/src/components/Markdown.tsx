import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import remarkGfm from 'remark-gfm';

// Same Markdown rendering the storefront uses, so the admin preview matches what
// shoppers see. XSS-safe: react-markdown does not render raw HTML by default.
const COMPONENTS = {
  p: (props: React.ComponentPropsWithoutRef<'p'>) => (
    <p className="mb-2 last:mb-0" {...props} />
  ),
  strong: (props: React.ComponentPropsWithoutRef<'strong'>) => (
    <strong className="font-semibold" {...props} />
  ),
  em: (props: React.ComponentPropsWithoutRef<'em'>) => (
    <em className="italic" {...props} />
  ),
  ul: (props: React.ComponentPropsWithoutRef<'ul'>) => (
    <ul className="mb-2 list-disc space-y-1 pl-5" {...props} />
  ),
  ol: (props: React.ComponentPropsWithoutRef<'ol'>) => (
    <ol className="mb-2 list-decimal space-y-1 pl-5" {...props} />
  ),
  li: (props: React.ComponentPropsWithoutRef<'li'>) => <li {...props} />,
  h2: (props: React.ComponentPropsWithoutRef<'h2'>) => (
    <h2 className="mt-3 mb-1 text-base font-semibold" {...props} />
  ),
  h3: (props: React.ComponentPropsWithoutRef<'h3'>) => (
    <h3 className="mt-2 mb-1 text-sm font-semibold" {...props} />
  ),
  a: (props: React.ComponentPropsWithoutRef<'a'>) => (
    <a
      className="text-primary underline underline-offset-2"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  blockquote: (props: React.ComponentPropsWithoutRef<'blockquote'>) => (
    <blockquote className="border-l-2 pl-3 italic" {...props} />
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
