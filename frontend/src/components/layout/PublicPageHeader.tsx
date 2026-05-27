type PublicPageHeaderProps = {
  eyebrow?: string;
  eyebrowHighlight?: string;
  title: string;
  description?: string;
};

export function PublicPageHeader({
  eyebrow,
  eyebrowHighlight,
  title,
  description,
}: PublicPageHeaderProps) {
  return (
    <header className="kp-page-header mb-10 max-w-3xl">
      {eyebrow && (
        <p className="text-sm font-medium text-kp-muted">
          {eyebrow}
          {eyebrowHighlight && (
            <>
              {" "}
              / <span className="text-kp-blue-glow">{eyebrowHighlight}</span>
            </>
          )}
        </p>
      )}
      <h1 className="kp-page-title mt-2">{title}</h1>
      {description && <p className="kp-page-lead mt-3">{description}</p>}
    </header>
  );
}
